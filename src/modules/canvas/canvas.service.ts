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

  /**
   * Lấy title từ nội dung canvas
   * @param rawContent - Nội dung canvas
   * @param fallbackTitle - Tên mặc định nếu không tìm thấy title
   * @returns Tên canvas
   */
  private deriveCanvasTitleFromContent(rawContent: any, fallbackTitle: string): string {
    try {
      let parsed = rawContent as any;

      // FE có thể gửi JSON string
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }

      if (parsed && Array.isArray(parsed.blocks)) {
        const heading1 = parsed.blocks.find(
          (b: any) => b.type === 'heading1' && typeof b.content === 'string' && b.content.trim().length > 0
        );

        if (heading1) {
          return heading1.content.trim();
        }

        // fallback
        const firstTextBlock = parsed.blocks.find(
          (b: any) => typeof b.content === 'string' && b.content.trim().length > 0
        );

        if (firstTextBlock) {
          return firstTextBlock.content.trim();
        }
      }
    } catch {
      // parse lỗi => dùng fallback
    }

    return fallbackTitle;
  }

  async createCanvas(workspaceId: string, channelId: string, userId: string, dto: CreateCanvasDto): Promise<CanvasDto> {
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

  async getCanvas(workspaceId: string, channelId: string, canvasId: string, userId: string): Promise<CanvasDto> {
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
      relations: ['content'],
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    return this.mapCanvasToDto(canvas, canvas.content ?? null);
  }

  async getCanvasesForChannel(workspaceId: string, channelId: string, userId: string): Promise<CanvasDto[]> {
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvases = await this.canvasRepository.find({
      where: { workspaceId, channelId },
      order: { createdAt: 'ASC' },
    });

    return canvases.map((canvas) => this.mapCanvasToDto(canvas));
  }

  async saveCanvasContent(
    workspaceId: string,
    channelId: string,
    canvasId: string,
    userId: string,
    dto: SaveCanvasContentDto
  ): Promise<CanvasDto> {
    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

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

    // Cập nhật title của canvas dựa trên nội dung blocks
    const newTitle = this.deriveCanvasTitleFromContent(dto.content, 'New page');
    if (canvas.title !== newTitle) {
      canvas.title = newTitle;
    }

    canvas.lastAutoSaveAt = new Date();
    canvas.updatedById = workspaceMember.id;

    const [savedCanvas, savedContent] = await Promise.all([
      this.canvasRepository.save(canvas),
      this.canvasContentRepository.save(content),
    ]);

    return this.mapCanvasToDto(savedCanvas, savedContent);
  }

  async createCanvasVersion(
    workspaceId: string,
    channelId: string,
    canvasId: string,
    userId: string
  ): Promise<CanvasVersionDto> {
    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const content = await this.canvasContentRepository.findOne({
      where: { canvasId: canvas.id },
    });

    if (!content) {
      throw new NotFoundException('Canvas content not found');
    }

    const latestVersion = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvas.id },
      order: { version: 'DESC' },
    });

    const newVersionNumber = (latestVersion?.version ?? 0) + 1;

    const version = this.canvasVersionRepository.create({
      canvasId: canvas.id,
      version: newVersionNumber,
      title: canvas.title,
      content: content.content,
      contentSchemaVersion: content.contentSchemaVersion,
      snapshotType: 'manual',
      savedById: workspaceMember.id,
    });

    const savedVersion = await this.canvasVersionRepository.save(version);

    content.version = newVersionNumber;
    content.isDirty = false;
    canvas.lastPublishedVersion = newVersionNumber;
    canvas.updatedById = workspaceMember.id;

    await Promise.all([this.canvasContentRepository.save(content), this.canvasRepository.save(canvas)]);

    return this.mapVersionToDto(savedVersion, true);
  }

  async getCanvasVersions(
    workspaceId: string,
    channelId: string,
    canvasId: string,
    userId: string
  ): Promise<CanvasVersionDto[]> {
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const versions = await this.canvasVersionRepository.find({
      where: { canvasId: canvas.id },
      order: { version: 'DESC' },
    });

    return versions.map((v) => this.mapVersionToDto(v));
  }

  async getCanvasVersion(
    workspaceId: string,
    channelId: string,
    canvasId: string,
    versionNumber: number,
    userId: string
  ): Promise<CanvasVersionDto> {
    await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const version = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvas.id, version: versionNumber },
    });

    if (!version) {
      throw new NotFoundException('Canvas version not found');
    }

    return this.mapVersionToDto(version, true);
  }

  async revertCanvasToVersion(
    workspaceId: string,
    channelId: string,
    canvasId: string,
    versionNumber: number,
    userId: string
  ): Promise<CanvasDto> {
    const { workspaceMember } = await this.verifyChannelMembership(workspaceId, channelId, userId);

    const canvas = await this.canvasRepository.findOne({
      where: { id: canvasId, workspaceId, channelId },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const version = await this.canvasVersionRepository.findOne({
      where: { canvasId: canvas.id, version: versionNumber },
    });

    if (!version) {
      throw new NotFoundException('Canvas version not found');
    }

    let content = await this.canvasContentRepository.findOne({
      where: { canvasId: canvas.id },
    });

    if (!content) {
      content = this.canvasContentRepository.create({
        canvasId: canvas.id,
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

    canvas.lastPublishedVersion = version.version;
    canvas.updatedById = workspaceMember.id;

    const [savedCanvas, savedContent] = await Promise.all([
      this.canvasRepository.save(canvas),
      this.canvasContentRepository.save(content),
    ]);

    return this.mapCanvasToDto(savedCanvas, savedContent);
  }
}
