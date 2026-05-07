import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateTaskListDto {
  @ApiProperty({ required: false, description: 'Task list name', default: 'Untitled list' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
