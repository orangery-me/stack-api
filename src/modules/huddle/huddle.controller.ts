import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { HuddleService } from './huddle.service';
import {
  CreateHuddleDto,
  JoinHuddleDto,
  UpdateHuddleStateDto,
  TransferDeviceDto,
  HuddleJoinResponse,
  HuddleStatusResponse,
} from './dto/huddle.dto';

@ApiTags('Huddle')
@Controller('v1/channels/:channelId/huddle')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class HuddleController {
  constructor(private readonly huddleService: HuddleService) {}

  @Get()
  @ApiOperation({ summary: 'Get huddle status for a channel' })
  getStatus(@Param('channelId') channelId: string): Promise<HuddleStatusResponse> {
    return this.huddleService.getStatus(channelId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new huddle call' })
  createHuddle(
    @Param('channelId') channelId: string,
    @Req() req: any,
  ): Promise<HuddleJoinResponse> {
    const userId = req.user?.userId;
    const userName = req.user?.email || 'Unknown';
    return this.huddleService.createHuddle(channelId, userId, userName);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join an active huddle call' })
  joinHuddle(
    @Param('channelId') channelId: string,
    @Req() req: any,
    @Body() dto: JoinHuddleDto,
  ): Promise<HuddleJoinResponse> {
    const userId = req.user?.userId;
    const userName = req.user?.email || 'Unknown';
    return this.huddleService.joinHuddle(channelId, userId, userName, dto.sessionId);
  }

  @Post('leave')
  @ApiOperation({ summary: 'Leave the active huddle call' })
  leaveHuddle(
    @Param('channelId') channelId: string,
    @Req() req: any,
  ): Promise<{ left: boolean; callEnded: boolean }> {
    const userId = req.user?.userId;
    return this.huddleService.leaveHuddle(channelId, userId);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Confirm or decline device transfer' })
  transferDevice(
    @Param('channelId') channelId: string,
    @Req() req: any,
    @Body() dto: TransferDeviceDto,
  ): Promise<HuddleJoinResponse | { transferred: boolean; message: string }> {
    const userId = req.user?.userId;
    const userName = req.user?.email || 'Unknown';
    return this.huddleService.transferDevice(channelId, userId, userName, dto);
  }

  @Post('token')
  @ApiOperation({ summary: 'Refresh LiveKit token' })
  refreshToken(
    @Param('channelId') channelId: string,
    @Req() req: any,
  ): Promise<{ livekitToken: string; expiresIn: number }> {
    const userId = req.user?.userId;
    const userName = req.user?.email || 'Unknown';
    return this.huddleService.refreshToken(channelId, userId, userName);
  }

  @Patch('state')
  @ApiOperation({ summary: 'Update mic/camera state' })
  updateState(
    @Param('channelId') channelId: string,
    @Req() req: any,
    @Body() dto: UpdateHuddleStateDto,
  ): Promise<{ updated: boolean; micEnabled: boolean; cameraEnabled: boolean }> {
    const userId = req.user?.userId;
    return this.huddleService.updateState(channelId, userId, dto.micEnabled, dto.cameraEnabled);
  }
}
