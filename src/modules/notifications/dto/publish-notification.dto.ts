export interface PublishNotificationDto {
  type: string;
  workspaceId?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, any>;
  occurredAt?: Date;
  dedupeKey?: string;
}

export interface NotificationRuleResult {
  recipientUserIds: string[];
  deliveryChannels: string[];
  title: string;
  body: string;
  targetUrl?: string;
}
