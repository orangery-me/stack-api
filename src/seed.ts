import { MongooseModule } from '@nestjs/mongoose';
import 'dotenv/config';
import { seeder } from 'nestjs-seeder';

import { UserEntity, UserSchema } from '@app/entities';
import { DatabaseModule } from './config/database.module';
import { UserSeeder } from './seeders/user.seeder';

seeder({
  imports: [DatabaseModule, MongooseModule.forFeature([{ name: UserEntity.name, schema: UserSchema }])],
}).run([UserSeeder]);
