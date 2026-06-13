import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('system_latencies')
export class SystemLatencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'integer' })
  duration: number; // in milliseconds

  @Column({ type: 'integer' })
  statusCode: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
