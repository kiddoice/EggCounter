import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { DailyTotals } from '../database/database.service';

/**
 * EggGateway
 *
 * Equivalent to the Python:
 *   async with websockets.serve(...) as server:
 *       await asyncio.Future()
 *
 * And broadcast_update():
 *   for ws in connected_websockets:
 *       await ws.send(json.dumps({...}))
 *
 * NestJS exposes this on the same port as HTTP (/ws path).
 * Expo / React Native connects with:  new WebSocket('ws://HOST:5000/ws')
 */
@WebSocketGateway({ path: '/ws' })
export class EggGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EggGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.logger.log('WebSocket gateway initialized at /ws');
  }

  handleConnection(client: WebSocket) {
    this.logger.debug(`Client connected. Total: ${this.server.clients.size}`);
    // Send current date totals immediately on connect so the app isn't stale
    // (DatabaseService would need to be injected here if you want that — see note below)
    void client; // suppress unused-var warning
  }

  handleDisconnect() {
    this.logger.debug(`Client disconnected. Total: ${this.server.clients.size}`);
  }

  /**
   * Broadcast updated totals to all connected clients.
   * Called by CameraService whenever new eggs are counted or a reset happens.
   *
   * Message format (same as Python):
   *   { "type": "update", "totals": { "cam_0": 12, "cam_1": 7, "cam_2": 0 } }
   */
  broadcastUpdate(totals: DailyTotals) {
    if (!this.server) return;
    const message = JSON.stringify({ type: 'update', totals });
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}