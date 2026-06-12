import { Injectable } from '@nestjs/common';
import { ChannelPermissions, PermissionService } from '../permission.service';
import {
  CHANNEL_ACTION_CONFIG,
  CHANNEL_PERMISSION_CAPABILITY_MAP,
  ChannelCapabilityMap,
  ChannelPermissionAction,
  ChannelRoleName,
  normalizeChannelPermissionSettings,
} from './channel-permission.config';

@Injectable()
export class ChannelPermissionResolver {
  constructor(private readonly permissionService: PermissionService) {}

  can(
    permissions: ChannelPermissions | null | undefined,
    action: ChannelPermissionAction,
    channelSettings?: Record<string, any> | null
  ): boolean {
    if (!permissions?.actions) {
      return false;
    }

    const actionConfig = CHANNEL_ACTION_CONFIG[action];
    if (!actionConfig) {
      return false;
    }

    const hasConfiguredAction = this.permissionService.hasAction(permissions, action);
    const hasFallbackAction = actionConfig.fallbackActions?.some((fallbackAction) =>
      this.permissionService.hasAction(permissions, fallbackAction)
    );
    if (!hasConfiguredAction && !hasFallbackAction) {
      return false;
    }

    if (actionConfig.type === 'static') {
      return this.matchesAllowedRoles(permissions, actionConfig.allowedRoles);
    }

    if (!actionConfig.settingKey) {
      return false;
    }

    const permissionSettings = normalizeChannelPermissionSettings(channelSettings);
    const policy = permissionSettings[actionConfig.settingKey];

    if (policy === 'all_members') {
      return true;
    }

    return this.matchesAllowedRoles(permissions, ['manager']);
  }

  buildCapabilityMap(
    permissions: ChannelPermissions | null | undefined,
    channelSettings?: Record<string, any> | null
  ): ChannelCapabilityMap {
    return Object.entries(CHANNEL_PERMISSION_CAPABILITY_MAP).reduce<ChannelCapabilityMap>((capabilities, entry) => {
      const [capability, action] = entry as [keyof typeof CHANNEL_PERMISSION_CAPABILITY_MAP, ChannelPermissionAction];

      capabilities[capability] = this.can(permissions, action, channelSettings);
      return capabilities;
    }, {});
  }

  private matchesAllowedRoles(permissions: ChannelPermissions, allowedRoles?: ChannelRoleName[] | undefined): boolean {
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    if (allowedRoles.includes('manager') && permissions.actions['channel:*'] === true) {
      return true;
    }

    return false;
  }
}
