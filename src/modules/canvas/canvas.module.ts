import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanvasEntity, ChannelEntity, ChannelMemberEntity, UserEntity, WorkspaceMemberEntity } from '@app/entities';
import { CanvasPermissionEntity } from '@app/entities/canvas/canvas-permission.entity';
import { CanvasRecentEntity } from '@app/entities/canvas/canvas-recent.entity';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';
import { WorkspaceCanvasController } from './workspace-canvas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanvasEntity,
      ChannelEntity,
      ChannelMemberEntity,
      UserEntity,
      WorkspaceMemberEntity,
      CanvasPermissionEntity,
      CanvasRecentEntity,
    ]),
  ],
  controllers: [CanvasController, WorkspaceCanvasController],
  providers: [CanvasService],
  exports: [CanvasService],
})
export class CanvasModule {}
