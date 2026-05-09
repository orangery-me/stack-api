import { ChannelPermissions } from '../permission.service';

export type TaskPermissionAction =
  | 'task:create'
  | 'task:view'
  | 'task:update'
  | 'task:delete';

export interface TaskPermissionContext {
  isCreator?: boolean;
  isAssignee?: boolean;
}

export function canPerformTaskAction(
  permissions: ChannelPermissions | null | undefined,
  action: TaskPermissionAction,
  context?: TaskPermissionContext,
): boolean {
  if (!permissions?.actions) {
    return false;
  }

  // If user has exact permission or wildcard `task:*`
  const hasExact = permissions.actions[action] === true;
  const hasWildcard = permissions.actions['task:*'] === true;

  if (hasExact || hasWildcard) {
    return true;
  }

  // Handle specific ownership rules
  if (action === 'task:update' && permissions.actions['task:update_own'] === true) {
    return !!context?.isCreator || !!context?.isAssignee;
  }

  if (action === 'task:delete' && permissions.actions['task:delete_own'] === true) {
    return !!context?.isCreator;
  }

  return false;
}
