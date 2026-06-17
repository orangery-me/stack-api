import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminCommunicationsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async getHuddles(from?: string, to?: string) {
    const result = await this.dataSource.query(
      `SELECT hc.*, c.name as channel_name
       FROM huddle_calls hc
       LEFT JOIN channels c ON c.id = hc."channelId"
       ${from && to ? 'WHERE hc."createdAt" BETWEEN $1 AND $2' : ''}
       ORDER BY hc."createdAt" DESC
       LIMIT 50`,
      from && to ? [from, to] : []
    );
    return result;
  }

  async getHuddleStats() {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as total_calls,
              AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - created_at))) as avg_duration_seconds
       FROM huddle_calls
       WHERE created_at > NOW() - INTERVAL '30 days'`
    );
    return {
      totalCalls: parseInt(result[0]?.total_calls || '0', 10),
      avgDurationSeconds: Math.round(parseFloat(result[0]?.avg_duration_seconds || '0')),
    };
  }
}
