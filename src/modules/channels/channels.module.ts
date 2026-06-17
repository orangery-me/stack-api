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
import { ChannelPolicy } from '../../policy/channel/channel.policy';
import { PermissionService } from '../../policy/permission.service';
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';
import { WorkspacePermissionService } from '../../policy/workspace/workspace-permission.service';
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
  providers: [ChannelsService, ChannelPolicy, ChannelPermissionResolver, PermissionService, WorkspacePermissionService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
