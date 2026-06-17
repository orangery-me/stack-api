import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { TaskEntity } from '@app/entities/task/task.entity';
import { TaskListEntity } from '@app/entities/task/task-list.entity';
import { TaskAssigneeEntity } from '@app/entities/task/task-assignee.entity';
import { CanvasEntity } from '@app/entities/canvas/canvas.entity';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceEntity } from '@app/entities/workspace/workspace.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { WorkspaceRoleEntity } from '@app/entities/workspace/workspace-role.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminTasksController } from './tasks/admin-tasks.controller';
import { AdminTasksService } from './tasks/admin-tasks.service';
import { AdminHealthController } from './health/admin-health.controller';
import { AdminHealthService } from './health/admin-health.service';
import { AdminAnalyticsController } from './analytics/admin-analytics.controller';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminContentController } from './content/admin-content.controller';
import { AdminContentService } from './content/admin-content.service';
import { AdminCommunicationsController } from './communications/admin-communications.controller';
import { AdminCommunicationsService } from './communications/admin-communications.service';
import { AdminWorkspaceRolesController } from './workspaces/admin-workspace-roles.controller';
import { AdminWorkspaceRolesService } from './workspaces/admin-workspace-roles.service';
import { AdminHuddleController } from './workspaces/admin-huddle.controller';
import { AdminHuddleService } from './workspaces/admin-huddle.service';
import { AdminWorkspaceTasksController } from './workspaces/admin-workspace-tasks.controller';
import { AdminWorkspaceTasksService } from './workspaces/admin-workspace-tasks.service';
import { HuddleCall } from '../huddle/entities/huddle-call.entity';
import { HuddleParticipant } from '../huddle/entities/huddle-participant.entity';
import { SystemLatencyModule } from '../system-latency/system-latency.module';
import { PermissionService } from '../../policy/permission.service';
import { WorkspacePermissionService } from '../../policy/workspace/workspace-permission.service';

@Module({
  imports: [
    SystemLatencyModule,
    TypeOrmModule.forFeature([
      UserEntity,
      TaskEntity,
      TaskListEntity,
      TaskAssigneeEntity,
      CanvasEntity,
      ChannelEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
      WorkspaceRoleEntity,
      AuditLog,
      HuddleCall,
      HuddleParticipant,
    ]),
  ],
  controllers: [
    AdminController,
    AdminTasksController,
    AdminHealthController,
    AdminAnalyticsController,
    AdminContentController,
    AdminCommunicationsController,
    AdminWorkspaceRolesController,
    AdminHuddleController,
    AdminWorkspaceTasksController,
  ],
  providers: [
    AdminService,
    AdminTasksService,
    AdminHealthService,
    AdminAnalyticsService,
    AdminContentService,
    AdminCommunicationsService,
    AdminWorkspaceRolesService,
    AdminHuddleService,
    AdminWorkspaceTasksService,
    PermissionService,
    WorkspacePermissionService,
  ],
})
export class AdminModule {}
