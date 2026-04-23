import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CanvasClientService } from '../canvas-client/canvas-client.service';

@Injectable()
export class McpService {
  constructor(private readonly canvasClient: CanvasClientService) {}

  createServer(): McpServer {
    const server = new McpServer({
      name: 'stack-canvas-mcp',
      version: '1.0.0',
    });

    this.registerTools(server);
    return server;
  }

  private registerTools(server: McpServer) {
    server.tool(
      'get_canvas_blocks',
      'Read all top-level blocks from a canvas. Returns an array of blocks with index, type, and text.',
      { canvas_id: z.string().describe('The canvas document ID') },
      async ({ canvas_id }) => {
        const blocks = await this.canvasClient.getBlocks(canvas_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(blocks, null, 2) }],
        };
      },
    );

    server.tool(
      'insert_canvas_block',
      'Insert a new block into the canvas after the given index. If afterIndex is -1 or omitted, the block is prepended.',
      {
        canvas_id: z.string().describe('The canvas document ID'),
        content: z.string().describe('Text content of the new block'),
        type: z
          .enum(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock'])
          .optional()
          .default('paragraph')
          .describe('Block node type (default: paragraph)'),
        after_index: z
          .number()
          .int()
          .optional()
          .describe('Index of the block to insert after. Omit or use -1 to prepend.'),
      },
      async ({ canvas_id, content, type, after_index }) => {
        const result = await this.canvasClient.insertBlock(canvas_id, content, type, after_index);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.tool(
      'update_canvas_block',
      'Replace the text content of an existing block at the given index.',
      {
        canvas_id: z.string().describe('The canvas document ID'),
        index: z.number().int().describe('Zero-based index of the block to update'),
        content: z.string().describe('New text content for the block'),
      },
      async ({ canvas_id, index, content }) => {
        const result = await this.canvasClient.updateBlock(canvas_id, index, content);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.tool(
      'delete_canvas_block',
      'Delete the block at the given index from the canvas.',
      {
        canvas_id: z.string().describe('The canvas document ID'),
        index: z.number().int().describe('Zero-based index of the block to delete'),
      },
      async ({ canvas_id, index }) => {
        const result = await this.canvasClient.deleteBlock(canvas_id, index);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.tool(
      'reorder_canvas_blocks',
      'Move a block from one position to another in the canvas.',
      {
        canvas_id: z.string().describe('The canvas document ID'),
        from_index: z.number().int().describe('Zero-based index of the block to move'),
        to_index: z.number().int().describe('Zero-based target index to move the block to'),
      },
      async ({ canvas_id, from_index, to_index }) => {
        const result = await this.canvasClient.reorderBlocks(canvas_id, from_index, to_index);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      },
    );
  }
}
