import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpService } from './mcp.service';

/**
 * MCP endpoint — handles both POST (tool calls) and GET (SSE notifications).
 * Each request creates a fresh stateless transport, connects it to the shared
 * McpServer instance, and delegates handling.
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    const server = this.mcpService.createServer();

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
