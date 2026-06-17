import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CanvasEntity } from '@app/entities/canvas/canvas.entity';
import { ChannelEntity } from '@app/entities/channel/channel.entity';

@Injectable()
export class AdminContentService {
  constructor(
    @InjectRepository(CanvasEntity)
    private readonly canvasRepository: Repository<CanvasEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>
  ) {}

  async getCanvases(page: number = 1, size: number = 20) {
    const [data, total] = await this.canvasRepository.findAndCount({
      relations: ['workspace'],
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { data, meta: { page, take: size, total, pageCount: Math.ceil(total / size) } };
  }

  async getCanvasStats() {
    return { total: await this.canvasRepository.count() };
  }

  async getChannels(page: number = 1, size: number = 20) {
    const [data, total] = await this.channelRepository.findAndCount({
      relations: ['workspace'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { data, meta: { page, take: size, total, pageCount: Math.ceil(total / size) } };
  }
}
