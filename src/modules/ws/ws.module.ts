import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, ChatModule, UsersModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class WsModule {}
