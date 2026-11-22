import { timingSafeEqual } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { config, allowedHosts, allowedOrigins } from './config.js';
import { modules } from './modules/index.js';
import { callPublicTool } from './upstream.js';

const app = express();
if (config.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');

// No CORS wildcard by default. Cross-origin browser access requires explicit allowlisting.
function guard(req: Request, res: Response, next: NextFunction): void {
  const host = (req.headers.host ?? '').toLowerCase();
  if (allowedHosts.size > 0 && !allowedHosts.has(host)) {
    res.status(403).json({ error: 'Host no permitido' });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({ error: 'Origin no permitido' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (config.GATEWAY_TOKEN) {
    const presented = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const a = Buffer.from(presented);
    const b = Buffer.from(config.GATEWAY_TOKEN);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  next();
}

const sessions = new Map<string, {
  transport: SSEServerTransport;
  mcp: McpServer;
  heartbeat: ReturnType<typeof setInterval> | undefined;
}>();
let inflight = 0;
const toolCount = modules.reduce((sum, module) => sum + module.tools.length, 0);

/** Each SSE client has its own SDK server + transport; upstream calls are stateless GETs. */
export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'reforma-digital-unified', version: '1.0.0' },
    { capabilities: { tools: { listChanged: false } } }
  );
  for (const module of modules) {
    for (const tool of module.tools) {
      server.registerTool(
        `${module.name}_${tool.name}`,
        { description: `[${module.name}] ${tool.description}`, inputSchema: tool.inputSchema },
        async (args) => {
          const parsed = z.object(tool.inputSchema).strict().safeParse(args);
          if (!parsed.success) {
            return { isError: true, content: [{ type: 'text' as const,
              text: `Argumentos inválidos: ${parsed.error.message}` }] };
          }
          if (inflight >= config.MAX_INFLIGHT_TOOLS) {
            return { isError: true, content: [{ type: 'text' as const,
              text: 'Gateway ocupado: límite de consultas simultáneas alcanzado.' }] };
          }
          try {
            tool.validate?.(parsed.data);
          } catch (error) {
            return { isError: true, content: [{ type: 'text' as const,
              text: error instanceof Error ? error.message : 'Argumentos inválidos.' }] };
          }
          inflight++;
          try {
            const output = await callPublicTool(module.name, tool.name, parsed.data);
            return { content: [{ type: 'text' as const, text: output }] };
          } catch (error) {
            console.error(JSON.stringify({ level: 'error', module: module.name,
              tool: tool.name, error: error instanceof Error ? error.message : String(error) }));
            return { isError: true, content: [{ type: 'text' as const,
              text: error instanceof Error ? error.message : 'Error upstream.' }] };
          } finally {
            inflight--;
          }
        }
      );
    }
  }
  return server;
}

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', transport: 'legacy-sse', modules: modules.length,
    tools: toolCount, sessions: sessions.size });
});

// SSE is a two-URL protocol. SDK emits `event: endpoint` with /message?sessionId=...
app.get('/sse', guard, async (_req, res) => {
  if (sessions.size >= config.MAX_SESSIONS) {
    res.status(503).json({ error: 'Máximo de sesiones SSE alcanzado' });
    return;
  }
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  const transport = new SSEServerTransport('/message', res);
  const mcp = buildMcpServer();
  const sessionId = transport.sessionId;
  sessions.set(sessionId, { transport, mcp, heartbeat: undefined });

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const session = sessions.get(sessionId);
    if (session?.heartbeat) clearInterval(session.heartbeat);
    sessions.delete(sessionId);
    void mcp.close().catch(() => undefined);
  };
  res.once('close', dispose);

  try {
    await mcp.connect(transport);
    if (disposed) return;
    if (config.SSE_HEARTBEAT_MS > 0) {
      const heartbeat = setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(': keepalive\n\n');
      }, config.SSE_HEARTBEAT_MS);
      const session = sessions.get(sessionId);
      if (session) session.heartbeat = heartbeat;
      else clearInterval(heartbeat);
    }
  } catch (error) {
    console.error('Error inicializando sesión SSE:', error);
    dispose();
    if (!res.headersSent) res.status(500).end('Error de inicialización MCP');
    else res.end();
  }
});

// Express parses JSON before the SDK validates the JSON-RPC envelope.
app.post('/message', guard, express.json({ limit: '64kb', type: 'application/json' }),
  async (req, res) => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) {
      res.status(400).json({ error: 'Falta sessionId' });
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sesión SSE inexistente o caducada' });
      return;
    }
    try {
      await session.transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error de mensaje SSE:', error);
      if (!res.headersSent) res.status(400).json({ error: 'Mensaje MCP inválido' });
    }
  }
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error HTTP:', error instanceof Error ? error.message : String(error));
  if (!res.headersSent) res.status(400).json({ error: 'Petición HTTP inválida' });
});

let httpServer: HttpServer;
httpServer = app.listen(config.PORT, config.HOST, () => {
  console.log(JSON.stringify({ event: 'mcp_gateway_started',
    address: `${config.HOST}:${config.PORT}`, transport: 'legacy-sse',
    modules: modules.length, tools: toolCount }));
});

const shutdown = async (): Promise<void> => {
  for (const session of sessions.values()) {
    if (session.heartbeat) clearInterval(session.heartbeat);
    await session.mcp.close().catch(() => undefined);
  }
  sessions.clear();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
