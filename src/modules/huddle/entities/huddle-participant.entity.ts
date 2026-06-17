import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { HuddleCall } from './huddle-call.entity';
import { HuddleParticipantStatus } from './huddle.enums';

@Entity('huddle_participants')
export class HuddleParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  callId: string;

  @ManyToOne(() => HuddleCall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callId' })
  call: HuddleCall;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 100 })
  sessionId: string;

  @Column({ type: 'boolean', default: true })
  micEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  cameraEnabled: boolean;

  @Column({
    type: 'enum',
    enum: HuddleParticipantStatus,
    default: HuddleParticipantStatus.ACTIVE,
  })
  status: HuddleParticipantStatus;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date;
}
