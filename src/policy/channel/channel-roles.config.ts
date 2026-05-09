import type { ChannelPermissions } from '../permission.service';

export interface ChannelRoleConfig {
  name: 'manager' | 'member';
  permissions: ChannelPermissions;
}

export const DEFAULT_CHANNEL_ROLES: ChannelRoleConfig[] = [
  {
    name: 'manager',
    permissions: {
      actions: {
        'channel:*': true,
        'message:*': true,
        'task:*': true,
      },
      dataScopes: {
        channel: ['basic', 'settings'],
      },
    },
  },
  {
    name: 'member',
    permissions: {
      actions: {
        'channel:view': true,
        'channel:join': true,
        'channel:invite_member': true,
        'channel:post_message': true,
        'channel:pin_message': true,
        'channel:create_thread': true,
        'message:create': true,
        'message:view': true,
        'task:create': true,
        'task:view': true,
        'task:update_own': true,
        'task:delete_own': true,
      },
      dataScopes: {
        channel: ['basic'],
      },
    },
  },
];

