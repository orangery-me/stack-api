import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CanvasEntity } from '@app/entities/canvas/canvas.entity';
import { HuddleCall } from '../../huddle/entities/huddle-call.entity';
import { TranscriptSegment } from './transcript-segment.entity';

export enum CallTranscriptStatus {
  RECORDING = 'recording',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('call_transcripts')
export class CallTranscript {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  callId: string;

  @ManyToOne(() => HuddleCall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callId' })
  call: HuddleCall;

  @Column({ type: 'enum', enum: CallTranscriptStatus, default: CallTranscriptStatus.RECORDING })
  status: CallTranscriptStatus;

  @Column({ type: 'varchar', length: 10, default: 'vi' })
  language: string;

  @Column({ type: 'int', default: 0 })
  segmentCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewCanvasId?: string | null;

  @ManyToOne(() => CanvasEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewCanvasId' })
  reviewCanvas?: CanvasEntity | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewCanvasCreatedAt?: Date | null;

  @OneToMany(() => TranscriptSegment, (segment) => segment.transcript)
  segments: TranscriptSegment[];
}
