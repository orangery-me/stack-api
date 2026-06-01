import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

export interface SendMessageRequest {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  workspaceId: string;
  channelId: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, any> | string;
}

export interface MessageResponse {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar: string;
  content: string;
  messageType: string;
  createdAt: string;
  channelId: string;
  metadata?: Record<string, any> | string;
}

export interface GetMessagesRequest {
  channelId: string;
  page?: number;
  size?: number;
}

export interface GetMessagesResponse {
  messages: MessageResponse[];
  hasMore: boolean;
}

interface ChatServiceClient {
  sendMessage(data: SendMessageRequest): any;
  getMessages(data: GetMessagesRequest): any;
}

@Injectable()
export class ChatClientService implements OnModuleInit {
  private chatService: ChatServiceClient;

  constructor(@Inject('CHAT_PACKAGE') private readonly chatClient: ClientGrpc) {}

  onModuleInit() {
    this.chatService = this.chatClient.getService<ChatServiceClient>('ChatService');
  }

  async sendMessage(data: SendMessageRequest): Promise<MessageResponse> {
    try {
      const response = await lastValueFrom<MessageResponse>(
        this.chatService.sendMessage({
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          userAvatar: data.userAvatar || '',
          workspaceId: data.workspaceId,
          channelId: data.channelId,
          content: data.content,
          messageType: data.messageType || 'text',
          metadata: this.stringifyMetadata(data.metadata),
        })
      );

      return {
        ...response,
        metadata: this.parseMetadata(response.metadata),
      };
    } catch (error: any) {
      console.error('[ChatClientService] Error sending message:', error?.message || error);
      throw error;
    }
  }

  async getMessages(data: GetMessagesRequest): Promise<GetMessagesResponse> {
    try {
      const response = await lastValueFrom<GetMessagesResponse>(
        this.chatService.getMessages({
          channelId: data.channelId,
          page: data.page || 1,
          size: data.size || 20,
        })
      );

      return {
        ...response,
        messages: (response.messages || []).map((message) => ({
          ...message,
          metadata: this.parseMetadata(message.metadata),
        })),
      };
    } catch (error: any) {
      console.error('[ChatClientService] Error getting messages:', error?.message || error);
      throw error;
    }
  }

  private stringifyMetadata(metadata?: Record<string, any> | string): string {
    if (!metadata) return '';
    return typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  }

  private parseMetadata(metadata?: Record<string, any> | string): Record<string, any> | undefined {
    if (!metadata) return undefined;
    if (typeof metadata !== 'string') return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return undefined;
    }
  }
}
