import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChannelEntity } from '@app/entities/channel/channel.entity';
import { UserEntity } from '@app/entities/user/user.entity';
import { HuddleCallStatus } from './huddle.enums';

@Entity('huddle_calls')
export class HuddleCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  channelId: string;

  @ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: ChannelEntity;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: UserEntity;

  @Column({ type: 'enum', enum: HuddleCallStatus, default: HuddleCallStatus.ACTIVE })
  status: HuddleCallStatus;

  @Column({ type: 'varchar', length: 100, unique: true })
  livekitRoomName: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;
}
