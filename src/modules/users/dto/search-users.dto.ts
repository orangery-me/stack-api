import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchUsersDto {
  @ApiProperty({
    description: 'Search keyword (email or name)',
    example: 'john@example.com',
  })
  @IsNotEmpty({ message: 'Query must not be empty' })
  @IsString({ message: 'Query must be a string' })
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be greater than 0' })
  @Max(50, { message: 'Limit must not exceed 50' })
  limit?: number = 10;
}
