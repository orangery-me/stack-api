import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtTokenService } from '../auth/services/jwt.service';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';
import { ProfileDto } from '@UsersModule/dto/profile.dto';

interface SendMessagePayload {
  workspaceId: string;
  channelId: string;
  content: string;
}

interface JoinChannelPayload {
  channelId: string;
}

interface LoadMessagesPayload {
  channelId: string;
  workspaceId: string;
  page?: number;
  size?: number;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService
  ) {}

  afterInit() {
    console.log('[ChatGateway] WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;

    if (!token) {
      console.log('[ChatGateway] No token provided, disconnecting client:', client.id);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtTokenService.verifyToken(token);
      // Get full user profile
      const profileResponse = await this.usersService.getProfile(payload.sub);
      const profile = profileResponse.data as ProfileDto;

      // Store user info in socket data
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        name: profile?.name || payload.email,
        avatar: profile?.avatar || null,
      };
      client.data.accessToken = token;

      console.log('[ChatGateway] Client connected:', client.id, 'User:', payload.sub);
    } catch (error) {
      console.error('[ChatGateway] Token verification failed:', error?.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[ChatGateway] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('send_channel_message')
  async handleSendChannelMessage(@ConnectedSocket() client: Socket, @MessageBody() data: SendMessagePayload) {
    const user = client?.data?.user;

    if (!user?.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // ChatService handles permission verification and calls gRPC to stack-chat
      const message = await this.chatService.sendMessage(data.workspaceId, data.channelId, user.userId, {
        content: data.content,
      });

      const room = `channel:${data.channelId}`;
      client.join(room);

      // Broadcast message to all clients in the room
      client.to(room).emit('new_message', message);

      // Send confirmation to sender
      client.emit('message_sent', message);
    } catch (error: any) {
      console.error('[ChatGateway] Error sending message:', {
        error: error?.message || error,
        channelId: data.channelId,
        userId: user.userId,
      });
      client.emit('error', { message: error?.message || 'Failed to send message' });
    }
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() data: JoinChannelPayload) {
    const room = `channel:${data.channelId}`;
    client.join(room);
    client.emit('joined_channel', { channelId: data.channelId });
    console.log(`[ChatGateway] Client ${client.id} joined channel: ${data.channelId}`);
  }

  @SubscribeMessage('load_messages')
  async handleLoadMessages(@ConnectedSocket() client: Socket, @MessageBody() data: LoadMessagesPayload) {
    const user = client?.data?.user;

    if (!user?.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const page = data.page || 1;
      const size = data.size || 20;

      // ChatService handles permission verification and calls gRPC to stack-chat
      const result = await this.chatService.getMessages(data.workspaceId, data.channelId, user.userId, page, size);

      client.emit('messages_loaded', {
        channelId: data.channelId,
        messages: result.messages,
        page,
        hasMore: result.hasMore,
      });
    } catch (error: any) {
      console.error('[ChatGateway] Error loading messages:', error?.message);
      client.emit('error', { message: error?.message || 'Failed to load messages' });
    }
  }
}
