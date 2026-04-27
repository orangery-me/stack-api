import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkspaceEntity,
  WorkspaceRoleEntity,
  WorkspaceMemberEntity,
  WorkspaceInviteEntity,
  UserEntity,
} from '@app/entities';
import { ChannelsModule } from '../channels/channels.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacePolicy } from '../../policy/workspace.policy';
import { PermissionService } from '../../policy/permission.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      WorkspaceRoleEntity,
      WorkspaceMemberEntity,
      WorkspaceInviteEntity,
      UserEntity,
    ]),
    ChannelsModule,
    NotificationsModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacePolicy, PermissionService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
