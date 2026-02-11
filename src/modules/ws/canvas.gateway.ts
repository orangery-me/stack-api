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
import { ProfileDto } from '@UsersModule/dto/profile.dto';
import { UsersService } from '@UsersModule/users.service';
import { JwtTokenService } from '../auth/services';
import { CanvasService } from '../canvas/canvas.service';

interface JoinCanvasEditPagePayload {
  canvasId: string;
}

interface LeaveCanvasEditPagePayload {
  canvasId: string;
}

interface GetCanvasEditPageUsersPayload {
  canvasId: string;
}

interface GetCanvasDataPayload {
  canvasId: string;
}

interface EditCanvasPayload {
  canvasId: string;
  content: any;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/canvas',
})
export class CanvasGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly usersService: UsersService,
    private readonly canvasService: CanvasService
  ) {}

  afterInit() {
    console.log('[CanvasGateway] WebSocket gateway initialized');
  }
  async handleConnection(client: Socket) {
    console.log('[CanvasGateway] A new client connected:', client.id);

    // verify user by token
    const token = client.handshake.auth?.token;

    if (!token) {
      console.log('[CanvasGateway] No token provided, disconnecting client:', client.id);
      client.disconnect();
      return;
    }

    try {
      // extract payload from token
      const payload = this.jwtTokenService.verifyToken(token);

      // Gán trước thông tin user cơ bản từ JWT để tránh race-condition
      // khi client join room ngay lập tức (trước khi load xong profile).
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        name: payload.email,
        avatar: null,
      };

      try {
        const profileResponse = await this.usersService.getProfile(payload.sub);
        const profile = profileResponse.data as ProfileDto;

        client.data.user = {
          userId: payload.sub,
          email: payload.email,
          name: profile?.name || payload.email,
          avatar: profile?.avatar || null,
        };
      } catch (profileError) {
        console.error(
          '[CanvasGateway] Failed to load user profile, using JWT fallback:',
          (profileError as any)?.message
        );
      }

      console.log('[CanvasGateway] Client connected:', client.id, 'User:', client.data.user);
    } catch (error) {
      console.error('[CanvasGateway] Token verification failed:', error?.message);
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    console.log('[CanvasGateway] A client disconnected:', client.id);

    // Khi disconnect, cập nhật lại danh sách user ở các canvas rooms mà client đang ở
    const canvasRooms = Array.from(client.rooms).filter((room) => room.startsWith('canvas:'));

    canvasRooms.forEach((room) => {
      const canvasId = room.split(':')[1];
      if (canvasId) {
        this.broadcastCanvasUsers(canvasId).catch((error) => {
          console.error('[CanvasGateway] Error broadcasting users on disconnect:', error?.message);
        });
      }
    });
  }

  /**
   * User only can join one canvas edit page at a time
   */
  @SubscribeMessage('join_canvas_edit_page')
  async handleJoinCanvasEditPage(@ConnectedSocket() client: Socket, @MessageBody() data: JoinCanvasEditPagePayload) {
    // Rời khỏi canvas room hiện tại (nếu có)
    const currentCanvasRoom: string | undefined = client.data.currentCanvasRoom;
    if (currentCanvasRoom && currentCanvasRoom !== `canvas:${data.canvasId}`) {
      client.leave(currentCanvasRoom);
      const currentCanvasId = currentCanvasRoom.split(':')[1];
      if (currentCanvasId) {
        await this.broadcastCanvasUsers(currentCanvasId);
      }
    }

    const room = `canvas:${data.canvasId}`;
    client.join(room);
    client.data.currentCanvasRoom = room;

    client.emit('joined_canvas_edit_page', { canvasId: data.canvasId });
    await this.broadcastCanvasUsers(data.canvasId);

    console.log(`[CanvasGateway] Client ${client.id} joined canvas edit page: ${data.canvasId}`);
  }

  @SubscribeMessage('leave_canvas_edit_page')
  async handleLeaveCanvasEditPage(@ConnectedSocket() client: Socket, @MessageBody() data: LeaveCanvasEditPagePayload) {
    const room = `canvas:${data.canvasId}`;
    client.leave(room);

    if (client.data.currentCanvasRoom === room) {
      client.data.currentCanvasRoom = null;
    }

    client.emit('left_canvas_edit_page', { canvasId: data.canvasId });
    //   Gửi danh sách user (mới) đang ở trong canvas room cho tất cả client trong room
    await this.broadcastCanvasUsers(data.canvasId);

    console.log(`[CanvasGateway] Client ${client.id} left canvas edit page: ${data.canvasId}`);
  }

  /**
   * Get all users in a canvas edit page
   */
  @SubscribeMessage('get_canvas_edit_page_users')
  async handleGetCanvasEditPageUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GetCanvasEditPageUsersPayload
  ) {
    const users = await this.getCanvasRoomUsers(data.canvasId);

    client.emit('canvas_edit_page_users', {
      canvasId: data.canvasId,
      users,
    });

    console.log(`[CanvasGateway] Client ${client.id} got canvas edit page users: ${data.canvasId}`, users);
  }

  /**
   * get canvas data (initial load or manual refresh)
   */
  @SubscribeMessage('get_canvas_data')
  async handleGetCanvasData(@ConnectedSocket() client: Socket, @MessageBody() data: GetCanvasDataPayload) {
    const canvas = await this.canvasService.getCanvas(data.canvasId, client.data.user.userId);

    client.emit('canvas_data', { canvas });
    console.log(`[CanvasGateway] Client ${client.id} got canvas data: ${data.canvasId}`);
  }

  /**
   * Edit canvas content in real-time
   * - Lưu lại content mới
   * - Broadcast canvas_data cho tất cả client trong cùng canvas room (bao gồm cả người gửi)
   */
  @SubscribeMessage('edit_canvas')
  async handleEditCanvas(@ConnectedSocket() client: Socket, @MessageBody() data: EditCanvasPayload) {
    const user = client?.data?.user;

    if (!user?.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = `canvas:${data.canvasId}`;

    try {
      const canvas = await this.canvasService.saveCanvasContent(data.canvasId, user.userId, {
        content: data.content,
      });

      // Gửi content mới cho tất cả client trong room
      this.server.in(room).emit('canvas_data', { canvas });

      console.log(`[CanvasGateway] Client ${client.id} edited canvas: ${data.canvasId}`);
    } catch (error: any) {
      console.error('[CanvasGateway] Error editing canvas:', error?.message);
      client.emit('error', { message: error?.message || 'Failed to edit canvas' });
    }
  }

  /**
   * Helpers
   */
  private async getCanvasRoomUsers(canvasId: string) {
    const room = `canvas:${canvasId}`;
    // Race-condition: Gán trước thông tin user cơ bản từ JWT để tránh race-condition
    const sockets = await this.server.in(room).fetchSockets();

    // Trả về danh sách thông tin user đã được set ở handleConnection
    return sockets.map((socket: any) => socket.data?.user).filter((user: any) => !!user);
  }

  /**
   * Broadcast canvas users to all clients in the canvas room
   */
  private async broadcastCanvasUsers(canvasId: string) {
    const users = await this.getCanvasRoomUsers(canvasId);
    const room = `canvas:${canvasId}`;

    console.log('[CanvasGateway] Broadcasting canvas users to room:', room, 'Users:', users);

    this.server.in(room).emit('canvas_edit_page_users', {
      canvasId,
      users,
    });
  }
}
