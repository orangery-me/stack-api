import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CanvasEntity,
  CanvasContentEntity,
  CanvasVersionEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { CanvasDto } from './dto/canvas.dto';
import { CanvasVersionDto } from './dto/canvas-version.dto';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { SaveCanvasContentDto } from './dto/save-canvas-content.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';

@Injectable()
export class CanvasService {
  constructor(
    @InjectRepository(CanvasEntity)
    private readonly canvasRepository: Repository<CanvasEntity>,
    @InjectRepository(CanvasContentEntity)
    private readonly canvasContentRepository: Repository<CanvasContentEntity>,
    @InjectRepository(CanvasVersionEntity)
    private readonly canvasVersionRepository: Repository<CanvasVersionEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>
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

  private mapCanvasToDto(canvas: CanvasEntity, content?: CanvasContentEntity | null): CanvasDto {
    return {
      id: canvas.id,
      workspaceId: canvas.workspaceId,
      channelId: canvas.channelId,
      title: canvas.title,
      description: canvas.description ?? null,
      status: canvas.status,
      createdById: canvas.createdById,
      updatedById: canvas.updatedById ?? null,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
      lastPublishedVersion: canvas.lastPublishedVersion ?? null,
      lastAutoSaveAt: canvas.lastAutoSaveAt ?? null,
      content: content ? content.content : undefined,
    };
  }

  private mapVersionToDto(version: CanvasVersionEntity, includeContent = false): CanvasVersionDto {
    return {
      version: version.version,
      title: version.title ?? null,
      savedById: version.savedById ?? null,
      savedAt: version.savedAt,
      content: includeContent ? version.content : undefined,
    };
  }

  async createCanvas(channelId: string, userId: string, dto: CreateCanvasDto): Promise<CanvasDto> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId },
      relations: ['workspace'],
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const { workspaceId } = channel;

    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = this.canvasRepository.create({
      workspaceId,
      channelId,
      title: dto.title,
      description: dto.description ?? null,
      status: 'active',
      createdById: workspaceMember.id,
      updatedById: workspaceMember.id,
      lastPublishedVersion: null,
      lastAutoSaveAt: null,
    });

    const savedCanvas = await this.canvasRepository.save(canvas);

    const initialContent =
      dto.initialContent ??
      ({
        version: 1,
        blocks: [
          {
            type: 'heading1',
            content: '',
          },
        ],
      } as any);

    const content = this.canvasContentRepository.create({
      canvasId: savedCanvas.id,
      content: initialContent,
      contentSchemaVersion: 1,
      revision: 0,
      version: null,
      isDirty: true,
      updatedById: workspaceMember.id,
    });

    const savedContent = await this.canvasContentRepository.save(content);

