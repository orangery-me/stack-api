import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HuddleCall } from './entities/huddle-call.entity';
import { HuddleParticipant } from './entities/huddle-participant.entity';
import { HuddleCallStatus, HuddleParticipantStatus } from './entities/huddle.enums';
import { LiveKitService } from './livekit.service';
import {
  HuddleJoinResponse,
  HuddleStatusResponse,
  HuddleCallResponse,
  TransferDeviceDto,
} from './dto/huddle.dto';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { ChatClientService } from '../chat-client/chat-client.service';
import { ChatGateway } from '../ws/chat.gateway';

@Injectable()
export class HuddleService {
  private readonly logger = new Logger(HuddleService.name);

  constructor(
    @InjectRepository(HuddleCall)
    private readonly huddleCallRepo: Repository<HuddleCall>,
    @InjectRepository(HuddleParticipant)
    private readonly participantRepo: Repository<HuddleParticipant>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepo: Repository<ChannelEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepo: Repository<WorkspaceMemberEntity>,
    private readonly liveKitService: LiveKitService,
    private readonly chatClientService: ChatClientService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async createHuddle(channelId: string, userId: string, userName: string): Promise<HuddleJoinResponse> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.workspaceMemberRepo.findOne({
      where: { workspaceId: channel.workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    const existingCall = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (existingCall) {
      throw new ConflictException('A huddle is already active in this channel');
    }

    const roomName = this.liveKitService.generateRoomName(channelId);
    const call = this.huddleCallRepo.create({
      channelId,
      createdById: userId,
      status: HuddleCallStatus.ACTIVE,
      livekitRoomName: roomName,
    });
    await this.huddleCallRepo.save(call);

    const participant = this.participantRepo.create({
      callId: call.id,
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      micEnabled: true,
      cameraEnabled: true,
      status: HuddleParticipantStatus.ACTIVE,
    });
    await this.participantRepo.save(participant);

    const token = await this.liveKitService.generateToken(roomName, userId, userName);
    const livekitUrl = this.liveKitService.getWebSocketUrl();

    // Broadcast system message
    const user = await this.workspaceMemberRepo.manager.query(
      `SELECT email, avatar FROM users WHERE id = $1`,
      [userId]
    );
    const userEmail = user?.[0]?.email || '';
    const userAvatar = user?.[0]?.avatar || '';

    try {
      const message = await this.chatClientService.sendMessage({
        userId,
        userName,
        userEmail,
        userAvatar,
        workspaceId: channel.workspaceId,
        channelId,
        content: 'Huddle started',
        messageType: 'system',
      });
      // Broadcast via WebSocket
      const room = `channel:${channelId}`;
      if (this.chatGateway.server) {
        this.chatGateway.server.to(room).emit('new_message', message);
      }
    } catch (err) {
      this.logger.error(`Failed to send huddle system message: ${err.message}`);
    }

    this.logger.log(`Huddle created: call=${call.id} channel=${channelId} user=${userId}`);

    return {
      callId: call.id,
      livekitRoomName: roomName,
      livekitToken: token,
      livekitUrl,
      participantCount: 1,
    };
  }

  async getStatus(channelId: string): Promise<HuddleStatusResponse> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
      relations: ['createdBy'],
    });
    if (!call) {
      return { active: false, call: null };
    }

    const participantCount = await this.participantRepo.count({
      where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
    });

    return {
      active: true,
      call: this.toCallResponse(call, participantCount),
    };
  }

