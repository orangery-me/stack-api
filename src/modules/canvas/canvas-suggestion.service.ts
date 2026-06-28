import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CanvasSuggestionAction,
  CanvasSuggestionEntity,
  CanvasSuggestionStatus,
} from '@app/entities/canvas/canvas-suggestion.entity';
import { CanvasEntity } from '@app/entities/canvas/canvas.entity';
import {
  CanvasBlockMutation,
  CanvasClientService,
} from '../canvas-client/canvas-client.service';
import { CanvasService } from './canvas.service';
import { CanvasSuggestionDto } from './dto/canvas-suggestion.dto';

type SuggestionMutation = Exclude<CanvasBlockMutation, { action: 'move_after' }>;

interface CreateSuggestionsInput {
  canvasId: string;
  messageId?: string;
  actionId?: string;
  mutations: CanvasBlockMutation[];
  createdBy?: 'ai' | 'agent';
}

@Injectable()
export class CanvasSuggestionService {
  constructor(
    @InjectRepository(CanvasSuggestionEntity)
    private readonly suggestionRepository: Repository<CanvasSuggestionEntity>,
    @InjectRepository(CanvasEntity)
    private readonly canvasRepository: Repository<CanvasEntity>,
    private readonly canvasClient: CanvasClientService,
    private readonly canvasService: CanvasService
  ) {}

  async createFromMutations(input: CreateSuggestionsInput): Promise<CanvasSuggestionDto[]> {
    if (!input.canvasId?.trim()) {
      throw new BadRequestException('canvasId is required');
    }
    if (!Array.isArray(input.mutations) || input.mutations.length === 0) {
      throw new BadRequestException('mutations must contain at least one item');
    }

    const canvas = await this.canvasRepository.findOne({ where: { id: input.canvasId } });
    if (!canvas) {
      throw new NotFoundException('Canvas not found');
    }

    const rows = input.mutations.map((mutation, index) =>
      this.suggestionRepository.create({
        canvasId: input.canvasId,
        messageId: input.messageId?.trim() || input.actionId?.trim() || `ai-message-${Date.now()}`,
        actionId: input.actionId?.trim() ? `${input.actionId.trim()}-${index}` : null,
        blockId: this.blockIdForMutation(mutation),
        targetBlockId: this.targetBlockIdForMutation(mutation),
        action: this.supportedAction(mutation.action),
        payload: mutation as Record<string, any>,
        status: 'pending',
        createdBy: input.createdBy ?? 'ai',
      })
    );

    const saved = await this.suggestionRepository.save(rows);
    return saved.map((item) => this.toDto(item));
  }

