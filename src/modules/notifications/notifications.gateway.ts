import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtTokenService } from '../auth/services/jwt.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtTokenService.verifyToken(token);
      client.data.userId = payload.sub;
      client.join(this.getUserRoom(payload.sub));
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(): void {
    // no-op
  }

  @SubscribeMessage('notifications.ack')
  handleAck(@ConnectedSocket() client: Socket, @MessageBody() data: { notificationId: string }) {
    client.emit('notification.updated', {
      notificationId: data?.notificationId,
      status: 'acknowledged',
    });
  }

  emitCreated(userId: string, payload: Record<string, any>): void {
    this.server.to(this.getUserRoom(userId)).emit('notification.created', payload);
  }

  emitUnreadCountChanged(userId: string, unreadCount: number): void {
    this.server.to(this.getUserRoom(userId)).emit('notification.unread_count_changed', { unreadCount });
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
