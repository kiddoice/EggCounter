import os
# Force FFmpeg to use TCP for RTSP streams before initializing OpenCV
# THIS MUST REMAIN AT THE VERY TOP
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

import cv2
import asyncio
import websockets
import json
import datetime
import time
import numpy as np
import copy
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from threading import Thread, Lock
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
CAM_STREAMS = {
    0: "rtsp://admin:JNJbuilt1%21@192.168.100.200:554/Streaming/Channels/102"
}

CAM_IDS = list(CAM_STREAMS.keys())
DB_FILE = 'egg_data.json'

try:
    print("=========================================")
    print("LOADING AI MODELS (1 Dedicated Tracker per Camera)...")
    models = {}
    for i in CAM_IDS:
        models[i] = YOLO('032926EGG.pt')
        
    print("WARMING UP MODELS (Preventing Thread Crashes)...")
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    for i in CAM_IDS:
        models[i].track(dummy_frame, persist=True, verbose=False, tracker="bytetrack.yaml")
    print("YOLO WARM-UP COMPLETE.")
    print("=========================================")
except Exception as e:
    print(f"WARNING: YOLO model error: {e}")

# --- RAM DATABASE INIT ---
ram_db_lock = Lock()
def load_initial_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r') as f:
            try: return json.load(f)
            except: return {}
    return {}

ram_db = load_initial_db()

# --- THE BACKGROUND DISK SAVER ---
def disk_saver_worker():
    while True:
        time.sleep(3)
        with ram_db_lock:
            db_copy = copy.deepcopy(ram_db)
        try:
            with open(DB_FILE, 'w') as f:
                json.dump(db_copy, f, indent=4)
        except Exception as e:
            print(f"Background save error: {e}")

# --- FAST RTSP THREAD CLASS ---
# This continuously drains the network buffer so OpenCV never drops packets
class FastRTSP:
    def __init__(self, url):
        self.stream = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        self.stream.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.grabbed, self.frame = self.stream.read()
        self.stopped = False
        self.lock = Lock()
        
        # Start reading frames in a separate background thread immediately
        Thread(target=self.update, daemon=True).start()

    def update(self):
        while not self.stopped:
            if not self.stream.isOpened():
                time.sleep(0.1)
                continue
            
            # Continuously pull data so packets never drop
            grabbed, frame = self.stream.read()
            with self.lock:
                self.grabbed = grabbed
                self.frame = frame

    def read(self):
        with self.lock:
            # Return a copy to prevent YOLO from altering the thread's raw frame memory
            if self.frame is not None:
                return self.grabbed, self.frame.copy()
            return self.grabbed, None

    def stop(self):
        self.stopped = True
        self.stream.release()

# --- HARDWARE INITIALIZATION ---
cameras = {}
latest_frames = {i: None for i in CAM_IDS}
frame_locks = {i: Lock() for i in CAM_IDS}
counted_ids = {i: set() for i in CAM_IDS}
connected_websockets = set()

