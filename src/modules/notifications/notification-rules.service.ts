import { Injectable } from '@nestjs/common';
import { NotificationRuleResult } from './dto/publish-notification.dto';

@Injectable()
export class NotificationRulesService {
  resolve(type: string, payload: Record<string, any>, actorUserId?: string): NotificationRuleResult | null {
    const recipientUserIds = this.normalizeRecipients(payload?.recipientUserIds, actorUserId);
    if (recipientUserIds.length === 0) {
      return null;
    }

    switch (type) {
      case 'workspace.invited':
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'email', 'websocket'],
          title: 'Workspace invitation',
          body: `${payload?.inviterName || 'Someone'} invited you to ${payload?.workspaceName || 'a workspace'}.`,
          targetUrl: payload?.targetUrl || '/workspaces',
        };
      case 'channel.member_added':
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'websocket'],
          title: 'Added to channel',
          body: `${payload?.actorName || 'Someone'} added you to #${payload?.channelName || 'channel'}.`,
          targetUrl: payload?.targetUrl || '/workspaces',
        };
      case 'task.assigned':
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'websocket'],
          title: 'New task assigned',
          body: `${payload?.actorName || 'Someone'} assigned a task to you: ${payload?.taskTitle || 'Untitled Task'}.`,
          targetUrl: payload?.targetUrl || '/workspaces',
        };
      case 'task.status_changed':
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'websocket'],
          title: 'Task status changed',
          body: `${payload?.actorName || 'Someone'} changed the status of '${payload?.taskTitle || 'a task'}' to ${payload?.status || 'a new status'}.`,
          targetUrl: payload?.targetUrl || '/workspaces',
        };
      // case 'conversation.reply':
      //   return {
      //     recipientUserIds,
      //     deliveryChannels: ['in_app', 'websocket'],
      //     title: 'New message',
      //     body: payload?.preview || `${payload?.actorName || 'A teammate'} sent a new message.`,
      //     targetUrl: payload?.targetUrl || '/workspaces',
      //   };
      case 'message.mentioned':
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'websocket'],
          title: 'You were mentioned',
          body: payload?.preview || `${payload?.actorName || 'A teammate'} mentioned you.`,
          targetUrl: payload?.targetUrl || '/workspaces',
        };
      default:
        return {
          recipientUserIds,
          deliveryChannels: ['in_app', 'websocket'],
          title: payload?.title || 'Notification',
          body: payload?.body || 'You have a new notification.',
          targetUrl: payload?.targetUrl || '/workspaces',
        };
    }
  }

  private normalizeRecipients(recipientUserIds: string[] = [], actorUserId?: string): string[] {
    const deduped = Array.from(new Set((recipientUserIds || []).filter(Boolean)));
    if (!actorUserId) {
      return deduped;
    }
    return deduped.filter((id) => id !== actorUserId);
  }
}
