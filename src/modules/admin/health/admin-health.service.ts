import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../audit-log/entities/audit-log.entity';

@Injectable()
export class AdminHealthService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async getHealth() {
    let dbStatus = 'healthy';
    try {
      await this.auditLogRepository.query('SELECT 1');
    } catch {
      dbStatus = 'unhealthy';
    }
    return {
      api: { status: 'healthy', uptime: Math.floor(process.uptime()) },
      database: { status: dbStatus },
      timestamp: new Date().toISOString(),
    };
  }

  async getErrors(period: string = '24h') {
    const interval = period === '7d' ? '7 days' : '24 hours';
    const data = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where(`log.createdAt > NOW() - INTERVAL '${interval}'`)
      .andWhere("log.status = 'failure'")
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .getRawMany();
    return {
      period,
      totalErrors: data.reduce((s, r) => s + parseInt(r.count, 10), 0),
      errors: data.map((r) => ({ action: r.action, count: parseInt(r.count, 10) })),
    };
  }

  async getPerformance(period: string = '7d') {
    const interval = period === '24h' ? '24 hours' : '7 days';
    const data = await this.auditLogRepository
      .createQueryBuilder('log')
      .select(`DATE_TRUNC('hour', log.createdAt)`, 'hour')
      .addSelect("AVG((log.metadata->>'duration')::numeric)", 'avgDuration')
      .addSelect('COUNT(*)', 'count')
      .where(`log.createdAt > NOW() - INTERVAL '${interval}'`)
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany();
    return {
      period,
      data: data.map((r) => ({
        time: r.hour,
        avgDuration: r.avgDuration ? Math.round(parseFloat(r.avgDuration)) : 0,
        requestCount: parseInt(r.count, 10),
      })),
    };
  }
}
