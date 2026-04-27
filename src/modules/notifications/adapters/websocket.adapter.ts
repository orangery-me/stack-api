import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from '../notifications.gateway';

@Injectable()
export class NotificationWebsocketAdapter {
  constructor(private readonly notificationsGateway: NotificationsGateway) {}

  async deliver(userId: string, payload: Record<string, any>): Promise<boolean> {
    this.notificationsGateway.emitCreated(userId, payload);
    return true;
  }

  emitUnreadCountChanged(userId: string, unreadCount: number): void {
    this.notificationsGateway.emitUnreadCountChanged(userId, unreadCount);
  }
}
