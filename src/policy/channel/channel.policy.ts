import { Injectable } from '@nestjs/common';
import { ChannelEntity } from '@app/entities';
import { ChannelDto } from '@app/modules/channels/dto/channel.dto';
import { PermissionService, ChannelPermissions } from '../permission.service';
import { ChannelType } from '@app/modules/channels/dto/create-channel.dto';
import { buildChannelSettings } from './channel-permission.config';
import { ChannelPermissionResolver } from './channel-permission.resolver';

@Injectable()
export class ChannelPolicy {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly channelPermissionResolver: ChannelPermissionResolver
  ) {}

  map(channel: ChannelEntity, permissions: ChannelPermissions | null | undefined): ChannelDto | null {
    let dto: ChannelDto | null = null;

    if (!permissions || !permissions.actions || !permissions.dataScopes) {
      return null;
    }

    if (this.permissionService.hasDataScope(permissions as any, 'channel', 'basic')) {
      dto = {
        id: channel.id,
        workspaceId: channel.workspaceId,
        type: channel.type as ChannelType,
        name: channel.name,
        createdById: channel.createdById,
        createdAt: channel.createdAt,
        isDefault: channel.isDefault,
      };

      if (this.permissionService.hasDataScope(permissions as any, 'channel', 'settings')) {
        dto.metadata = channel.metadata || {};
        dto.settings = buildChannelSettings(channel.settings);
      }

      dto.permissions = this.channelPermissionResolver.buildCapabilityMap(permissions, channel.settings);
    }

    return dto;
  }
}
