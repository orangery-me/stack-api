import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { ResponseItem } from '@app/common/dtos';
import { UserEntity } from '@app/entities';
import { WorkspaceEntity, WorkspaceRoleEntity, WorkspaceMemberEntity, WorkspaceInviteEntity } from '@app/entities';
import { WorkspaceMemberStatusEnum, WorkspaceRoleNameEnum, WorkspacePlanEnum } from '@Constant/enums';
import { EmailService } from '../email/email.service';
import { WorkspacePolicy } from '../../policy/workspace.policy';
import { DEFAULT_WORKSPACE_ROLES } from '../../policy/workspace-roles.config';
import { WorkspacePermissions } from '../../policy/permission.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { WorkspaceDto } from './dto/workspace.dto';
import { WorkspaceMemberDto } from './dto/workspace-member.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceRoleEntity)
    private readonly workspaceRoleRepository: Repository<WorkspaceRoleEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(WorkspaceInviteEntity)
    private readonly workspaceInviteRepository: Repository<WorkspaceInviteEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly emailService: EmailService,
    private readonly workspacePolicy: WorkspacePolicy
  ) {}

  private generateSlug(name: string): string {
    const slugBase = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const timestamp = Date.now();
    return `${slugBase}-${timestamp}`;
  }

  private async checkDuplicateName(userId: string, name: string): Promise<void> {
    // Get all workspaces where user is a member
    const members = await this.workspaceMemberRepository.find({
      where: { userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['workspace'],
    });

    const userWorkspaces = members.map((m) => m.workspace).filter((w) => w !== null);
    const duplicateWorkspace = userWorkspaces.find((w) => w.name.toLowerCase().trim() === name.toLowerCase().trim());

    if (duplicateWorkspace) {
      throw new BadRequestException('You already have a workspace with this name');
    }
  }

  async createWorkspace(userId: string, createDto: CreateWorkspaceDto): Promise<ResponseItem<WorkspaceDto>> {
    // Check duplicate name for this user
    await this.checkDuplicateName(userId, createDto.name);

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    // Generate slug automatically
    let slug = this.generateSlug(createDto.name);
    let slugExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure slug is unique (in case of collision)
    while (slugExists && attempts < maxAttempts) {
      const existingWorkspace = await this.workspaceRepository.findOne({
        where: { slug },
      });

      if (!existingWorkspace) {
        slugExists = false;
      } else {
        slug = this.generateSlug(createDto.name);
        attempts++;
      }
    }

    if (slugExists) {
      throw new BadRequestException('Unable to generate a unique slug for this workspace');
    }

    // Create workspace
    const workspace = this.workspaceRepository.create({
      name: createDto.name,
      slug,
      ownerId: userId,
      plan: createDto.plan || WorkspacePlanEnum.FREE,
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Initialize default roles
    await this.initializeDefaultRoles(savedWorkspace.id);

    // Get owner role
    const ownerRole = await this.workspaceRoleRepository.findOne({
      where: {
        workspaceId: savedWorkspace.id,
        name: WorkspaceRoleNameEnum.OWNER,
      },
    });

    if (!ownerRole) {
      throw new BadRequestException('Unable to create owner role');
    }

    // Create workspace member for creator (owner) with displayName
    const workspaceMember = this.workspaceMemberRepository.create({
      workspaceId: savedWorkspace.id,
      userId: userId,
      roleId: ownerRole.id,
      displayName: createDto.displayName,
      status: WorkspaceMemberStatusEnum.ACTIVE,
    });

    await this.workspaceMemberRepository.save(workspaceMember);

    // Process invites if provided
    if (createDto.invites && createDto.invites.length > 0) {
      for (const inviteItem of createDto.invites) {
        // Verify user exists
        const invitedUser = await this.userRepository.findOne({
          where: { email: inviteItem.email, deletedAt: IsNull() },
        });

        if (!invitedUser) {
          continue; // Skip if user doesn't exist
        }

        // Check if user is already a member
        const existingMember = await this.workspaceMemberRepository.findOne({
          where: { workspaceId: savedWorkspace.id, userId: invitedUser.id },
        });

        if (existingMember) {
          continue; // Skip if already a member
        }

        // Verify role exists by name
        const inviteRole = await this.workspaceRoleRepository.findOne({
          where: { name: inviteItem.role, workspaceId: savedWorkspace.id },
        });

        if (!inviteRole) {
          continue; // Skip if role doesn't exist
        }

        // Generate invite token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invite
        const invite = this.workspaceInviteRepository.create({
          workspaceId: savedWorkspace.id,
          email: inviteItem.email,
          roleId: inviteRole.id,
          invitedBy: workspaceMember.id,
          token,
          expiresAt,
        });

        await this.workspaceInviteRepository.save(invite);

        // Send invite email
        await this.emailService.sendWorkspaceInviteEmail(
          inviteItem.email,
          createDto.displayName || user.name,
          savedWorkspace.name,
          inviteRole.name,
          token
        );
      }
    }

    const workspaceDto: WorkspaceDto = {
      id: savedWorkspace.id,
      name: savedWorkspace.name,
      slug: savedWorkspace.slug,
      ownerId: savedWorkspace.ownerId,
      plan: savedWorkspace.plan as WorkspacePlanEnum,
      settings: savedWorkspace.settings,
      createdAt: savedWorkspace.createdAt,
    };

    return new ResponseItem<WorkspaceDto>(workspaceDto, 'Workspace created successfully');
  }

  async initializeDefaultRoles(workspaceId: string): Promise<void> {
    for (const roleData of DEFAULT_WORKSPACE_ROLES) {
      const role = this.workspaceRoleRepository.create({
        workspaceId,
        name: roleData.name,
        permissions: roleData.permissions,
      });
      await this.workspaceRoleRepository.save(role);
    }
  }

  async inviteMember(
    workspaceId: string,
    inviterUserId: string,
    inviteDto: InviteMemberDto
  ): Promise<ResponseItem<{ message: string }>> {
    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    // Verify inviter is a member and has permission (owner or admin)
    const inviterMember = await this.workspaceMemberRepository.findOne({
      where: { userId: inviterUserId, workspaceId },
      relations: ['role'],
    });

    if (!inviterMember) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    const inviterRole = inviterMember.role;
    if (inviterRole.name !== WorkspaceRoleNameEnum.OWNER && inviterRole.name !== WorkspaceRoleNameEnum.ADMIN) {
      throw new UnauthorizedException('You do not have permission to invite members');
    }

    // Verify role exists in workspace
    const role = await this.workspaceRoleRepository.findOne({
      where: { id: inviteDto.roleId, workspaceId },
    });

    if (!role) {
      throw new NotFoundException('Role does not exist in this workspace');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { email: inviteDto.email, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User does not exist in the system');
    }

    // Check if user is already a member
    const existingMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: user.id },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    // Check if there's a pending invite
    const existingInvite = await this.workspaceInviteRepository.findOne({
      where: {
        workspaceId,
        email: inviteDto.email,
        acceptedAt: IsNull(),
      },
    });

    if (existingInvite && existingInvite.expiresAt > new Date()) {
      throw new BadRequestException('There is already a pending invitation for this user');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = this.workspaceInviteRepository.create({
      workspaceId,
      email: inviteDto.email,
      roleId: inviteDto.roleId,
      invitedBy: inviterMember.id,
      token,
      expiresAt,
    });

    await this.workspaceInviteRepository.save(invite);

    // Send invite email
    const inviterUser = await this.userRepository.findOne({
      where: { id: inviterMember.userId },
    });

    await this.emailService.sendWorkspaceInviteEmail(
      inviteDto.email,
      inviterUser?.name || 'Someone',
      workspace.name,
      role.name,
      token
    );

    return new ResponseItem<{ message: string }>(
      { message: 'Invitation has been sent' },
      'Workspace invitation sent successfully'
    );
  }

  async acceptInvite(token: string, userId: string): Promise<ResponseItem<{ message: string; workspaceId: string }>> {
    // Find invite by token
    const invite = await this.workspaceInviteRepository.findOne({
      where: { token },
      relations: ['workspace', 'role'],
    });

    if (!invite) {
      throw new NotFoundException('Invitation token is invalid');
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Verify user exists and matches email
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    if (user.email !== invite.email) {
      throw new UnauthorizedException('Email does not match the invitation');
    }

    // Check if user is already a member
    const existingMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId: invite.workspaceId, userId: user.id },
    });

    if (existingMember) {
      throw new BadRequestException('You are already a member of this workspace');
    }

    // Create workspace member
    const workspaceMember = this.workspaceMemberRepository.create({
      workspaceId: invite.workspaceId,
      userId: user.id,
      roleId: invite.roleId,
      status: WorkspaceMemberStatusEnum.ACTIVE,
    });

    await this.workspaceMemberRepository.save(workspaceMember);

    // Update invite as accepted
    invite.acceptedAt = new Date();
    await this.workspaceInviteRepository.save(invite);

    return new ResponseItem<{ message: string; workspaceId: string }>(
      { message: 'Joined workspace successfully', workspaceId: invite.workspaceId },
      'Workspace invitation accepted successfully'
    );
  }

  async getWorkspaceById(workspaceId: string, userId: string): Promise<ResponseItem<WorkspaceDto>> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId,
      },
      relations: ['workspace', 'role'],
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const { workspace, role } = membership;

    let normalizedPermissions: WorkspacePermissions | null = null;
    if (role?.permissions) {
      if (role.permissions.actions && typeof role.permissions.actions === 'object') {
        normalizedPermissions = role.permissions as WorkspacePermissions;
      }
    }

    const dto = this.workspacePolicy.map(workspace, normalizedPermissions);

    return new ResponseItem<WorkspaceDto>(dto, 'Workspace fetched successfully');
  }

  async getWorkspaceMembers(workspaceId: string): Promise<ResponseItem<WorkspaceMemberDto[]>> {
    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    // Get all members with relations
    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId },
      relations: ['user', 'role'],
      order: { joinedAt: 'ASC' },
    });

    const memberDtos: WorkspaceMemberDto[] = members.map((member) => ({
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      avatar: member.user.avatar || undefined,
      roleId: member.roleId,
      roleName: member.role.name,
      permissions: member.role.permissions,
      status: member.status as WorkspaceMemberStatusEnum,
      joinedAt: member.joinedAt,
    }));

    return new ResponseItem<WorkspaceMemberDto[]>(memberDtos, 'Workspace members fetched successfully');
  }

  async getUserWorkspaces(userId: string): Promise<ResponseItem<WorkspaceDto[]>> {
    // Get all workspaces where user is a member
    const members = await this.workspaceMemberRepository.find({
      where: { userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['workspace'],
      order: { joinedAt: 'DESC' },
    });

    // Filter out members with null workspace and map to DTOs
    const workspaceDtos: WorkspaceDto[] = members
      .filter((member) => member.workspace !== null)
      .map((member) => ({
        id: member.workspace.id,
        name: member.workspace.name,
        slug: member.workspace.slug,
        ownerId: member.workspace.ownerId,
        plan: member.workspace.plan as WorkspacePlanEnum,
        settings: member.workspace.settings,
        createdAt: member.workspace.createdAt,
      }));

    return new ResponseItem<WorkspaceDto[]>(workspaceDtos, 'Workspaces fetched successfully');
  }
}
