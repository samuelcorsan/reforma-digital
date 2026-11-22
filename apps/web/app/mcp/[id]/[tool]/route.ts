import { callTool } from '../../../../lib/mcp/catalog';

export const runtime = 'nodejs';

/**
 * GET /mcp/<servidor>/<herramienta>?param=valor: la herramienta MCP como una URL. Es para Instinct,
 * que no admite conectores MCP pero sí lee URLs. Responde el mismo texto que la herramienta.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; tool: string }> },
) {
  const { id, tool } = await params;
  const result = await callTool(id, tool, new URL(request.url).searchParams);
  if (!result) return new Response('No existe esa herramienta.\n', { status: 404 });
  return new Response(`${result.text}\n`, {
    status: result.status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
