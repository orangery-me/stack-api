import { Injectable, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseItem } from '@app/common/dtos';
import {
  ChannelEntity,
  ChannelMemberEntity,
  ChannelRoleEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceRoleEntity,
} from '@app/entities';
import { WorkspaceMemberStatusEnum, WorkspaceRoleNameEnum } from '@Constant/enums';
import { CreateChannelDto, ChannelType } from './dto/create-channel.dto';
import { ChannelDto } from './dto/channel.dto';
import { ChannelPolicy } from '../../policy/channel.policy';
import { PermissionService, ChannelPermissions } from '../../policy/permission.service';
import { DEFAULT_CHANNEL_ROLES } from '../../policy/channel-roles.config';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(ChannelRoleEntity)
    private readonly channelRoleRepository: Repository<ChannelRoleEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(WorkspaceRoleEntity)
    private readonly workspaceRoleRepository: Repository<WorkspaceRoleEntity>,
    private readonly channelPolicy: ChannelPolicy,
    private readonly permissionService: PermissionService
  ) {}

  async createChannel(
    workspaceId: string,
    creatorUserId: string,
    dto: CreateChannelDto
  ): Promise<ResponseItem<ChannelDto>> {
    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    const creatorMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: creatorUserId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!creatorMember) {
      throw new UnauthorizedException('You are not an active member of this workspace');
    }

    const channel = this.channelRepository.create({
      workspaceId,
      type: dto.type,
      name: dto.name ?? (dto.type === ChannelType.DM || dto.type === ChannelType.GROUP_DM ? null : dto.name),
      createdById: creatorMember.id,
      metadata: dto.metadata ?? {},
      settings: dto.settings ?? {},
      isDefault: dto.isDefault ?? false,
    });

    const savedChannel = await this.channelRepository.save(channel);

    // Add members depending on channel type
    if (dto.type === ChannelType.PUBLIC) {
      await this.addAllActiveMembersToChannel(workspaceId, savedChannel.id, creatorMember.id);
    } else if (dto.type === ChannelType.PRIVATE) {
      await this.addSingleMemberToChannel(savedChannel.id, creatorMember.id, 'manager');
    } else {
      // dm / group_dm: for now only ensure creator is present as manager
      await this.addSingleMemberToChannel(savedChannel.id, creatorMember.id, 'manager');
    }

    const channelDto: ChannelDto = {
      id: savedChannel.id,
      workspaceId: savedChannel.workspaceId,
      type: savedChannel.type as ChannelType,
      name: savedChannel.name,
      createdById: savedChannel.createdById,
      createdAt: savedChannel.createdAt,
      isDefault: savedChannel.isDefault,
    };

    return new ResponseItem<ChannelDto>(channelDto, 'Channel created successfully');
  }

  async addMemberToAllPublicChannels(workspaceId: string, memberId: string): Promise<void> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { id: memberId, workspaceId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!member) {
      return;
    }

    const publicChannels = await this.channelRepository.find({
      where: { workspaceId, type: ChannelType.PUBLIC },
    });

    const channelMembers = publicChannels.map((channel) =>
      this.channelMemberRepository.create({
        channelId: channel.id,
        memberId: member.id,
        memberType: 'human',
        memberRole: 'member',
      })
    );

    await this.channelMemberRepository.save(channelMembers);
  }

  private async addAllActiveMembersToChannel(
    workspaceId: string,
    channelId: string,
    creatorMemberId: string
  ): Promise<void> {
    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    const channelMembers = members.map((member) =>
      this.channelMemberRepository.create({
        channelId,
        memberId: member.id,
        memberType: 'human',
        memberRole: member.id === creatorMemberId ? 'manager' : 'member',
      })
    );

    if (channelMembers.length > 0) {
      await this.channelMemberRepository.save(channelMembers);
    }
  }

  private async addSingleMemberToChannel(
    channelId: string,
    memberId: string,
    memberRole: 'manager' | 'member'
  ): Promise<void> {
    const channelMember = this.channelMemberRepository.create({
      channelId,
      memberId,
      memberType: 'human',
      memberRole,
    });

    await this.channelMemberRepository.save(channelMember);
  }

  async getAllChannels(workspaceId: string, userId: string): Promise<ResponseItem<ChannelDto[]>> {
    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    // Verify user is a member and has admin/owner role
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['role'],
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const role = membership.role;
    if (role.name !== WorkspaceRoleNameEnum.OWNER && role.name !== WorkspaceRoleNameEnum.ADMIN) {
      throw new ForbiddenException('You do not have permission to view all channels');
    }

    // Get all channels in workspace
    const channels = await this.channelRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });

    // Map to DTOs (admin can see all fields)
    const channelDtos: ChannelDto[] = channels.map((channel) => ({
      id: channel.id,
      workspaceId: channel.workspaceId,
      type: channel.type as ChannelType,
      name: channel.name,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      metadata: channel.metadata || {},
      settings: channel.settings || {},
      isDefault: channel.isDefault,
    }));

    return new ResponseItem<ChannelDto[]>(channelDtos, 'Channels fetched successfully');
  }

  async getUserChannels(workspaceId: string, userId: string): Promise<ResponseItem<ChannelDto[]>> {
    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    // Verify user is a workspace member
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!workspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Get channels where user is a member
    const channelMembers = await this.channelMemberRepository.find({
      where: { memberId: workspaceMember.id },
      relations: ['channel'],
    });

    const channels = channelMembers
      .map((cm) => cm.channel)
      .filter((channel) => channel !== null && channel.workspaceId === workspaceId);

    // Map to DTOs with basic info only (user's channels)
    const channelDtos: ChannelDto[] = channels.map((channel) => ({
      id: channel.id,
      workspaceId: channel.workspaceId,
      type: channel.type as ChannelType,
      name: channel.name,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      isDefault: channel.isDefault,
    }));

    return new ResponseItem<ChannelDto[]>(channelDtos, 'User channels fetched successfully');
  }

  async getChannelById(workspaceId: string, channelId: string, userId: string): Promise<ResponseItem<ChannelDto>> {
    // Verify workspace membership
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId,
        status: WorkspaceMemberStatusEnum.ACTIVE,
      },
      relations: ['role'],
    });

    if (!workspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Get channel
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
      relations: ['roles'],
    });

    if (!channel) {
      throw new NotFoundException('Channel does not exist');
    }

    // Get user's channel membership
    const channelMember = await this.channelMemberRepository.findOne({
      where: {
        channelId: channel.id,
        memberId: workspaceMember.id,
      },
    });

    if (!channelMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    // Get channel role permissions based on memberRole
    const channelRole = await this.channelRoleRepository.findOne({
      where: {
        channelId: channel.id,
        name: channelMember.memberRole as 'manager' | 'member',
      },
    });

    let normalizedPermissions: ChannelPermissions | null = null;
    if (channelRole?.permissions) {
      if (channelRole.permissions.actions && typeof channelRole.permissions.actions === 'object') {
        normalizedPermissions = channelRole.permissions as ChannelPermissions;
      }
    }

    // Map channel data based on permissions
    const dto = this.channelPolicy.map(channel, normalizedPermissions);

    if (!dto) {
      throw new ForbiddenException('You do not have permission to view this channel');
    }

    return new ResponseItem<ChannelDto>(dto, 'Channel fetched successfully');
  }

  async initializeChannelRoles(channelId: string): Promise<void> {
    for (const roleData of DEFAULT_CHANNEL_ROLES) {
      const role = this.channelRoleRepository.create({
        channelId,
        name: roleData.name,
        permissions: roleData.permissions,
      });
      await this.channelRoleRepository.save(role);
    }
  }
}
