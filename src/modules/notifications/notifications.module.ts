import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEventEntity, NotificationOutboxEntity, NotificationRecipientEntity } from '@app/entities';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { InAppAdapter } from './adapters/in-app.adapter';
import { NotificationWebsocketAdapter } from './adapters/websocket.adapter';
import { NotificationEmailAdapter } from './adapters/email.adapter';
import { WebhookAdapter } from './adapters/webhook.adapter';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEventEntity, NotificationRecipientEntity, NotificationOutboxEntity]),
    AuthModule,
    EmailModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRulesService,
    NotificationDispatcherService,
    NotificationOutboxWorker,
    InAppAdapter,
    NotificationWebsocketAdapter,
    NotificationEmailAdapter,
    WebhookAdapter,
    NotificationsGateway,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