  async joinHuddle(channelId: string, userId: string, userName: string, sessionId: string): Promise<HuddleJoinResponse> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const member = await this.workspaceMemberRepo.findOne({
      where: { workspaceId: channel.workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new ConflictException('No active huddle in this channel');
    }

    const existingParticipant = await this.participantRepo.findOne({
      where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
    });
    if (existingParticipant) {
      return {
        callId: call.id,
        livekitRoomName: call.livekitRoomName,
        livekitToken: await this.liveKitService.generateToken(call.livekitRoomName, userId, userName),
        livekitUrl: this.liveKitService.getWebSocketUrl(),
        participantCount: await this.participantRepo.count({
          where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
        }),
      };
    }

    const activeCount = await this.participantRepo.count({
      where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
    });
    if (activeCount >= 10) {
      throw new ConflictException('Huddle is full (maximum 10 participants)');
    }

    const participant = this.participantRepo.create({
      callId: call.id,
      userId,
      sessionId,
      micEnabled: true,
      cameraEnabled: true,
      status: HuddleParticipantStatus.ACTIVE,
    });
    await this.participantRepo.save(participant);

    const token = await this.liveKitService.generateToken(call.livekitRoomName, userId, userName);
    const participantCount = activeCount + 1;

    this.logger.log(`User ${userId} joined huddle ${call.id}`);

    return {
      callId: call.id,
      livekitRoomName: call.livekitRoomName,
      livekitToken: token,
      livekitUrl: this.liveKitService.getWebSocketUrl(),
      participantCount,
    };
  }

  async leaveHuddle(channelId: string, userId: string): Promise<{ left: boolean; callEnded: boolean }> {
    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new NotFoundException('No active huddle in this channel');
    }

    const participant = await this.participantRepo.findOne({
      where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
    });
    if (!participant) {
      throw new ConflictException('You are not currently in this huddle');
    }

    participant.status = HuddleParticipantStatus.LEFT;
    participant.leftAt = new Date();
    await this.participantRepo.save(participant);

    const remainingActive = await this.participantRepo.count({
      where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
    });

    let callEnded = false;
    if (remainingActive === 0) {
      call.status = HuddleCallStatus.ENDED;
      call.endedAt = new Date();
      await this.huddleCallRepo.save(call);
      callEnded = true;
      this.logger.log(`Huddle ${call.id} ended (last participant left)`);

      // Broadcast system message for Huddle ended
      const user = await this.workspaceMemberRepo.manager.query(
        `SELECT email, avatar FROM users WHERE id = $1`,
        [userId]
      );
      const channel = await this.channelRepo.findOne({ where: { id: channelId } });
      try {
        const message = await this.chatClientService.sendMessage({
          userId,
          userName: user?.[0]?.email || 'Unknown',
          userEmail: user?.[0]?.email || '',
          userAvatar: user?.[0]?.avatar || '',
          workspaceId: channel?.workspaceId || '',
          channelId,
          content: 'Huddle ended',
          messageType: 'system',
        });
        
        const room = `channel:${channelId}`;
        if (this.chatGateway.server) {
          this.chatGateway.server.to(room).emit('new_message', message);
        }
      } catch (err) {
        this.logger.error(`Failed to send huddle ended system message: ${err.message}`);
      }
    }

    return { left: true, callEnded };
  }

  async updateState(
    channelId: string,
    userId: string,
    micEnabled?: boolean,
    cameraEnabled?: boolean,
  ): Promise<{ updated: boolean; micEnabled: boolean; cameraEnabled: boolean }> {
    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new NotFoundException('No active huddle in this channel');
    }

    const participant = await this.participantRepo.findOne({
      where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
    });
    if (!participant) {
      throw new ConflictException('You are not currently in this huddle');
    }

    if (micEnabled !== undefined) {
      participant.micEnabled = micEnabled;
    }
    if (cameraEnabled !== undefined) {
      participant.cameraEnabled = cameraEnabled;
    }
    await this.participantRepo.save(participant);

    return {
      updated: true,
      micEnabled: participant.micEnabled,
      cameraEnabled: participant.cameraEnabled,
    };
  }

  async transferDevice(
    channelId: string,
    userId: string,
    userName: string,
    dto: TransferDeviceDto,
  ): Promise<HuddleJoinResponse | { transferred: boolean; message: string }> {
    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new NotFoundException('No active huddle in this channel');
    }

    if (!dto.confirm) {
      await this.participantRepo.delete({
        callId: call.id,
        sessionId: dto.pendingSessionId,
        status: HuddleParticipantStatus.ACTIVE,
      });
      return { transferred: false, message: 'Giữ nguyên thiết bị hiện tại.' };
    }

    const existingActive = await this.participantRepo.findOne({
      where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
    });
    if (existingActive) {
      existingActive.status = HuddleParticipantStatus.LEFT;
      existingActive.leftAt = new Date();
      await this.participantRepo.save(existingActive);
    }

    const pendingParticipant = await this.participantRepo.findOne({
      where: { callId: call.id, sessionId: dto.pendingSessionId },
    });
    if (pendingParticipant) {
      pendingParticipant.status = HuddleParticipantStatus.ACTIVE;
      pendingParticipant.joinedAt = new Date();
      await this.participantRepo.save(pendingParticipant);
    }

    const participantCount = await this.participantRepo.count({
      where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
    });

    return {
      callId: call.id,
      livekitRoomName: call.livekitRoomName,
      livekitToken: await this.liveKitService.generateToken(call.livekitRoomName, userId, userName),
      livekitUrl: this.liveKitService.getWebSocketUrl(),
      participantCount,
    };
  }

  async refreshToken(channelId: string, userId: string, userName: string): Promise<{ livekitToken: string; expiresIn: number }> {
    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
    });
    if (!call) {
      throw new NotFoundException('No active huddle in this channel');
    }

    const participant = await this.participantRepo.findOne({
      where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
    });
    if (!participant) {
      throw new ForbiddenException('You are not in this huddle');
    }

    const token = await this.liveKitService.generateToken(call.livekitRoomName, userId, userName);
    return { livekitToken: token, expiresIn: 600 };
  }

  private toCallResponse(call: HuddleCall, participantCount: number): HuddleCallResponse {
    return {
      id: call.id,
      channelId: call.channelId,
      status: call.status,
      participantCount,
      startedAt: call.startedAt,
      createdBy: {
        id: call.createdBy?.id || call.createdById,
        displayName: (call.createdBy as any)?.name || 'Unknown',
        avatarUrl: (call.createdBy as any)?.avatar,
      },
    };
  }
}