  async listForCanvas(
    canvasId: string,
    userId: string,
    status?: CanvasSuggestionStatus
  ): Promise<CanvasSuggestionDto[]> {
    await this.canvasService.authorizeCanvasAccess(canvasId, userId, 'viewer');
    const rows = await this.suggestionRepository.find({
      where: {
        canvasId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    return rows.map((item) => this.toDto(item));
  }

  async accept(canvasId: string, suggestionId: string, userId: string): Promise<CanvasSuggestionDto> {
    await this.canvasService.authorizeCanvasAccess(canvasId, userId, 'editor');
    const suggestion = await this.getSuggestionOrThrow(canvasId, suggestionId);

    if (suggestion.status === 'accepted') return this.toDto(suggestion);
    if (suggestion.status === 'rejected') {
      throw new ConflictException('Suggestion has already been rejected');
    }
    if (suggestion.status === 'applying') {
      throw new ConflictException('Suggestion is already being applied');
    }

    const transition = await this.suggestionRepository.update(
      {
        id: suggestionId,
        canvasId,
        status: In(['pending', 'failed']),
      },
      {
        status: 'applying',
        error: null,
      }
    );

    if (!transition.affected) {
      const latest = await this.getSuggestionOrThrow(canvasId, suggestionId);
      if (latest.status === 'accepted') return this.toDto(latest);
      throw new ConflictException(`Suggestion is ${latest.status}`);
    }

    const applyingSuggestion = await this.getSuggestionOrThrow(canvasId, suggestionId);

    try {
      await this.canvasClient.editBlocks(canvasId, [this.toMutation(applyingSuggestion)]);
      applyingSuggestion.status = 'accepted';
      applyingSuggestion.acceptedBy = userId;
      applyingSuggestion.error = null;
      return this.toDto(await this.suggestionRepository.save(applyingSuggestion));
    } catch (error: any) {
      applyingSuggestion.status = 'failed';
      applyingSuggestion.error = error?.response?.data?.error || error?.message || 'Apply failed';
      await this.suggestionRepository.save(applyingSuggestion);
      throw new BadRequestException(applyingSuggestion.error);
    }
  }

  async reject(canvasId: string, suggestionId: string, userId: string): Promise<CanvasSuggestionDto> {
    await this.canvasService.authorizeCanvasAccess(canvasId, userId, 'editor');
    const suggestion = await this.getSuggestionOrThrow(canvasId, suggestionId);

    if (suggestion.status === 'accepted') {
      throw new ConflictException('Accepted suggestions cannot be rejected');
    }
    if (suggestion.status === 'rejected') return this.toDto(suggestion);

    suggestion.status = 'rejected';
    suggestion.rejectedBy = userId;
    suggestion.error = null;
    return this.toDto(await this.suggestionRepository.save(suggestion));
  }

  async acceptAll(canvasId: string, userId: string): Promise<CanvasSuggestionDto[]> {
    await this.canvasService.authorizeCanvasAccess(canvasId, userId, 'editor');
    const rows = await this.suggestionRepository.find({
      where: { canvasId, status: In(['pending', 'failed']) },
      order: { createdAt: 'ASC' },
    });

    const results: CanvasSuggestionDto[] = [];
    for (const row of rows) {
      results.push(await this.accept(canvasId, row.id, userId));
    }
    return results;
  }

  async rejectAll(canvasId: string, userId: string): Promise<CanvasSuggestionDto[]> {
    await this.canvasService.authorizeCanvasAccess(canvasId, userId, 'editor');
    const rows = await this.suggestionRepository.find({
      where: { canvasId, status: In(['pending', 'failed']) },
      order: { createdAt: 'ASC' },
    });

    const results: CanvasSuggestionDto[] = [];
    for (const row of rows) {
      results.push(await this.reject(canvasId, row.id, userId));
    }
    return results;
  }

  private async getSuggestionOrThrow(canvasId: string, suggestionId: string): Promise<CanvasSuggestionEntity> {
    const suggestion = await this.suggestionRepository.findOne({
      where: { id: suggestionId, canvasId },
    });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    return suggestion;
  }

  private supportedAction(action: string): CanvasSuggestionAction {
    if (
      action === 'replace_text' ||
      action === 'replace_block' ||
      action === 'insert_after' ||
      action === 'insert_before' ||
      action === 'delete_block'
    ) {
      return action;
    }
    throw new BadRequestException(`Unsupported suggestion action: ${action}`);
  }

  private blockIdForMutation(mutation: CanvasBlockMutation): string | null {
    if ('block_id' in mutation) return mutation.block_id;
    return null;
  }

  private targetBlockIdForMutation(mutation: CanvasBlockMutation): string | null {
    if ('target_block_id' in mutation) return mutation.target_block_id ?? null;
    return null;
  }

  private toMutation(suggestion: CanvasSuggestionEntity): SuggestionMutation {
    const payload = suggestion.payload || {};
    switch (suggestion.action) {
      case 'replace_text':
        return {
          action: 'replace_text',
          block_id: suggestion.blockId || payload.block_id,
          new_text: String(payload.new_text ?? ''),
        };
      case 'replace_block':
        return {
          action: 'replace_block',
          block_id: suggestion.blockId || payload.block_id,
          new_block: payload.new_block || {},
        };
      case 'insert_before':
      case 'insert_after':
        return {
          action: suggestion.action,
          target_block_id: suggestion.targetBlockId ?? payload.target_block_id ?? null,
          new_block: payload.new_block || {},
        };
      case 'delete_block':
        return {
          action: 'delete_block',
          block_id: suggestion.blockId || payload.block_id,
        };
    }
  }

  private toDto(entity: CanvasSuggestionEntity): CanvasSuggestionDto {
    return {
      id: entity.id,
      canvasId: entity.canvasId,
      messageId: entity.messageId,
      actionId: entity.actionId,
      blockId: entity.blockId,
      targetBlockId: entity.targetBlockId,
      action: entity.action,
      payload: entity.payload,
      status: entity.status,
      error: entity.error,
      createdBy: entity.createdBy,
      acceptedBy: entity.acceptedBy,
      rejectedBy: entity.rejectedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
