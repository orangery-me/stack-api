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
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';
import { PermissionService } from '../../policy/permission.service';

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
  providers: [TasksService, ChannelPermissionResolver, PermissionService],
  exports: [TasksService],
})
export class TasksModule {}
