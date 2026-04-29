import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const CHANNEL_PERMISSION_POLICY_VALUES = ['manager_only', 'all_members'] as const;
export type ChannelPermissionPolicyValue = (typeof CHANNEL_PERMISSION_POLICY_VALUES)[number];

export class UpdateChannelPermissionsDto {
  @ApiPropertyOptional({ enum: CHANNEL_PERMISSION_POLICY_VALUES })
  @IsOptional()
  @IsIn(CHANNEL_PERMISSION_POLICY_VALUES)
  invitePolicy?: ChannelPermissionPolicyValue;

  @ApiPropertyOptional({ enum: CHANNEL_PERMISSION_POLICY_VALUES })
  @IsOptional()
  @IsIn(CHANNEL_PERMISSION_POLICY_VALUES)
  postPolicy?: ChannelPermissionPolicyValue;

  @ApiPropertyOptional({ enum: CHANNEL_PERMISSION_POLICY_VALUES })
  @IsOptional()
  @IsIn(CHANNEL_PERMISSION_POLICY_VALUES)
  pinMessagePolicy?: ChannelPermissionPolicyValue;

  @ApiPropertyOptional({ enum: CHANNEL_PERMISSION_POLICY_VALUES })
  @IsOptional()
  @IsIn(CHANNEL_PERMISSION_POLICY_VALUES)
  threadPolicy?: ChannelPermissionPolicyValue;
}
