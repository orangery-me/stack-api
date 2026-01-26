import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ChatClientService } from './chat-client.service';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'CHAT_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'chat',
            protoPath: join(process.cwd(), 'proto', 'chat.proto'),
            url: configService.get<string>('STACK_CHAT_GRPC_URL', 'localhost:50052'),
          },
        }),
      },
    ]),
  ],
  providers: [ChatClientService],
  exports: [ChatClientService],
})
export class ChatClientModule {}
