import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';
import { CanvasModule } from '../canvas/canvas.module';
import { HuddleCall } from '../huddle/entities/huddle-call.entity';
import { HuddleModule } from '../huddle/huddle.module';
import { CallTranscript, SubtitlePreference, TranscriptSegment } from './entities';
import { SubtitleClientService } from './subtitle-client.service';
import { SubtitleController } from './subtitle.controller';
import { SubtitleService } from './subtitle.service';
import { InternalSecretGuard } from './guards/internal-secret.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HuddleCall,
      ChannelEntity,
      WorkspaceMemberEntity,
      CallTranscript,
      TranscriptSegment,
      SubtitlePreference,
    ]),
    ConfigModule,
    CanvasModule,
    CanvasClientModule,
    forwardRef(() => HuddleModule),
  ],
  controllers: [SubtitleController],
  providers: [SubtitleService, SubtitleClientService, InternalSecretGuard],
  exports: [SubtitleService, SubtitleClientService],
})
export class SubtitleModule {}
