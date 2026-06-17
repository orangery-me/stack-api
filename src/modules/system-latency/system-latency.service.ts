import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLatencyEntity } from '@app/entities';

@Injectable()
export class SystemLatencyService {
  constructor(
    @InjectRepository(SystemLatencyEntity)
    private readonly repository: Repository<SystemLatencyEntity>
  ) {}

  async record(
    path: string,
    method: string,
    duration: number,
    statusCode: number,
    ip?: string,
    userId?: string
  ): Promise<SystemLatencyEntity> {
    const latency = this.repository.create({
      path,
      method,
      duration,
      statusCode,
      ip,
      userId,
    });
    return this.repository.save(latency);
  }

  async getAverageLatency(since: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('latency')
      .select('AVG(latency.duration)', 'avg')
      .where('latency.createdAt >= :since', { since })
      .getRawOne();

    const avg = parseFloat(result?.avg);
    return isNaN(avg) ? 0 : Math.round(avg);
  }

  async getIncidentStats(since: Date) {
    // Count requests with HTTP 5xx as incidents
    const totalIncidentsRes = await this.repository
      .createQueryBuilder('latency')
      .select('COUNT(*)', 'count')
      .where('latency.createdAt >= :since', { since })
      .andWhere('latency.statusCode >= 500')
      .getRawOne();

    const incidents = parseInt(totalIncidentsRes?.count || '0', 10);

    // Count incidents that happened more than 1 hour ago as resolved
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const resolvedRes = await this.repository
      .createQueryBuilder('latency')
      .select('COUNT(*)', 'count')
      .where('latency.createdAt >= :since', { since })
      .andWhere('latency.createdAt < :oneHourAgo', { oneHourAgo })
      .andWhere('latency.statusCode >= 500')
      .getRawOne();

    const incidentsResolved = parseInt(resolvedRes?.count || '0', 10);

    // Calculate system availability: successful requests (status < 500) / total requests
    const totalRequestsRes = await this.repository
      .createQueryBuilder('latency')
      .select('COUNT(*)', 'count')
      .where('latency.createdAt >= :since', { since })
      .getRawOne();

    const totalRequests = parseInt(totalRequestsRes?.count || '0', 10);

    let availability = 100.0;
    if (totalRequests > 0) {
      const failedRequestsRes = await this.repository
        .createQueryBuilder('latency')
        .select('COUNT(*)', 'count')
        .where('latency.createdAt >= :since', { since })
        .andWhere('latency.statusCode >= 500')
        .getRawOne();
      const failedRequests = parseInt(failedRequestsRes?.count || '0', 10);
      availability = parseFloat((((totalRequests - failedRequests) / totalRequests) * 100).toFixed(2));
    }

    return {
      incidents,
      incidentsResolved,
      availability,
    };
  }
}
