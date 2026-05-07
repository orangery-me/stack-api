import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AddChannelMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsIn(['manager', 'member'])
  memberRole?: 'manager' | 'member';
}
