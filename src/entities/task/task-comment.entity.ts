import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';

@Entity('task_comments')
export class TaskCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @ManyToOne(() => TaskEntity, (task) => task.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @Column({ type: 'uuid' })
  workspaceMemberId: string;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceMemberId' })
  workspaceMember: WorkspaceMemberEntity;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: [] })
  mentions: string[];

  @Column({ type: 'uuid', nullable: true })
  parentCommentId?: string | null;

  @ManyToOne(() => TaskCommentEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment?: TaskCommentEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
