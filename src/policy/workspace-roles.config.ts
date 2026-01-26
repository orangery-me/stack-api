import { WorkspaceRoleNameEnum } from '@Constant/enums';
import type { WorkspacePermissions } from './permission.service';

export interface WorkspaceRoleConfig {
  name: WorkspaceRoleNameEnum;
  permissions: WorkspacePermissions;
}

export const DEFAULT_WORKSPACE_ROLES: WorkspaceRoleConfig[] = [
  {
    name: WorkspaceRoleNameEnum.OWNER,
    permissions: {
      actions: {
        'workspace:*': true,
        'member:*': true,
        'channel:*': true,
        'message:*': true,
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
        'workspace:view': true,
        'member:*': true,
        'channel:*': true,
        'message:*': true,
      },
      dataScopes: {
        workspace: ['basic', 'settings', 'plan'],
      },
    },
  },
  {
    name: WorkspaceRoleNameEnum.MEMBER,
    permissions: {
      actions: {
        'workspace:view': true,
        'channel:view': true,
        'channel:join': true,
        'message:create': true,
        'message:view': true,
      },
      dataScopes: {
        workspace: ['basic', 'plan'],
      },
    },
  },
];
