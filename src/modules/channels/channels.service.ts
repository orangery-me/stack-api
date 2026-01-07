import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseItem } from '@app/common/dtos';
import { ChannelEntity, ChannelMemberEntity, WorkspaceEntity, WorkspaceMemberEntity } from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { CreateChannelDto, ChannelType } from './dto/create-channel.dto';
import { ChannelDto } from './dto/channel.dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>
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
}
