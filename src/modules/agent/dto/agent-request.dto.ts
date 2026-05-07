import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AgentRequestDto {
  @ApiProperty({
    description: 'User message to the agent',
    example: 'Hello, world!',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'AI provider: "openai" or "gemini"',
    example: 'openai',
    enum: ['openai', 'gemini'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['openai', 'gemini'])
  provider?: string;

  @ApiPropertyOptional({
    description: 'Model / version selected by user, e.g. "gpt-4o", "gemini-1.5-pro"',
    example: 'gpt-4o',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
