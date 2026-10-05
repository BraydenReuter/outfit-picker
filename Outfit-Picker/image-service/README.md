# Local image service

FastAPI runs the pinned BiRefNet model through PyTorch and Transformers. Express forwards uploads to this service and stores its PNG response. This service does not persist photos itself.

See the [root README](../README.md) for setup and configuration. Run from this folder:

```powershell
.venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

`GET /health` returns the selected device and whether the model is loaded. `POST /remove-background` accepts a multipart `file` containing JPEG, PNG, or WebP data. Limits are 10 MB and 25 megapixels. One inference runs at a time; concurrent processing receives 429. Invalid images receive 400/415, oversized uploads 413, and inference failures 503.

Tests run with `.venv/Scripts/python.exe -m pytest -q`. The test configuration skips startup model loading. Validation tests exercise the real HTTP/decoding path; successful mask tests stub inference. Test model quality separately using actual photos.

The [official BiRefNet model](https://huggingface.co/ZhengPeng7/BiRefNet) is a foreground/background model, not a clothing parser. Worn clothing photos can retain people. Hangers and other foreground objects can remain. Use single-garment photos and review the result.

The default revision is `e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4`. The model's custom implementation is loaded with `trust_remote_code=True`; the revision pin prevents silently switching to newer code. Weights are cached after the first download. Images stay local.
