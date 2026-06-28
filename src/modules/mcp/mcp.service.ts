import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CanvasClientService } from '../canvas-client/canvas-client.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskPriority, TaskStatus } from '@app/entities/task/task.entity';
import { CanvasSuggestionService } from '../canvas/canvas-suggestion.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class McpService {
  private readonly toolPolicies = new Map<string, boolean>([
    ['get_canvas_blocks', false],
    ['list_task_lists', false],
    ['list_tasks', false],
    ['search_workspace_members', false],
    ['query_tasks', false],
    ['create_task', true],
    ['create_tasks_batch', true],
    ['create_task_list_with_tasks', true],
    ['send_channel_message', true],
    ['edit_canvas_blocks', true],
  ]);

  constructor(
    private readonly canvasClient: CanvasClientService,
    private readonly tasksService: TasksService,
    private readonly canvasSuggestionService: CanvasSuggestionService,
    private readonly chatService: ChatService
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
    const registerTool = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
      cb: (args: any) => Promise<any>
    ) => {
      const requireConfirmation = this.toolPolicies.get(name) ?? true;
      return server.registerTool(
        name,
        {
          description,
          inputSchema,
          annotations: {
            readOnlyHint: !requireConfirmation,
            destructiveHint: requireConfirmation,
          },
          _meta: {
            stack: {
              require_confirmation: requireConfirmation,
            },
          },
        },
        cb
      );
    };

    registerTool(
      'get_canvas_blocks',
      'Read all top-level blocks from a canvas. Returns an array of blocks with stable id, index, type, and text.',
      { canvas_id: z.string().describe('The canvas document ID') },
      async ({ canvas_id }) => {
        const blocks = await this.canvasClient.getBlocks(canvas_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(blocks, null, 2) }],
        };
      }
    );

    const newCanvasBlockSchema = z.object({
      id: z
        .string()
        .optional()
        .describe('Optional stable block ID. Omit unless preserving or explicitly creating one.'),
      type: z
        .enum(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock'])
        .optional()
        .default('paragraph')
        .describe('Block node type'),
      content: z.string().optional().describe('Plain text content of the block'),
      text: z.string().optional().describe('Alias for content'),
    });

    const canvasMutationSchema = z.discriminatedUnion('action', [
      z.object({
        action: z.literal('replace_text'),
        block_id: z.string().describe('Stable ID of the block to edit'),
        new_text: z.string().describe('Full replacement plain text for the block'),
      }),
      z.object({
        action: z.literal('replace_block'),
        block_id: z.string().describe('Stable ID of the block to replace'),
        new_block: newCanvasBlockSchema.describe('Replacement block. Its id defaults to the replaced block id.'),
      }),
      z.object({
        action: z.literal('insert_before'),
        target_block_id: z.string().nullable().optional().describe('Target block ID. Null/omitted prepends.'),
        new_block: newCanvasBlockSchema.describe('Block to insert'),
      }),
      z.object({
        action: z.literal('insert_after'),
        target_block_id: z.string().nullable().optional().describe('Target block ID. Null/omitted appends.'),
        new_block: newCanvasBlockSchema.describe('Block to insert'),
      }),
      z.object({
        action: z.literal('delete_block'),
        block_id: z.string().describe('Stable ID of the block to delete'),
      }),
    ]);

    registerTool(
      'edit_canvas_blocks',
      [
        'Apply multiple canvas block edits atomically using stable block IDs.',
        'Use this single tool for all canvas edits; do not target blocks by index.',
        'For rewriting/deleting/recreating a section, send one mutations array so the user can accept once.',
      ].join(' '),
      {
        canvas_id: z.string().describe('The canvas document ID'),
        message_id: z
          .string()
          .optional()
          .describe('Optional assistant message/session identifier for suggestion linking'),
        action_id: z.string().optional().describe('Optional parent AI action identifier'),
        mutations: z.array(canvasMutationSchema).min(1).describe('Ordered batch of id-based canvas mutations'),
      },
      async ({ canvas_id, message_id, action_id, mutations }) => {
        const suggestions = await this.canvasSuggestionService.createFromMutations({
          canvasId: canvas_id,
          messageId: message_id,
          actionId: action_id,
          mutations,
          createdBy: 'ai',
        });
        const result = {
          ok: true,
          suggestions,
          createdSuggestionCount: suggestions.length,
        };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );

    registerTool(
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
      async ({
        workspace_id,
        task_list_id,
        acting_user_id,
        title,
        description,
        status,
        priority,
        due_date,
        assignee_ids,
      }) => {
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
      }
    );

    registerTool(
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
          })
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
      }
    );

    registerTool(
      'create_task_list_with_tasks',
      'Create a new task list and multiple tasks from an AI-reviewed canvas action.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        channel_id: z.string().uuid().describe('Channel ID for the new task list'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        list_name: z.string().min(1).max(255).describe('Task list name'),
        source_canvas_id: z.string().uuid().optional().describe('Source canvas ID to attach to every task'),
        source_canvas_title: z.string().max(500).optional().describe('Source canvas title'),
        source_canvas_url: z.string().max(2000).optional().describe('Source canvas URL'),
        overall_due_date: z.string().optional().describe('Overall deadline in ISO format'),
        default_assignee: z.literal('creator').optional().describe('Default assignee strategy'),
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(500),
              description: z.string().optional(),
              status: z.nativeEnum(TaskStatus).optional(),
              priority: z.nativeEnum(TaskPriority).optional(),
              due_date: z.string().optional(),
              assignee_ids: z.array(z.string().uuid()).optional(),
            })
          )
          .min(1),
      },
      async ({
        workspace_id,
        channel_id,
        acting_user_id,
        list_name,
        source_canvas_id,
        source_canvas_title,
        source_canvas_url,
        overall_due_date,
        tasks,
      }) => {
        const overallDueDate = this.parseOptionalDate(overall_due_date, 'overall_due_date');
        const cleanTasks = tasks.map((task, index) => {
          const title = task.title?.trim();
          if (!title) {
            throw new Error(`Task at index ${index} is missing a title`);
          }
          const dueDate = this.parseOptionalDate(task.due_date, `tasks[${index}].due_date`);
          if (overallDueDate && dueDate && dueDate.getTime() > overallDueDate.getTime()) {
            throw new Error(`Task "${title}" due date cannot be later than the overall due date`);
          }
          return {
            ...task,
            title,
            dueDateIso: dueDate ? dueDate.toISOString() : undefined,
          };
        });

        const taskListName = await this.buildUniqueTaskListName(workspace_id, channel_id, acting_user_id, list_name);
        const createdListResponse = await this.tasksService.createTaskList(workspace_id, channel_id, acting_user_id, {
          name: taskListName,
        });
        const taskList = createdListResponse.data as { id: string; name: string; createdById?: string };
        const creatorWorkspaceMemberId = taskList.createdById;
        if (!creatorWorkspaceMemberId) {
          throw new Error('Could not resolve creator workspace member for default assignment');
        }

        const canvasAttachment = source_canvas_id
          ? {
              type: 'canvas' as const,
              name: (source_canvas_title || 'Source canvas').slice(0, 500),
              canvasId: source_canvas_id,
              ...(source_canvas_url ? { url: source_canvas_url.slice(0, 2000) } : {}),
            }
          : null;

        const results: Array<{ index: number; ok: boolean; task?: unknown; error?: string }> = [];
        for (let index = 0; index < cleanTasks.length; index++) {
          const task = cleanTasks[index];
          try {
            const response = await this.tasksService.createTask(workspace_id, taskList.id, acting_user_id, {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDateIso,
              assigneeIds: [creatorWorkspaceMemberId],
              attachments: canvasAttachment ? [canvasAttachment] : [],
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
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ taskList, tasks: results }, null, 2),
            },
          ],
        };
      }
    );

    registerTool(
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
      }
    );

    registerTool(
      'list_tasks',
      'List task items inside a task list, including status, priority, due date, creator, and assignees.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        task_list_id: z.string().uuid().describe('Task list ID'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        status: z.nativeEnum(TaskStatus).optional().describe('Optional task status filter'),
        priority: z.nativeEnum(TaskPriority).optional().describe('Optional task priority filter'),
        assignee_id: z.string().uuid().optional().describe('Optional workspace member ID filter'),
        page: z.number().int().min(1).optional().default(1).describe('Page number'),
        size: z.number().int().min(1).max(200).optional().default(100).describe('Page size'),
      },
      async ({ workspace_id, task_list_id, acting_user_id, status, priority, assignee_id, page, size }) => {
        const result = await this.tasksService.listTasksForMcp(workspace_id, acting_user_id, task_list_id, {
          status,
          priority,
          assigneeId: assignee_id,
          page,
          size,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );

    registerTool(
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
          limit
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(members, null, 2) }],
        };
      }
    );

    registerTool(
      'query_tasks',
      'Query tasks in a channel for workload/progress analysis. Returns task data with assignee information.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        channel_id: z.string().uuid().describe('Channel ID to analyze'),
        acting_user_id: z.string().uuid().describe('User ID performing this action'),
        status: z.nativeEnum(TaskStatus).optional().describe('Optional task status filter'),
        is_overdue: z.boolean().optional().describe('When true, only return non-done tasks past due date'),
      },
      async ({ workspace_id, channel_id, acting_user_id, status, is_overdue }) => {
        const tasks = await this.tasksService.queryTasksForMcp(workspace_id, acting_user_id, {
          channelId: channel_id,
          status,
          isOverdue: is_overdue,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(tasks, null, 2) }],
        };
      }
    );

    registerTool(
      'send_channel_message',
      'Send a Markdown text message to a channel as the acting user. The message may include resolved @username mentions.',
      {
        workspace_id: z.string().uuid().describe('Workspace ID'),
        channel_id: z.string().uuid().describe('Channel ID'),
        acting_user_id: z.string().uuid().describe('User ID sending the message'),
        message: z.string().min(1).max(10000).describe('Message content to send to channel'),
        mentions: z
          .array(
            z.object({
              userId: z.string().uuid().optional(),
              workspaceMemberId: z.string().uuid().optional(),
              name: z.string().optional(),
              email: z.string().optional(),
            })
          )
          .optional()
          .describe('Resolved users to mention. Message content must include matching @name or @email tokens.'),
      },
      async ({ workspace_id, channel_id, acting_user_id, message, mentions }) => {
        const cleanMentions = Array.isArray(mentions)
          ? mentions.filter((mention) => mention?.userId || mention?.workspaceMemberId)
          : [];
        const sent = await this.chatService.sendMessage(workspace_id, channel_id, acting_user_id, {
          content: message,
          messageType: 'text',
          ...(cleanMentions.length ? { metadata: { mentions: cleanMentions } } : {}),
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ok: true, messageId: sent.id, channelId: sent.channelId }, null, 2),
            },
          ],
        };
      }
    );
  }

  private parseOptionalDate(value: string | undefined, label: string): Date | undefined {
    if (!value?.trim()) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${label} must be a valid ISO date`);
    }
    return parsed;
  }

  private async buildUniqueTaskListName(
    workspaceId: string,
    channelId: string,
    actingUserId: string,
    desiredName: string
  ): Promise<string> {
    const baseName = (desiredName.trim() || 'Action items').slice(0, 255);
    const existingLists = await this.tasksService.listTaskListsForMcp(workspaceId, actingUserId, channelId);
    const existingNames = new Set(existingLists.map((list) => list.name.toLowerCase()));
    if (!existingNames.has(baseName.toLowerCase())) {
      return baseName;
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const suffix = ` - ${timestamp}`;
    return `${baseName.slice(0, 255 - suffix.length)}${suffix}`;
  }
}
