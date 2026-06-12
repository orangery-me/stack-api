export type ChannelRoleName = 'manager' | 'member';

export type ChannelPermissionPolicy = 'manager_only' | 'all_members';

export interface ChannelPermissionSettings {
  invitePolicy: ChannelPermissionPolicy;
  postPolicy: ChannelPermissionPolicy;
  pinMessagePolicy: ChannelPermissionPolicy;
  deleteMessagePolicy: ChannelPermissionPolicy;
  taskListCreatePolicy: ChannelPermissionPolicy;
  taskItemEditPolicy: ChannelPermissionPolicy;
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
  | 'channel:delete_message'
  | 'channel:create_task_list'
  | 'channel:edit_task_item';

export interface ChannelActionConfigEntry {
  type: 'static' | 'dynamic';
  allowedRoles?: ChannelRoleName[];
  settingKey?: keyof ChannelPermissionSettings;
  fallbackActions?: string[];
}

export const DEFAULT_CHANNEL_PERMISSION_SETTINGS: ChannelPermissionSettings = {
  invitePolicy: 'manager_only',
  postPolicy: 'all_members',
  pinMessagePolicy: 'manager_only',
  deleteMessagePolicy: 'all_members',
  taskListCreatePolicy: 'all_members',
  taskItemEditPolicy: 'all_members',
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
  'channel:delete_message': {
    type: 'dynamic',
    settingKey: 'deleteMessagePolicy',
  },
  'channel:create_task_list': {
    type: 'dynamic',
    settingKey: 'taskListCreatePolicy',
    fallbackActions: ['task:create'],
  },
  'channel:edit_task_item': {
    type: 'dynamic',
    settingKey: 'taskItemEditPolicy',
    fallbackActions: ['task:update', 'task:update_own'],
  },
};

export const CHANNEL_PERMISSION_CAPABILITY_MAP = {
  canDelete: 'channel:delete',
  canKick: 'channel:kick_member',
  canTransferManager: 'channel:transfer_manager',
  canInvite: 'channel:invite_member',
  canPost: 'channel:post_message',
  canPinMessage: 'channel:pin_message',
  canDeleteMessage: 'channel:delete_message',
  canCreateTaskList: 'channel:create_task_list',
  canEditTaskItem: 'channel:edit_task_item',
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

  const merged = {
    ...DEFAULT_CHANNEL_PERMISSION_SETTINGS,
    ...incomingPermissions,
  };

  return {
    invitePolicy: merged.invitePolicy,
    postPolicy: merged.postPolicy,
    pinMessagePolicy: merged.pinMessagePolicy,
    deleteMessagePolicy: merged.deleteMessagePolicy,
    taskListCreatePolicy: merged.taskListCreatePolicy,
    taskItemEditPolicy: merged.taskItemEditPolicy,
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
