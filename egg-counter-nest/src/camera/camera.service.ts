import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService, DailyTotals } from '../database/database.service';
import { InferenceClient } from '../inference/inference.client';
import { EggGateway } from '../websocket/egg.gateway';

const CAM_IDS = [0, 1, 2];
const POLL_INTERVAL_MS = 33; // ~30 fps

// Node.js has no built-in USB camera capture.
// We use the Python sidecar to supply raw JPEG frames via its /frame/:id endpoint.
// If you prefer a native solution, replace fetchRawFrame() with node-uvc or v4l2camera.

@Injectable()
export class CameraService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CameraService.name);

  /** Latest annotated JPEG per camera — served by the MJPEG streaming route */
  private latestFrames: Map<number, Buffer> = new Map();

  /** SSE / MJPEG subscriber callbacks per camera */
  private frameSubscribers: Map<number, Set<(jpeg: Buffer) => void>> = new Map();

  private pollTimers: Map<number, NodeJS.Timeout> = new Map();

  private readonly sidecarUrl = process.env.YOLO_SIDECAR_URL ?? 'http://localhost:5001';

  constructor(
    private readonly db: DatabaseService,
    private readonly inference: InferenceClient,
    @Inject(forwardRef(() => EggGateway))
    private readonly gateway: EggGateway,
  ) {
    for (const id of CAM_IDS) {
      this.frameSubscribers.set(id, new Set());
      this.latestFrames.set(id, this.buildOfflineFrame(id));
    }
  }

  onModuleInit() {
    for (const id of CAM_IDS) {
      this.startPolling(id);
    }
    this.logger.log(`Camera polling started for cams: ${CAM_IDS.join(', ')}`);
  }

  onModuleDestroy() {
    for (const timer of this.pollTimers.values()) clearInterval(timer);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  getLatestFrame(camId: number): Buffer | null {
    return this.latestFrames.get(camId) ?? null;
  }

  /** Register a callback to receive new frames (used by MJPEG streaming). */
  subscribeFrames(camId: number, cb: (jpeg: Buffer) => void) {
    this.frameSubscribers.get(camId)?.add(cb);
    return () => this.frameSubscribers.get(camId)?.delete(cb);
  }

  resetCounter(camId: number): DailyTotals {
    return this.db.reset(camId);
  }

  // ─── Per-camera polling loop ──────────────────────────────────────────────

  private startPolling(camId: number) {
    // We poll the Python sidecar for the latest annotated frame + new egg count.
    // This replaces the Python inference_worker thread entirely.
    const timer = setInterval(() => this.poll(camId), POLL_INTERVAL_MS);
    this.pollTimers.set(camId, timer);
  }

  private async poll(camId: number) {
    try {
      // 1. Fetch a raw JPEG frame from the sidecar's camera endpoint
      const rawJpeg = await this.fetchRawFrame(camId);
      if (!rawJpeg) return;

      // 2. Run YOLO inference via the sidecar
      const { newEggs, annotatedJpeg } = await this.inference.infer(camId, rawJpeg);

      // 3. Store annotated frame for MJPEG streaming
      this.latestFrames.set(camId, annotatedJpeg);

      // 4. Notify all MJPEG stream subscribers
      for (const cb of this.frameSubscribers.get(camId) ?? []) {
        cb(annotatedJpeg);
      }

      // 5. Update DB and broadcast WebSocket event if eggs were found
      if (newEggs > 0) {
        const totals = this.db.increment(camId, newEggs);
        this.gateway.broadcastUpdate(totals);
      }
    } catch {
      // Sidecar offline → silently keep showing the last frame
    }
  }

  /**
   * Fetches a raw JPEG from the Python sidecar's /raw_frame/:camId endpoint.
   * The sidecar handles OpenCV capture; Node.js just gets the JPEG bytes back.
   */
  private async fetchRawFrame(camId: number): Promise<Buffer | null> {
    const res = await fetch(`${this.sidecarUrl}/raw_frame/${camId}`);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // ─── Offline placeholder frame (plain black JPEG) ─────────────────────────

  private buildOfflineFrame(camId: number): Buffer {
    // Minimal valid 1×1 black JPEG — the frontend should show "NO SIGNAL" text
    // For a proper offline frame, generate one in the Python sidecar at startup.
    const tinyBlackJpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
        'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
        'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
        'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
        'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA' +
        '/9oADAMBAAIRAxEAPwCwABmX/9k=',
      'base64',
    );
    void camId;
    return tinyBlackJpeg;
  }
}