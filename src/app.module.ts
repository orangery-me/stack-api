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
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { ChatModule } from './modules/chat/chat.module';
import { WsModule } from './modules/ws/ws.module';
import { CanvasModule } from './modules/canvas/canvas.module';
import { AgentModule } from './modules/agent/agent.module';
import { McpModule } from './modules/mcp/mcp.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { HuddleModule } from './modules/huddle/huddle.module';
import { SubtitleModule } from './modules/subtitle/subtitle.module';
import { AdminModule } from './modules/admin/admin.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuditLogInterceptor } from './modules/audit-log/audit-log.interceptor';
import { SystemLatencyModule } from './modules/system-latency/system-latency.module';
import { LatencyInterceptor } from './modules/system-latency/latency.interceptor';
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

        // Stack Chat Service (gRPC client connection)
        STACK_CHAT_GRPC_URL: Joi.string().default('localhost:50051'),

        // Stack Agent Service (gRPC client connection)
        STACK_AGENT_GRPC_URL: Joi.string().default('localhost:50052'),

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
        APP_URL: Joi.string().optional().default('http://localhost:8105'),
        CLIENT_URL: Joi.string().optional().default('http://localhost:5173'),

        // Canvas Collab Server
        CANVAS_COLLAB_URL: Joi.string().default('http://localhost:1235'),
        CANVAS_COLLAB_SECRET: Joi.string().optional().default(''),
        CANVAS_COLLAB_SESSION_SECRET: Joi.string()
          .min(32)
          .default('dev-canvas-collab-session-secret-change-me'),
        CANVAS_COLLAB_SESSION_TTL: Joi.string().default('10m'),
        INTERNAL_SECRET: Joi.string().allow('').optional().default(''),

        // GCS uploads (optional; sensible defaults applied in StorageService when unset)
        GCP_STORAGE_BUCKET: Joi.string().allow('').optional(),
        GCP_STORAGE_KEY_FILENAME: Joi.string().allow('').optional(),
        GCS_UPLOAD_PREFIX: Joi.string().allow('').optional(),
        TASK_ATTACHMENT_MAX_MB: Joi.number().integer().min(1).max(500).optional().default(15),

        // Redis
        REDIS_URL: Joi.string().optional().default('redis://localhost:6379'),

        // Media Service
        MEDIA_SERVICE_URL: Joi.string().optional().default('http://localhost:3000/api'),

        // LiveKit
        LIVEKIT_API_KEY: Joi.string().optional().default('devkey'),
        LIVEKIT_API_SECRET: Joi.string().optional().default('secret'),
        LIVEKIT_URL: Joi.string().optional().default('ws://localhost:7880'),

        // Realtime subtitles
        WHISPER_SERVICE_URL: Joi.string().allow('').optional().default(''),
        STACK_API_INTERNAL_URL: Joi.string().allow('').optional().default(''),

        // Optional
        LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
        TZ: Joi.string().default('Asia/Ho_Chi_Minh'),
      }),
    }),
    DatabaseModule,
    EmailModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    KeepAliveModule,
    ChannelsModule,
    ChatModule,
    WsModule,
    CanvasModule,
    AgentModule,
    McpModule,
    NotificationsModule,
    HuddleModule,
    SubtitleModule,
    AdminModule,
    SystemSettingsModule,
    AuditLogModule,
    SystemLatencyModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LatencyInterceptor,
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
