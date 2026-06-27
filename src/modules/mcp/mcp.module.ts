import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';
import { TasksModule } from '../tasks/tasks.module';
import { CanvasModule } from '../canvas/canvas.module';

@Module({
  imports: [CanvasClientModule, TasksModule, CanvasModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
