import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChannelEntity,
  ChannelMemberEntity,
  ChannelRoleEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceRoleEntity,
} from '@app/entities';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ChannelPolicy } from '../../policy/channel.policy';
import { PermissionService } from '../../policy/permission.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelEntity,
      ChannelMemberEntity,
      ChannelRoleEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
      WorkspaceRoleEntity,
    ]),
    NotificationsModule,
    ChatModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelPolicy, PermissionService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
