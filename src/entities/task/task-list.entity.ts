import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { ChannelEntity } from '../channel/channel.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';
import { TaskEntity } from './task.entity';

@Entity('task_lists')
export class TaskListEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: ChannelEntity;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity;

  @Column({ type: 'varchar', length: 255, default: 'Untitled list' })
  name: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: WorkspaceMemberEntity;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TaskEntity, (task) => task.taskList)
  tasks: TaskEntity[];
}
