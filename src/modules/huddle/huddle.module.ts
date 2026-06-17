import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HuddleCall } from './entities/huddle-call.entity';
import { HuddleParticipant } from './entities/huddle-participant.entity';
import { LiveKitService } from './livekit.service';
import { HuddleService } from './huddle.service';
import { HuddleController } from './huddle.controller';
import { HuddleGateway } from './huddle.gateway';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';
import { AuthModule } from '../auth/auth.module';
import { ChatClientModule } from '../chat-client/chat-client.module';
import { WsModule } from '../ws/ws.module';
import { SubtitleModule } from '../subtitle/subtitle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HuddleCall, HuddleParticipant, ChannelEntity, WorkspaceMemberEntity]),
    ConfigModule,
    AuthModule,
    ChatClientModule,
    WsModule,
    forwardRef(() => SubtitleModule),
  ],
  providers: [LiveKitService, HuddleService, HuddleGateway],
  controllers: [HuddleController],
  exports: [LiveKitService, HuddleService, HuddleGateway],
})
export class HuddleModule {}
