import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  enableEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  enableWebsocket?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedTypes?: string[];
}
