import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';
import { TasksModule } from '../tasks/tasks.module';
import { CanvasModule } from '../canvas/canvas.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [CanvasClientModule, TasksModule, CanvasModule, ChatModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
