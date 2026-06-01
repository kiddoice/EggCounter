# Egg Counter — NestJS Backend

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NestJS (port 5000)                │
│                                                     │
│  CameraController  ──►  GET /video_feed/:id  (MJPEG)│
│                    ──►  GET /history          (JSON) │
│                    ──►  POST /reset/:id       (JSON) │
│                                                     │
│  EggGateway        ──►  ws://host:5000/ws           │
│                         broadcasts { type, totals } │
│                                                     │
│  DatabaseService   ──►  RAM DB + background saver   │
│  CameraService     ──►  polls sidecar @ 30fps       │
└───────────────────────────┬─────────────────────────┘
                            │ HTTP (localhost:5001)
┌───────────────────────────▼─────────────────────────┐
│            Python YOLO Sidecar (port 5001)          │
│                                                     │
│  GET  /raw_frame/:id  → JPEG bytes                  │
│  POST /infer          → { new_eggs, annotated_b64 } │
│  POST /reset/:id      → clears tracked IDs          │
│                                                     │
│  Uses: OpenCV, ultralytics YOLO, ByteTrack          │
└─────────────────────────────────────────────────────┘
```

## Why this split?

Node.js has no native bindings for OpenCV or YOLO (`ultralytics`).
Rather than port the entire CV pipeline, the Python sidecar handles only what
Python does uniquely well — camera capture and inference — while NestJS
owns the API, WebSocket broadcast, and database layer.

## Running

### 1. Start the Python sidecar
```bash
pip install flask ultralytics opencv-python
python yolo_sidecar.py
# Runs on http://localhost:5001
```

### 2. Start the NestJS backend
```bash
npm install
npm run start:dev
# Runs on http://localhost:5000
# WebSocket on ws://localhost:5000/ws
```

### Environment variables
| Variable          | Default                  | Description              |
|-------------------|--------------------------|--------------------------|
| `YOLO_SIDECAR_URL`| `http://localhost:5001`  | URL of the Python sidecar|

## API Reference

| Method | Path                | Description                        |
|--------|---------------------|------------------------------------|
| GET    | `/video_feed/:id`   | MJPEG stream for camera `id`       |
| GET    | `/history`          | Full egg count database (JSON)     |
| POST   | `/reset/:id`        | Reset today's count for camera `id`|

WebSocket message (sent to all clients on any count change or reset):
```json
{ "type": "update", "totals": { "cam_0": 12, "cam_1": 7, "cam_2": 0 } }
```

## File structure

```
src/
├── main.ts                        # Bootstrap
├── app.module.ts                  # Root module
├── camera/
│   ├── camera.service.ts          # Frame polling + inference orchestration
│   ├── camera.controller.ts       # HTTP routes (MJPEG, history, reset)
│   └── camera.module.ts
├── database/
│   ├── database.service.ts        # RAM DB + background disk saver
│   └── database.module.ts
├── inference/
│   └── inference.client.ts        # HTTP client for the Python sidecar
└── websocket/
    ├── egg.gateway.ts             # WebSocket broadcast
    └── websocket.module.ts
yolo_sidecar.py                    # Python OpenCV + YOLO sidecar
```