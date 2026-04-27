import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEventEntity, NotificationOutboxEntity, NotificationRecipientEntity } from '@app/entities';
import { Repository } from 'typeorm';
import { NotificationEmailAdapter } from './adapters/email.adapter';
import { InAppAdapter } from './adapters/in-app.adapter';
import { NotificationWebsocketAdapter } from './adapters/websocket.adapter';
import { WebhookAdapter } from './adapters/webhook.adapter';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly outboxRepository: Repository<NotificationOutboxEntity>,
    @InjectRepository(NotificationRecipientEntity)
    private readonly recipientRepository: Repository<NotificationRecipientEntity>,
    @InjectRepository(NotificationEventEntity)
    private readonly eventRepository: Repository<NotificationEventEntity>,
    private readonly inAppAdapter: InAppAdapter,
    private readonly websocketAdapter: NotificationWebsocketAdapter,
    private readonly emailAdapter: NotificationEmailAdapter,
    private readonly webhookAdapter: WebhookAdapter
  ) {}

  async dispatchPending(limit = 100): Promise<number> {
    const jobs = await this.outboxRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    let processed = 0;
    for (const job of jobs) {
      if (job.nextAttemptAt && job.nextAttemptAt > new Date()) {
        continue;
      }

      await this.processJob(job.id);
      processed += 1;
    }

    return processed;
  }

  private async processJob(outboxId: string): Promise<void> {
    const outbox = await this.outboxRepository.findOne({
      where: { id: outboxId },
      relations: ['notificationRecipient', 'notificationRecipient.notificationEvent'],
    });
    if (!outbox) {
      return;
    }

    const recipient = outbox.notificationRecipient;
    const event = recipient?.notificationEvent;
    if (!recipient || !event) {
      outbox.status = 'failed';
      outbox.lastError = 'Missing recipient or event context';
      await this.outboxRepository.save(outbox);
      return;
    }

    let delivered = false;
    try {
      if (outbox.channel === 'in_app') {
        delivered = await this.inAppAdapter.deliver();
      } else if (outbox.channel === 'websocket') {
        delivered = await this.websocketAdapter.deliver(
          recipient.recipientUserId,
          this.buildRealtimePayload(event, recipient)
        );
      } else if (outbox.channel === 'email') {
        delivered = await this.emailAdapter.deliver(event.type, event.payload);
      } else if (outbox.channel === 'webhook') {
        delivered = await this.webhookAdapter.deliver();
      } else {
        delivered = true;
      }
    } catch (error: any) {
      this.logger.error(`Failed to dispatch ${outbox.channel} for outbox ${outbox.id}`, error?.stack || error?.message);
      delivered = false;
    }

    if (delivered) {
      outbox.status = 'delivered';
      outbox.deliveredAt = new Date();
      outbox.lastError = null;
      await this.outboxRepository.save(outbox);

      recipient.lastDeliveredAt = new Date();
      recipient.status = 'delivered';
      await this.recipientRepository.save(recipient);

      const unreadCount = await this.recipientRepository.count({
        where: {
          recipientUserId: recipient.recipientUserId,
          readAt: null,
        },
      });
      this.websocketAdapter.emitUnreadCountChanged(recipient.recipientUserId, unreadCount);
      return;
    }

    outbox.attempts += 1;
    outbox.status = 'pending';
    outbox.lastError = outbox.lastError || `Delivery failed for channel ${outbox.channel}`;
    outbox.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 5_000 * outbox.attempts));
    await this.outboxRepository.save(outbox);

    if (outbox.attempts >= 5) {
      outbox.status = 'failed';
      await this.outboxRepository.save(outbox);
      recipient.status = 'failed';
      await this.recipientRepository.save(recipient);
    }
  }

  private buildRealtimePayload(
    event: NotificationEventEntity,
    recipient: NotificationRecipientEntity
  ): Record<string, any> {
    return {
      id: recipient.id,
      type: event.type,
      workspaceId: event.workspaceId,
      title: event.payload?.title,
      body: event.payload?.body,
      targetUrl: event.payload?.targetUrl,
      payload: event.payload,
      occurredAt: event.occurredAt,
      readAt: recipient.readAt,
      seenAt: recipient.seenAt,
      createdAt: recipient.createdAt,
    };
  }
}
