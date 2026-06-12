import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { AgentService } from './agent.service';
import { AgentRequestDto } from './dto/agent-request.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { CanvasWriteRequest } from '../agent-client/agent-client.service';
import { CanvasService } from '../canvas/canvas.service';

@ApiTags('agent')
@Controller('/agent')
@UseGuards(JwtAccessTokenGuard)
@ApiBearerAuth('JWT-auth')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly canvasService: CanvasService
  ) {}

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
  async getOrCreateActiveSession(@Req() req: Request, @Query('scopeType') scopeType?: string, @Query('scopeId') scopeId?: string) {
    const userId = String((req.user as any).userId);
    const session = await this.agentService.getOrCreateActiveSession(userId, this.normalizeSessionScope(scopeType, scopeId));
    return new ResponseItem(session, 'Active session retrieved');
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all AI chat sessions for the current user' })
  async listSessions(@Req() req: Request, @Query('scopeType') scopeType?: string, @Query('scopeId') scopeId?: string) {
    const userId = String((req.user as any).userId);
    const sessions = await this.agentService.listSessions(userId, this.normalizeSessionScope(scopeType, scopeId));
    return new ResponseItem(sessions, 'Sessions retrieved');
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new AI chat session (archives current active)' })
  @ApiBody({ schema: { properties: { title: { type: 'string' }, scopeType: { type: 'string' }, scopeId: { type: 'string' } } } })
  async createSession(@Req() req: Request, @Body() body: { title?: string; scopeType?: string; scopeId?: string }) {
    const userId = String((req.user as any).userId);
    const session = await this.agentService.createSession(
      userId,
      body.title,
      this.normalizeSessionScope(body.scopeType, body.scopeId)
    );
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
    @Query('size') size = 50,
    @Query('scopeType') scopeType?: string,
    @Query('scopeId') scopeId?: string
  ) {
    const userId = String((req.user as any).userId);
    const result = await this.agentService.getSessionMessages(
      userId,
      sessionId,
      Number(page),
      Number(size),
      this.normalizeSessionScope(scopeType, scopeId)
    );
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

  @Patch('sessions/:sessionId/messages/:messageId/actions/:actionId')
  @ApiOperation({ summary: 'Update persisted status for a proposed AI action' })
  @ApiParam({ name: 'sessionId' })
  @ApiParam({ name: 'messageId' })
  @ApiParam({ name: 'actionId' })
  @ApiBody({ schema: { properties: { status: { type: 'string' }, error: { type: 'string' } } } })
  async updateMessageActionStatus(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Param('actionId') actionId: string,
    @Body() body: { status: string; error?: string }
  ) {
    const userId = String((req.user as any).userId);
    const result = await this.agentService.updateMessageActionStatus({
      userId,
      sessionId,
      messageId,
      actionId,
      status: body.status,
      error: body.error,
    });
    return new ResponseItem(result, 'Action status updated');
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

  // ---- Canvas AI Writer ----

  @Post('canvas/write/stream')
  @ApiOperation({
    summary: 'Canvas AI Writer - AI reads canvas via MCP and applies tool-based mutations directly',
  })
  @ApiBody({
    schema: {
      properties: {
        canvasId: { type: 'string', description: 'Canvas document ID (required for MCP tool access)' },
        canvasContent: { type: 'string', description: 'Fallback plain-text snapshot (used if MCP read fails)' },
        userRequest: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
      },
      required: ['canvasId', 'userRequest'],
    },
  })
  async canvasWriteStream(
    @Req() req: Request,
    @Body() body: { canvasId: string; canvasContent?: string; userRequest: string; provider?: string; model?: string },
    @Res() res: Response
  ): Promise<void> {
    const userId = String((req.user as any).userId);
    await this.canvasService.authorizeCanvasAccess(body.canvasId, userId, 'editor');

    this.setSSEHeaders(res);

    const stream$ = this.agentService.canvasWriteStream({
      canvasId: body.canvasId,
      canvasContent: body.canvasContent ?? '',
      userRequest: body.userRequest,
      provider: body.provider,
      model: body.model,
    } as CanvasWriteRequest);

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

  @Post('sessions/:sessionId/canvas/messages/stream')
  @ApiOperation({ summary: 'Canvas chat stream with session history + pending actions (Accept/Reject)' })
  async canvasSessionMessageStream(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      canvasId: string;
      canvasContent?: string;
      message: string;
      provider?: string;
      model?: string;
      mode?: string;
    },
    @Res() res: Response
  ): Promise<void> {
    const userId = String((req.user as any).userId);
    await this.canvasService.authorizeCanvasAccess(body.canvasId, userId, 'viewer');
    this.setSSEHeaders(res);

    const stream$ = this.agentService.canvasSessionMessageStream({
      userId,
      sessionId,
      canvasId: body.canvasId,
      canvasContent: body.canvasContent ?? '',
      message: body.message,
      provider: body.provider,
      model: body.model,
      mode: body.mode,
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

  @Post('canvas/actions/apply')
  @ApiOperation({ summary: 'Apply one approved canvas action from pending preview list' })
  async applyCanvasAction(
    @Req() req: Request,
    @Body() body: { canvasId: string; actionName: string; actionArgsJson: string }
  ): Promise<ResponseItem<{ ok: boolean; resultJson?: string; error?: string }>> {
    const userId = String((req.user as any).userId);
    await this.canvasService.authorizeCanvasAccess(body.canvasId, userId, 'editor');

    const result = await this.agentService.canvasApplyAction({
      canvasId: body.canvasId,
      actionName: body.actionName,
      actionArgsJson: body.actionArgsJson,
    });
    return new ResponseItem(result, result.ok ? 'Action applied' : 'Action failed');
  }

  @Post('sessions/:sessionId/tasks/messages/stream')
  @ApiOperation({ summary: 'Task chat stream with session history + pending task actions (Accept/Reject)' })
  async taskSessionMessageStream(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      workspaceId: string;
      channelId?: string;
      taskListId?: string;
      canvasId?: string;
      canvasContent?: string;
      canvasTitle?: string;
      sourceCanvasUrl?: string;
      overallDueDate?: string;
      timezone?: string;
      message: string;
      provider?: string;
      model?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    const userId = String((req.user as any).userId);
    this.setSSEHeaders(res);

    const stream$ = this.agentService.taskSessionMessageStream({
      userId,
      sessionId,
      workspaceId: body.workspaceId,
      channelId: body.channelId,
      taskListId: body.taskListId,
      canvasId: body.canvasId,
      canvasContent: body.canvasContent ?? '',
      message: body.message,
      provider: body.provider,
      model: body.model,
      canvasTitle: body.canvasTitle,
      sourceCanvasUrl: body.sourceCanvasUrl,
      overallDueDate: body.overallDueDate,
      timezone: body.timezone,
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

  @Post('tasks/actions/apply')
  @ApiOperation({ summary: 'Apply one approved task action from pending preview list' })
  async applyTaskAction(
    @Req() req: Request,
    @Body()
    body: {
      workspaceId: string;
      channelId?: string;
      taskListId?: string;
      actionName: string;
      actionArgsJson: string;
    },
  ): Promise<ResponseItem<{ ok: boolean; resultJson?: string; error?: string }>> {
    const userId = String((req.user as any).userId);
    const result = await this.agentService.taskApplyAction({
      userId,
      workspaceId: body.workspaceId,
      channelId: body.channelId,
      taskListId: body.taskListId,
      actionName: body.actionName,
      actionArgsJson: body.actionArgsJson,
    });
    return new ResponseItem(result, result.ok ? 'Action applied' : 'Action failed');
  }

  // ---- Helpers ----

  private setSSEHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
  }

  private normalizeSessionScope(scopeType?: string, scopeId?: string) {
    const normalizedType = scopeType === 'canvas' ? 'canvas' : 'general';
    const normalizedId = normalizedType === 'canvas' ? scopeId?.trim() : undefined;
    if (normalizedType === 'canvas' && !normalizedId) {
      throw new BadRequestException('scopeId is required for canvas sessions');
    }
    return {
      scopeType: normalizedType,
      ...(normalizedId ? { scopeId: normalizedId } : {}),
    };
  }
}
