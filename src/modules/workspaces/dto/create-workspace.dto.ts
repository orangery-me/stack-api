import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspacePlanEnum } from '@Constant/enums';
import { InviteItemDto } from './invite-item.dto';

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'Workspace name',
    example: 'My Workspace',
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Workspace name must not be empty' })
  @IsString({ message: 'Workspace name must be a string' })
  @Length(2, 255, { message: 'Workspace name must be between 2 and 255 characters' })
  name: string;

  @ApiProperty({
    description: 'Your display name in this workspace',
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Display name must not be empty' })
  @IsString({ message: 'Display name must be a string' })
  @Length(2, 50, { message: 'Display name must be between 2 and 50 characters' })
  displayName: string;

  @ApiPropertyOptional({
    description: 'List of users to invite to the workspace',
    type: [InviteItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'Invites must be an array' })
  @ValidateNested({ each: true })
  @Type(() => InviteItemDto)
  invites?: InviteItemDto[];

  @ApiPropertyOptional({
    description: 'Workspace plan',
    enum: WorkspacePlanEnum,
    example: WorkspacePlanEnum.FREE,
    default: WorkspacePlanEnum.FREE,
  })
  @IsOptional()
  plan?: WorkspacePlanEnum;
}
