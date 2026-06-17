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
import { WorkspacePolicy } from '../../policy/workspace/workspace.policy';
import { PermissionService } from '../../policy/permission.service';
import { WorkspacePermissionService } from '../../policy/workspace/workspace-permission.service';
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
  providers: [WorkspacesService, WorkspacePolicy, PermissionService, WorkspacePermissionService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
