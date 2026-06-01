"""
yolo_sidecar.py
───────────────
Minimal Flask sidecar that handles OpenCV camera capture and YOLO inference.
NestJS calls this over HTTP so it never needs to touch Python libraries.

Start with:  python yolo_sidecar.py
Runs on:     http://localhost:5001

Endpoints
─────────
GET  /raw_frame/<cam_id>   → raw JPEG bytes (grabbed from camera)
POST /infer                → { cam_id, frame_b64 } → { new_eggs, annotated_b64 }
"""

import cv2
import json
import base64
import numpy as np
import time
from flask import Flask, request, jsonify, Response
from threading import Lock
from ultralytics import YOLO

app = Flask(__name__)

CAM_IDS = [0, 1, 2]
LINE_Y = 240

# ── Load models (one dedicated tracker per camera, same as before) ──────────
print("Loading YOLO models…")
models = {}
for i in CAM_IDS:
    models[i] = YOLO('032926EGG.pt')

dummy = np.zeros((480, 640, 3), dtype=np.uint8)
for i in CAM_IDS:
    models[i].track(dummy, persist=True, verbose=False, tracker="bytetrack.yaml")
print("YOLO warm-up complete.")

# ── Open cameras ────────────────────────────────────────────────────────────
cameras = {}
cam_locks = {i: Lock() for i in CAM_IDS}
counted_ids = {i: set() for i in CAM_IDS}

for idx in CAM_IDS:
    cap = cv2.VideoCapture(idx)
    if cap.isOpened():
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cameras[idx] = cap
        print(f"Camera {idx} connected.")
    else:
        cameras[idx] = None
        print(f"Camera {idx} not found.")

# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/raw_frame/<int:cam_id>')
def raw_frame(cam_id):
    """Grab one JPEG frame from the camera and return raw bytes."""
    cap = cameras.get(cam_id)
    if cap is None:
        frame = offline_frame(cam_id)
    else:
        with cam_locks[cam_id]:
            ok, frame = cap.read()
        if not ok:
            frame = offline_frame(cam_id)

    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return Response(buf.tobytes(), mimetype='image/jpeg')


@app.route('/infer', methods=['POST'])
def infer():
    """
    Body: { cam_id: int, frame_b64: str }
    Returns: { new_eggs: int, annotated_b64: str }
    """
    data = request.get_json()
    cam_id = int(data['cam_id'])
    frame_bytes = base64.b64decode(data['frame_b64'])
    nparr = np.frombuffer(frame_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    roi = frame[LINE_Y:480, 0:640]
    results = models[cam_id].track(roi, persist=True, conf=0.75, verbose=False, tracker="bytetrack.yaml")

    annotated_roi = results[0].plot()
    frame[LINE_Y:480, 0:640] = annotated_roi
    cv2.line(frame, (0, LINE_Y), (640, LINE_Y), (0, 255, 255), 2)
    cv2.putText(frame, f"CAM {cam_id + 1} - LIVE", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    new_eggs = 0
    if results[0].boxes is not None and results[0].boxes.id is not None:
        ids = results[0].boxes.id.cpu().numpy().astype(int)
        for obj_id in ids:
            if obj_id not in counted_ids[cam_id]:
                counted_ids[cam_id].add(obj_id)
                new_eggs += 1

    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    annotated_b64 = base64.b64encode(buf.tobytes()).decode('utf-8')

    return jsonify({'new_eggs': new_eggs, 'annotated_b64': annotated_b64})


@app.route('/reset/<int:cam_id>', methods=['POST'])
def reset(cam_id):
    """Clear the counted_ids set so the tracker starts fresh."""
    counted_ids[cam_id].clear()
    return jsonify({'status': 'ok'})


def offline_frame(cam_id):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(frame, "NO SIGNAL", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
    cv2.putText(frame, f"CAM {cam_id + 1} OFFLINE", (220, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    return frame


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)