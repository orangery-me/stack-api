import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateTaskCommentDto {
  @ApiProperty({ required: false, description: 'Comment content', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiProperty({ required: false, description: 'Mentioned workspace member IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[];
}
