import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TaskEntity,
  TaskAssigneeEntity,
  TaskCommentEntity,
  TaskListEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermissionService } from '../../policy/permission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskAssigneeEntity,
      TaskCommentEntity,
      TaskListEntity,
      ChannelEntity,
      ChannelMemberEntity,
      WorkspaceMemberEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, PermissionService],
  exports: [TasksService],
})
export class TasksModule {}
