import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HuddleCall } from '../../huddle/entities/huddle-call.entity';
import { HuddleParticipant } from '../../huddle/entities/huddle-participant.entity';
import { HuddleCallStatus } from '../../huddle/entities/huddle.enums';
import { ChannelEntity } from '@app/entities/channel/channel.entity';

export interface ParticipantStat {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: Date;
  leftAt?: Date;
  /** Duration in seconds this participant was in the call */
  durationSeconds: number;
  /** Percentage of the call's total duration they were present */
  participationPercent: number;
  micEnabled: boolean;
  cameraEnabled: boolean;
}

export interface HuddleCallSummary {
  id: string;
  channelId: string;
  channelName: string;
  status: string;
  startedAt: Date;
  endedAt?: Date;
  /** Total call duration in seconds */
  durationSeconds: number;
  participantCount: number;
  createdBy: { id: string; name: string; email: string };
}

export interface HuddleCallDetail extends HuddleCallSummary {
  participants: ParticipantStat[];
  avgParticipationPercent: number;
}

@Injectable()
export class AdminHuddleService {
  constructor(
    @InjectRepository(HuddleCall)
    private readonly callRepo: Repository<HuddleCall>,
    @InjectRepository(HuddleParticipant)
    private readonly participantRepo: Repository<HuddleParticipant>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepo: Repository<ChannelEntity>
  ) {}

  async listWorkspaceHistory(
    workspaceId: string,
    opts: { page: number; take: number; channelId?: string }
  ): Promise<{ data: HuddleCallSummary[]; meta: { total: number; page: number; take: number; totalPages: number } }> {
    const { page, take, channelId } = opts;

    // Resolve channels belonging to this workspace
    const channelQb = this.channelRepo
      .createQueryBuilder('ch')
      .select('ch.id')
      .where('ch.workspaceId = :workspaceId', { workspaceId });

    if (channelId) {
      channelQb.andWhere('ch.id = :channelId', { channelId });
    }

    const channelRows = await channelQb.getRawMany();
    const channelIds: string[] = channelRows.map((r: any) => r.ch_id ?? r.id);

    if (channelIds.length === 0) {
      return { data: [], meta: { total: 0, page, take, totalPages: 0 } };
    }

    const qb = this.callRepo
      .createQueryBuilder('call')
      .leftJoinAndSelect('call.createdBy', 'creator')
      .leftJoinAndSelect('call.channel', 'channel')
      .where('call.channelId IN (:...channelIds)', { channelIds })
      .andWhere('call.status = :status', { status: HuddleCallStatus.ENDED })
      .orderBy('call.startedAt', 'DESC')
      .skip((page - 1) * take)
      .take(take);

    const [calls, total] = await qb.getManyAndCount();

    // Batch load participant counts
    const callIds = calls.map((c) => c.id);
    const participantCounts: Record<string, number> = {};
    if (callIds.length > 0) {
      const counts = await this.participantRepo
        .createQueryBuilder('p')
        .select('p.callId', 'callId')
        .addSelect('COUNT(DISTINCT p.userId)', 'cnt')
        .where('p.callId IN (:...callIds)', { callIds })
        .groupBy('p.callId')
        .getRawMany();
      counts.forEach((row: any) => {
        participantCounts[row.callId] = parseInt(row.cnt, 10);
      });
    }

    const data: HuddleCallSummary[] = calls.map((call) => {
      const endedAt = call.endedAt ?? undefined;
      const durationSeconds = endedAt ? Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000) : 0;

      return {
        id: call.id,
        channelId: call.channelId,
        channelName: (call.channel as any)?.name ?? 'Unknown Channel',
        status: call.status,
        startedAt: call.startedAt,
        endedAt,
        durationSeconds,
        participantCount: participantCounts[call.id] ?? 0,
        createdBy: {
          id: call.createdById,
          name: (call.createdBy as any)?.name ?? (call.createdBy as any)?.email ?? 'Unknown',
          email: (call.createdBy as any)?.email ?? '',
        },
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getCallDetail(workspaceId: string, callId: string): Promise<HuddleCallDetail> {
    // Verify the call belongs to this workspace via its channel
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['createdBy', 'channel'],
    });
    if (!call) {
      throw new NotFoundException('Huddle call not found');
    }

    const channel = await this.channelRepo.findOne({ where: { id: call.channelId } });
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new NotFoundException('Huddle call not found in this workspace');
    }

    const endedAt = call.endedAt ?? new Date();
    const callDurationMs = endedAt.getTime() - call.startedAt.getTime();
    const callDurationSeconds = Math.round(callDurationMs / 1000);

    // Load all participants with user info
    const participants = await this.participantRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.callId = :callId', { callId })
      .orderBy('p.joinedAt', 'ASC')
      .getMany();

    // Aggregate per user (user may have joined multiple times / device transfer)
    const userMap = new Map<
      string,
      { durationMs: number; first: HuddleParticipant; name: string; email: string; avatar?: string }
    >();

    for (const p of participants) {
      const leftMs = p.leftAt ? p.leftAt.getTime() : endedAt.getTime();
      const pDuration = Math.max(0, leftMs - p.joinedAt.getTime());

      if (userMap.has(p.userId)) {
        userMap.get(p.userId)!.durationMs += pDuration;
      } else {
        userMap.set(p.userId, {
          durationMs: pDuration,
          first: p,
          name: (p.user as any)?.name ?? (p.user as any)?.email ?? 'Unknown',
          email: (p.user as any)?.email ?? '',
          avatar: (p.user as any)?.avatar ?? undefined,
        });
      }
    }

    const participantStats: ParticipantStat[] = Array.from(userMap.entries()).map(([userId, info]) => {
      const durationSeconds = Math.round(info.durationMs / 1000);
      const participationPercent =
        callDurationMs > 0 ? Math.min(100, Math.round((info.durationMs / callDurationMs) * 100)) : 0;
      return {
        userId,
        name: info.name,
        email: info.email,
        avatar: info.avatar,
        joinedAt: info.first.joinedAt,
        leftAt: info.first.leftAt ?? undefined,
        durationSeconds,
        participationPercent,
        micEnabled: info.first.micEnabled,
        cameraEnabled: info.first.cameraEnabled,
      };
    });

    const avgParticipationPercent =
      participantStats.length > 0
        ? Math.round(participantStats.reduce((s, p) => s + p.participationPercent, 0) / participantStats.length)
        : 0;

    return {
      id: call.id,
      channelId: call.channelId,
      channelName: (channel as any)?.name ?? 'Unknown Channel',
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt ?? undefined,
      durationSeconds: callDurationSeconds,
      participantCount: userMap.size,
      createdBy: {
        id: call.createdById,
        name: (call.createdBy as any)?.name ?? (call.createdBy as any)?.email ?? 'Unknown',
        email: (call.createdBy as any)?.email ?? '',
      },
      participants: participantStats,
      avgParticipationPercent,
    };
  }
}
