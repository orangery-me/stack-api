import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationRecipientEntity } from './notification-recipient.entity';

@Entity('notification_events')
export class NotificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  type: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  entityType?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  entityId?: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 180, nullable: true })
  dedupeKey?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => NotificationRecipientEntity, (recipient) => recipient.notificationEvent)
  recipients: NotificationRecipientEntity[];
}
