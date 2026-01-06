import { Injectable } from '@nestjs/common';

export interface WorkspacePermissions {
  actions: Record<string, boolean>;
  dataScopes?: Record<string, string[]>;
}

@Injectable()
export class PermissionService {
  hasAction(permissions: WorkspacePermissions, action: string): boolean {
    if (!permissions || !permissions.actions) return false;

    if (permissions.actions[action]) return true;

    const wildcard = action.split(':')[0] + ':*';
    return permissions.actions[wildcard] === true;
  }

  hasDataScope(permissions: WorkspacePermissions, resource: string, scope: string): boolean {
    return permissions?.dataScopes?.[resource]?.includes(scope) || false;
  }
}
