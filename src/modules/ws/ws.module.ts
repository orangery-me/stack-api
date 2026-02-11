import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { CanvasGateway } from './canvas.gateway';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CanvasModule } from '../canvas/canvas.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, ChatModule, CanvasModule, UsersModule],
  providers: [ChatGateway, CanvasGateway],
  exports: [ChatGateway, CanvasGateway],
})
export class WsModule {}
