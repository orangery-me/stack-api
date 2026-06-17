import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '@app/entities/task/task.entity';
import { TaskAssigneeEntity } from '@app/entities/task/task-assignee.entity';

export interface WorkspaceTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  dueDate: Date | null;
  createdAt: Date;
  workspaceId: string;
}

@Injectable()
export class AdminWorkspaceTasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskAssigneeEntity)
    private readonly taskAssigneeRepository: Repository<TaskAssigneeEntity>
  ) {}

  async getWorkspaceTasks(
    workspaceId: string,
    opts: {
      page: number;
      take: number;
      status?: string;
      priority?: string;
      assigneeId?: string;
      search?: string;
    }
  ) {
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndMapMany('task._assignees', TaskAssigneeEntity, 'ta', 'ta.taskId = task.id')
      .leftJoinAndMapOne('ta._member', 'ta.workspaceMember', 'wm')
      .leftJoinAndMapOne('wm._user', 'wm.user', 'u')
      .where('task.workspaceId = :workspaceId', { workspaceId })
      .andWhere('task.deletedAt IS NULL');

    if (opts.status) {
      qb.andWhere('task.status = :status', { status: opts.status });
    }

    if (opts.priority) {
      qb.andWhere('task.priority = :priority', { priority: opts.priority });
    }

    if (opts.assigneeId) {
      qb.andWhere(
        'EXISTS ' +
          qb
            .subQuery()
            .select('1')
            .from(TaskAssigneeEntity, 'ta2')
            .leftJoin('ta2.workspaceMember', 'wm2')
            .where('ta2.taskId = task.id')
            .andWhere('wm2.userId = :assigneeId')
            .getQuery()
      );
      qb.setParameter('assigneeId', opts.assigneeId);
    }

    if (opts.search) {
      qb.andWhere('LOWER(task.title) LIKE LOWER(:search)', {
        search: `%${opts.search}%`,
      });
    }

    const total = await qb.getCount();

    const tasks = await qb
      .orderBy('task.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.take)
      .take(opts.take)
      .getMany();

    const data: WorkspaceTaskItem[] = tasks.map((task) => {
      const assignee = this.extractFirstAssignee(task as any);
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee,
        dueDate: task.dueDate ?? null,
        createdAt: task.createdAt,
        workspaceId: task.workspaceId,
      };
    });

    return {
      data,
      meta: {
        total,
        page: opts.page,
        take: opts.take,
        totalPages: Math.ceil(total / opts.take),
      },
    };
  }

  private extractFirstAssignee(task: any): { id: string; name: string; avatar?: string } | null {
    const assignees = task._assignees ?? [];
    if (assignees.length === 0) return null;
    const first = assignees[0];
    const member = first._member;
    const user = member?._user;
    if (!user) return null;
    return {
      id: user.id,
      name: user.name ?? user.email ?? 'Unknown',
      avatar: user.avatar ?? undefined,
    };
  }
}
