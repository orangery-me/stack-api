import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CanvasEntity,
  CanvasContentEntity,
  CanvasVersionEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CanvasEntity,
      CanvasContentEntity,
      CanvasVersionEntity,
      ChannelEntity,
      ChannelMemberEntity,
      WorkspaceMemberEntity,
    ]),
  ],
  controllers: [CanvasController],
  providers: [CanvasService],
  exports: [CanvasService],
})
export class CanvasModule {}

