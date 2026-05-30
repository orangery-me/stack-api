import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelEntity, ChannelMemberEntity, WorkspaceMemberEntity, UserEntity } from '@app/entities';
import { ChatClientModule } from '../chat-client/chat-client.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsersModule } from '@UsersModule/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatRealtimeService } from './chat-realtime.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelEntity, ChannelMemberEntity, WorkspaceMemberEntity, UserEntity]),
    ChatClientModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRealtimeService],
  exports: [ChatService, ChatRealtimeService],
})
export class ChatModule {}
