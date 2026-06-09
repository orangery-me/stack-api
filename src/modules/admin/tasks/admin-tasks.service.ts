import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '@app/entities/task/task.entity';
import { TaskListEntity } from '@app/entities/task/task-list.entity';

@Injectable()
export class AdminTasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskListEntity)
    private readonly taskListRepository: Repository<TaskListEntity>,
  ) {}

  async getStats() {
    const total = await this.taskRepository.count();
    const completed = await this.taskRepository.count({ where: { status: 'done' } });
    const inProgress = await this.taskRepository.count({ where: { status: 'in_progress' } });
    const todo = await this.taskRepository.count({ where: { status: 'todo' } });

    const overdue = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.dueDate < :now', { now: new Date() })
      .andWhere('task.status != :status', { status: 'done' })
      .getCount();

    // Stats by workspace
    const byWorkspace = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.taskList', 'taskList')
      .select('taskList.workspaceId', 'workspaceId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('taskList.workspaceId')
      .getRawMany();

    return { total, inProgress, completed, todo, overdue, byWorkspace };
  }

  async getTrends(period: 'day' | 'week' | 'month' = 'week') {
    const truncMap = { day: 'day', week: 'week', month: 'month' };
    const created = await this.taskRepository
      .createQueryBuilder('task')
      .select(`DATE_TRUNC('${truncMap[period]}', task.createdAt)`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('task.deletedAt IS NULL')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const labels = created.map(r => {
      const d = new Date(r.date);
      if (period === 'week') return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
      if (period === 'month') return `T${d.getMonth() + 1}`;
      return d.toLocaleDateString('vi-VN');
    });

    return { period, labels, values: created.map(r => parseInt(r.count, 10)) };
  }

  async getTimeline(page: number = 1, size: number = 20) {
    // Only return metadata: createdAt, updatedAt, status, no title/content
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .select([
        'task.id',
        'task.status',
        'task.createdAt',
        'task.updatedAt',
        'task.dueDate',
        'task.priority',
      ])
      .leftJoin('task.taskList', 'taskList')
      .addSelect(['taskList.id', 'taskList.name', 'taskList.workspaceId'])
      .orderBy('task.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * size).take(size).getMany();
    return {
      data: data.map(t => ({
        id: t.id,
        status: t.status,
        priority: (t as any).priority,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        dueDate: (t as any).dueDate,
        taskList: (t as any).taskList ? { id: (t as any).taskList.id, name: (t as any).taskList.name, workspaceId: (t as any).taskList.workspaceId } : null,
      })),
      meta: { page, take: size, total, pageCount: Math.ceil(total / size) },
    };
  }
}
