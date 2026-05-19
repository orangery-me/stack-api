import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TaskEntity,
  TaskAssigneeEntity,
  TaskListEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskAssigneeEntity,
      TaskListEntity,
      ChannelEntity,
      ChannelMemberEntity,
      WorkspaceMemberEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
