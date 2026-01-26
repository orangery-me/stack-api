import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkspaceEntity,
  WorkspaceRoleEntity,
  WorkspaceMemberEntity,
  WorkspaceInviteEntity,
  UserEntity,
} from '@app/entities';
import { EmailModule } from '../email/email.module';
import { ChannelsModule } from '../channels/channels.module';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacePolicy } from '../../policy/workspace.policy';
import { PermissionService } from '../../policy/permission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      WorkspaceRoleEntity,
      WorkspaceMemberEntity,
      WorkspaceInviteEntity,
      UserEntity,
    ]),
    EmailModule,
    ChannelsModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacePolicy, PermissionService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
