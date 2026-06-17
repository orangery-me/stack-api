import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity, WorkspaceRoleEntity, WorkspaceMemberEntity } from '@app/entities';
import { WorkspaceRoleNameEnum } from '@Constant/enums';
import { CreateWorkspaceRoleDto } from '../dto/create-workspace-role.dto';
import { UpdateWorkspaceRoleDto } from '../dto/update-workspace-role.dto';
import { WorkspacePermissionService } from '../../../policy/workspace/workspace-permission.service';
import { validateWorkspacePermissions } from '../../../policy/workspace/workspace-roles.config';

@Injectable()
export class AdminWorkspaceRolesService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceRoleEntity)
    private readonly workspaceRoleRepository: Repository<WorkspaceRoleEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    private readonly workspacePermissionService: WorkspacePermissionService
  ) {}

  private validatePermissionsPayload(permissions?: Record<string, any>): void {
    if (permissions === undefined) {
      return;
    }

    try {
      validateWorkspacePermissions(permissions);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid workspace permissions');
    }
  }

  async getWorkspaceRoles(workspaceId: string, userId: string, userRole: string): Promise<WorkspaceRoleEntity[]> {
    await this.workspacePermissionService.enforceWorkspaceMember(workspaceId, userId, userRole);

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.workspaceRoleRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async createWorkspaceRole(
    workspaceId: string,
    dto: CreateWorkspaceRoleDto,
    userId: string,
    userRole: string
  ): Promise<WorkspaceRoleEntity> {
    await this.workspacePermissionService.enforceWorkspaceAction(
      workspaceId,
      userId,
      'workspace:manage_roles',
      userRole
    );
    this.validatePermissionsPayload(dto.permissions);

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check duplicate name (case-insensitive) in this workspace
    const existing = await this.workspaceRoleRepository
      .createQueryBuilder('role')
      .where('role.workspaceId = :workspaceId', { workspaceId })
      .andWhere('LOWER(role.name) = LOWER(:name)', { name: dto.name })
      .getOne();

    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" already exists in this workspace`);
    }

    const role = this.workspaceRoleRepository.create({
      workspaceId,
      name: dto.name,
      permissions: dto.permissions || {},
    });

    return this.workspaceRoleRepository.save(role);
  }

  async updateWorkspaceRole(
    roleId: string,
    dto: UpdateWorkspaceRoleDto,
    userId: string,
    userRole: string
  ): Promise<WorkspaceRoleEntity> {
    const role = await this.workspaceRoleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Workspace role not found');
    }

    await this.workspacePermissionService.enforceWorkspaceAction(
      role.workspaceId,
      userId,
      'workspace:manage_roles',
      userRole
    );
    this.validatePermissionsPayload(dto.permissions);

    const defaultRoles = [
      WorkspaceRoleNameEnum.OWNER.toString(),
      WorkspaceRoleNameEnum.ADMIN.toString(),
      WorkspaceRoleNameEnum.MEMBER.toString(),
    ];

    const isDefaultRole = defaultRoles.includes(role.name);

    if (role.name === WorkspaceRoleNameEnum.OWNER.toString() && dto.permissions !== undefined) {
      throw new ForbiddenException('Cannot change permissions of the owner role');
    }

    if (dto.name && dto.name !== role.name) {
      if (isDefaultRole) {
        throw new ForbiddenException('Cannot change the name of default workspace roles');
      }

      // Check duplicate name (case-insensitive) in the same workspace for other roles
      const existing = await this.workspaceRoleRepository
        .createQueryBuilder('role')
        .where('role.workspaceId = :workspaceId', { workspaceId: role.workspaceId })
        .andWhere('role.id != :roleId', { roleId })
        .andWhere('LOWER(role.name) = LOWER(:name)', { name: dto.name })
        .getOne();

      if (existing) {
        throw new ConflictException(`Role with name "${dto.name}" already exists in this workspace`);
      }

      role.name = dto.name;
    }

    if (dto.permissions !== undefined) {
      role.permissions = dto.permissions;
    }

    return this.workspaceRoleRepository.save(role);
  }

  async deleteWorkspaceRole(roleId: string, userId: string, userRole: string): Promise<void> {
    const role = await this.workspaceRoleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Workspace role not found');
    }

    await this.workspacePermissionService.enforceWorkspaceAction(
      role.workspaceId,
      userId,
      'workspace:manage_roles',
      userRole
    );

    const defaultRoles = [
      WorkspaceRoleNameEnum.OWNER.toString(),
      WorkspaceRoleNameEnum.ADMIN.toString(),
      WorkspaceRoleNameEnum.MEMBER.toString(),
    ];

    if (defaultRoles.includes(role.name)) {
      throw new ForbiddenException('Cannot delete default workspace roles');
    }

    // Check if any workspace member is currently using this role
    const memberCount = await this.workspaceMemberRepository.count({
      where: { roleId },
    });

    if (memberCount > 0) {
      throw new ConflictException(
        'Cannot delete role because it is currently assigned to some members. Please reassign those members first.'
      );
    }

    await this.workspaceRoleRepository.remove(role);
  }

  async updateMemberRole(
    memberId: string,
    roleId: string,
    userId: string,
    userRole: string
  ): Promise<WorkspaceMemberEntity> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { id: memberId },
      relations: ['role', 'workspace'],
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    await this.workspacePermissionService.enforceWorkspaceAction(
      member.workspaceId,
      userId,
      'member:update_role',
      userRole
    );

    const newRole = await this.workspaceRoleRepository.findOne({
      where: { id: roleId, workspaceId: member.workspaceId },
    });
    if (!newRole) {
      throw new NotFoundException('Workspace role not found or does not belong to this workspace');
    }

    // Prevent assigning the owner role to any member
    if (newRole.name === WorkspaceRoleNameEnum.OWNER.toString()) {
      throw new ForbiddenException('Cannot assign owner role to a member');
    }

    // Check if member is the owner of the workspace
    if (member.userId === member.workspace.ownerId) {
      throw new ForbiddenException('Cannot change the role of the workspace owner');
    }

    member.roleId = roleId;
    member.role = newRole;
    return this.workspaceMemberRepository.save(member);
  }

  async removeWorkspaceMember(memberId: string, userId: string, userRole: string): Promise<void> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { id: memberId },
      relations: ['workspace'],
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    await this.workspacePermissionService.enforceWorkspaceAction(member.workspaceId, userId, 'member:remove', userRole);

    if (member.userId === member.workspace.ownerId) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    await this.workspaceMemberRepository.remove(member);
  }
}
