import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * SYS-09 — Comms realtime gateway.
 * JWT-verified socket.io namespace. Every connection joins its own `user:{id}` room
 * (for inbox/unread pushes); clients join `channel:{id}` rooms for the open thread.
 * MessagesService calls the emit* helpers so sends/edits/deletes push live — the REST
 * API stays the source of truth, this just removes the poll latency.
 */
@Injectable()
@WebSocketGateway({ namespace: '/comms', cors: { origin: ORIGIN, credentials: true } })
export class CommsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth as any)?.token ||
        String(client.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      const payload: any = await this.jwt.verifyAsync(raw, { secret: process.env.JWT_SECRET });
      const userId = payload?.sub;
      if (!userId) throw new Error('no subject');
      client.data.userId = userId;
      client.join(`user:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('channel:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() channelId: string) {
    if (channelId) client.join(`channel:${channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('channel:leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() channelId: string) {
    if (channelId) client.leave(`channel:${channelId}`);
    return { ok: true };
  }

  // ── emit helpers (called by MessagesService) ────────────────────────────────
  emitMessage(channelId: string, message: any) {
    this.server?.to(`channel:${channelId}`).emit('message', message);
  }
  emitMessageUpdate(channelId: string, message: any) {
    this.server?.to(`channel:${channelId}`).emit('message:update', message);
  }
  /** Nudge each member's inbox so the channel list reorders / bumps unread without polling. */
  emitInbox(userIds: string[], payload: any) {
    for (const id of userIds || []) this.server?.to(`user:${id}`).emit('inbox', payload);
  }
  /** Ping the specific people named in an @mention. */
  emitMention(userIds: string[], payload: any) {
    for (const id of userIds || []) this.server?.to(`user:${id}`).emit('mention', payload);
  }
}
