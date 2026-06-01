import { Injectable, Logger } from '@nestjs/common';

/**
 * InferenceClient
 *
 * This service talks to the Python YOLO sidecar process over HTTP.
 * The sidecar exposes a simple JSON API so Node.js never needs to touch
 * OpenCV or ultralytics directly.
 *
 * ┌─────────────────────┐      HTTP POST /infer      ┌──────────────────────┐
 * │   NestJS Backend    │ ─────────────────────────► │  Python YOLO Sidecar │
 * │  (this service)     │ ◄───────────────────────── │  (yolo_sidecar.py)   │
 * └─────────────────────┘   { new_eggs, jpeg_b64 }   └──────────────────────┘
 *
 * If you later export your model to ONNX you can replace this with
 * onnxruntime-node calls directly here — the rest of the app stays identical.
 */
@Injectable()
export class InferenceClient {
  private readonly logger = new Logger(InferenceClient.name);
  private readonly sidecarUrl = process.env.YOLO_SIDECAR_URL ?? 'http://localhost:5001';

  /**
   * Send a JPEG buffer to the sidecar for inference.
   * Returns the number of newly-seen eggs and the annotated JPEG.
   */
  async infer(
    camId: number,
    jpegBuffer: Buffer,
  ): Promise<{ newEggs: number; annotatedJpeg: Buffer }> {
    const response = await fetch(`${this.sidecarUrl}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cam_id: camId,
        frame_b64: jpegBuffer.toString('base64'),
      }),
    });

    if (!response.ok) {
      this.logger.error(`Sidecar error for cam ${camId}: ${response.status}`);
      return { newEggs: 0, annotatedJpeg: jpegBuffer };
    }

    const data = (await response.json()) as { new_eggs: number; annotated_b64: string };
    return {
      newEggs: data.new_eggs,
      annotatedJpeg: Buffer.from(data.annotated_b64, 'base64'),
    };
  }
}