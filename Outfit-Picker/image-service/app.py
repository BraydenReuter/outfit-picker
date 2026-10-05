from __future__ import annotations

import io
import os
from contextlib import asynccontextmanager
from threading import Lock
from typing import Annotated

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageChops, ImageFile, ImageOps, UnidentifiedImageError
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

ImageFile.LOAD_TRUNCATED_IMAGES = False

MODEL_ID = os.getenv("BIREFNET_MODEL_ID", "ZhengPeng7/BiRefNet")
MODEL_REVISION = os.getenv("BIREFNET_REVISION", "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4")
MODEL_INPUT_SIZE = (1024, 1024)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000

_transform = transforms.Compose(
    [
        transforms.Resize(MODEL_INPUT_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)
_model = None
_device = None
_model_lock = Lock()
_inference_lock = Lock()


def select_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model() -> tuple[object, torch.device]:
    global _model, _device
    with _model_lock:
        if _model is None:
            _device = select_device()
            _model = AutoModelForImageSegmentation.from_pretrained(
                MODEL_ID,
                trust_remote_code=True,
                revision=MODEL_REVISION,
            )
            _model.to(_device)
            if _device.type == "cuda":
                _model.half()
            else:
                _model.float()
            _model.eval()
    return _model, _device


def model_status() -> str:
    return str(_device or select_device())


def predict_mask(image: Image.Image) -> Image.Image:
    model, device = load_model()
    input_tensor = _transform(image.convert("RGB")).unsqueeze(0).to(device)
    if device.type == "cuda":
        input_tensor = input_tensor.half()

    with torch.inference_mode():
        prediction = model(input_tensor)[-1].sigmoid().cpu().squeeze()

    mask = transforms.ToPILImage()(prediction)
    return mask.resize(image.size, Image.Resampling.BILINEAR)


def remove_background(image_bytes: bytes) -> bytes:
    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Choose a JPEG, PNG, or WebP image.")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise ValueError("Images must be 25 megapixels or smaller.")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGBA")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("The uploaded file is not a valid supported image.") from error

    mask = predict_mask(image)
    output = image.copy()
    mask = ImageChops.multiply(mask, image.getchannel("A"))
    output.putalpha(mask)

    # Trim the empty edges without making the clothing outline jagged.
    bbox = mask.point(lambda value: 255 if value > 4 else 0).getbbox()
    if not bbox:
        raise ValueError("No foreground found. Try a clearer photo of one piece.")
    output = output.crop(bbox)

    buffer = io.BytesIO()
    output.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if os.getenv("BIREFNET_SKIP_MODEL", "0") != "1":
        load_model()
    yield


app = FastAPI(
    title="Outfit Picker Image Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "image-service", "device": model_status(), "modelLoaded": _model is not None}


@app.post("/remove-background", response_class=Response)
def remove_background_endpoint(file: Annotated[UploadFile, File(...)]) -> Response:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload an image file.")

    image_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB upload limit.")

    # One model call at a time keeps memory usage predictable on a laptop.
    if not _inference_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Another photo is being processed.")
    try:
        processed = remove_background(image_bytes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="BiRefNet inference failed.") from error
    finally:
        _inference_lock.release()

    return Response(content=processed, media_type="image/png")
