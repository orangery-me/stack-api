import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelEntity, ChannelMemberEntity, WorkspaceMemberEntity, UserEntity } from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { ChatClientService } from '../chat-client/chat-client.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UsersService } from '@UsersModule/users.service';
import { ProfileDto } from '@UsersModule/dto/profile.dto';
import { ResponseItem } from '@app/common/dtos/response-item.dto';

export interface SendMessageResult {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar: string | null;
  content: string;
  createdAt: string;
  channelId: string;
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
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly chatClientService: ChatClientService,
    private readonly usersService: UsersService
  ) {}

  /**
   * Verify that user is a member of the channel
   */
  async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<{ workspaceMember: WorkspaceMemberEntity; channelMember: ChannelMemberEntity }> {
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

    return { workspaceMember, channelMember };
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
    // 1. Verify channel membership
    await this.verifyChannelMembership(workspaceId, channelId, userId);

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
    });

    return {
      id: result.id,
      senderId: result.senderId,
      senderName: result.senderName,
      senderEmail: result.senderEmail,
      senderAvatar: result.senderAvatar || null,
      content: result.content,
      createdAt: result.createdAt,
      channelId: result.channelId,
    };
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
    for (const message of result.messages) {
      const profileResponse = (await this.usersService.getProfile(message.senderId)) as ResponseItem<ProfileDto>;
      const profile = profileResponse.data as ProfileDto;

      formattedMessages.push({
        ...message,
        senderName: profile.name,
        senderEmail: profile.email,
        senderAvatar: profile.avatar || null,
      });
    }

    return {
      messages: formattedMessages,
      hasMore: result.hasMore,
      page,
    };
  }
}
