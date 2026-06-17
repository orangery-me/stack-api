import { ForbiddenException, forwardRef, Inject, Logger } from '@nestjs/common';
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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtTokenService } from '../auth/services/jwt.service';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { SubtitleService } from '../subtitle/subtitle.service';

interface JoinChannelPayload {
  channelId: string;
}

interface SubtitlePreferencePayload {
  enabled: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/huddle',
})
export class HuddleGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(HuddleGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @InjectRepository(ChannelEntity)
    private readonly channelRepo: Repository<ChannelEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepo: Repository<WorkspaceMemberEntity>,
    @Inject(forwardRef(() => SubtitleService))
    private readonly subtitleService: SubtitleService
  ) {}

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
      client.join(`user:${payload.sub}`);
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
  async handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: JoinChannelPayload) {
    if (!data.channelId) return;
    const userId = client.data.user?.userId;
    if (!userId || !(await this.canAccessChannel(data.channelId, userId))) {
      client.emit('error', { message: 'Forbidden' });
      throw new ForbiddenException('You are not a member of this channel');
    }

    const room = `channel:${data.channelId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);

    const subtitleState = await this.subtitleService.getCurrentStateForChannel(data.channelId);
    if (subtitleState) {
      client.emit('subtitle:state', subtitleState);
    }
  }

  @SubscribeMessage('huddle:unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: JoinChannelPayload) {
    if (!data.channelId) return;
    const room = `channel:${data.channelId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  @SubscribeMessage('subtitle:preference')
  async handleSubtitlePreference(@ConnectedSocket() client: Socket, @MessageBody() data: SubtitlePreferencePayload) {
    const userId = client.data.user?.userId;
    if (!userId || typeof data?.enabled !== 'boolean') return;
    await this.subtitleService.updatePreference(userId, data.enabled);
  }

  emitToChannel(channelId: string, event: string, data: any) {
    const room = `channel:${channelId}`;
    if (this.server) {
      this.server.to(room).emit(event, data);
      this.logger.debug(`Emitted ${event} to ${room}`);
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  private async canAccessChannel(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) return false;
    const member = await this.workspaceMemberRepo.findOne({
      where: { workspaceId: channel.workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });
    return Boolean(member);
  }
}
