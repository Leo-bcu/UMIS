# Mine Local Inference Service

This directory contains a standalone local inference API for the `yolo11n` model.

## Structure

- `app.py` — FastAPI application
- `model_loader.py` — lazy model loading and caching
- `schemas.py` — request/response schemas
- `requirements.txt` — service dependencies

## Model placement

By default, the service loads:

- `../yolo11n.pt` if it exists
- otherwise it fetches the official `yolo11n.pt` model by name

You can override it with:

- `MINE_MODEL_PATH=/absolute/path/to/yolo11n.pt`
- `MINE_MODEL_NAME=yolo11n.pt`

## Run

```bash
cd approch/mine_service
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

## Endpoints

- `GET /health`
- `POST /infer`

### POST /infer body

```json
{
  "image_path": "/absolute/path/to/image.png",
  "conf": 0.25,
  "iou": 0.45,
  "max_det": 300
}
```

Or send base64 image data:

```json
{
  "image_b64": "data:image/png;base64,..."
}
```
