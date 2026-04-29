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
      },
      dataScopes: {
        channel: ['basic'],
      },
    },
  },
];
