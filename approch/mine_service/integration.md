# Frontend Integration

The main app already calls `src/api/mineClient.ts` through `inferMineFrame` and `inferMineBatch`.

## What changed

- `inferMineFrame()` now fetches the current monitor image URL, converts it to base64, and sends it to the local FastAPI service.
- `inferMineBatch()` is implemented as a simple parallel wrapper over `inferMineFrame()`.
- The monitor detail panel already refreshes from the currently selected frame, so the displayed summary stays aligned with the current image.

## Required runtime setup

Set the local service URL in the main app environment:

```bash
VITE_MINE_API_BASE_URL=http://127.0.0.1:8010
```

## Local service endpoints

- `GET /health`
- `POST /infer`
- `POST /infer/batch`

## Frontend flow

1. User opens a monitor detail panel.
2. The panel resolves the current image URL.
3. `inferMineFrame()` downloads the image and converts it to base64.
4. The local Mine FastAPI service runs YOLO inference.
5. The response is normalized and shown in the monitor panel.
