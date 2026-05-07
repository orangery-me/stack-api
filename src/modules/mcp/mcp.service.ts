import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CanvasClientService } from '../canvas-client/canvas-client.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskPriority, TaskStatus } from '@app/entities/task/task.entity';

@Injectable()
export class McpService {
  constructor(
    private readonly canvasClient: CanvasClientService,
    private readonly tasksService: TasksService,
  ) {}

  createServer(): McpServer {
    const server = new McpServer({
      name: 'stack-canvas-mcp',
      version: '1.0.0',
    });

    this.registerTools(server);
    return server;
  }

  private registerTools(serverInstance: McpServer) {
    const server = serverInstance as any;

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

    server.tool(
      'create_task',
      'Create a task in a task list with permission enforcement via task service.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        task_list_id: z.string().uuid().describe('Task list ID'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        title: z.string().min(1).max(500).describe('Task title'),
        description: z.string().optional().describe('Task description'),
        status: z.nativeEnum(TaskStatus).optional().describe('Task status'),
        priority: z.nativeEnum(TaskPriority).optional().describe('Task priority'),
        due_date: z.string().optional().describe('Due date in ISO format'),
        assignee_ids: z.array(z.string().uuid()).optional().describe('Workspace member IDs to assign'),
      },
      async ({ workspace_id, task_list_id, acting_user_id, title, description, status, priority, due_date, assignee_ids }) => {
        const response = await this.tasksService.createTask(workspace_id, task_list_id, acting_user_id, {
          title,
          description,
          status,
          priority,
          dueDate: due_date,
          assigneeIds: assignee_ids,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }],
        };
      },
    );

    server.tool(
      'create_tasks_batch',
      'Create multiple tasks in one call and return per-item success/failure.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        task_list_id: z.string().uuid().describe('Task list ID'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        tasks: z.array(
          z.object({
            title: z.string().min(1).max(500),
            description: z.string().optional(),
            status: z.nativeEnum(TaskStatus).optional(),
            priority: z.nativeEnum(TaskPriority).optional(),
            due_date: z.string().optional(),
            assignee_ids: z.array(z.string().uuid()).optional(),
          }),
        ),
      },
      async ({ workspace_id, task_list_id, acting_user_id, tasks }) => {
        const results: Array<{ index: number; ok: boolean; task?: unknown; error?: string }> = [];
        for (let index = 0; index < tasks.length; index++) {
          const task = tasks[index];
          try {
            const response = await this.tasksService.createTask(workspace_id, task_list_id, acting_user_id, {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.due_date,
              assigneeIds: task.assignee_ids,
            });
            results.push({ index, ok: true, task: response.data });
          } catch (error: any) {
            results.push({
              index,
              ok: false,
              error: error?.message ?? 'Task creation failed',
            });
          }
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
        };
      },
    );

    server.tool(
      'list_task_lists',
      'List task lists available to the acting user (optionally by channel).',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        channel_id: z.string().uuid().optional().describe('Optional channel ID to scope task lists'),
      },
      async ({ workspace_id, acting_user_id, channel_id }) => {
        const lists = await this.tasksService.listTaskListsForMcp(workspace_id, acting_user_id, channel_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(lists, null, 2) }],
        };
      },
    );

    server.tool(
      'search_workspace_members',
      'Search workspace members for assignment suggestions (optional channel scope).',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        query: z.string().default('').describe('Search query by name/email'),
        channel_id: z.string().uuid().optional().describe('Optional channel ID to only search channel members'),
        limit: z.number().int().min(1).max(50).optional().default(10).describe('Max results'),
      },
      async ({ workspace_id, acting_user_id, query, channel_id, limit }) => {
        const members = await this.tasksService.searchWorkspaceMembersForMcp(
          workspace_id,
          acting_user_id,
          query,
          channel_id,
          limit,
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(members, null, 2) }],
        };
      },
    );
  }
}
