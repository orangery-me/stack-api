import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserEntity } from '@app/entities';
import { UsersService } from '@UsersModule/users.service';
import { UsersController } from '@UsersModule/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGrpcController } from './user-grpc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController, UserGrpcController],
  providers: [UsersService, ConfigService],
  exports: [UsersService],
})
export class UsersModule {}
