import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingItem {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class UpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingItem)
  settings: UpdateSettingItem[];
}
