import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationOutboxEntity } from './notification-outbox.entity';

@Entity('notification_recipients')
export class NotificationRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notificationEventId: string;

  @ManyToOne(() => NotificationEventEntity, (event) => event.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationEventId' })
  notificationEvent: NotificationEventEntity;

  @Column({ type: 'uuid' })
  recipientUserId: string;

  @Column({ type: 'jsonb', default: [] })
  deliveryChannels: string[];

  @Column({ type: 'varchar', length: 40, default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  seenAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastDeliveredAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => NotificationOutboxEntity, (outbox) => outbox.notificationRecipient)
  outboxItems: NotificationOutboxEntity[];
}
