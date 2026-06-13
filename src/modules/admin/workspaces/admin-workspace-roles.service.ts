import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity, WorkspaceRoleEntity, WorkspaceMemberEntity } from '@app/entities';
import { WorkspaceRoleNameEnum, UserRoleEnum } from '@Constant/enums';
import { CreateWorkspaceRoleDto } from '../dto/create-workspace-role.dto';
import { UpdateWorkspaceRoleDto } from '../dto/update-workspace-role.dto';

@Injectable()
export class AdminWorkspaceRolesService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceRoleEntity)
    private readonly workspaceRoleRepository: Repository<WorkspaceRoleEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  private async checkWorkspacePermission(workspaceId: string, userId: string, userRole: string): Promise<void> {
    if (userRole === UserRoleEnum.ADMIN.toString()) return; // System Admin bypass

    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: 'active' },
      relations: ['role'],
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const roleName = member.role?.name?.toLowerCase();
    if (roleName !== 'owner' && roleName !== 'admin') {
      throw new ForbiddenException('You do not have permission to manage this workspace');
    }
  }

  async getWorkspaceRoles(workspaceId: string, userId: string, userRole: string): Promise<WorkspaceRoleEntity[]> {
    await this.checkWorkspacePermission(workspaceId, userId, userRole);

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
    userRole: string,
  ): Promise<WorkspaceRoleEntity> {
    await this.checkWorkspacePermission(workspaceId, userId, userRole);

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
    userRole: string,
  ): Promise<WorkspaceRoleEntity> {
    const role = await this.workspaceRoleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Workspace role not found');
    }

    await this.checkWorkspacePermission(role.workspaceId, userId, userRole);

    const defaultRoles = [
      WorkspaceRoleNameEnum.OWNER.toString(),
      WorkspaceRoleNameEnum.ADMIN.toString(),
      WorkspaceRoleNameEnum.MEMBER.toString(),
    ];

    const isDefaultRole = defaultRoles.includes(role.name);

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

    await this.checkWorkspacePermission(role.workspaceId, userId, userRole);

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
        'Cannot delete role because it is currently assigned to some members. Please reassign those members first.',
      );
    }

    await this.workspaceRoleRepository.remove(role);
  }

  async updateMemberRole(
    memberId: string,
    roleId: string,
    userId: string,
    userRole: string,
  ): Promise<WorkspaceMemberEntity> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { id: memberId },
      relations: ['role', 'workspace'],
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }

    await this.checkWorkspacePermission(member.workspaceId, userId, userRole);

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
}
