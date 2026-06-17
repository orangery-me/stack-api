import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@app/entities/user/user.entity';
import { WorkspaceEntity } from '@app/entities/workspace/workspace.entity';
import { WorkspaceMemberEntity } from '@app/entities/workspace/workspace-member.entity';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>
  ) {}

  async getActiveUsers(days: number = 30) {
    const data = await this.userRepository
      .createQueryBuilder('user')
      .select(`DATE_TRUNC('day', user.updatedAt)`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where(`user.updatedAt > NOW() - INTERVAL '${days} days'`)
      .andWhere("user.role != 'ADMIN'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();
    return {
      period: `${days}d`,
      labels: data.map((r) => new Date(r.date).toLocaleDateString('vi-VN')),
      values: data.map((r) => parseInt(r.count, 10)),
    };
  }

  async getUserActivity(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new Error('User not found');

    const workspaceCount = await this.workspaceMemberRepository.count({ where: { userId } });
    return { user: { id: user.id, email: user.email, name: user.name, status: user.status }, workspaceCount };
  }

  async getWorkspaceActivity() {
    const workspaces = await this.workspaceRepository.find({ relations: ['owner'] });
    const result = [];
    for (const ws of workspaces) {
      const memberCount = await this.workspaceMemberRepository.count({ where: { workspaceId: ws.id } });
      result.push({ id: ws.id, name: ws.name, ownerName: ws.owner?.name, memberCount });
    }
    return result.sort((a, b) => b.memberCount - a.memberCount);
  }
}
