import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { IsNull, Repository } from 'typeorm';
import { ResponseItem } from '@app/common/dtos';
import {
  TaskEntity,
  TaskAssigneeEntity,
  TaskListEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { TaskStatus } from '@app/entities/task/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskDto, TaskAssigneeDto } from './dto/task.dto';
import { TaskAttachmentDto, TaskAttachmentInputDto } from './dto/task-attachment.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { isAllowedUploadFileType, resolveMaxUploadMb } from '../storage/file-upload.options';
import { DEFAULT_CHANNEL_ROLES } from '../../policy/channel/channel-roles.config';
import {
  canPerformTaskAction,
  TaskPermissionAction,
  TaskPermissionContext,
} from '../../policy/task/task-permission.config';
import { ChannelPermissionResolver } from '../../policy/channel/channel-permission.resolver';

@Injectable()
export class TasksService {
  private static readonly MAX_ATTACHMENTS = 50;

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskAssigneeEntity)
    private readonly taskAssigneeRepository: Repository<TaskAssigneeEntity>,
    @InjectRepository(TaskListEntity)
    private readonly taskListRepository: Repository<TaskListEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly channelPermissionResolver: ChannelPermissionResolver
  ) {}

  // ─── Helpers ──────────────────────────────────────────────

  private enforceTaskAction(
    channelMember: ChannelMemberEntity,
    action: TaskPermissionAction,
    context?: TaskPermissionContext
  ) {
    const roleConfig = DEFAULT_CHANNEL_ROLES.find((r) => r.name === channelMember.memberRole);
    if (!roleConfig) {
      throw new ForbiddenException('Invalid channel role');
    }

    const hasPermission = canPerformTaskAction(roleConfig.permissions, action, context);
    if (!hasPermission) {
      throw new ForbiddenException(`You don't have permission to perform '${action}' on this task`);
    }
  }

  private enforceDynamicChannelAction(
    channelMember: ChannelMemberEntity,
    channel: ChannelEntity,
    action: 'channel:create_task_list' | 'channel:edit_task_item'
  ) {
    const roleConfig = DEFAULT_CHANNEL_ROLES.find((r) => r.name === channelMember.memberRole);
    const allowed = this.channelPermissionResolver.can(roleConfig?.permissions, action, channel.settings);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to perform this action in this channel');
    }
  }

  private async resolveWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMemberEntity> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId, status: WorkspaceMemberStatusEnum.ACTIVE },
      relations: ['user'],
    });
    if (!member) {
      throw new ForbiddenException('You are not an active member of this workspace');
    }
    return member;
  }

  private async verifyChannelMembership(channelId: string, workspaceMemberId: string): Promise<ChannelMemberEntity> {
    const channelMember = await this.channelMemberRepository.findOne({
      where: { channelId, memberId: workspaceMemberId },
    });
    if (!channelMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }
    return channelMember;
  }

  private async getChannelOrFail(channelId: string, workspaceId: string): Promise<ChannelEntity> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId, workspaceId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  private async getTaskListOrFail(taskListId: string, workspaceId: string): Promise<TaskListEntity> {
    const taskList = await this.taskListRepository.findOne({
      where: { id: taskListId, workspaceId },
    });
    if (!taskList) {
      throw new NotFoundException('Task list not found');
    }
    return taskList;
  }

  private readonly taskDetailRelations = [
    'assignees',
    'assignees.workspaceMember',
    'assignees.workspaceMember.user',
    'createdBy',
    'createdBy.user',
    'subtasks',
    'subtasks.assignees',
    'subtasks.assignees.workspaceMember',
    'subtasks.assignees.workspaceMember.user',
    'subtasks.createdBy',
    'subtasks.createdBy.user',
  ] as const;

  private async getTaskOrFail(taskId: string, workspaceId: string, withChildren = false): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, workspaceId, deletedAt: IsNull() },
      relations: withChildren
        ? [...this.taskDetailRelations]
        : ['assignees', 'assignees.workspaceMember', 'assignees.workspaceMember.user', 'createdBy', 'createdBy.user'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private mapAttachmentsStored(raw?: Record<string, unknown>[] | null): TaskAttachmentDto[] {
    if (!Array.isArray(raw)) return [];
    const out: TaskAttachmentDto[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const type = r.type;
      if (type !== 'canvas' && type !== 'file') continue;
      const name = String(r.name ?? '').slice(0, 500);
      if (!name) continue;
      const dto: TaskAttachmentDto = {
        id: typeof r.id === 'string' ? r.id : undefined,
        type,
        name,
        url: typeof r.url === 'string' ? r.url : undefined,
        canvasId: typeof r.canvasId === 'string' ? r.canvasId : undefined,
        fileId: typeof r.fileId === 'string' ? r.fileId.slice(0, 2048) : undefined,
      };
      if (typeof r.size === 'number' && Number.isFinite(r.size) && r.size >= 0) {
        dto.size = Math.min(r.size, Number.MAX_SAFE_INTEGER);
      }
      if (typeof r.mimeType === 'string' && r.mimeType.trim()) {
        dto.mimeType = r.mimeType.trim().slice(0, 255);
      }
      if (typeof r.uploadedAt === 'string' && r.uploadedAt.trim()) {
        dto.uploadedAt = r.uploadedAt;
      }
      out.push(dto);
      if (out.length >= 50) break;
    }
    return out;
  }

  private normalizeAttachmentsInput(input?: TaskAttachmentInputDto[] | null): Record<string, unknown>[] {
    if (!input?.length) return [];
    const out: Record<string, unknown>[] = [];
    for (const a of input) {
      if (!a?.type || !(a.name || '').trim()) continue;
      const row: Record<string, unknown> = {
        type: a.type,
        name: a.name.trim().slice(0, 500),
      };
      if (a.id) row.id = a.id;
      if (a.url) row.url = a.url.slice(0, 2000);
      if (a.canvasId) row.canvasId = a.canvasId;
      if (a.fileId) row.fileId = String(a.fileId).slice(0, 2048);
      if (a.size !== undefined && a.size !== null && Number.isFinite(Number(a.size))) {
        row.size = Math.floor(Number(a.size));
      }
      if (a.mimeType) row.mimeType = String(a.mimeType).slice(0, 255);
      if (a.uploadedAt) row.uploadedAt = String(a.uploadedAt);
      out.push(row);
      if (out.length >= 50) break;
    }
    return out;
  }

  private assigneesToDto(assignees?: TaskAssigneeEntity[]): TaskAssigneeDto[] {
    return (assignees || []).map((a) => ({
      id: a.id,
      workspaceMemberId: a.workspaceMemberId,
      userId: a.workspaceMember?.userId,
      name: a.workspaceMember?.user?.name,
      email: a.workspaceMember?.user?.email,
      avatar: a.workspaceMember?.user?.avatar || null,
      assignedAt: a.assignedAt,
    }));
  }

  private mapTaskToLeaf(task: TaskEntity): TaskDto {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      channelId: task.channelId,
      taskListId: task.taskListId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      attachments: this.mapAttachmentsStored(task.attachments ?? null),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdById: task.createdById,
      creatorName: task.createdBy?.user?.name,
      creatorEmail: task.createdBy?.user?.email,
      reporterWorkspaceMemberId: task.createdById,
      reporterUserId: task.createdBy?.user?.id,
      reporterName: task.createdBy?.user?.name,
      reporterEmail: task.createdBy?.user?.email,
      assignees: this.assigneesToDto(task.assignees),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private mapTaskToDto(task: TaskEntity): TaskDto {
    const dto = this.mapTaskToLeaf(task);
    const rawChildren = task.subtasks || [];
    if (rawChildren.length) {
      dto.subtasks = rawChildren
        .filter((c) => !c.deletedAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((c) => this.mapTaskToLeaf(c));
    }
    return dto;
  }

  /** When every non-deleted subtask is Done, mark parent Done once (no automatic downgrade when a subtask reopens). */
  private async maybeRollupParentDone(
    workspaceId: string,
    parentId: string | null | undefined,
    actorUserId: string
  ): Promise<void> {
    if (!parentId) return;
    const siblings = await this.taskRepository.find({
      where: { workspaceId, parentTaskId: parentId, deletedAt: IsNull() },
    });
    if (!siblings.length) return;
    if (!siblings.every((t) => t.status === TaskStatus.DONE)) return;

    const parent = await this.getTaskOrFail(parentId, workspaceId);
    if (parent.status === TaskStatus.DONE) return;

    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, actorUserId);
    await this.verifyChannelMembership(parent.channelId, workspaceMember.id);

    parent.status = TaskStatus.DONE;
    parent.updatedById = workspaceMember.id;
    await this.taskRepository.save(parent);

    const withAssignees = await this.getTaskOrFail(parentId, workspaceId);
    if (!withAssignees.assignees?.length) return;

    const assigneeUserIds = withAssignees.assignees
      .map((a) => a.workspaceMember?.user?.id)
      .filter((id) => Boolean(id) && id !== actorUserId);
    if (assigneeUserIds.length === 0) return;

    await this.notificationsService.publishEvent({
      type: 'task.status_changed',
      workspaceId,
      actorUserId,
      payload: {
        recipientUserIds: assigneeUserIds,
        actorName: workspaceMember.user?.name || 'Someone',
        taskTitle: withAssignees.title,
        status: withAssignees.status,
        targetUrl: `/channels/${withAssignees.channelId}`,
      },
    });
  }

  // ─── TaskList CRUD ────────────────────────────────────────

  async createTaskList(workspaceId: string, channelId: string, userId: string, dto: CreateTaskListDto) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const channel = await this.getChannelOrFail(channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:create');
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:create_task_list');

    // Calculate next position
    const maxPos = await this.taskListRepository
      .createQueryBuilder('tl')
      .select('COALESCE(MAX(tl.position), -1)', 'maxPos')
      .where('tl.channelId = :channelId', { channelId })
      .getRawOne();

    const taskList = this.taskListRepository.create({
      channelId,
      workspaceId,
      name: dto.name || 'Untitled list',
      position: (maxPos?.maxPos ?? -1) + 1,
      createdById: workspaceMember.id,
    });

    const saved = await this.taskListRepository.save(taskList);
    return new ResponseItem(saved, 'Task list created successfully');
  }

  async getTaskListsByChannel(workspaceId: string, channelId: string, userId: string) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    await this.getChannelOrFail(channelId, workspaceId);
    await this.verifyChannelMembership(channelId, workspaceMember.id);

    const lists = await this.taskListRepository.find({
      where: { channelId, workspaceId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });

    return new ResponseItem(lists, 'Task lists fetched successfully');
  }

  async listTaskListsForMcp(
    workspaceId: string,
    userId: string,
    channelId?: string
  ): Promise<Array<{ id: string; name: string; channelId: string; position: number }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);

    if (channelId) {
      await this.verifyChannelMembership(channelId, workspaceMember.id);
      const lists = await this.taskListRepository.find({
        where: { workspaceId, channelId },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
      return lists.map((list) => ({
        id: list.id,
        name: list.name,
        channelId: list.channelId,
        position: list.position,
      }));
    }

    const joinedChannels = await this.channelMemberRepository.find({
      where: { memberId: workspaceMember.id },
    });
    const channelIds = joinedChannels.map((item) => item.channelId);
    if (!channelIds.length) return [];

    const lists = await this.taskListRepository
      .createQueryBuilder('taskList')
      .where('taskList.workspaceId = :workspaceId', { workspaceId })
      .andWhere('taskList.channelId IN (:...channelIds)', { channelIds })
      .orderBy('taskList.position', 'ASC')
      .addOrderBy('taskList.createdAt', 'ASC')
      .getMany();

    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      channelId: list.channelId,
      position: list.position,
    }));
  }

  async searchWorkspaceMembersForMcp(
    workspaceId: string,
    userId: string,
    query: string,
    channelId?: string,
    limit = 10
  ): Promise<Array<{ workspaceMemberId: string; userId: string; name: string; email: string }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const normalizedLimit = Math.min(Math.max(limit, 1), 50);

    let allowedMemberIds: string[] | null = null;
    if (channelId) {
      await this.verifyChannelMembership(channelId, workspaceMember.id);
      const channelMembers = await this.channelMemberRepository.find({
        where: { channelId },
      });
      allowedMemberIds = channelMembers.map((member) => member.memberId);
      if (!allowedMemberIds.length) return [];
    }

    const qb = this.workspaceMemberRepository
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .where('member.workspaceId = :workspaceId', { workspaceId })
      .andWhere('member.status = :status', { status: WorkspaceMemberStatusEnum.ACTIVE });

    if (allowedMemberIds) {
      qb.andWhere('member.id IN (:...allowedMemberIds)', { allowedMemberIds });
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      qb.andWhere('(LOWER(user.name) LIKE :q OR LOWER(user.email) LIKE :q)', {
        q: `%${normalizedQuery.toLowerCase()}%`,
      });
    }

    const members = await qb.orderBy('user.name', 'ASC').limit(normalizedLimit).getMany();
    return members
      .filter((member) => Boolean(member.user?.id))
      .map((member) => ({
        workspaceMemberId: member.id,
        userId: member.user.id,
        name: member.user.name || '',
        email: member.user.email || '',
      }));
  }

  async updateTaskList(workspaceId: string, taskListId: string, userId: string, dto: UpdateTaskListDto) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    const channelMember = await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:update');

    if (dto.name !== undefined) taskList.name = dto.name;
    if (dto.position !== undefined) taskList.position = dto.position;

    const updated = await this.taskListRepository.save(taskList);
    return new ResponseItem(updated, 'Task list updated successfully');
  }

  async deleteTaskList(workspaceId: string, taskListId: string, userId: string) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    const channelMember = await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:delete');

    // CASCADE will delete all tasks in this list
    await this.taskListRepository.remove(taskList);
    return new ResponseItem({ message: 'Task list deleted' }, 'Task list deleted successfully');
  }

  // ─── Task CRUD ────────────────────────────────────────────

  async createTask(
    workspaceId: string,
    taskListId: string,
    userId: string,
    dto: CreateTaskDto
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    const channel = await this.getChannelOrFail(taskList.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:create');
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    let reporterMember = workspaceMember;
    if (dto.reporterWorkspaceMemberId && dto.reporterWorkspaceMemberId !== workspaceMember.id) {
      const targetReporter = await this.workspaceMemberRepository.findOne({
        where: {
          id: dto.reporterWorkspaceMemberId,
          workspaceId,
          status: WorkspaceMemberStatusEnum.ACTIVE,
        },
        relations: ['user'],
      });
      if (!targetReporter) {
        throw new NotFoundException('Reporter not found');
      }
      await this.verifyChannelMembership(taskList.channelId, targetReporter.id);
      reporterMember = targetReporter;
    }

    let parentTaskId: string | null = null;
    if (dto.parentTaskId) {
      const parent = await this.getTaskOrFail(dto.parentTaskId, workspaceId);
      if (parent.taskListId !== taskList.id) {
        throw new ConflictException('Subtask parent must belong to the same task list');
      }
      if (parent.parentTaskId) {
        throw new ConflictException('Nested subtasks deeper than one level are not supported');
      }
      parentTaskId = parent.id;
    }

    const attachments =
      dto.attachments !== undefined && dto.attachments.length > 0
        ? this.normalizeAttachmentsInput(dto.attachments)
        : [];

    const task = this.taskRepository.create({
      workspaceId,
      channelId: taskList.channelId,
      taskListId: taskList.id,
      parentTaskId,
      title: dto.title,
      description: dto.description || null,
      status: dto.status || TaskStatus.TODO,
      priority: dto.priority || 'medium',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      attachments: attachments.length ? attachments : null,
      createdById: reporterMember.id,
      updatedById: workspaceMember.id,
    });

    const savedTask = await this.taskRepository.save(task);

    // Auto-assign if assigneeIds provided
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const assignees = dto.assigneeIds.map((memberId) =>
        this.taskAssigneeRepository.create({
          taskId: savedTask.id,
          workspaceMemberId: memberId,
          assignedById: workspaceMember.id,
        })
      );
      await this.taskAssigneeRepository.save(assignees);

      // Trigger notifications for new assignments
      const targetUserIds = [];
      for (const memberId of dto.assigneeIds) {
        const member = await this.workspaceMemberRepository.findOne({ where: { id: memberId }, relations: ['user'] });
        if (member?.user?.id && member.user.id !== userId) {
          targetUserIds.push(member.user.id);
        }
      }

      if (targetUserIds.length > 0) {
        await this.notificationsService.publishEvent({
          type: 'task.assigned',
          workspaceId,
          actorUserId: userId,
          payload: {
            recipientUserIds: targetUserIds,
            actorName: workspaceMember.user?.name || 'Someone',
            taskTitle: savedTask.title,
            targetUrl: `/channels/${savedTask.channelId}`,
          },
        });
      }
    }

    if (parentTaskId && savedTask.status === TaskStatus.DONE) {
      await this.maybeRollupParentDone(workspaceId, parentTaskId, userId);
    }

    const fullTask = await this.getTaskOrFail(savedTask.id, workspaceId, true);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(fullTask), 'Task created successfully');
  }

  async getTasksByList(
    workspaceId: string,
    taskListId: string,
    userId: string,
    filters: TaskFilterDto = {}
  ): Promise<ResponseItem<{ tasks: TaskDto[]; total: number; page: number; hasMore: boolean }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);

    const page = filters.page || 1;
    const size = filters.size || 50;

    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignees', 'assignee')
      .leftJoinAndSelect('assignee.workspaceMember', 'assigneeMember')
      .leftJoinAndSelect('assigneeMember.user', 'assigneeUser')
      .leftJoinAndSelect('task.createdBy', 'creator')
      .leftJoinAndSelect('creator.user', 'creatorUser')
      .where('task.taskListId = :taskListId', { taskListId })
      .andWhere('task.workspaceId = :workspaceId', { workspaceId })
      .andWhere('task.deletedAt IS NULL');

    if (filters.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      query.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters.assigneeId) {
      query.andWhere('assignee.workspaceMemberId = :assigneeId', { assigneeId: filters.assigneeId });
    }

    query.orderBy('task.createdAt', 'ASC');

    const [rawTasks, total] = await query
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    const uniq = new Map<string, TaskEntity>();
    for (const t of rawTasks) {
      if (!uniq.has(t.id)) uniq.set(t.id, t);
    }
    const tasks = [...uniq.values()];

    return new ResponseItem(
      {
        tasks: tasks.map((t) => this.mapTaskToLeaf(t)),
        total,
        page,
        hasMore: page * size < total,
      },
      'Tasks fetched successfully'
    );
  }

  async getTaskById(workspaceId: string, taskId: string, userId: string): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId, true);
    await this.verifyChannelMembership(task.channelId, workspaceMember.id);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(task), 'Task fetched successfully');
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channel = await this.getChannelOrFail(task.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    const statusChanged = dto.status !== undefined && task.status !== dto.status;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.attachments !== undefined) {
      const att = this.normalizeAttachmentsInput(dto.attachments);
      task.attachments = att.length ? att : null;
    }
    task.updatedById = workspaceMember.id;

    await this.taskRepository.save(task);

    if (task.parentTaskId) {
      await this.maybeRollupParentDone(workspaceId, task.parentTaskId, userId);
    }

    if (statusChanged && task.assignees?.length > 0) {
      const assigneeUserIds = task.assignees
        .map((a) => a.workspaceMember?.user?.id)
        .filter((id) => id && id !== userId);

      if (assigneeUserIds.length > 0) {
        await this.notificationsService.publishEvent({
          type: 'task.status_changed',
          workspaceId,
          actorUserId: userId,
          payload: {
            recipientUserIds: assigneeUserIds,
            actorName: workspaceMember.user?.name || 'Someone',
            taskTitle: task.title,
            status: task.status,
            targetUrl: `/channels/${task.channelId}`,
          },
        });
      }
    }

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId, true);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'Task updated successfully');
  }

  private getTaskAttachmentMaxMb(): number {
    return resolveMaxUploadMb(this.configService.get<number>('TASK_ATTACHMENT_MAX_MB'));
  }

  private assertTaskAttachmentUpload(file: Express.Multer.File): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const maxMb = this.getTaskAttachmentMaxMb();
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds maximum size (${maxMb} MB)`);
    }

    if (!isAllowedUploadFileType(file)) {
      throw new BadRequestException('File type is not allowed');
    }
  }

  private createTaskFileAttachmentRow(
    file: Express.Multer.File,
    uploaded: { url: string; objectPath: string }
  ): Record<string, unknown> {
    const displayName = path.basename(file.originalname || 'file').slice(0, 500);

    return {
      id: randomUUID(),
      type: 'file',
      name: displayName,
      url: uploaded.url,
      fileId: uploaded.objectPath,
      size: file.size,
      mimeType: file.mimetype?.slice(0, 255) || undefined,
      uploadedAt: new Date().toISOString(),
    };
  }

  async uploadTaskAttachment(
    workspaceId: string,
    taskId: string,
    userId: string,
    file: Express.Multer.File
  ): Promise<ResponseItem<TaskDto>> {
    this.assertTaskAttachmentUpload(file);

    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channel = await this.getChannelOrFail(task.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    const rawExisting = Array.isArray(task.attachments) ? [...task.attachments] : [];
    const count = rawExisting.filter((x) => x && typeof x === 'object').length;
    if (count >= TasksService.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Maximum attachment count (${TasksService.MAX_ATTACHMENTS}) reached`);
    }

    const uploaded = await this.storageService.uploadFile({
      buffer: file.buffer,
      originalFilename: file.originalname || 'file',
      mimeType: file.mimetype,
      directory: ['workspaces', workspaceId, 'tasks', taskId, 'attachments'],
    });

    task.attachments = [...rawExisting, this.createTaskFileAttachmentRow(file, uploaded)];
    task.updatedById = workspaceMember.id;
    await this.taskRepository.save(task);

    const full = await this.getTaskOrFail(taskId, workspaceId, true);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(full), 'Attachment uploaded successfully');
  }

  async deleteTask(workspaceId: string, taskId: string, userId: string): Promise<ResponseItem<{ message: string }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channel = await this.getChannelOrFail(task.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;

    this.enforceTaskAction(channelMember, 'task:delete', { isCreator: isOwner });
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    const children = await this.taskRepository.find({
      where: { parentTaskId: taskId, deletedAt: IsNull() },
    });
    for (const child of children) {
      child.deletedAt = new Date();
      child.updatedById = workspaceMember.id;
      await this.taskRepository.save(child);
    }

    task.deletedAt = new Date();
    task.updatedById = workspaceMember.id;
    await this.taskRepository.save(task);

    return new ResponseItem({ message: 'Task deleted' }, 'Task deleted successfully');
  }

  // ─── Assign / Unassign ───────────────────────────────────

  async assignTask(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: AssignTaskDto
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channel = await this.getChannelOrFail(task.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    const targetMember = await this.workspaceMemberRepository.findOne({
      where: { id: dto.workspaceMemberId, workspaceId, status: WorkspaceMemberStatusEnum.ACTIVE },
    });
    if (!targetMember) {
      throw new NotFoundException('Target workspace member not found');
    }

    const existing = await this.taskAssigneeRepository.findOne({
      where: { taskId, workspaceMemberId: dto.workspaceMemberId },
    });
    if (existing) {
      throw new ConflictException('User is already assigned to this task');
    }

    const assignee = this.taskAssigneeRepository.create({
      taskId,
      workspaceMemberId: dto.workspaceMemberId,
      assignedById: workspaceMember.id,
    });
    await this.taskAssigneeRepository.save(assignee);

    const targetUser = targetMember.user;
    if (targetUser && targetUser.id !== userId) {
      await this.notificationsService.publishEvent({
        type: 'task.assigned',
        workspaceId,
        actorUserId: userId,
        payload: {
          recipientUserIds: [targetUser.id],
          actorName: workspaceMember.user?.name || 'Someone',
          taskTitle: task.title,
          targetUrl: `/channels/${task.channelId}`,
        },
      });
    }

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId, true);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'User assigned to task');
  }

  async unassignTask(
    workspaceId: string,
    taskId: string,
    userId: string,
    memberId: string
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channel = await this.getChannelOrFail(task.channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isSelf = memberId === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    // If unassigning someone else, you must have update rights on the task
    if (!isSelf) {
      this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });
    }
    this.enforceDynamicChannelAction(channelMember, channel, 'channel:edit_task_item');

    const assignee = await this.taskAssigneeRepository.findOne({
      where: { taskId, workspaceMemberId: memberId },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee not found on this task');
    }

    await this.taskAssigneeRepository.remove(assignee);

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId, true);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'User unassigned from task');
  }

  // ─── My Tasks ─────────────────────────────────────────────

  async getMyTasks(
    workspaceId: string,
    userId: string,
    filters: TaskFilterDto = {}
  ): Promise<ResponseItem<{ tasks: TaskDto[]; total: number; page: number; hasMore: boolean }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);

    const page = filters.page || 1;
    const size = filters.size || 50;

    const query = this.taskRepository
      .createQueryBuilder('task')
      .innerJoin('task.assignees', 'myAssignment', 'myAssignment.workspaceMemberId = :memberId', {
        memberId: workspaceMember.id,
      })
      .leftJoinAndSelect('task.assignees', 'assignee')
      .leftJoinAndSelect('assignee.workspaceMember', 'assigneeMember')
      .leftJoinAndSelect('assigneeMember.user', 'assigneeUser')
      .leftJoinAndSelect('task.createdBy', 'creator')
      .leftJoinAndSelect('creator.user', 'creatorUser')
      .where('task.workspaceId = :workspaceId', { workspaceId })
      .andWhere('task.deletedAt IS NULL');

    if (filters.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      query.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters.channelId) {
      query.andWhere('task.channelId = :channelId', { channelId: filters.channelId });
    }
    if (filters.dueFrom) {
      query.andWhere('task.dueDate IS NOT NULL').andWhere('task.dueDate >= :dueFrom', {
        dueFrom: new Date(filters.dueFrom),
      });
    }
    if (filters.dueTo) {
      query.andWhere('task.dueDate IS NOT NULL').andWhere('task.dueDate <= :dueTo', {
        dueTo: new Date(filters.dueTo),
      });
    }

    query.orderBy('task.createdAt', 'DESC');

    const [tasks, total] = await query
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return new ResponseItem(
      {
        tasks: tasks.map((t) => this.mapTaskToLeaf(t)),
        total,
        page,
        hasMore: page * size < total,
      },
      'My tasks fetched successfully'
    );
  }
}
