import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { SubtitleService } from './subtitle.service';
import { TranscriptSegmentInputDto } from './dto/transcript-segment.dto';
import { UpdateSubtitlePreferenceDto } from './dto/subtitle-preference.dto';

@ApiTags('Subtitle')
@Controller('v1/subtitle')
export class SubtitleController {
  constructor(private readonly subtitleService: SubtitleService) {}

  @Post('transcript')
  @UseGuards(InternalSecretGuard)
  @ApiOperation({ summary: 'Internal transcript relay from whisper-service' })
  submitTranscript(@Body() dto: TranscriptSegmentInputDto) {
    return this.subtitleService.processTranscript(dto);
  }

  @Post('call/:callId/start')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  startTranscript(@Param('callId') callId: string, @Req() req: any, @Body() body: { language?: string }) {
    return this.subtitleService.startTranscript(callId, req.user?.userId, body?.language || 'vi');
  }

  @Post('call/:callId/stop')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  stopTranscript(@Param('callId') callId: string, @Req() req: any) {
    return this.subtitleService.stopTranscript(callId, req.user?.userId);
  }

  @Get('call/:callId/status')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get transcript recording status for a call' })
  getTranscriptStatus(@Param('callId') callId: string, @Req() req: any) {
    return this.subtitleService.getTranscriptStatus(callId, req.user?.userId);
  }

  @Get('call/:callId/transcript')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  getTranscript(
    @Param('callId') callId: string,
    @Req() req: any,
    @Query('cursor', new DefaultValuePipe(0), ParseIntPipe) cursor: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.subtitleService.getTranscript(callId, req.user?.userId, cursor, limit);
  }

  @Post('call/:callId/review-canvas')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create or return the shared transcript review canvas for a call' })
  createReviewCanvas(@Param('callId') callId: string, @Req() req: any) {
    return this.subtitleService.createReviewCanvas(callId, req.user?.userId);
  }

  @Get('preference')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  getPreference(@Req() req: any) {
    return this.subtitleService.getPreference(req.user?.userId);
  }

  @Patch('preference')
  @UseGuards(JwtAccessTokenGuard)
  @ApiBearerAuth('JWT-auth')
  updatePreference(@Req() req: any, @Body() dto: UpdateSubtitlePreferenceDto) {
    return this.subtitleService.updatePreference(req.user?.userId, dto.enabled);
  }
}
