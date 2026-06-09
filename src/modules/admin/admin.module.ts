import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { TaskEntity } from '@app/entities/task/task.entity';
import { TaskListEntity } from '@app/entities/task/task-list.entity';
import { CanvasEntity } from '@app/entities/canvas/canvas.entity';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceEntity } from '@app/entities/workspace/workspace.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TaskEntity,
      TaskListEntity,
      CanvasEntity,
      ChannelEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
      AuditLog,
    ]),
  ],
  controllers: [
    AdminController,
    AdminTasksController,
    AdminHealthController,
    AdminAnalyticsController,
    AdminContentController,
    AdminCommunicationsController,
  ],
  providers: [
    AdminService,
    AdminTasksService,
    AdminHealthService,
    AdminAnalyticsService,
    AdminContentService,
    AdminCommunicationsService,
  ],
})
export class AdminModule {}
