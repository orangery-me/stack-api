import {
  Logger,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtTokenService } from '../auth/services/jwt.service';

interface JoinChannelPayload {
  channelId: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/huddle',
})
export class HuddleGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(HuddleGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtTokenService: JwtTokenService) {}

  afterInit() {
    this.logger.log('Huddle WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn(`Client ${client.id} disconnected: no token`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtTokenService.verifyToken(token);
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
      };
      this.logger.log(`Client ${client.id} connected, user: ${payload.sub}`);
    } catch (error: any) {
      this.logger.error(`Token verification failed for client ${client.id}: ${error?.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('huddle:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChannelPayload,
  ) {
    if (!data.channelId) return;
    const room = `channel:${data.channelId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  @SubscribeMessage('huddle:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChannelPayload,
  ) {
    if (!data.channelId) return;
    const room = `channel:${data.channelId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  emitToChannel(channelId: string, event: string, data: any) {
    const room = `channel:${channelId}`;
    if (this.server) {
      this.server.to(room).emit(event, data);
      this.logger.debug(`Emitted ${event} to ${room}`);
    }
  }
}
