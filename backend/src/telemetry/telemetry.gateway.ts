import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * SYS-06 — Dispatch realtime gateway.
 * JWT-verified socket.io namespace for the live map. Dispatchers join `dispatch` (all)
 * and/or `dispatch:{projectId}`. TelemetryService.ingest() calls emitDrivers() after a
 * ping batch advances shift heads, so the map moves live instead of polling every 5s.
 */
@Injectable()
@WebSocketGateway({ namespace: '/dispatch', cors: { origin: ORIGIN, credentials: true } })
export class TelemetryGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth as any)?.token ||
        String(client.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      const payload: any = await this.jwt.verifyAsync(raw, { secret: process.env.JWT_SECRET });
      if (!payload?.sub) throw new Error('no subject');
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('dispatch:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() projectId?: string) {
    client.join('dispatch');
    if (projectId) client.join(`dispatch:${projectId}`);
    return { ok: true };
  }

  /** Push the freshest driver positions. Emits to the all-dispatch room and the project room. */
  emitDrivers(drivers: any[], projectId?: string | null) {
    this.server?.to('dispatch').emit('drivers', drivers);
    if (projectId) this.server?.to(`dispatch:${projectId}`).emit('drivers', drivers);
  }
}
