import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { UpdateSettingsDto } from './dto/update-setting.dto';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepository: Repository<SystemSetting>,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.settingRepository.find({ order: { key: 'ASC' } });
  }

  async update(dto: UpdateSettingsDto): Promise<SystemSetting[]> {
    const updated: SystemSetting[] = [];

    for (const item of dto.settings) {
      let setting = await this.settingRepository.findOneBy({ key: item.key });

      if (!setting) {
        setting = this.settingRepository.create({
          key: item.key,
          value: String(item.value),
          type: 'string',
        });
      } else {
        setting.value = String(item.value);
      }

      updated.push(await this.settingRepository.save(setting));
    }

    return updated;
  }

  async getValue(key: string, defaultValue?: string): Promise<string | undefined> {
    const setting = await this.settingRepository.findOneBy({ key });
    return setting?.value ?? defaultValue;
  }
}
