import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CanvasClientService } from './canvas-client.service';

@Module({
  imports: [ConfigModule],
  providers: [CanvasClientService],
  exports: [CanvasClientService],
})
export class CanvasClientModule {}
