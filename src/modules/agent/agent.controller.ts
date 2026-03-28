import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { AgentService } from './agent.service';
import { AgentRequestDto } from './dto/agent-request.dto';
import { AgentResponseDto } from './dto/agent-response.dto';

@ApiTags('agent')
@Controller('/agent')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // ---- Legacy single-shot ----

  @Post('ask')
  @ApiOperation({ summary: 'Ask the AI agent a question' })
  @ApiBody({ type: AgentRequestDto })
  @ApiResponse({ status: 200, description: 'Agent response successfully', type: AgentResponseDto })
  async askAgent(@Body() dto: AgentRequestDto): Promise<ResponseItem<AgentResponseDto>> {
    const result = await this.agentService.askAgent({
      message: dto.message,
      provider: dto.provider,
      model: dto.model,
    });
    return new ResponseItem(result as AgentResponseDto, 'Agent response successfully');
  }

  @Post('ask/stream')
  @ApiOperation({ summary: 'Ask the AI agent a question (SSE streaming)' })
  @ApiBody({ type: AgentRequestDto })
  async askAgentStream(@Body() dto: AgentRequestDto, @Res() res: Response): Promise<void> {
    this.setSSEHeaders(res);

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
        res.write(`data: ${JSON.stringify({ error: err?.message ?? 'Stream error' })}\n\n`);
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => subscription.unsubscribe());
  }

  // ---- Sessions ----

  @Patch('sessions/:sessionId')
  @ApiOperation({ summary: 'Update session metadata (e.g. title)' })
  @ApiParam({ name: 'sessionId' })
  @ApiBody({ schema: { properties: { title: { type: 'string' } } } })
  async updateSession(@Req() req: Request, @Param('sessionId') sessionId: string, @Body() body: { title: string }) {
    const userId = String((req.user as any).userId);
    const session = await this.agentService.updateSession(userId, sessionId, body.title);
    return new ResponseItem(session, 'Session updated');
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Get or create the active AI chat session for the current user' })
  async getOrCreateActiveSession(@Req() req: Request) {
    const userId = String((req.user as any).userId);
    const session = await this.agentService.getOrCreateActiveSession(userId);
    return new ResponseItem(session, 'Active session retrieved');
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all AI chat sessions for the current user' })
  async listSessions(@Req() req: Request) {
    const userId = String((req.user as any).userId);
    const sessions = await this.agentService.listSessions(userId);
    return new ResponseItem(sessions, 'Sessions retrieved');
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new AI chat session (archives current active)' })
  @ApiBody({ schema: { properties: { title: { type: 'string' } } } })
  async createSession(@Req() req: Request, @Body() body: { title?: string }) {
    const userId = String((req.user as any).userId);
    const session = await this.agentService.createSession(userId, body.title);
    return new ResponseItem(session, 'Session created');
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get messages for a session' })
  @ApiParam({ name: 'sessionId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getSessionMessages(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Query('page') page = 1,
    @Query('size') size = 50
  ) {
    const userId = String((req.user as any).userId);
    const result = await this.agentService.getSessionMessages(userId, sessionId, Number(page), Number(size));
    return new ResponseItem(result, 'Messages retrieved');
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message in a session (non-streaming)' })
  @ApiParam({ name: 'sessionId' })
  @ApiBody({
    schema: { properties: { message: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' } } },
  })
  async sendMessage(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string; provider?: string; model?: string }
  ) {
    const userId = String((req.user as any).userId);
    const result = await this.agentService.sendMessage({ userId, sessionId, ...body });
    return new ResponseItem(result, 'Message sent');
  }

  @Post('sessions/:sessionId/messages/stream')
  @ApiOperation({ summary: 'Send a message in a session (SSE streaming)' })
  @ApiParam({ name: 'sessionId' })
  @ApiBody({
    schema: { properties: { message: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' } } },
  })
  async sendMessageStream(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string; provider?: string; model?: string },
    @Res() res: Response
  ): Promise<void> {
    const userId = String((req.user as any).userId);
    this.setSSEHeaders(res);

    const stream$ = this.agentService.sendMessageStream({ userId, sessionId, ...body });

    const subscription = stream$.subscribe({
      next: (item) => {
        if (item.done) {
          res.write(`data: [DONE]\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ chunk: item.chunk })}\n\n`);
        }
      },
      error: (err: any) => {
        res.write(`data: ${JSON.stringify({ error: err?.message ?? 'Stream error' })}\n\n`);
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => subscription.unsubscribe());
  }

  // ---- Helpers ----

  private setSSEHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
  }
}
