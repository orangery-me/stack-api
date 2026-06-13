import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New Workspace Role ID',
    example: 'd3b07384-d113-4956-a5e2-7634f195d523',
  })
  @IsNotEmpty({ message: 'Role ID must not be empty' })
  @IsUUID('all', { message: 'Role ID must be a valid UUID' })
  roleId: string;
}
