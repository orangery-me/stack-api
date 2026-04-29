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
import { AddChannelMemberDto } from './dto/add-channel-member.dto';
import { ChannelMemberDto } from './dto/channel-member.dto';
import { ChannelPolicy } from '../../policy/channel/channel.policy';
import { ChannelPermissions } from '../../policy/permission.service';
import { DEFAULT_CHANNEL_ROLES } from '../../policy/channel/channel-roles.config';
import { buildChannelSettings, ChannelRoleName } from '../../policy/channel/channel-permission.config';
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';

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
    private readonly channelPermissionResolver: ChannelPermissionResolver,
    private readonly notificationsService: NotificationsService,
    private readonly chatService: ChatService
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
      settings: buildChannelSettings(dto.settings),
      isDefault: dto.isDefault ?? false,
    });

    const savedChannel = await this.channelRepository.save(channel);
    await this.initializeChannelRoles(savedChannel.id);

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
      settings: buildChannelSettings(savedChannel.settings),
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

  async addMember(
    workspaceId: string,
    channelId: string,
    actorUserId: string,
    dto: AddChannelMemberDto
  ): Promise<ResponseItem<{ message: string }>> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('Channel does not exist');
    }

    const actorWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: actorUserId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['role', 'user'],
    });
    if (!actorWorkspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const { actorChannelMember, actorPermissions } = await this.getActorChannelPermissionContext(
      workspaceId,
      channelId,
      actorUserId
    );
    const canManage = this.channelPermissionResolver.can(actorPermissions, 'channel:invite_member', channel.settings);

    if (!canManage) {
      throw new ForbiddenException('You do not have permission to add members to this channel');
    }

    const targetWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: dto.userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['user'],
    });
    if (!targetWorkspaceMember) {
      throw new NotFoundException('Target user is not an active workspace member');
    }

    const existing = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: targetWorkspaceMember.id },
    });
    if (existing) {
      throw new ForbiddenException('User is already a member of this channel');
    }

    await this.addSingleMemberToChannel(channelId, targetWorkspaceMember.id, dto.memberRole || 'member');

    await this.notificationsService.publishEvent({
      type: 'channel.member_added',
      workspaceId,
      actorUserId,
      entityType: 'channel',
      entityId: channel.id,
      payload: {
        recipientUserIds: [dto.userId],
        actorName: actorWorkspaceMember.user?.name || 'Someone',
        channelName: channel.name || 'channel',
        channelId,
        targetUrl: `/workspaces/${workspaceId}`,
      },
    });

    const systemMessageSenderUserId = actorChannelMember ? actorUserId : dto.userId;
    const targetDisplayName = targetWorkspaceMember.user?.name || targetWorkspaceMember.user?.email || 'a teammate';
    const actorDisplayName = actorWorkspaceMember.user?.name || 'Someone';

    await this.chatService.sendMessage(workspaceId, channelId, systemMessageSenderUserId, {
      content: `${actorDisplayName} added ${targetDisplayName} to this channel.`,
      messageType: 'system',
    });

    return new ResponseItem({ message: 'Member added to channel' }, 'Member added to channel successfully');
  }

  async kickMember(
    workspaceId: string,
    channelId: string,
    actorUserId: string,
    targetUserId: string
  ): Promise<ResponseItem<{ message: string }>> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('Channel does not exist');
    }

    const actorWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: actorUserId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['role', 'user'],
    });
    if (!actorWorkspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot remove yourself with this endpoint');
    }

    const { actorPermissions } = await this.getActorChannelPermissionContext(workspaceId, channelId, actorUserId);
    const canKick = this.channelPermissionResolver.can(actorPermissions, 'channel:kick_member', channel.settings);

    if (!canKick) {
      throw new ForbiddenException('You do not have permission to remove members from this channel');
    }

    const targetWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: targetUserId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['user'],
    });
    if (!targetWorkspaceMember) {
      throw new NotFoundException('Target user is not an active workspace member');
    }

    const targetChannelMember = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: targetWorkspaceMember.id },
    });
    if (!targetChannelMember) {
      throw new NotFoundException('Target user is not a member of this channel');
    }

    await this.channelMemberRepository.delete({ channelId, memberId: targetWorkspaceMember.id });

    await this.notificationsService.publishEvent({
      type: 'channel.member_removed',
      workspaceId,
      actorUserId,
      entityType: 'channel',
      entityId: channel.id,
      payload: {
        recipientUserIds: [targetUserId],
        actorName: actorWorkspaceMember.user?.name || 'Someone',
        channelName: channel.name || 'channel',
        channelId,
        targetUrl: `/workspaces/${workspaceId}`,
      },
    });

    const targetDisplayName = targetWorkspaceMember.user?.name || targetWorkspaceMember.user?.email || 'a teammate';
    const actorDisplayName = actorWorkspaceMember.user?.name || 'Someone';

    await this.chatService.sendMessage(workspaceId, channelId, actorUserId, {
      content: `${actorDisplayName} removed ${targetDisplayName} from this channel.`,
      messageType: 'system',
    });

    return new ResponseItem({ message: 'Member removed from channel' }, 'Member removed from channel successfully');
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
      settings: buildChannelSettings(channel.settings),
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

    const channelDtos: ChannelDto[] = [];
    for (const channelMember of channelMembers) {
      const channel = channelMember.channel;
      if (!channel || channel.workspaceId !== workspaceId) {
        continue;
      }

      const normalizedPermissions = await this.getChannelPermissions(
        channel.id,
        channelMember.memberRole as ChannelRoleName
      );
      const capabilityMap = this.channelPermissionResolver.buildCapabilityMap(normalizedPermissions, channel.settings);

      channelDtos.push({
        id: channel.id,
        workspaceId: channel.workspaceId,
        type: channel.type as ChannelType,
        name: channel.name,
        createdById: channel.createdById,
        createdAt: channel.createdAt,
        isDefault: channel.isDefault,
        permissions: capabilityMap,
      });
    }

    return new ResponseItem<ChannelDto[]>(channelDtos, 'User channels fetched successfully');
  }

  async getChannelMembers(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<ResponseItem<ChannelMemberDto[]>> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('Channel does not exist');
    }

    const { actorChannelMember } = await this.getActorChannelPermissionContext(workspaceId, channelId, userId);
    if (!actorChannelMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    const channelMembers = await this.channelMemberRepository.find({
      where: { channelId },
      relations: ['member', 'member.user'],
      order: { joinedAt: 'ASC' },
    });

    const memberDtos: ChannelMemberDto[] = channelMembers
      .filter((member) => member.member?.user)
      .map((member) => ({
        channelId: member.channelId,
        userId: member.member.userId,
        workspaceMemberId: member.memberId,
        name: member.member.user.name,
        email: member.member.user.email,
        avatar: member.member.user.avatar || undefined,
        memberRole: member.memberRole as 'manager' | 'member',
        joinedAt: member.joinedAt,
      }));

    return new ResponseItem<ChannelMemberDto[]>(memberDtos, 'Channel members fetched successfully');
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
    const normalizedPermissions = await this.getChannelPermissions(
      channel.id,
      channelMember.memberRole as ChannelRoleName
    );
    // Map channel data based on permissions
    const dto = this.channelPolicy.map(channel, normalizedPermissions);

    if (!dto) {
      throw new ForbiddenException('You do not have permission to view this channel');
    }

    return new ResponseItem<ChannelDto>(dto, 'Channel fetched successfully');
  }

  async initializeChannelRoles(channelId: string): Promise<void> {
    for (const roleData of DEFAULT_CHANNEL_ROLES) {
      const existingRole = await this.channelRoleRepository.findOne({
        where: { channelId, name: roleData.name },
      });
      if (existingRole) {
        continue;
      }
      const role = this.channelRoleRepository.create({
        channelId,
        name: roleData.name,
        permissions: roleData.permissions,
      });
      await this.channelRoleRepository.save(role);
    }
  }

  private async getChannelPermissions(
    channelId: string,
    roleName: ChannelRoleName | null | undefined
  ): Promise<ChannelPermissions | null> {
    if (!roleName) {
      return null;
    }
    const channelRole = await this.channelRoleRepository.findOne({
      where: {
        channelId,
        name: roleName,
      },
    });

    if (!channelRole?.permissions?.actions || typeof channelRole.permissions.actions !== 'object') {
      return null;
    }

    return channelRole.permissions as ChannelPermissions;
  }

  private async getActorChannelPermissionContext(
    workspaceId: string,
    channelId: string,
    actorUserId: string
  ): Promise<{
    actorWorkspaceMember: WorkspaceMemberEntity;
    actorChannelMember: ChannelMemberEntity | null;
    actorPermissions: ChannelPermissions | null;
  }> {
    const actorWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: actorUserId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['role', 'user'],
    });
    if (!actorWorkspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const actorChannelMember = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: actorWorkspaceMember.id },
    });
    const isWorkspacePrivileged =
      actorWorkspaceMember.role?.name === WorkspaceRoleNameEnum.OWNER ||
      actorWorkspaceMember.role?.name === WorkspaceRoleNameEnum.ADMIN;
    const effectiveRoleName = actorChannelMember?.memberRole
      ? (actorChannelMember.memberRole as ChannelRoleName)
      : isWorkspacePrivileged
        ? 'manager'
        : null;
    const actorPermissions = await this.getChannelPermissions(channelId, effectiveRoleName);

    return {
      actorWorkspaceMember,
      actorChannelMember,
      actorPermissions,
    };
  }
}
