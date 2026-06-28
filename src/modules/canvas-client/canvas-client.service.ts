import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface CanvasBlock {
  id: string;
  index: number;
  type: string;
  text: string;
}

export interface BlockMutationResult {
  ok: boolean;
  blocks: CanvasBlock[];
  appliedMutationCount?: number;
  suggestions?: unknown[];
  createdSuggestionCount?: number;
}

export type CanvasBlockMutation =
  | { action: 'replace_text'; block_id: string; new_text: string }
  | { action: 'replace_block'; block_id: string; new_block: NewCanvasBlock }
  | { action: 'insert_before' | 'insert_after'; target_block_id?: string | null; new_block: NewCanvasBlock }
  | { action: 'delete_block'; block_id: string }
  | { action: 'move_after'; block_id: string; target_block_id?: string | null };

export interface NewCanvasBlock {
  id?: string;
  type?: string;
  content?: string;
  text?: string;
}

@Injectable()
export class CanvasClientService {
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('CANVAS_COLLAB_URL');
    const secret = this.config.get<string>('CANVAS_COLLAB_SECRET');

    this.http = axios.create({
      baseURL,
      headers: secret ? { 'x-internal-secret': secret } : {},
      timeout: 10_000,
    });
  }

  async getBlocks(canvasId: string): Promise<CanvasBlock[]> {
    const { data } = await this.http.get<CanvasBlock[]>(`/canvas/${canvasId}/blocks`);
    return data;
  }

  async editBlocks(canvasId: string, mutations: CanvasBlockMutation[]): Promise<BlockMutationResult> {
    const { data } = await this.http.post<BlockMutationResult>(`/canvas/${canvasId}/blocks/mutations`, {
      mutations,
    });
    return data;
  }

  async insertBlock(
    canvasId: string,
    content: string,
    type = 'paragraph',
    afterIndex?: number
  ): Promise<BlockMutationResult> {
    const { data } = await this.http.post<BlockMutationResult>(`/canvas/${canvasId}/blocks`, {
      content,
      type,
      afterIndex,
    });
    return data;
  }

  async updateBlock(canvasId: string, index: number, content: string): Promise<BlockMutationResult> {
    const { data } = await this.http.patch<BlockMutationResult>(`/canvas/${canvasId}/blocks/${index}`, { content });
    return data;
  }

  async deleteBlock(canvasId: string, index: number): Promise<BlockMutationResult> {
    const { data } = await this.http.delete<BlockMutationResult>(`/canvas/${canvasId}/blocks/${index}`);
    return data;
  }

  async reorderBlocks(canvasId: string, fromIndex: number, toIndex: number): Promise<BlockMutationResult> {
    const { data } = await this.http.post<BlockMutationResult>(`/canvas/${canvasId}/blocks/reorder`, {
      fromIndex,
      toIndex,
    });
    return data;
  }
}
