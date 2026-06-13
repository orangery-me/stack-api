import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserEntity, WorkspaceMemberEntity } from '@app/entities';
import { UsersService } from '@UsersModule/users.service';
import { UsersController } from '@UsersModule/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, WorkspaceMemberEntity])],
  controllers: [UsersController],
  providers: [UsersService, ConfigService],
  exports: [UsersService],
})
export class UsersModule {}
