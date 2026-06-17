import { WorkspaceRoleNameEnum } from '@Constant/enums';
import type { WorkspacePermissions } from '../permission.service';

export const WORKSPACE_PERMISSION_ACTIONS = [
  'workspace:manage_roles',
  'workspace:update_settings',
  'member:invite',
  'member:update_role',
  'member:remove',
  'channel:create',
] as const;

export const WORKSPACE_PERMISSION_WILDCARDS = ['workspace:*', 'member:*', 'channel:*'] as const;

export type WorkspacePermissionAction = (typeof WORKSPACE_PERMISSION_ACTIONS)[number];
export type WorkspacePermissionWildcard = (typeof WORKSPACE_PERMISSION_WILDCARDS)[number];
export type WorkspacePermissionKey = WorkspacePermissionAction | WorkspacePermissionWildcard;

export const WORKSPACE_PERMISSION_LABELS: Record<WorkspacePermissionAction, string> = {
  'workspace:manage_roles': 'Có thể quản lý role và quyền',
  'workspace:update_settings': 'Có thể chỉnh cài đặt workspace',
  'member:invite': 'Có thể mời thành viên',
  'member:update_role': 'Có thể đổi role thành viên',
  'member:remove': 'Có thể xóa thành viên khỏi workspace',
  'channel:create': 'Có thể tạo channel',
};

export interface WorkspaceCapabilityMap {
  canInviteMembers: boolean;
  canUpdateMemberRole: boolean;
  canRemoveMembers: boolean;
  canCreateChannel: boolean;
  canManageWorkspaceRoles: boolean;
  canUpdateWorkspaceSettings: boolean;
}

export interface WorkspaceRoleConfig {
  name: WorkspaceRoleNameEnum;
  permissions: WorkspacePermissions;
}

const allowedWorkspacePermissionKeys = new Set<string>([
  ...WORKSPACE_PERMISSION_ACTIONS,
  ...WORKSPACE_PERMISSION_WILDCARDS,
]);

export function isAllowedWorkspacePermissionKey(action: string): action is WorkspacePermissionKey {
  return allowedWorkspacePermissionKeys.has(action);
}

export function normalizeWorkspacePermissions(permissions?: Record<string, any> | null): WorkspacePermissions | null {
  if (!permissions || typeof permissions !== 'object') {
    return null;
  }

  const actions = permissions.actions;
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
    return null;
  }

  const normalizedActions = Object.entries(actions).reduce<Record<string, boolean>>((acc, [action, enabled]) => {
    if (enabled === true) {
      acc[action] = true;
    }
    return acc;
  }, {});

  const dataScopes =
    permissions.dataScopes && typeof permissions.dataScopes === 'object' && !Array.isArray(permissions.dataScopes)
      ? permissions.dataScopes
      : undefined;

  return {
    actions: normalizedActions,
    ...(dataScopes ? { dataScopes } : {}),
  };
}

export function validateWorkspacePermissions(permissions?: Record<string, any> | null): void {
  if (!permissions || typeof permissions !== 'object') {
    return;
  }

  const actions = permissions.actions;
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
    return;
  }

  for (const action of Object.keys(actions)) {
    if (!isAllowedWorkspacePermissionKey(action)) {
      throw new Error(`Invalid workspace permission action: ${action}`);
    }
  }
}

export function buildWorkspaceCapabilityMap(
  permissions: WorkspacePermissions | null | undefined,
  hasAction: (permissions: WorkspacePermissions, action: WorkspacePermissionAction) => boolean
): WorkspaceCapabilityMap {
  const can = (action: WorkspacePermissionAction) => (permissions ? hasAction(permissions, action) : false);

  return {
    canInviteMembers: can('member:invite'),
    canUpdateMemberRole: can('member:update_role'),
    canRemoveMembers: can('member:remove'),
    canCreateChannel: can('channel:create'),
    canManageWorkspaceRoles: can('workspace:manage_roles'),
    canUpdateWorkspaceSettings: can('workspace:update_settings'),
  };
}

export const DEFAULT_WORKSPACE_ROLES: WorkspaceRoleConfig[] = [
  {
    name: WorkspaceRoleNameEnum.OWNER,
    permissions: {
      actions: {
        'workspace:*': true,
        'member:*': true,
        'channel:*': true,
      },
      dataScopes: {
        workspace: ['basic', 'settings', 'plan'],
      },
    },
  },
  {
    name: WorkspaceRoleNameEnum.ADMIN,
    permissions: {
      actions: {
        'workspace:update_settings': true,
        'member:*': true,
        'channel:create': true,
      },
      dataScopes: {
        workspace: ['basic', 'settings', 'plan'],
      },
    },
  },
  {
    name: WorkspaceRoleNameEnum.MEMBER,
    permissions: {
      actions: {},
      dataScopes: {
        workspace: ['basic', 'plan'],
      },
    },
  },
];
