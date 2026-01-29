import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';
import { ChannelEntity } from '../channel/channel.entity';
import { CanvasContentEntity } from './canvas-content.entity';
import { CanvasVersionEntity } from './canvas-version.entity';

@Entity('canvases')
export class CanvasEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.channels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: ChannelEntity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active | archived | deleted (soft)

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

  @Column({ type: 'int', nullable: true })
  lastPublishedVersion?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastAutoSaveAt?: Date | null;

  @OneToOne(() => CanvasContentEntity, (content) => content.canvas)
  content: CanvasContentEntity;

  @OneToMany(() => CanvasVersionEntity, (version) => version.canvas)
  versions: CanvasVersionEntity[];
}

