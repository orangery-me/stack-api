import { ClassSerializerInterceptor, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { I18nModule, AcceptLanguageResolver, QueryResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';

import { DatabaseModule } from '@app/config/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { XMLMiddleware } from './common/middleware/xml.middleware';
import { KeepAliveModule } from './modules/keep-alive/keep-alive.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import * as Joi from 'joi';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: path.join(__dirname, '../src/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        { use: HeaderResolver, options: ['x-lang'] },
        AcceptLanguageResolver,
      ],
    }),
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        // Application
        APP_PORT: Joi.number().default(8105),
        NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),

        // Database - PostgreSQL
        DB_POSTGRE_HOST: Joi.string().default('localhost'),
        DB_POSTGRE_PORT: Joi.number().default(5432),
        DB_POSTGRE_USERNAME: Joi.string().required(),
        DB_POSTGRE_PASSWORD: Joi.string().required(),
        DB_POSTGRE_DATABASE: Joi.string().required(),

        // JWT
        JWT_ACCESS_SECRETKEY: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
        JWT_REFRESH_SECRETKEY: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

        // Security
        RESET_PASSWORD: Joi.string().default('123456'),
        BCRYPT_SALT_ROUNDS: Joi.number().default(10),

        // Features
        ENABLE_SWAGGER: Joi.boolean().default(true),
        ENABLE_CORS: Joi.boolean().default(true),
        ENABLE_RATE_LIMITING: Joi.boolean().default(false),

        // Keep-alive
        KEEP_ALIVE_ENABLED: Joi.boolean().default(true),
        KEEP_ALIVE_INTERVAL: Joi.number().default(30),

        // Email
        MAIL_HOST: Joi.string().required(),
        MAIL_PORT: Joi.number().default(587),
        MAIL_USER: Joi.string().required(),
        MAIL_PASS: Joi.string().required(),
        MAIL_FROM: Joi.string().required(),

        // Google OAuth
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),

        // App URL
        APP_URL: Joi.string().required(),

        // Optional
        LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
        TZ: Joi.string().default('Asia/Ho_Chi_Minh'),
      }),
    }),
    DatabaseModule,
    EmailModule,
    // TODO: Tạm thời tắt các module dùng MongoDB (UsersModule, AuthModule)
    // để chỉ chạy với PostgreSQL. Khi migrate sang TypeORM,
    // có thể bật lại hoặc tạo module mới dùng TypeORM.
    UsersModule,
    AuthModule,
    KeepAliveModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(XMLMiddleware).forRoutes({
      path: 'report-1/import',
      method: RequestMethod.POST,
    });
  }
}
