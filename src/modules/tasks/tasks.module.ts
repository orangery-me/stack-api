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
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