    return this.mapCanvasToDto(savedCanvas, savedContent);
  }

  async getCanvas(canvasId: string, userId: string): Promise<CanvasDto> {
    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace', 'channel', 'content'],
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const { workspaceId, channelId } = canvas;

    await this.verifyChannelMembership(workspaceId, channelId, userId);

    return this.mapCanvasToDto(canvas, canvas.content ?? null);
  }

  async updateCanvas(canvasId: string, userId: string, dto: UpdateCanvasDto): Promise<CanvasDto> {
    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace', 'channel'],
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const { workspaceId, channelId } = canvas;

    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    if (dto.title !== undefined) {
      canvas.title = (dto.title.trim() || 'New page').slice(0, 500);
    }

    canvas.updatedById = workspaceMember.id;
    const savedCanvas = await this.canvasRepository.save(canvas);

    return this.mapCanvasToDto(savedCanvas, canvas.content ?? null);
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

    const canvases = await this.canvasRepository.find({
      where: { workspaceId, channelId },
      order: { createdAt: 'ASC' },
    });

    return canvases.map((canvas) => this.mapCanvasToDto(canvas));
  }

  async saveCanvasContent(canvasId: string, userId: string, dto: SaveCanvasContentDto): Promise<CanvasDto> {
    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace', 'channel'],
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const { workspaceId, channelId } = canvas;

    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    let content = await this.canvasContentRepository.findOne({
      where: { canvasId: canvas.id },
    });

    if (!content) {
      content = this.canvasContentRepository.create({
        canvasId: canvas.id,
        content: dto.content,
        contentSchemaVersion: 1,
        revision: 0,
        version: null,
        isDirty: true,
        updatedById: workspaceMember.id,
      });
    } else {
      content.content = dto.content;
      content.revision += 1;
      content.isDirty = true;
      content.updatedById = workspaceMember.id;
    }

    canvas.lastAutoSaveAt = new Date();
    canvas.updatedById = workspaceMember.id;

    const [savedCanvas, savedContent] = await Promise.all([
      this.canvasRepository.save(canvas),
      this.canvasContentRepository.save(content),
    ]);

    return this.mapCanvasToDto(savedCanvas, savedContent);
  }

  async createCanvasVersion(canvasId: string, userId: string): Promise<CanvasVersionDto> {
    await this.getCanvas(canvasId, userId);

    const canvasEntity = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace', 'channel'],
    });
    if (!canvasEntity) {
      throw new NotFoundException('Canvas not found');
    }
    const { workspaceId, channelId } = canvasEntity;
    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const content = await this.canvasContentRepository.findOne({
      where: { canvasId: canvasEntity.id },
    });

    if (!content) {
      throw new NotFoundException('Canvas content not found');
    }

    const latestVersion = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvasEntity.id },
      order: { version: 'DESC' },
    });

    const newVersionNumber = (latestVersion?.version ?? 0) + 1;

    const version = this.canvasVersionRepository.create({
      canvasId: canvasEntity.id,
      version: newVersionNumber,
      title: canvasEntity.title,
      content: content.content,
      contentSchemaVersion: content.contentSchemaVersion,
      snapshotType: 'manual',
      savedById: workspaceMember.id,
    });

    const savedVersion = await this.canvasVersionRepository.save(version);

    content.version = newVersionNumber;
    content.isDirty = false;
    canvasEntity.lastPublishedVersion = newVersionNumber;
    canvasEntity.updatedById = workspaceMember.id;

    await Promise.all([this.canvasContentRepository.save(content), this.canvasRepository.save(canvasEntity)]);

    return this.mapVersionToDto(savedVersion, true);
  }

  async getCanvasVersions(canvasId: string, userId: string): Promise<CanvasVersionDto[]> {
    const canvas = await this.getCanvas(canvasId, userId);
    const { workspaceId, channelId } = canvas;
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const versions = await this.canvasVersionRepository.find({
      where: { canvasId: canvas.id },
      order: { version: 'DESC' },
    });

    return versions.map((v) => this.mapVersionToDto(v));
  }

  async getCanvasVersion(canvasId: string, versionNumber: number, userId: string): Promise<CanvasVersionDto> {
    const canvas = await this.getCanvas(canvasId, userId);
    const { workspaceId, channelId } = canvas;
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const version = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvas.id, version: versionNumber },
    });

    if (!version) {
      throw new NotFoundException('Canvas version not found');
    }

    return this.mapVersionToDto(version, true);
  }

  async revertCanvasToVersion(canvasId: string, versionNumber: number, userId: string): Promise<CanvasDto> {
    await this.getCanvas(canvasId, userId);

    const canvasEntity = await this.canvasRepository.findOne({
      where: { id: canvasId },
      relations: ['workspace', 'channel'],
    });
    if (!canvasEntity) {
      throw new NotFoundException('Canvas not found');
    }
    const { workspaceId, channelId } = canvasEntity;
    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const version = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvasEntity.id, version: versionNumber },
    });

    if (!version) {
      throw new NotFoundException('Canvas version not found');
    }

    let content = await this.canvasContentRepository.findOne({
      where: { canvasId: canvasEntity.id },
    });

    if (!content) {
      content = this.canvasContentRepository.create({
        canvasId: canvasEntity.id,
        content: version.content,
        contentSchemaVersion: version.contentSchemaVersion,
        revision: 0,
        version: version.version,
        isDirty: false,
        updatedById: workspaceMember.id,
      });
    } else {
      content.content = version.content;
      content.contentSchemaVersion = version.contentSchemaVersion;
      content.version = version.version;
      content.isDirty = false;
      content.updatedById = workspaceMember.id;
      content.revision += 1;
    }

    canvasEntity.lastPublishedVersion = version.version;
    canvasEntity.updatedById = workspaceMember.id;

    const [savedCanvas, savedContent] = await Promise.all([
      this.canvasRepository.save(canvasEntity),
      this.canvasContentRepository.save(content),
    ]);

    return this.mapCanvasToDto(savedCanvas, savedContent);
  }
}
