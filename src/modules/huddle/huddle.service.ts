import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
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
import { SubtitleClientService } from '../subtitle/subtitle-client.service';
import { SubtitleService } from '../subtitle/subtitle.service';

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
    @Inject(forwardRef(() => SubtitleClientService))
    private readonly subtitleClientService: SubtitleClientService,
    @Inject(forwardRef(() => SubtitleService))
    private readonly subtitleService: SubtitleService,
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
    await this.startSubtitleSession(call, livekitUrl);

    await this.sendHuddleSystemMessage({
      userId,
      userName,
      workspaceId: channel.workspaceId,
      channelId,
      content: 'Huddle started',
      metadata: {
        huddle: {
          event: 'started',
          callId: call.id,
          channelId,
          startedAt: call.startedAt.toISOString(),
          participantCount: 1,
        },
      },
    });

    this.logger.log(`Huddle created: call=${call.id} channel=${channelId} user=${userId}`);

    return {
      callId: call.id,
      livekitRoomName: roomName,
      livekitToken: token,
      livekitUrl,
      participantCount: 1,
    };
  }

  async getStatus(channelId: string, userId?: string): Promise<HuddleStatusResponse> {
    const channel = await this.channelRepo.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const call = await this.huddleCallRepo.findOne({
      where: { channelId, status: HuddleCallStatus.ACTIVE },
      relations: ['createdBy'],
    });
    if (!call) {
      return { active: false, call: null, isCurrentUserParticipant: false };
    }

    const participantCount = await this.participantRepo.count({
      where: { callId: call.id, status: HuddleParticipantStatus.ACTIVE },
    });

    const isCurrentUserParticipant = userId
      ? Boolean(
          await this.participantRepo.findOne({
            where: { callId: call.id, userId, status: HuddleParticipantStatus.ACTIVE },
          }),
        )
      : false;

    return {
      active: true,
      call: this.toCallResponse(call, participantCount),
      isCurrentUserParticipant,
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
      await this.startSubtitleSession(call, this.liveKitService.getWebSocketUrl());
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
    await this.startSubtitleSession(call, this.liveKitService.getWebSocketUrl());

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
      await this.stopSubtitleSession(call.id);
      const completedTranscript = await this.subtitleService.completeTranscriptForCall(call.id);

      const channel = await this.channelRepo.findOne({ where: { id: channelId } });
      if (channel) {
        await this.sendHuddleSystemMessage({
          userId,
          userName: 'System',
          workspaceId: channel.workspaceId,
          channelId,
          content: 'Huddle ended',
          metadata: {
            huddle: {
              event: 'ended',
              callId: call.id,
              channelId,
              startedAt: call.startedAt.toISOString(),
              endedAt: call.endedAt.toISOString(),
              transcriptEnabled: Boolean(completedTranscript),
              transcriptId: completedTranscript?.id || null,
              transcriptSegmentCount: completedTranscript?.segmentCount || 0,
            },
          },
        });
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

  private async startSubtitleSession(call: HuddleCall, livekitUrl: string): Promise<void> {
    try {
      const botToken = await this.liveKitService.generateSubscribeOnlyToken(
        call.livekitRoomName,
        `subtitle-bot:${call.id}`,
        'Subtitle Bot',
      );
      const started = await this.subtitleClientService.startSession({
        callId: call.id,
        channelId: call.channelId,
        livekitRoomName: call.livekitRoomName,
        livekitUrl,
        livekitToken: botToken,
        language: 'vi',
      });
      if (started) {
        this.logger.log(`Subtitle session started for huddle ${call.id}`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to start subtitle session for huddle ${call.id}: ${error?.message || error}`);
    }
  }

  private async stopSubtitleSession(callId: string): Promise<void> {
    try {
      await this.subtitleClientService.stopSession(callId);
      this.logger.log(`Subtitle session stopped for huddle ${callId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to stop subtitle session for huddle ${callId}: ${error?.message || error}`);
    }
  }

  private async sendHuddleSystemMessage(params: {
    userId: string;
    userName: string;
    workspaceId: string;
    channelId: string;
    content: 'Huddle started' | 'Huddle ended';
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      const user = await this.workspaceMemberRepo.manager.query(
        `SELECT email, avatar FROM users WHERE id = $1`,
        [params.userId],
      );

      const message = await this.chatClientService.sendMessage({
        userId: params.userId,
        userName: params.userName || user?.[0]?.email || 'System',
        userEmail: user?.[0]?.email || '',
        userAvatar: user?.[0]?.avatar || '',
        workspaceId: params.workspaceId,
        channelId: params.channelId,
        content: params.content,
        messageType: 'system',
        metadata: params.metadata,
      });

      const room = `channel:${params.channelId}`;
      if (this.chatGateway.server) {
        this.chatGateway.server.to(room).emit('new_message', message);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send huddle system message: ${err.message}`);
    }
  }
}
