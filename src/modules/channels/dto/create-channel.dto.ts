import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ChannelType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  DM = 'dm',
  GROUP_DM = 'group_dm',
}

export class CreateChannelDto {
  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  type: ChannelType;

  @ApiProperty({ required: false, description: 'Channel name (can be null for DM)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, type: 'object' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ required: false, type: 'object' })
  @IsOptional()
  settings?: Record<string, any>;
}
