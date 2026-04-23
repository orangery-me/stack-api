import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { CanvasClientModule } from '../canvas-client/canvas-client.module';

@Module({
  imports: [CanvasClientModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
