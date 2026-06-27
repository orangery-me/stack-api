import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CanvasEntity,
  CanvasSuggestionEntity,
  ChannelEntity,
  ChannelMemberEntity,
  UserEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { CanvasPermissionEntity } from '@app/entities/canvas/canvas-permission.entity';
import { CanvasRecentEntity } from '@app/entities/canvas/canvas-recent.entity';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';
import { WorkspaceCanvasController } from './workspace-canvas.controller';
import { CanvasSuggestionController } from './canvas-suggestion.controller';
import { CanvasSuggestionService } from './canvas-suggestion.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatClientModule } from '../chat-client/chat-client.module';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';

@Module({
  imports: [
    NotificationsModule,
    ChatClientModule,
    ChatModule,
    AuthModule,
    CanvasClientModule,
    TypeOrmModule.forFeature([
      CanvasEntity,
      CanvasSuggestionEntity,
      ChannelEntity,
      ChannelMemberEntity,
      UserEntity,
      WorkspaceMemberEntity,
      CanvasPermissionEntity,
      CanvasRecentEntity,
    ]),
  ],
  controllers: [CanvasController, WorkspaceCanvasController, CanvasSuggestionController],
  providers: [CanvasService, CanvasSuggestionService],
  exports: [CanvasService, CanvasSuggestionService],
})
export class CanvasModule {}
