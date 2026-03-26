import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AgentClientService } from './agent-client.service';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'AGENT_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'agent',
            protoPath: join(process.cwd(), 'proto', 'agent.proto'),
            url: configService.get<string>('STACK_AGENT_GRPC_URL', 'localhost:50052'),
          },
        }),
      },
    ]),
  ],
  providers: [AgentClientService],
  exports: [AgentClientService],
})
export class AgentClientModule {}
