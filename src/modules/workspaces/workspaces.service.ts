import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { ResponseItem } from '@app/common/dtos';
import { UserEntity } from '@app/entities';
import { WorkspaceEntity, WorkspaceRoleEntity, WorkspaceMemberEntity, WorkspaceInviteEntity } from '@app/entities';
import { WorkspaceMemberStatusEnum, WorkspaceRoleNameEnum, WorkspacePlanEnum } from '@Constant/enums';
import { EmailService } from '../email/email.service';
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
    private readonly emailService: EmailService
  ) {}

  async createWorkspace(userId: string, createDto: CreateWorkspaceDto): Promise<ResponseItem<WorkspaceDto>> {
    // Check if slug already exists
    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { slug: createDto.slug },
    });

    if (existingWorkspace) {
      throw new BadRequestException('Slug đã được sử dụng');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    // Create workspace
    const workspace = this.workspaceRepository.create({
      name: createDto.name,
      slug: createDto.slug,
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
      throw new BadRequestException('Không thể tạo owner role');
    }

    // Create workspace member for creator (owner)
    const workspaceMember = this.workspaceMemberRepository.create({
      workspaceId: savedWorkspace.id,
      userId: userId,
      roleId: ownerRole.id,
      status: WorkspaceMemberStatusEnum.ACTIVE,
    });

    await this.workspaceMemberRepository.save(workspaceMember);

    const workspaceDto: WorkspaceDto = {
      id: savedWorkspace.id,
      name: savedWorkspace.name,
      slug: savedWorkspace.slug,
      ownerId: savedWorkspace.ownerId,
      plan: savedWorkspace.plan as WorkspacePlanEnum,
      settings: savedWorkspace.settings,
      createdAt: savedWorkspace.createdAt,
    };

    return new ResponseItem<WorkspaceDto>(workspaceDto, 'Tạo workspace thành công');
  }

  async initializeDefaultRoles(workspaceId: string): Promise<void> {
    const defaultRoles = [
      {
        name: WorkspaceRoleNameEnum.OWNER,
        permissions: {
          'workspace:*': true,
          'member:*': true,
          'channel:*': true,
          'message:*': true,
        },
      },
      {
        name: WorkspaceRoleNameEnum.ADMIN,
        permissions: {
          'workspace:view': true,
          'member:*': true,
          'channel:*': true,
          'message:*': true,
        },
      },
      {
        name: WorkspaceRoleNameEnum.MEMBER,
        permissions: {
          'workspace:view': true,
          'channel:view': true,
          'channel:join': true,
          'message:create': true,
          'message:view': true,
        },
      },
    ];

    for (const roleData of defaultRoles) {
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
      throw new NotFoundException('Workspace không tồn tại');
    }

    // Verify inviter is a member and has permission (owner or admin)
    const inviterMember = await this.workspaceMemberRepository.findOne({
      where: { userId: inviterUserId, workspaceId },
      relations: ['role'],
    });

    if (!inviterMember) {
      throw new UnauthorizedException('Bạn không phải là member của workspace này');
    }

    const inviterRole = inviterMember.role;
    if (inviterRole.name !== WorkspaceRoleNameEnum.OWNER && inviterRole.name !== WorkspaceRoleNameEnum.ADMIN) {
      throw new UnauthorizedException('Bạn không có quyền mời thành viên');
    }

    // Verify role exists in workspace
    const role = await this.workspaceRoleRepository.findOne({
      where: { id: inviteDto.roleId, workspaceId },
    });

    if (!role) {
      throw new NotFoundException('Role không tồn tại trong workspace này');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { email: inviteDto.email, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User không tồn tại trong hệ thống');
    }

    // Check if user is already a member
    const existingMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: user.id },
    });

    if (existingMember) {
      throw new BadRequestException('User đã là member của workspace này');
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
      throw new BadRequestException('Đã có lời mời đang chờ cho user này');
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

    return new ResponseItem<{ message: string }>({ message: 'Lời mời đã được gửi' }, 'Gửi lời mời thành công');
  }

  async acceptInvite(token: string, userId: string): Promise<ResponseItem<{ message: string; workspaceId: string }>> {
    // Find invite by token
    const invite = await this.workspaceInviteRepository.findOne({
      where: { token },
      relations: ['workspace', 'role'],
    });

    if (!invite) {
      throw new NotFoundException('Token không hợp lệ');
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      throw new BadRequestException('Lời mời đã được chấp nhận');
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Lời mời đã hết hạn');
    }

    // Verify user exists and matches email
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    if (user.email !== invite.email) {
      throw new UnauthorizedException('Email không khớp với lời mời');
    }

    // Check if user is already a member
    const existingMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId: invite.workspaceId, userId: user.id },
    });

    if (existingMember) {
      throw new BadRequestException('Bạn đã là member của workspace này');
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
      { message: 'Tham gia workspace thành công', workspaceId: invite.workspaceId },
      'Chấp nhận lời mời thành công'
    );
  }

  async getWorkspaceMembers(workspaceId: string): Promise<ResponseItem<WorkspaceMemberDto[]>> {
    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace không tồn tại');
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

    return new ResponseItem<WorkspaceMemberDto[]>(memberDtos, 'Lấy danh sách members thành công');
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

    return new ResponseItem<WorkspaceDto[]>(workspaceDtos, 'Lấy danh sách workspaces thành công');
  }
}
