import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class ChatRealtimeService {
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitNewMessage(channelId: string, message: unknown): void {
    this.server?.to(`channel:${channelId}`).emit('new_message', message);
  }

  emitMessageUpdated(channelId: string, message: unknown): void {
    this.server?.to(`channel:${channelId}`).emit('message_updated', message);
  }

  emitMessageDeleted(channelId: string, message: unknown): void {
    this.server?.to(`channel:${channelId}`).emit('message_deleted', message);
  }
}
