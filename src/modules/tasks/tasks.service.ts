import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ResponseItem } from '@app/common/dtos';
import {
  TaskEntity,
  TaskAssigneeEntity,
  TaskCommentEntity,
  TaskListEntity,
  ChannelEntity,
  ChannelMemberEntity,
  WorkspaceMemberEntity,
} from '@app/entities';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskDto, TaskAssigneeDto } from './dto/task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionService } from '../../policy/permission.service';
import { DEFAULT_CHANNEL_ROLES } from '../../policy/channel/channel-roles.config';
import { canPerformTaskAction, TaskPermissionAction, TaskPermissionContext } from '../../policy/task/task-permission.config';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskAssigneeEntity)
    private readonly taskAssigneeRepository: Repository<TaskAssigneeEntity>,
    @InjectRepository(TaskCommentEntity)
    private readonly taskCommentRepository: Repository<TaskCommentEntity>,
    @InjectRepository(TaskListEntity)
    private readonly taskListRepository: Repository<TaskListEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly channelMemberRepository: Repository<ChannelMemberEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly permissionService: PermissionService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────

  private enforceTaskAction(
    channelMember: ChannelMemberEntity,
    action: TaskPermissionAction,
    context?: TaskPermissionContext,
  ) {
    const roleConfig = DEFAULT_CHANNEL_ROLES.find(r => r.name === channelMember.memberRole);
    if (!roleConfig) {
      throw new ForbiddenException('Invalid channel role');
    }
    
    const hasPermission = canPerformTaskAction(roleConfig.permissions, action, context);
    if (!hasPermission) {
      throw new ForbiddenException(`You don't have permission to perform '${action}' on this task`);
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

  private async verifyChannelMembership(
    channelId: string,
    workspaceMemberId: string,
  ): Promise<ChannelMemberEntity> {
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

  private async getTaskOrFail(taskId: string, workspaceId: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, workspaceId, deletedAt: IsNull() },
      relations: ['assignees', 'assignees.workspaceMember', 'assignees.workspaceMember.user', 'createdBy', 'createdBy.user'],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private mapTaskToDto(task: TaskEntity): TaskDto {
    const assigneeDtos: TaskAssigneeDto[] = (task.assignees || []).map((a) => ({
      id: a.id,
      workspaceMemberId: a.workspaceMemberId,
      userId: a.workspaceMember?.userId,
      name: a.workspaceMember?.user?.name,
      email: a.workspaceMember?.user?.email,
      avatar: a.workspaceMember?.user?.avatar || null,
      assignedAt: a.assignedAt,
    }));

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      channelId: task.channelId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdById: task.createdById,
      creatorName: task.createdBy?.user?.name,
      creatorEmail: task.createdBy?.user?.email,
      assignees: assigneeDtos,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  // ─── TaskList CRUD ────────────────────────────────────────

  async createTaskList(
    workspaceId: string,
    channelId: string,
    userId: string,
    dto: CreateTaskListDto,
  ) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    await this.getChannelOrFail(channelId, workspaceId);
    const channelMember = await this.verifyChannelMembership(channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:create');

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

  async getTaskListsByChannel(
    workspaceId: string,
    channelId: string,
    userId: string,
  ) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    await this.getChannelOrFail(channelId, workspaceId);
    await this.verifyChannelMembership(channelId, workspaceMember.id);

    const lists = await this.taskListRepository.find({
      where: { channelId, workspaceId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });

    return new ResponseItem(lists, 'Task lists fetched successfully');
  }

  async updateTaskList(
    workspaceId: string,
    taskListId: string,
    userId: string,
    dto: UpdateTaskListDto,
  ) {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    const channelMember = await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:update');

    if (dto.name !== undefined) taskList.name = dto.name;
    if (dto.position !== undefined) taskList.position = dto.position;

    const updated = await this.taskListRepository.save(taskList);
    return new ResponseItem(updated, 'Task list updated successfully');
  }

  async deleteTaskList(
    workspaceId: string,
    taskListId: string,
    userId: string,
  ) {
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
    dto: CreateTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const taskList = await this.getTaskListOrFail(taskListId, workspaceId);
    const channelMember = await this.verifyChannelMembership(taskList.channelId, workspaceMember.id);
    this.enforceTaskAction(channelMember, 'task:create');

    const task = this.taskRepository.create({
      workspaceId,
      channelId: taskList.channelId,
      taskListId: taskList.id,
      title: dto.title,
      description: dto.description || null,
      status: dto.status || 'todo',
      priority: dto.priority || 'medium',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      createdById: workspaceMember.id,
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
        }),
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

    const fullTask = await this.getTaskOrFail(savedTask.id, workspaceId);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(fullTask), 'Task created successfully');
  }

  async getTasksByList(
    workspaceId: string,
    taskListId: string,
    userId: string,
    filters: TaskFilterDto = {},
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

    const [tasks, total] = await query
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return new ResponseItem(
      {
        tasks: tasks.map((t) => this.mapTaskToDto(t)),
        total,
        page,
        hasMore: page * size < total,
      },
      'Tasks fetched successfully',
    );
  }

  async getTaskById(
    workspaceId: string,
    taskId: string,
    userId: string,
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    await this.verifyChannelMembership(task.channelId, workspaceMember.id);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(task), 'Task fetched successfully');
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });

    const statusChanged = dto.status !== undefined && task.status !== dto.status;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    task.updatedById = workspaceMember.id;

    await this.taskRepository.save(task);

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

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'Task updated successfully');
  }

  async deleteTask(
    workspaceId: string,
    taskId: string,
    userId: string,
  ): Promise<ResponseItem<{ message: string }>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;

    this.enforceTaskAction(channelMember, 'task:delete', { isCreator: isOwner });

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
    dto: AssignTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });

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

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'User assigned to task');
  }

  async unassignTask(
    workspaceId: string,
    taskId: string,
    userId: string,
    memberId: string,
  ): Promise<ResponseItem<TaskDto>> {
    const workspaceMember = await this.resolveWorkspaceMember(workspaceId, userId);
    const task = await this.getTaskOrFail(taskId, workspaceId);
    const channelMember = await this.verifyChannelMembership(task.channelId, workspaceMember.id);

    const isOwner = task.createdById === workspaceMember.id;
    const isSelf = memberId === workspaceMember.id;
    const isAssignee = task.assignees?.some((a) => a.workspaceMemberId === workspaceMember.id);

    // If unassigning someone else, you must have update rights on the task
    if (!isSelf) {
      this.enforceTaskAction(channelMember, 'task:update', { isCreator: isOwner, isAssignee });
    }

    const assignee = await this.taskAssigneeRepository.findOne({
      where: { taskId, workspaceMemberId: memberId },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee not found on this task');
    }

    await this.taskAssigneeRepository.remove(assignee);

    const updatedTask = await this.getTaskOrFail(taskId, workspaceId);
    return new ResponseItem<TaskDto>(this.mapTaskToDto(updatedTask), 'User unassigned from task');
  }

  // ─── My Tasks ─────────────────────────────────────────────

  async getMyTasks(
    workspaceId: string,
    userId: string,
    filters: TaskFilterDto = {},
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

    query.orderBy('task.createdAt', 'DESC');

    const [tasks, total] = await query
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return new ResponseItem(
      {
        tasks: tasks.map((t) => this.mapTaskToDto(t)),
        total,
        page,
        hasMore: page * size < total,
      },
      'My tasks fetched successfully',
    );
  }
}
