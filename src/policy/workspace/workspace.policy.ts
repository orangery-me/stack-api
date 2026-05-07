import { Injectable } from '@nestjs/common';
import { WorkspaceEntity } from '@app/entities';
import { WorkspaceDto } from '@app/modules/workspaces/dto/workspace.dto';
import { PermissionService, WorkspacePermissions } from '../permission.service';
import { WorkspacePlanEnum } from '@Constant/enums';

@Injectable()
export class WorkspacePolicy {
  constructor(private readonly permissionService: PermissionService) {}

  map(workspace: WorkspaceEntity, permissions: WorkspacePermissions | null | undefined): WorkspaceDto | null {
    let dto: WorkspaceDto | null = null;
    console.log('permissions: ', permissions);
    if (!permissions || !permissions.actions || !permissions.dataScopes) {
      return null;
    }

    if (this.permissionService.hasDataScope(permissions, 'workspace', 'basic')) {
      dto = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        ownerId: workspace.ownerId,
        createdAt: workspace.createdAt,
      };

      if (this.permissionService.hasDataScope(permissions, 'workspace', 'settings')) {
        dto.settings = workspace.settings || {};
      }

      if (this.permissionService.hasDataScope(permissions, 'workspace', 'plan')) {
        dto.plan = (workspace.plan as WorkspacePlanEnum) || WorkspacePlanEnum.FREE;
      }
    }

    return dto;
  }
}
