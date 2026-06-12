import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Repository } from 'typeorm';
import { ChannelEntity, ChannelMemberEntity, ChannelRoleEntity, WorkspaceMemberEntity, UserEntity } from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { ChatClientService } from '../chat-client/chat-client.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UsersService } from '@UsersModule/users.service';
import { ProfileDto } from '@UsersModule/dto/profile.dto';
import { ResponseItem } from '@app/common/dtos/response-item.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';
import { ChannelPermissions } from '../../policy/permission.service';
import { ChannelRoleName } from '../../policy/channel/channel-permission.config';
import { ChatRealtimeService } from './chat-realtime.service';
import { StorageService } from '../storage/storage.service';
import { isAllowedUploadFileType, resolveMaxUploadMb } from '../storage/file-upload.options';

const CHAT_EXTRA_UPLOAD_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
]);

export interface SendMessageResult {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar: string | null;
  content: string;
  messageType: string;
  createdAt: string;
  channelId: string;
  metadata?: Record<string, any>;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
}

export interface GetMessagesResult {
  messages: SendMessageResult[];
  hasMore: boolean;
  page: number;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(ChannelRoleEntity)
    private readonly channelRoleRepository: Repository<ChannelRoleEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly chatClientService: ChatClientService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly channelPermissionResolver: ChannelPermissionResolver,
    private readonly chatRealtimeService: ChatRealtimeService,
    private readonly storageService: StorageService
  ) {}

  /**
   * Verify that user is a member of the channel
   */
  async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<{ workspaceMember: WorkspaceMemberEntity; channelMember: ChannelMemberEntity; channel: ChannelEntity }> {
    // Verify workspace membership
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!workspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Verify channel exists and belongs to workspace
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Verify channel membership
    const channelMember = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: workspaceMember.id },
    });

    if (!channelMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    return { workspaceMember, channelMember, channel };
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    dto: SendMessageDto
  ): Promise<SendMessageResult> {
    // 1. Verify channel membership and dynamic post permissions
    const { channelMember, channel } = await this.verifyChannelMembership(workspaceId, channelId, userId);
    const isSystemMessage = (dto.messageType || 'text') === 'system';
    if (!isSystemMessage) {
      await this.enforceChannelAction(channelMember, 'channel:post_message', channel.settings);
    }

    // 2. Get user profile
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3. Call gRPC to stack-chat with full context
    const result = await this.chatClientService.sendMessage({
      userId,
      userName: user.name,
      userEmail: user.email,
      userAvatar: user.avatar || '',
      workspaceId,
      channelId,
      content: dto.content,
      messageType: dto.messageType || 'text',
      metadata: dto.metadata,
    });

    const recipientUserIds = await this.resolveRecipientUserIds(channelId, userId);
    if (!isSystemMessage && recipientUserIds.length > 0) {
      await this.notificationsService.publishEvent({
        type: 'conversation.reply',
        workspaceId,
        actorUserId: userId,
        entityType: 'channel_message',
        entityId: result.id,
        payload: {
          recipientUserIds,
          actorName: user.name,
          preview: dto.content?.slice(0, 180) || 'New message',
          channelId,
          targetUrl: `/workspaces/${workspaceId}`,
        },
      });
    }

    await this.publishMentionNotifications({
      workspaceId,
      channelId,
      actorUserId: userId,
      actorName: user.name,
      messageId: result.id,
      content: dto.content,
      mentions: dto.metadata?.mentions,
    });

    return {
      id: result.id,
      senderId: result.senderId,
      senderName: result.senderName,
      senderEmail: result.senderEmail,
      senderAvatar: result.senderAvatar || null,
      content: result.content,
      messageType: result.messageType || dto.messageType || 'text',
      createdAt: result.createdAt,
      channelId: result.channelId,
      metadata: result.metadata as Record<string, any> | undefined,
      isPinned: result.isPinned || false,
      pinnedAt: result.pinnedAt || null,
      pinnedBy: result.pinnedBy || null,
    };
  }

  async uploadAttachment(
    workspaceId: string,
    channelId: string,
    userId: string,
    file: Express.Multer.File,
    kind: 'file' | 'image' | 'video' | 'audio' = 'file'
  ): Promise<Record<string, unknown>> {
    this.assertChatAttachmentUpload(file);
    const { channelMember, channel } = await this.verifyChannelMembership(workspaceId, channelId, userId);
    await this.enforceChannelAction(channelMember, 'channel:post_message', channel.settings);

    const uploaded = await this.storageService.uploadFile({
      buffer: file.buffer,
      originalFilename: file.originalname || 'file',
      mimeType: file.mimetype,
      directory: ['workspaces', workspaceId, 'channels', channelId, 'messages', 'attachments'],
    });
    const type = this.resolveAttachmentType(kind, file.mimetype);

    return {
      id: randomUUID(),
      type,
      name: path.basename(file.originalname || 'file').slice(0, 500),
      url: uploaded.url,
      fileId: uploaded.objectPath,
      size: file.size,
      mimeType: file.mimetype?.slice(0, 255) || undefined,
      uploadedAt: new Date().toISOString(),
    };
  }

  async pinMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageId: string
  ): Promise<SendMessageResult> {
    return this.setPinnedState(workspaceId, channelId, userId, messageId, true);
  }

  async unpinMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageId: string
  ): Promise<SendMessageResult> {
    return this.setPinnedState(workspaceId, channelId, userId, messageId, false);
  }

  async deleteMessage(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageId: string
  ): Promise<{ id: string; channelId: string }> {
    const { channelMember, channel } = await this.verifyChannelMembership(workspaceId, channelId, userId);
    await this.enforceChannelAction(channelMember, 'channel:delete_message', channel.settings);

    const result = await this.chatClientService.deleteMessage({ channelId, messageId, deletedBy: userId });
    const deletedMessage = {
      id: result.id || messageId,
      channelId: result.channelId || channelId,
    };

    this.chatRealtimeService.emitMessageDeleted(channelId, deletedMessage);
    return deletedMessage;
  }

  /**
   * Get messages from a channel
   */
  async getMessages(
    workspaceId: string,
    channelId: string,
    userId: string,
    page = 1,
    size = 20
  ): Promise<GetMessagesResult> {
    // 1. Verify channel membership
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    // 2. Call gRPC to stack-chat
    const result = await this.chatClientService.getMessages({
      channelId,
      page,
      size,
    });

    console.log('result', result);
    const formattedMessages = [];

    // format messages
    if (result.messages && result.messages.length > 0) {
      for (const message of result.messages) {
        const profileResponse = (await this.usersService.getProfile(message.senderId)) as ResponseItem<ProfileDto>;
        const profile = profileResponse.data as ProfileDto;

        formattedMessages.push({
          ...message,
          senderName: profile.name,
          senderEmail: profile.email,
          senderAvatar: profile.avatar || null,
          messageType: message.messageType || 'text',
          metadata: message.metadata,
          isPinned: message.isPinned || false,
          pinnedAt: message.pinnedAt || null,
          pinnedBy: message.pinnedBy || null,
        });
      }
    }

    return {
      messages: formattedMessages,
      hasMore: result.hasMore,
      page,
    };
  }

  private async resolveRecipientUserIds(channelId: string, actorUserId: string): Promise<string[]> {
    const channelMembers = await this.channelMemberRepository.find({
      where: { channelId },
      relations: ['member'],
    });

    const recipientUserIds = channelMembers
      .map((channelMember) => channelMember.member?.userId)
      .filter((userId) => Boolean(userId) && userId !== actorUserId);

    return Array.from(new Set(recipientUserIds));
  }

  private assertChatAttachmentUpload(file: Express.Multer.File): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const maxMb = resolveMaxUploadMb(process.env.CHAT_ATTACHMENT_MAX_MB);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds maximum size (${maxMb} MB)`);
    }

    const mimeType = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (!isAllowedUploadFileType(file) && !CHAT_EXTRA_UPLOAD_MIMES.has(mimeType)) {
      throw new BadRequestException('File type is not allowed');
    }
  }

  private resolveAttachmentType(kind: string, mimeType = ''): 'file' | 'image' | 'video' | 'audio' {
    const normalized = mimeType.toLowerCase();
    if (kind === 'video' || normalized.startsWith('video/')) return 'video';
    if (kind === 'audio' || normalized.startsWith('audio/')) return 'audio';
    if (kind === 'image' || normalized.startsWith('image/')) return 'image';
    return 'file';
  }

  private async publishMentionNotifications(params: {
    workspaceId: string;
    channelId: string;
    actorUserId: string;
    actorName: string;
    messageId: string;
    content: string;
    mentions?: Array<{ userId?: string; workspaceMemberId?: string; name?: string; email?: string }>;
  }): Promise<void> {
    if (!Array.isArray(params.mentions) || params.mentions.length === 0) return;

    const channelMembers = await this.channelMemberRepository.find({
      where: { channelId: params.channelId },
      relations: ['member'],
    });
    const allowedUserIds = new Set(channelMembers.map((item) => item.member?.userId).filter(Boolean));
    const mentionedUserIds = Array.from(
      new Set(
        params.mentions
          .map((mention) => mention?.userId)
          .filter((userId): userId is string => Boolean(userId) && allowedUserIds.has(userId) && userId !== params.actorUserId)
      )
    );
    if (!mentionedUserIds.length) return;

    await this.notificationsService.publishEvent({
      type: 'message.mentioned',
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId,
      entityType: 'channel_message',
      entityId: params.messageId,
      payload: {
        recipientUserIds: mentionedUserIds,
        actorName: params.actorName,
        preview: params.content?.slice(0, 180) || 'mentioned you in a message.',
        channelId: params.channelId,
        messageId: params.messageId,
        targetUrl: `/workspaces/${params.workspaceId}`,
      },
    });
  }

  private async getChannelPermissions(
    channelId: string,
    roleName: ChannelRoleName | null | undefined
  ): Promise<ChannelPermissions | null> {
    if (!roleName) {
      return null;
    }
    const channelRole = await this.channelRoleRepository.findOne({
      where: {
        channelId,
        name: roleName,
      },
    });

    if (!channelRole?.permissions?.actions || typeof channelRole.permissions.actions !== 'object') {
      return null;
    }

    return channelRole.permissions as ChannelPermissions;
  }

  private async enforceChannelAction(
    channelMember: ChannelMemberEntity,
    action: 'channel:post_message' | 'channel:pin_message' | 'channel:delete_message',
    channelSettings?: Record<string, any> | null
  ): Promise<void> {
    const permissions = await this.getChannelPermissions(channelMember.channelId, channelMember.memberRole as ChannelRoleName);
    const allowed = this.channelPermissionResolver.can(permissions, action, channelSettings);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to perform this action in this channel');
    }
  }

  private async setPinnedState(
    workspaceId: string,
    channelId: string,
    userId: string,
    messageId: string,
    isPinned: boolean
  ): Promise<SendMessageResult> {
    const { channelMember, channel } = await this.verifyChannelMembership(workspaceId, channelId, userId);
    await this.enforceChannelAction(channelMember, 'channel:pin_message', channel.settings);

    const result = isPinned
      ? await this.chatClientService.pinMessage({ channelId, messageId, pinnedBy: userId })
      : await this.chatClientService.unpinMessage({ channelId, messageId, pinnedBy: userId });

    const updatedMessage = {
      id: result.id,
      senderId: result.senderId,
      senderName: result.senderName,
      senderEmail: result.senderEmail,
      senderAvatar: result.senderAvatar || null,
      content: result.content,
      messageType: result.messageType || 'text',
      createdAt: result.createdAt,
      channelId: result.channelId,
      metadata: result.metadata as Record<string, any> | undefined,
      isPinned: result.isPinned || false,
      pinnedAt: result.pinnedAt || null,
      pinnedBy: result.pinnedBy || null,
    };
    this.chatRealtimeService.emitMessageUpdated(channelId, updatedMessage);
    return updatedMessage;
  }
}
