import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CanvasEntity } from './canvas.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';

@Entity('canvas_contents')
export class CanvasContentEntity {
  @PrimaryColumn({ type: 'uuid' })
  canvasId: string;

  @OneToOne(() => CanvasEntity, (canvas) => canvas.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canvasId' })
  canvas: CanvasEntity;

  @Column({ type: 'jsonb' })
  content: any;

  @Column({ type: 'int', default: 1 })
  contentSchemaVersion: number;

  @Column({ type: 'int', default: 0 })
  revision: number;

  @Column({ type: 'int', nullable: true })
  version?: number | null;

  @Column({ type: 'boolean', default: true })
  isDirty: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedById?: string | null;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy?: WorkspaceMemberEntity | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

