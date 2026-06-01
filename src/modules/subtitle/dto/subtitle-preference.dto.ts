import { IsBoolean } from 'class-validator';

export class UpdateSubtitlePreferenceDto {
  @IsBoolean()
  enabled: boolean;
}

export interface SubtitlePreferenceResponse {
  user_id: string;
  enabled: boolean;
  updated_at: Date;
}
