import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(query: ListAuditLogsDto) {
    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('log.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('log.createdAt <= :to', { to: new Date(query.to) });
    }
    if (query.search) {
      qb.andWhere(
        '(log.userName ILIKE :search OR log.action ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const total = await qb.getCount();

    qb.orderBy(`log.${query.sortBy || 'createdAt'}`, query.sortOrder || 'DESC');
    qb.skip(((query.page || 1) - 1) * (query.size || 20));
    qb.take(query.size || 20);

    const data = await qb.getMany();

    return {
      data,
      meta: {
        page: query.page || 1,
        take: query.size || 20,
        total,
        pageCount: Math.ceil(total / (query.size || 20)),
      },
    };
  }

  async create(dto: Partial<AuditLog>): Promise<AuditLog> {
    const entry = this.auditLogRepository.create(dto);
    return this.auditLogRepository.save(entry);
  }
}
