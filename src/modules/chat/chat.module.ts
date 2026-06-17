import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChannelEntity,
  ChannelMemberEntity,
  ChannelRoleEntity,
  WorkspaceMemberEntity,
  UserEntity,
} from '@app/entities';
import { ChatClientModule } from '../chat-client/chat-client.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsersModule } from '@UsersModule/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';
import { PermissionService } from '../../policy/permission.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelEntity,
      ChannelMemberEntity,
      ChannelRoleEntity,
      WorkspaceMemberEntity,
      UserEntity,
    ]),
    ChatClientModule,
    UsersModule,
    NotificationsModule,
    StorageModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRealtimeService, ChannelPermissionResolver, PermissionService],
  exports: [ChatService, ChatRealtimeService],
})
export class ChatModule {}
