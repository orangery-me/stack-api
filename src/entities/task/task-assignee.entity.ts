import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';

@Entity('task_assignees')
@Unique(['taskId', 'workspaceMemberId'])
export class TaskAssigneeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => TaskEntity, (task) => task.assignees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @Column({ type: 'uuid' })
  workspaceMemberId: string;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceMemberId' })
  workspaceMember: WorkspaceMemberEntity;

  @Column({ type: 'uuid', nullable: true })
  assignedById?: string | null;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedById' })
  assignedBy?: WorkspaceMemberEntity | null;

  @CreateDateColumn()
  assignedAt: Date;
}
