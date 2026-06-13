import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLatencyEntity } from '@app/entities';
import { SystemLatencyService } from './system-latency.service';
import { LatencyInterceptor } from './latency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLatencyEntity])],
  providers: [SystemLatencyService, LatencyInterceptor],
  exports: [SystemLatencyService, LatencyInterceptor],
})
export class SystemLatencyModule {}
