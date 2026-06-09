import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { UserRoleEnum, UserStatusEnum } from '@Constant/enums';
import { SystemOverviewDto } from './dto/system-overview.dto';
import { UserGrowthDto } from './dto/user-growth.dto';
import { UserGrowthQueryDto } from './dto/stats-query.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getOverview(): Promise<SystemOverviewDto> {
    const totalUsers = await this.userRepository.count();
    const totalAdmins = await this.userRepository.count({ where: { role: UserRoleEnum.ADMIN } });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await this.userRepository.count({
      where: { updatedAt: Between(twentyFourHoursAgo, new Date()) },
    });

    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usersLastMonth = await this.userRepository.count({
      where: { createdAt: Between(lastMonth, twentyFourHoursAgo) },
    });

    const usersThisMonth = await this.userRepository.count({
      where: { createdAt: Between(twentyFourHoursAgo, new Date()) },
    });

    const totalUsersChange = usersLastMonth > 0
      ? parseFloat((((totalUsers - usersLastMonth) / usersLastMonth) * 100).toFixed(1))
      : 0;

    const activeUsersChange = totalUsers > 0
      ? parseFloat(((activeUsers / totalUsers) * 100).toFixed(1))
      : 0;

    return {
      totalUsers: totalUsers - totalAdmins,
      totalUsersChange,
      activeUsers,
      activeUsersChange,
      activeUsersPeriod: '24h',
      systemUptime: 99.98,
      systemUptimeChange: 0.02,
      storageUsed: 340,
      storageTotal: 500,
      storageUnit: 'GB',
      incidents: 3,
      incidentsResolved: 2,
      cpuUsage: 24,
      apiLatency: 18,
      apiLatencyUnit: 'ms',
    };
  }

  async getUserGrowth(query: UserGrowthQueryDto): Promise<UserGrowthDto> {
    const { period = 'week' } = query;
    const now = new Date();
    let from: Date;
    let truncUnit: string;

    switch (period) {
      case 'day':
        from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        truncUnit = 'day';
        break;
      case 'month':
        from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        truncUnit = 'month';
        break;
      case 'week':
      default:
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        truncUnit = 'week';
        break;
    }

    const raw = await this.userRepository
      .createQueryBuilder('user')
      .select(`DATE_TRUNC('${truncUnit}', user.createdAt)`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt BETWEEN :from AND :to', { from, to: now })
      .andWhere('user.role != :adminRole', { adminRole: UserRoleEnum.ADMIN })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const labels: string[] = [];
    const values: number[] = [];
    let totalNewUsers = 0;

    for (const row of raw) {
      const date = new Date(row.date);
      const label =
        period === 'week'
          ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]
          : period === 'month'
            ? `T${date.getMonth() + 1}`
            : date.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const count = parseInt(row.count, 10);
      labels.push(label);
      values.push(count);
      totalNewUsers += count;
    }

    return {
      period,
      labels,
      values,
      totalNewUsers,
      average: values.length > 0 ? Math.round(totalNewUsers / values.length) : 0,
      unit: 'users',
    };
  }
}