def create_offline_frame(cam_id):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(frame, "NO SIGNAL", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
    cv2.putText(frame, f"CAM {cam_id + 1} OFFLINE", (220, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    return frame

for idx in CAM_IDS:
    rtsp_url = CAM_STREAMS[idx]
    print(f"Starting Fast Thread for CAM {idx} RTSP stream...")
    
    # Initialize our new threaded reader
    cam_stream = FastRTSP(rtsp_url)
    
    # Brief pause to let the thread grab the first frame
    time.sleep(1.0) 
    
    if cam_stream.grabbed:
        cameras[idx] = cam_stream
        print(f"SUCCESS: Camera {idx} connected.")
    else:
        print(f"WARNING: Camera {idx} stream could not be opened.")
        cameras[idx] = None
        latest_frames[idx] = create_offline_frame(idx)

# --- PROCESSING LOGIC ---
def inference_worker(cam_id):
    stream = cameras[cam_id]
    if stream is None: return 
    
    model = models[cam_id]
    line_y = 240 
    
    while True:
        success, frame = stream.read()
        
        if not success or frame is None: 
            time.sleep(0.01) # Prevent CPU maxing if stream briefly stutters
            continue

        # Resize the stream down to 640x480 to maintain high FPS for your model
        frame = cv2.resize(frame, (640, 480))

        roi = frame[line_y:480, 0:640]
        results = model.track(roi, persist=True, conf=0.75, verbose=False, tracker="bytetrack.yaml")

        annotated_roi = results[0].plot()
        frame[line_y:480, 0:640] = annotated_roi

        cv2.line(frame, (0, line_y), (640, line_y), (0, 255, 255), 2)
        cv2.putText(frame, f"CAM {cam_id + 1} - LIVE", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        if results[0].boxes is not None and results[0].boxes.id is not None:
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            
            new_eggs_this_frame = 0
            for obj_id in ids:
                if obj_id not in counted_ids[cam_id]:
                    counted_ids[cam_id].add(obj_id)
                    new_eggs_this_frame += 1
            
            if new_eggs_this_frame > 0:
                today = datetime.datetime.now().strftime('%Y-%m-%d')
                key = f"cam_{cam_id}"
                
                with ram_db_lock:
                    if today not in ram_db:
                        ram_db[today] = {f"cam_{i}": 0 for i in CAM_IDS}
                    
                    ram_db[today][key] = ram_db[today].get(key, 0) + new_eggs_this_frame
                    current_totals = ram_db[today].copy()
                
                if main_loop:
                    asyncio.run_coroutine_threadsafe(broadcast_update(current_totals), main_loop)

        with frame_locks[cam_id]:
            latest_frames[cam_id] = frame

# --- ROUTES ---
@app.route('/video_feed/<int:cam_id>')
def video_feed(cam_id):
    return Response(generate_frames(cam_id), mimetype='multipart/x-mixed-replace; boundary=frame')

def generate_frames(cam_id):
    if cam_id not in frame_locks: return
        
    while True:
        with frame_locks[cam_id]:
            frame = latest_frames[cam_id]
            
        if frame is None: 
            time.sleep(0.1)
            continue
            
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.03)

@app.route('/history', methods=['GET'])
def get_history(): 
    with ram_db_lock:
        return jsonify(ram_db)

@app.route('/reset/<int:cam_id>', methods=['POST'])
def reset_counter(cam_id):
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    key = f"cam_{cam_id}"

    with ram_db_lock:
        if today not in ram_db: 
            ram_db[today] = {f"cam_{i}": 0 for i in CAM_IDS}
        ram_db[today][key] = 0
        current_totals = ram_db[today].copy()
        
        with open(DB_FILE, 'w') as f:
            json.dump(ram_db, f, indent=4)

    if cam_id in counted_ids:
        counted_ids[cam_id].clear()

    if main_loop:
        asyncio.run_coroutine_threadsafe(broadcast_update(current_totals), main_loop)

    return jsonify({"status": "success", "cam_id": cam_id, "totals": current_totals})

async def broadcast_update(data):
    if connected_websockets:
        msg = json.dumps({"type": "update", "totals": data})
        for ws in list(connected_websockets):
            try: await ws.send(msg)
            except: connected_websockets.remove(ws)

async def main():
    global main_loop
    main_loop = asyncio.get_running_loop()
    
    Thread(target=disk_saver_worker, daemon=True).start()
    
    for i in CAM_IDS: 
        Thread(target=inference_worker, args=(i,), daemon=True).start()
        
    Thread(target=lambda: app.run(host='0.0.0.0', port=5000, use_reloader=False, threaded=True), daemon=True).start()
    
    async with websockets.serve(lambda ws: connected_websockets.add(ws) or ws.wait_closed(), "0.0.0.0", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    main_loop = None
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] Ctrl+C detected. Executing hard shutdown...")
        # Cleanly stop the threads if possible
        for i in CAM_IDS:
            if cameras[i] is not None:
                cameras[i].stop()
        os._exit(0)