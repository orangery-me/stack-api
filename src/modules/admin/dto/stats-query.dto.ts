import { IsOptional, IsString, IsIn } from 'class-validator';

export class UserGrowthQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month' = 'week';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
