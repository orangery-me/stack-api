import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CanvasEntity } from './canvas.entity';
import { WorkspaceMemberEntity } from '../workspace/workspace-member.entity';

@Entity('canvas_versions')
@Index(['canvasId', 'version'], { unique: true })
export class CanvasVersionEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid' })
  canvasId: string;

  @ManyToOne(() => CanvasEntity, (canvas) => canvas.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canvasId' })
  canvas: CanvasEntity;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null;

  @Column({ type: 'jsonb' })
  content: any;

  @Column({ type: 'int', default: 1 })
  contentSchemaVersion: number;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  snapshotType: string; // manual | auto (future)

  @Column({ type: 'uuid', nullable: true })
  savedById?: string | null;

  @ManyToOne(() => WorkspaceMemberEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'savedById' })
  savedBy?: WorkspaceMemberEntity | null;

  @CreateDateColumn()
  savedAt: Date;
}

