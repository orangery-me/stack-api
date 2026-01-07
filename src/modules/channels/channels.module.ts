import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChannelEntity,
  ChannelMemberEntity,
  ChannelRoleEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelEntity,
      ChannelMemberEntity,
      ChannelRoleEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
