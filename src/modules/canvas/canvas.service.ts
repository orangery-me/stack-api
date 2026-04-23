import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { CanvasEntity, ChannelEntity, ChannelMemberEntity, UserEntity, WorkspaceMemberEntity } from '@app/entities';
import { CanvasPermissionEntity } from '@app/entities/canvas/canvas-permission.entity';
import { CanvasRecentEntity } from '@app/entities/canvas/canvas-recent.entity';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { CanvasDto } from './dto/canvas.dto';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';
import { CanvasPermissionListDto, CanvasPermissionItemDto } from './dto/canvas-permission.dto';
import { ShareCanvasWithUserDto } from './dto/share-canvas-user.dto';
import { ShareCanvasWithChannelDto } from './dto/share-canvas-channel.dto';
import { UpdateCanvasVisibilityDto } from './dto/update-canvas-visibility.dto';

type CanvasAccessRole = 'viewer' | 'editor';

@Injectable()
export class CanvasService {
  constructor(
    @InjectRepository(CanvasEntity)
    private readonly canvasRepository: Repository<CanvasEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(CanvasPermissionEntity)
    private readonly canvasPermissionRepository: Repository<CanvasPermissionEntity>,
    @InjectRepository(CanvasRecentEntity)
    private readonly canvasRecentRepository: Repository<CanvasRecentEntity>
  ) {}

