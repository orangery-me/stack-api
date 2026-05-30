import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class TranscriptSegmentInputDto {
  @IsUUID()
  call_id: string;

  @IsUUID()
  channel_id: string;

  @IsOptional()
  @IsUUID()
  segment_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  speaker_name: string;

  @IsOptional()
  @IsUUID()
  speaker_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_participant_identity?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @IsBoolean()
  is_final: boolean;

  @IsInt()
  @Min(0)
  start_ms: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  end_ms?: number;

  @IsInt()
  @Min(0)
  sequence: number;
}

export interface SubtitleTranscriptEvent {
  call_id: string;
  channel_id: string;
  segment_id: string;
  speaker_name: string;
  speaker_id: string | null;
  text: string;
  is_final: boolean;
  start_ms: number;
  end_ms: number | null;
  sequence: number;
  timestamp: string;
}
