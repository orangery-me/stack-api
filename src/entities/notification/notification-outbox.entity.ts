import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationRecipientEntity } from './notification-recipient.entity';

@Entity('notification_outbox')
export class NotificationOutboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notificationRecipientId: string;

  @ManyToOne(() => NotificationRecipientEntity, (recipient) => recipient.outboxItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationRecipientId' })
  notificationRecipient: NotificationRecipientEntity;

  @Column({ type: 'varchar', length: 40 })
  channel: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
