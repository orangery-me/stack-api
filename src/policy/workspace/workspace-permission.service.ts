import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMemberEntity } from '@app/entities';
import { UserRoleEnum, WorkspaceMemberStatusEnum, WorkspaceRoleNameEnum } from '@Constant/enums';
import { PermissionService, WorkspacePermissions } from '../permission.service';
import {
  buildWorkspaceCapabilityMap,
  normalizeWorkspacePermissions,
  WorkspaceCapabilityMap,
  WorkspacePermissionAction,
} from './workspace-roles.config';

export interface WorkspacePermissionContext {
  member: WorkspaceMemberEntity | null;
  permissions: WorkspacePermissions | null;
  isSystemAdmin: boolean;
}

const SYSTEM_ADMIN_WORKSPACE_PERMISSIONS: WorkspacePermissions = {
  actions: {
    'workspace:*': true,
    'member:*': true,
    'channel:*': true,
  },
  dataScopes: {
    workspace: ['basic', 'settings', 'plan'],
  },
};

@Injectable()
export class WorkspacePermissionService {
  constructor(
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    private readonly permissionService: PermissionService
  ) {}

  async resolveContext(
    workspaceId: string,
    userId: string,
    userRole?: string
  ): Promise<WorkspacePermissionContext> {
    const isSystemAdmin = userRole === UserRoleEnum.ADMIN.toString();
    if (isSystemAdmin) {
      return {
        member: null,
        permissions: SYSTEM_ADMIN_WORKSPACE_PERMISSIONS,
        isSystemAdmin,
      };
    }

    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['role', 'workspace', 'user'],
    });

    if (!member) {
      return {
        member: null,
        permissions: null,
        isSystemAdmin: false,
      };
    }

    const permissions = normalizeWorkspacePermissions(member.role?.permissions);
    if (
      member.role?.name === WorkspaceRoleNameEnum.ADMIN &&
      permissions?.actions?.['message:*'] === true &&
      permissions.actions['member:*'] === true &&
      permissions.actions['channel:*'] === true
    ) {
      permissions.actions['workspace:update_settings'] = true;
    }

    return {
      member,
      permissions,
      isSystemAdmin: false,
    };
  }

  async enforceWorkspaceAction(
    workspaceId: string,
    userId: string,
    action: WorkspacePermissionAction,
    userRole?: string
  ): Promise<WorkspacePermissionContext> {
    const context = await this.resolveContext(workspaceId, userId, userRole);

    if (!context.permissions || !this.permissionService.hasAction(context.permissions, action)) {
      throw new ForbiddenException('You do not have permission to perform this action in this workspace');
    }

    return context;
  }

  async enforceWorkspaceMember(
    workspaceId: string,
    userId: string,
    userRole?: string
  ): Promise<WorkspacePermissionContext> {
    const context = await this.resolveContext(workspaceId, userId, userRole);

    if (!context.isSystemAdmin && !context.member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return context;
  }

  buildCapabilityMap(permissions: WorkspacePermissions | null | undefined): WorkspaceCapabilityMap {
    return buildWorkspaceCapabilityMap(permissions, (candidatePermissions, action) =>
      this.permissionService.hasAction(candidatePermissions, action)
    );
  }
}