  private async verifyChannelMembership(
    workspaceId: string,
    channelId: string,
    userId: string
  ): Promise<{ workspaceMember: WorkspaceMemberEntity }> {
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!workspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const channelMember = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: workspaceMember.id },
    });

    if (!channelMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    return { workspaceMember };
  }

  private async getWorkspaceMemberOrThrow(workspaceId: string, userId: string): Promise<WorkspaceMemberEntity> {
    const workspaceMember = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });

    if (!workspaceMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return workspaceMember;
  }

  private async getCanvasOrThrow(canvasId: string): Promise<CanvasEntity> {
    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace'],
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    return canvas;
  }

  private upgradeRole(current: CanvasAccessRole | null, next: CanvasAccessRole): CanvasAccessRole {
    if (current === 'editor' || next === 'editor') {
      return 'editor';
    }
    return 'viewer';
  }

  private async getEffectiveCanvasRole(
    canvas: CanvasEntity,
    workspaceMember: WorkspaceMemberEntity
  ): Promise<CanvasAccessRole | null> {
    let effective: CanvasAccessRole | null = null;

    // Owner luôn có full quyền
    if (canvas.ownerId === workspaceMember.id) {
      effective = 'editor';
    }

    // Public workspace => mọi member workspace có ít nhất viewer
    if (canvas.visibility === 'public-workspace') {
      effective = this.upgradeRole(effective, 'viewer');
    }

    // Permission trực tiếp theo user
    const directPermission = await this.canvasPermissionRepository.findOne({
      where: {
        canvasId: canvas.id,
        type: 'user',
        targetId: workspaceMember.id,
      },
    });

    if (directPermission) {
      effective = this.upgradeRole(effective, directPermission.role);
    }

    // Permission qua channel mà user là member
    const channelMemberships = await this.channelMemberRepository.find({
      where: { memberId: workspaceMember.id },
    });

    if (channelMemberships.length > 0) {
      const channelIds = channelMemberships.map((m) => m.channelId);

      const channelPermissions = await this.canvasPermissionRepository.find({
        where: {
          canvasId: canvas.id,
          type: 'channel',
          targetId: In(channelIds),
        },
      });

      for (const perm of channelPermissions) {
        effective = this.upgradeRole(effective, perm.role);
      }
    }

    return effective;
  }

  private async mapPermissionToDto(permission: CanvasPermissionEntity): Promise<CanvasPermissionItemDto> {
    if (permission.type === 'user') {
      const workspaceMember = await this.workspaceMemberRepository.findOne({
        where: { id: permission.targetId },
        relations: ['user'],
      });

      const email = workspaceMember?.user?.email ?? '';
      const displayName = workspaceMember?.displayName || workspaceMember?.user?.name || email;

      return {
        id: permission.id,
        type: permission.type,
        targetId: permission.targetId,
        role: permission.role,
        label: displayName || email || permission.targetId,
      };
    }

    if (permission.type === 'channel') {
      const channel = await this.channelRepository.findOne({
        where: { id: permission.targetId },
      });

      return {
        id: permission.id,
        type: permission.type,
        targetId: permission.targetId,
        role: permission.role,
        label: channel?.name || permission.targetId,
      };
    }

    return {
      id: permission.id,
      type: permission.type,
      targetId: permission.targetId,
      role: permission.role,
      label: permission.targetId,
    };
  }

  private async ensureCanvasPermission(
    canvasId: string,
    userId: string,
    requiredRole: CanvasAccessRole
  ): Promise<{ canvas: CanvasEntity; workspaceMember: WorkspaceMemberEntity; role: CanvasAccessRole }> {
    const canvas = await this.getCanvasOrThrow(canvasId);
    const workspaceMember = await this.getWorkspaceMemberOrThrow(canvas.workspaceId, userId);
    const role = await this.getEffectiveCanvasRole(canvas, workspaceMember);

    if (!role) {
      throw new ForbiddenException('You do not have permission to access this canvas');
    }

    if (requiredRole === 'editor' && role !== 'editor') {
      throw new ForbiddenException('You do not have permission to edit this canvas');
    }

    return { canvas, workspaceMember, role };
  }

  async authorizeCanvasAccess(
    canvasId: string,
    userId: string,
    requiredRole: CanvasAccessRole
  ): Promise<{ canvas: CanvasEntity; workspaceMember: WorkspaceMemberEntity; role: CanvasAccessRole }> {
    return this.ensureCanvasPermission(canvasId, userId, requiredRole);
  }

  private async touchRecent(userId: string, canvasId: string): Promise<void> {
    let recent = await this.canvasRecentRepository.findOne({
      where: { userId, canvasId },
    });

    if (!recent) {
      recent = this.canvasRecentRepository.create({ userId, canvasId });
    }

    await this.canvasRecentRepository.save(recent);
  }

  private mapCanvasToDto(canvas: CanvasEntity, options?: { canEdit?: boolean; isShared?: boolean }): CanvasDto {
    const owner = canvas.owner
      ? {
          id: canvas.owner.id,
          name: canvas.owner.displayName || canvas.owner.user?.name || '',
          avatar: canvas.owner.user?.avatar ?? null,
        }
      : undefined;

    return {
      id: canvas.id,
      workspaceId: canvas.workspaceId,
      title: canvas.title,
      description: canvas.description ?? null,
      status: canvas.status,
      ownerId: canvas.ownerId,
      owner,
      createdById: canvas.createdById,
      updatedById: canvas.updatedById ?? null,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      visibility: canvas.visibility,
      lastPublishedVersion: canvas.lastPublishedVersion ?? null,
      lastAutoSaveAt: canvas.lastAutoSaveAt ?? null,
      canEdit: options?.canEdit,
      isShared: options?.isShared ?? canvas.visibility !== 'private',
    };
  }

  async createCanvasForWorkspace(workspaceId: string, userId: string, dto: CreateCanvasDto): Promise<CanvasDto> {
    const workspaceMember = await this.getWorkspaceMemberOrThrow(workspaceId, userId);

    const canvas = this.canvasRepository.create({
      workspaceId,
      title: dto.title,
      description: dto.description ?? null,
      status: 'active',
      ownerId: workspaceMember.id,
      createdById: workspaceMember.id,
      updatedById: workspaceMember.id,
      lastPublishedVersion: null,
      lastAutoSaveAt: null,
      visibility: 'private',
    });

    const savedCanvas = await this.canvasRepository.save(canvas);

    return this.mapCanvasToDto(savedCanvas, { canEdit: true, isShared: false });
  }

  async getCanvas(canvasId: string, userId: string): Promise<CanvasDto> {
    const { canvas, role } = await this.ensureCanvasPermission(canvasId, userId, 'viewer');

    await this.touchRecent(userId, canvasId);

    return this.mapCanvasToDto(canvas, {
      canEdit: role === 'editor',
      isShared: canvas.visibility !== 'private',
    });
  }

  async updateCanvas(canvasId: string, userId: string, dto: UpdateCanvasDto): Promise<CanvasDto> {
    const { canvas, workspaceMember } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    if (dto.title !== undefined) {
      canvas.title = (dto.title.trim() || 'New page').slice(0, 500);
    }

    canvas.updatedById = workspaceMember.id;
    const savedCanvas = await this.canvasRepository.save(canvas);

    return this.mapCanvasToDto(savedCanvas, {
      canEdit: true,
      isShared: savedCanvas.visibility !== 'private',
    });
  }

  async getCanvasesForChannel(channelId: string, userId: string): Promise<CanvasDto[]> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId },
      relations: ['workspace'],
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const { workspaceId } = channel;

    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const permissions = await this.canvasPermissionRepository.find({
      where: { type: 'channel', targetId: channelId },
    });

    if (!permissions.length) {
      return [];
    }

    const canvasIds = permissions.map((p) => p.canvasId);

    const canvases = await this.canvasRepository.find({
      where: {
        id: In(canvasIds),
        workspaceId,
      },
      order: { createdAt: 'ASC' },
    });

    return canvases.map((canvas) =>
      this.mapCanvasToDto(canvas, {
        isShared: true,
      })
    );
  }

  async getCanvasPermissions(canvasId: string, userId: string): Promise<CanvasPermissionListDto> {
    const { canvas } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    const permissions = await this.canvasPermissionRepository.find({
      where: { canvasId: canvas.id },
    });

    const items: CanvasPermissionItemDto[] = [];
    for (const perm of permissions) {
      items.push(await this.mapPermissionToDto(perm));
    }

    return {
      visibility: canvas.visibility,
      items,
    };
  }

  async shareCanvasWithUser(
    canvasId: string,
    userId: string,
    dto: ShareCanvasWithUserDto
  ): Promise<CanvasPermissionListDto> {
    const { canvas, workspaceMember } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    const targetUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const targetWorkspaceMember = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId: canvas.workspaceId,
        userId: targetUser.id,
        status: WorkspaceMemberStatusEnum.ACTIVE,
      },
    });

    if (!targetWorkspaceMember) {
      throw new ForbiddenException('User is not a member of this workspace');
    }

    let permission = await this.canvasPermissionRepository.findOne({
      where: {
        canvasId: canvas.id,
        type: 'user',
        targetId: targetWorkspaceMember.id,
      },
    });

    if (!permission) {
      permission = this.canvasPermissionRepository.create({
        canvasId: canvas.id,
        type: 'user',
        targetId: targetWorkspaceMember.id,
        role: dto.role,
      });
    } else {
      permission.role = dto.role;
    }

    await this.canvasPermissionRepository.save(permission);

    canvas.updatedById = workspaceMember.id;
    await this.canvasRepository.save(canvas);

    return this.getCanvasPermissions(canvas.id, userId);
  }

  async shareCanvasWithChannel(
    canvasId: string,
    userId: string,
    dto: ShareCanvasWithChannelDto
  ): Promise<CanvasPermissionListDto> {
    const { canvas, workspaceMember } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    const channel = await this.channelRepository.findOne({
      where: { id: dto.channelId, workspaceId: canvas.workspaceId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found in workspace');
    }

    let permission = await this.canvasPermissionRepository.findOne({
      where: {
        canvasId: canvas.id,
        type: 'channel',
        targetId: channel.id,
      },
    });

    if (!permission) {
      permission = this.canvasPermissionRepository.create({
        canvasId: canvas.id,
        type: 'channel',
        targetId: channel.id,
        role: dto.role,
      });
    } else {
      permission.role = dto.role;
    }

    await this.canvasPermissionRepository.save(permission);

    canvas.updatedById = workspaceMember.id;
    await this.canvasRepository.save(canvas);

    return this.getCanvasPermissions(canvas.id, userId);
  }

  async updateCanvasVisibility(
    canvasId: string,
    userId: string,
    dto: UpdateCanvasVisibilityDto
  ): Promise<CanvasPermissionListDto> {
    const { canvas, workspaceMember } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    canvas.visibility = dto.visibility;
    canvas.updatedById = workspaceMember.id;

    await this.canvasRepository.save(canvas);

    return this.getCanvasPermissions(canvas.id, userId);
  }

  async removeCanvasPermission(
    canvasId: string,
    userId: string,
    permissionId: string
  ): Promise<CanvasPermissionListDto> {
    const { canvas } = await this.ensureCanvasPermission(canvasId, userId, 'editor');

    const permission = await this.canvasPermissionRepository.findOne({
      where: { id: permissionId, canvasId: canvas.id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.canvasPermissionRepository.remove(permission);

    return this.getCanvasPermissions(canvas.id, userId);
  }

  async getMyCanvases(workspaceId: string, userId: string): Promise<CanvasDto[]> {
    const workspaceMember = await this.getWorkspaceMemberOrThrow(workspaceId, userId);

    const canvases = await this.canvasRepository.find({
      where: {
        workspaceId,
        ownerId: workspaceMember.id,
        status: 'active',
      },
      relations: ['owner', 'owner.user'],
      order: { createdAt: 'DESC' },
    });

    return canvases.map((canvas) =>
      this.mapCanvasToDto(canvas, {
        canEdit: true,
        isShared: canvas.visibility !== 'private',
      })
    );
  }

  async getRecentCanvases(workspaceId: string, userId: string): Promise<CanvasDto[]> {
    await this.getWorkspaceMemberOrThrow(workspaceId, userId);

    const recents = await this.canvasRecentRepository.find({
      where: { userId },
      relations: ['canvas', 'canvas.owner', 'canvas.owner.user'],
      order: { lastOpenedAt: 'DESC' },
    });

    const result: CanvasDto[] = [];

    for (const recent of recents) {
      const canvas = recent.canvas;
      if (!canvas || canvas.workspaceId !== workspaceId || canvas.status !== 'active') {
        continue;
      }

      try {
        const { role } = await this.ensureCanvasPermission(canvas.id, userId, 'viewer');
        result.push(
          this.mapCanvasToDto(canvas, {
            canEdit: role === 'editor',
            isShared: canvas.visibility !== 'private',
          })
        );
      } catch {
        // Bỏ qua canvas mà user không còn quyền
      }
    }

    return result;
  }

  async getSharedWithMeCanvases(workspaceId: string, userId: string): Promise<CanvasDto[]> {
    const workspaceMember = await this.getWorkspaceMemberOrThrow(workspaceId, userId);

    const channelMemberships = await this.channelMemberRepository.find({
      where: { memberId: workspaceMember.id },
    });
    const channelIds = channelMemberships.map((m) => m.channelId);

    const userPermissions = await this.canvasPermissionRepository.find({
      where: {
        type: 'user',
        targetId: workspaceMember.id,
      },
    });

    const channelPermissions = channelIds.length
      ? await this.canvasPermissionRepository.find({
          where: {
            type: 'channel',
            targetId: In(channelIds),
          },
        })
      : [];

    const permissionCanvasIds = [...userPermissions, ...channelPermissions].map((p) => p.canvasId);

    const publicCanvases = await this.canvasRepository.find({
      where: {
        workspaceId,
        visibility: 'public-workspace',
      },
    });

    const publicCanvasIds = publicCanvases.map((c) => c.id);

    const allCanvasIds = Array.from(new Set([...permissionCanvasIds, ...publicCanvasIds]));

    if (!allCanvasIds.length) {
      return [];
    }

    const canvases = await this.canvasRepository.find({
      where: {
        workspaceId,
        id: In(allCanvasIds),
        ownerId: Not(workspaceMember.id),
        status: 'active',
      },
      relations: ['owner', 'owner.user'],
      order: { createdAt: 'DESC' },
    });

    const result: CanvasDto[] = [];

    for (const canvas of canvases) {
      const role = await this.getEffectiveCanvasRole(canvas, workspaceMember);
      if (!role) {
        continue;
      }

      result.push(
        this.mapCanvasToDto(canvas, {
          canEdit: role === 'editor',
          isShared: true,
        })
      );
    }

    return result;
  }

  /**
   * Content and versions are now managed entirely by collab server.
   * Các API content/version cũ đã được xoá.
   */
}
