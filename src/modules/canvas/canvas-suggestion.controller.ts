import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ResponseItem } from '@app/common/dtos';
import { CanvasSuggestionStatus } from '@app/entities/canvas/canvas-suggestion.entity';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { CanvasSuggestionService } from './canvas-suggestion.service';
import { CanvasSuggestionDto, CanvasSuggestionListDto } from './dto/canvas-suggestion.dto';

@ApiTags('canvas-suggestions')
@Controller('/canvas/:canvasId/suggestions')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class CanvasSuggestionController {
  constructor(private readonly canvasSuggestionService: CanvasSuggestionService) {}

  @Get()
  @ApiOperation({ summary: 'List canvas suggestions' })
  @ApiParam({ name: 'canvasId' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: CanvasSuggestionListDto })
  async list(
    @Req() req: Request,
    @Param('canvasId') canvasId: string,
    @Query('status') status?: CanvasSuggestionStatus
  ): Promise<ResponseItem<CanvasSuggestionListDto>> {
    const userId = String((req.user as any).userId);
    const suggestions = await this.canvasSuggestionService.listForCanvas(canvasId, userId, status);
    return new ResponseItem({ suggestions }, 'Canvas suggestions fetched successfully');
  }

  @Post(':suggestionId/accept')
  @ApiOperation({ summary: 'Accept one canvas suggestion' })
  @ApiParam({ name: 'canvasId' })
  @ApiParam({ name: 'suggestionId' })
  async accept(
    @Req() req: Request,
    @Param('canvasId') canvasId: string,
    @Param('suggestionId') suggestionId: string
  ): Promise<ResponseItem<CanvasSuggestionDto>> {
    const userId = String((req.user as any).userId);
    const suggestion = await this.canvasSuggestionService.accept(canvasId, suggestionId, userId);
    return new ResponseItem(suggestion, 'Canvas suggestion accepted successfully');
  }

  @Post(':suggestionId/reject')
  @ApiOperation({ summary: 'Reject one canvas suggestion' })
  @ApiParam({ name: 'canvasId' })
  @ApiParam({ name: 'suggestionId' })
  async reject(
    @Req() req: Request,
    @Param('canvasId') canvasId: string,
    @Param('suggestionId') suggestionId: string
  ): Promise<ResponseItem<CanvasSuggestionDto>> {
    const userId = String((req.user as any).userId);
    const suggestion = await this.canvasSuggestionService.reject(canvasId, suggestionId, userId);
    return new ResponseItem(suggestion, 'Canvas suggestion rejected successfully');
  }

  @Post('accept-all')
  @ApiOperation({ summary: 'Accept all pending canvas suggestions' })
  @ApiParam({ name: 'canvasId' })
  async acceptAll(@Req() req: Request, @Param('canvasId') canvasId: string): Promise<ResponseItem<CanvasSuggestionListDto>> {
    const userId = String((req.user as any).userId);
    const suggestions = await this.canvasSuggestionService.acceptAll(canvasId, userId);
    return new ResponseItem({ suggestions }, 'Canvas suggestions accepted successfully');
  }

  @Post('reject-all')
  @ApiOperation({ summary: 'Reject all pending canvas suggestions' })
  @ApiParam({ name: 'canvasId' })
  async rejectAll(@Req() req: Request, @Param('canvasId') canvasId: string): Promise<ResponseItem<CanvasSuggestionListDto>> {
    const userId = String((req.user as any).userId);
    const suggestions = await this.canvasSuggestionService.rejectAll(canvasId, userId);
    return new ResponseItem({ suggestions }, 'Canvas suggestions rejected successfully');
  }
}
