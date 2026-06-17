import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { AdminHuddleService } from './admin-huddle.service';

@ApiTags('Admin – Huddle History')
@Controller('v1/admin/workspaces/:workspaceId/huddle-history')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class AdminHuddleController {
  constructor(private readonly adminHuddleService: AdminHuddleService) {}

  @Get()
  @ApiOperation({ summary: 'List all ended huddle calls in a workspace with participant stats' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'channelId', required: false, type: String })
  listHistory(
    @Param('workspaceId') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
    @Query('channelId') channelId?: string
  ) {
    return this.adminHuddleService.listWorkspaceHistory(workspaceId, { page, take, channelId });
  }

  @Get(':callId')
  @ApiOperation({ summary: 'Get detailed stats for a single huddle call' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'callId', description: 'Huddle Call ID' })
  getCallDetail(@Param('workspaceId') workspaceId: string, @Param('callId') callId: string) {
    return this.adminHuddleService.getCallDetail(workspaceId, callId);
  }
}
