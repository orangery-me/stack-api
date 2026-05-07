import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [CanvasClientModule, TasksModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
