import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { CameraService } from './camera.service';
import { DatabaseService } from '../database/database.service';
import { EggGateway } from '../websocket/egg.gateway';

@Controller()
export class CameraController {
  constructor(
    private readonly cameras: CameraService,
    private readonly db: DatabaseService,
    private readonly gateway: EggGateway,
  ) {}

  /**
   * GET /video_feed/:camId
   *
   * MJPEG multipart stream — identical to Flask's Response(generate_frames(...))
   * Browsers and most HTTP clients consume this as a live camera feed.
   */
  @Get('video_feed/:camId')
  videoFeed(@Param('camId', ParseIntPipe) camId: number, @Res() res: Response) {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send the latest frame immediately so the client doesn't wait
    const initial = this.cameras.getLatestFrame(camId);
    if (initial) {
      this.writeJpegPart(res, initial);
    }

    // Subscribe to future frames
    const unsubscribe = this.cameras.subscribeFrames(camId, (jpeg) => {
      if (res.writableEnded) {
        unsubscribe();
        return;
      }
      this.writeJpegPart(res, jpeg);
    });

    // Clean up when the client disconnects
    res.on('close', () => unsubscribe());
  }

  /**
   * GET /history
   *
   * Returns the full egg_data.json database as JSON.
   */
  @Get('history')
  getHistory() {
    return this.db.getAll();
  }

  /**
   * POST /reset/:camId
   *
   * Resets today's count for the given camera.
   * Flushes immediately to disk and broadcasts via WebSocket.
   */
  @Post('reset/:camId')
  @HttpCode(200)
  resetCounter(@Param('camId', ParseIntPipe) camId: number) {
    const totals = this.cameras.resetCounter(camId);
    this.gateway.broadcastUpdate(totals);
    return { status: 'success', cam_id: camId, totals };
  }

  // ─── Helper ──────────────────────────────────────────────────────────────

  private writeJpegPart(res: Response, jpeg: Buffer) {
    res.write(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`,
    );
    res.write(jpeg);
    res.write('\r\n');
  }
}