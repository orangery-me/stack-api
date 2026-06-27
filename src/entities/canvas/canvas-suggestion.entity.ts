import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CanvasEntity } from './canvas.entity';

export type CanvasSuggestionAction =
  | 'replace_text'
  | 'replace_block'
  | 'insert_after'
  | 'insert_before'
  | 'delete_block';

export type CanvasSuggestionStatus = 'pending' | 'applying' | 'accepted' | 'rejected' | 'failed';

@Entity('canvas_suggestions')
@Index(['canvasId', 'status'])
@Index(['canvasId', 'blockId'])
@Index(['canvasId', 'targetBlockId'])
export class CanvasSuggestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  canvasId: string;

  @ManyToOne(() => CanvasEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canvasId' })
  canvas: CanvasEntity;

  @Column({ type: 'varchar', length: 128 })
  messageId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  actionId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  blockId?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  targetBlockId?: string | null;

  @Column({ type: 'varchar', length: 32 })
  action: CanvasSuggestionAction;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CanvasSuggestionStatus;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'ai' })
  createdBy: 'ai' | 'agent';

  @Column({ type: 'uuid', nullable: true })
  acceptedBy?: string | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
