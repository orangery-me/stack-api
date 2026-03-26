import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { AgentService } from './agent.service';
import { AgentRequestDto } from './dto/agent-request.dto';
import { AgentResponseDto } from './dto/agent-response.dto';

@ApiTags('agent')
@Controller('/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post('ask')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ask the AI agent a question' })
  @ApiBody({ type: AgentRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Agent response successfully',
    type: AgentResponseDto,
  })
  async askAgent(@Body() dto: AgentRequestDto): Promise<ResponseItem<AgentResponseDto>> {
    const result = await this.agentService.askAgent({
      message: dto.message,
      provider: dto.provider,
      model: dto.model,
    });
    return new ResponseItem(result as AgentResponseDto, 'Agent response successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post('ask/stream')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ask the AI agent a question (SSE streaming)' })
  @ApiBody({ type: AgentRequestDto })
  async askAgentStream(@Body() dto: AgentRequestDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const stream$ = this.agentService.askAgentStream({
      message: dto.message,
      provider: dto.provider,
      model: dto.model,
    });

    const subscription = stream$.subscribe({
      next: (item) => {
        if (item.done) {
          res.write(`data: [DONE]\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ chunk: item.chunk })}\n\n`);
        }
      },
      error: (err: any) => {
        const msg = err?.message ?? 'Stream error';
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
