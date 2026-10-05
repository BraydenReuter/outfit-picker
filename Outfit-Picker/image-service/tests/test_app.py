import io

from fastapi.testclient import TestClient
from PIL import Image

import app


def make_test_image() -> bytes:
    image = Image.new("RGB", (20, 20), "white")
    for x in range(6, 14):
        for y in range(4, 16):
            image.putpixel((x, y), (220, 30, 80))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_health() -> None:
    with TestClient(app.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_rejects_non_image_upload() -> None:
    with TestClient(app.app) as client:
        response = client.post(
            "/remove-background",
            files={"file": ("notes.txt", b"not an image", "text/plain")},
        )

    assert response.status_code == 415
    assert response.json()["detail"] == "Upload an image file."


def test_rejects_malformed_image() -> None:
    with TestClient(app.app) as client:
        response = client.post(
            "/remove-background",
            files={"file": ("broken.png", b"not an image", "image/png")},
        )

    assert response.status_code == 400
    assert "valid supported image" in response.json()["detail"]


def test_preserves_pixels_and_crops_using_soft_mask(monkeypatch) -> None:
    def fake_predict_mask(image: Image.Image) -> Image.Image:
        mask = Image.new("L", image.size, 0)
        mask.putpixel((5, 3), 128)
        for x in range(6, 14):
            for y in range(4, 16):
                mask.putpixel((x, y), 255)
        return mask

    monkeypatch.setattr(app, "predict_mask", fake_predict_mask)
    with TestClient(app.app) as client:
        response = client.post(
            "/remove-background",
            files={"file": ("shirt.png", make_test_image(), "image/png")},
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(response.content)) as output:
        assert output.mode == "RGBA"
        assert output.size == (9, 13)
        assert output.getpixel((0, 0))[3] == 128
        assert output.getpixel((1, 1))[:3] == (220, 30, 80)


def test_rejects_oversized_upload():
    with TestClient(app.app) as client:
        response = client.post('/remove-background', files={'file': ('large.png', b'x' * (app.MAX_UPLOAD_BYTES + 1), 'image/png')})
    assert response.status_code == 413


def test_rejects_pixel_limit_before_inference(monkeypatch):
    monkeypatch.setattr(app, 'MAX_IMAGE_PIXELS', 300)
    with TestClient(app.app) as client:
        response = client.post('/remove-background', files={'file': ('large.png', make_test_image(), 'image/png')})
    assert response.status_code == 400


def test_keeps_existing_transparency(monkeypatch):
    image = Image.new('RGBA', (4, 4), (220, 30, 80, 128))
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    monkeypatch.setattr(app, 'predict_mask', lambda image: Image.new('L', image.size, 255))
    result = Image.open(io.BytesIO(app.remove_background(buffer.getvalue())))
    assert result.getpixel((1, 1)) == (220, 30, 80, 128)


def test_honors_camera_orientation(monkeypatch):
    image = Image.new('RGB', (20, 10), 'blue')
    exif = Image.Exif()
    exif[274] = 6
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', exif=exif)
    monkeypatch.setattr(app, 'predict_mask', lambda image: Image.new('L', image.size, 255))
    result = Image.open(io.BytesIO(app.remove_background(buffer.getvalue())))
    assert result.size == (10, 20)


def test_reports_an_empty_mask(monkeypatch):
    monkeypatch.setattr(app, 'predict_mask', lambda image: Image.new('L', image.size, 0))
    with TestClient(app.app) as client:
        response = client.post('/remove-background', files={'file': ('shirt.png', make_test_image(), 'image/png')})
    assert response.status_code == 400
    assert 'No foreground' in response.json()['detail']


def test_reports_inference_failure_and_releases_slot(monkeypatch):
    def fail(_image):
        raise RuntimeError('out of memory')
    monkeypatch.setattr(app, 'predict_mask', fail)
    with TestClient(app.app) as client:
        response = client.post('/remove-background', files={'file': ('shirt.png', make_test_image(), 'image/png')})
    assert response.status_code == 503
    assert not app._inference_lock.locked()


def test_rejects_concurrent_processing():
    app._inference_lock.acquire()
    try:
        with TestClient(app.app) as client:
            response = client.post('/remove-background', files={'file': ('shirt.png', make_test_image(), 'image/png')})
        assert response.status_code == 429
    finally:
        app._inference_lock.release()
