import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEventEntity, NotificationOutboxEntity, NotificationRecipientEntity } from '@app/entities';
import { IsNull, Repository } from 'typeorm';
import { PublishNotificationDto } from './dto/publish-notification.dto';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  private readonly inMemoryPreferences = new Map<string, UpdateNotificationPreferencesDto>();

  constructor(
    @InjectRepository(NotificationEventEntity)
    private readonly notificationEventRepository: Repository<NotificationEventEntity>,
    @InjectRepository(NotificationRecipientEntity)
    private readonly notificationRecipientRepository: Repository<NotificationRecipientEntity>,
    @InjectRepository(NotificationOutboxEntity)
    private readonly notificationOutboxRepository: Repository<NotificationOutboxEntity>,
    private readonly notificationRulesService: NotificationRulesService,
    private readonly notificationDispatcherService: NotificationDispatcherService
  ) {}

  async publishEvent(dto: PublishNotificationDto): Promise<void> {
    const rule = this.notificationRulesService.resolve(dto.type, dto.payload || {}, dto.actorUserId);
    if (!rule) {
      return;
    }

    const event = this.notificationEventRepository.create({
      type: dto.type,
      workspaceId: dto.workspaceId,
      actorUserId: dto.actorUserId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      dedupeKey: dto.dedupeKey,
      occurredAt: dto.occurredAt || new Date(),
      payload: {
        schemaVersion: 1,
        ...dto.payload,
        title: rule.title,
        body: rule.body,
        targetUrl: rule.targetUrl,
        icon: rule.icon,
        actorName: rule.actorName,
      },
    });
    const savedEvent = await this.notificationEventRepository.save(event);

    const recipients = rule.recipientUserIds.map((recipientUserId) =>
      this.notificationRecipientRepository.create({
        notificationEventId: savedEvent.id,
        recipientUserId,
        deliveryChannels: rule.deliveryChannels,
        status: 'pending',
      })
    );
    if (recipients.length === 0) {
      return;
    }

    const savedRecipients = await this.notificationRecipientRepository.save(recipients);
    const outboxItems = savedRecipients.flatMap((recipient) =>
      rule.deliveryChannels.map((channel) =>
        this.notificationOutboxRepository.create({
          notificationRecipientId: recipient.id,
          channel,
          status: 'pending',
        })
      )
    );
    if (outboxItems.length > 0) {
      await this.notificationOutboxRepository.save(outboxItems);
      await this.notificationDispatcherService.dispatchPending(100);
    }
  }

  async listForUser(userId: string, workspaceId?: string, page = 1, size = 20) {
    const query = this.notificationRecipientRepository
      .createQueryBuilder('recipient')
      .leftJoinAndSelect('recipient.notificationEvent', 'event')
      .where('recipient.recipientUserId = :userId', { userId });

    if (workspaceId) {
      query.andWhere('event.workspaceId = :workspaceId', { workspaceId });
    }

    const [items, total] = await query
      .orderBy('recipient.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.notificationEvent?.type,
        workspaceId: item.notificationEvent?.workspaceId,
        title: item.notificationEvent?.payload?.title,
        body: item.notificationEvent?.payload?.body,
        targetUrl: item.notificationEvent?.payload?.targetUrl,
        payload: item.notificationEvent?.payload || {},
        seenAt: item.seenAt,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
      page,
      size,
      total,
      hasMore: page * size < total,
    };
  }

  async getUnreadCount(userId: string, workspaceId?: string) {
    const query = this.notificationRecipientRepository
      .createQueryBuilder('recipient')
      .leftJoin('recipient.notificationEvent', 'event')
      .where('recipient.recipientUserId = :userId', { userId })
      .andWhere('recipient.readAt IS NULL');

    if (workspaceId) {
      query.andWhere('event.workspaceId = :workspaceId', { workspaceId });
    }

    const totalUnread = await query.getCount();

    return {
      totalUnread,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRecipientRepository.update(
      { id: notificationId, recipientUserId: userId },
      { readAt: new Date(), seenAt: new Date(), status: 'delivered' }
    );
  }

  async markSeen(userId: string, notificationId: string): Promise<void> {
    await this.notificationRecipientRepository.update(
      { id: notificationId, recipientUserId: userId, seenAt: IsNull() },
      { seenAt: new Date() }
    );
  }

  async markReadAll(userId: string, workspaceId?: string): Promise<void> {
    if (!workspaceId) {
      await this.notificationRecipientRepository
        .createQueryBuilder()
        .update(NotificationRecipientEntity)
        .set({ readAt: new Date(), seenAt: new Date(), status: 'delivered' })
        .where('recipientUserId = :userId', { userId })
        .andWhere('readAt IS NULL')
        .execute();
      return;
    }

    const recipients = await this.notificationRecipientRepository
      .createQueryBuilder('recipient')
      .leftJoinAndSelect('recipient.notificationEvent', 'event')
      .where('recipient.recipientUserId = :userId', { userId })
      .andWhere('recipient.readAt IS NULL')
      .andWhere('event.workspaceId = :workspaceId', { workspaceId })
      .getMany();

    if (recipients.length === 0) {
      return;
    }

    const ids = recipients.map((item) => item.id);
    await this.notificationRecipientRepository
      .createQueryBuilder()
      .update(NotificationRecipientEntity)
      .set({ readAt: new Date(), seenAt: new Date(), status: 'delivered' })
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  getPreferences(userId: string): UpdateNotificationPreferencesDto {
    return (
      this.inMemoryPreferences.get(userId) || {
        enableEmail: true,
        enableWebsocket: true,
        mutedTypes: [],
      }
    );
  }

  updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto): UpdateNotificationPreferencesDto {
    const current = this.getPreferences(userId);
    const next = {
      ...current,
      ...dto,
    };
    this.inMemoryPreferences.set(userId, next);
    return next;
  }
}
