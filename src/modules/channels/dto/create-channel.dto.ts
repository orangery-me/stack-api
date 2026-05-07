import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChannelSettingsShape } from '../../../policy/channel/channel-permission.config';

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
  settings?: ChannelSettingsShape;

  @ApiProperty({
    required: false,
    description: 'Whether this is the default channel for the workspace',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
