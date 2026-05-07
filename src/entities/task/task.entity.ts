import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { ChannelEntity } from '../channel/channel.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';
import { TaskAssigneeEntity } from './task-assignee.entity';
import { TaskCommentEntity } from './task-comment.entity';
import { TaskListEntity } from './task-list.entity';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: ChannelEntity;

  @Column({ type: 'uuid', nullable: true })
  taskListId?: string | null;

  @ManyToOne(() => TaskListEntity, (taskList) => taskList.tasks, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'taskListId' })
  taskList?: TaskListEntity | null;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32, default: TaskStatus.TODO })
  status: string;

  @Column({ type: 'varchar', length: 20, default: TaskPriority.MEDIUM })
  priority: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: WorkspaceMemberEntity;

  @Column({ type: 'uuid', nullable: true })
  updatedById?: string | null;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy?: WorkspaceMemberEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => TaskAssigneeEntity, (assignee) => assignee.task)
  assignees: TaskAssigneeEntity[];

  @OneToMany(() => TaskCommentEntity, (comment) => comment.task)
  comments: TaskCommentEntity[];
}
