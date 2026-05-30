import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { CallTranscript } from './call-transcript.entity';

@Entity('transcript_segments')
@Index('idx_transcript_segment_transcript_sequence', ['transcriptId', 'sequence'])
@Index('idx_transcript_segment_speaker', ['transcriptId', 'speakerId'])
@Index('idx_transcript_segment_unique_sequence', ['transcriptId', 'sequence'], { unique: true })
export class TranscriptSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  transcriptId: string;

  @ManyToOne(() => CallTranscript, (transcript) => transcript.segments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transcriptId' })
  transcript: CallTranscript;

  @Column({ type: 'varchar', length: 100 })
  speakerName: string;

  @Column({ type: 'uuid', nullable: true })
  speakerId?: string;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'speakerId' })
  speaker?: UserEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceParticipantIdentity?: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  isFinal: boolean;

  @Column({ type: 'int' })
  startMs: number;

  @Column({ type: 'int', nullable: true })
  endMs?: number;

  @Column({ type: 'int' })
  sequence: number;

  @CreateDateColumn()
  createdAt: Date;
}
