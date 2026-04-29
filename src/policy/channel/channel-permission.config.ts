export type ChannelRoleName = 'manager' | 'member';

export type ChannelPermissionPolicy = 'manager_only' | 'all_members';

export interface ChannelPermissionSettings {
  invitePolicy: ChannelPermissionPolicy;
  postPolicy: ChannelPermissionPolicy;
  pinMessagePolicy: ChannelPermissionPolicy;
  threadPolicy: ChannelPermissionPolicy;
}

export interface ChannelSettingsShape {
  permissions?: Partial<ChannelPermissionSettings> | null;
  [key: string]: any;
}

export type ChannelPermissionAction =
  | 'channel:delete'
  | 'channel:kick_member'
  | 'channel:transfer_manager'
  | 'channel:invite_member'
  | 'channel:post_message'
  | 'channel:pin_message'
  | 'channel:create_thread';

export interface ChannelActionConfigEntry {
  type: 'static' | 'dynamic';
  allowedRoles?: ChannelRoleName[];
  settingKey?: keyof ChannelPermissionSettings;
}

export const DEFAULT_CHANNEL_PERMISSION_SETTINGS: ChannelPermissionSettings = {
  invitePolicy: 'manager_only',
  postPolicy: 'all_members',
  pinMessagePolicy: 'manager_only',
  threadPolicy: 'all_members',
};

export const CHANNEL_ACTION_CONFIG: Record<ChannelPermissionAction, ChannelActionConfigEntry> = {
  'channel:delete': {
    type: 'static',
    allowedRoles: ['manager'],
  },
  'channel:kick_member': {
    type: 'static',
    allowedRoles: ['manager'],
  },
  'channel:transfer_manager': {
    type: 'static',
    allowedRoles: ['manager'],
  },
  'channel:invite_member': {
    type: 'dynamic',
    settingKey: 'invitePolicy',
  },
  'channel:post_message': {
    type: 'dynamic',
    settingKey: 'postPolicy',
  },
  'channel:pin_message': {
    type: 'dynamic',
    settingKey: 'pinMessagePolicy',
  },
  'channel:create_thread': {
    type: 'dynamic',
    settingKey: 'threadPolicy',
  },
};

export const CHANNEL_PERMISSION_CAPABILITY_MAP = {
  canDelete: 'channel:delete',
  canKick: 'channel:kick_member',
  canTransferManager: 'channel:transfer_manager',
  canInvite: 'channel:invite_member',
  canPost: 'channel:post_message',
  canPinMessage: 'channel:pin_message',
  canCreateThread: 'channel:create_thread',
} as const;

export type ChannelCapabilityKey = keyof typeof CHANNEL_PERMISSION_CAPABILITY_MAP;

export type ChannelCapabilityMap = Partial<Record<ChannelCapabilityKey, boolean>>;

export function normalizeChannelPermissionSettings(
  settings?: ChannelSettingsShape | Record<string, any> | null
): ChannelPermissionSettings {
  const incomingPermissions =
    settings && typeof settings === 'object' && settings.permissions && typeof settings.permissions === 'object'
      ? settings.permissions
      : {};

  return {
    ...DEFAULT_CHANNEL_PERMISSION_SETTINGS,
    ...incomingPermissions,
  };
}

export function buildChannelSettings(
  settings?: ChannelSettingsShape | Record<string, any> | null
): ChannelSettingsShape {
  return {
    ...(settings || {}),
    permissions: normalizeChannelPermissionSettings(settings),
  };
}
