import { notFound } from 'next/navigation';
import { openInBrowser } from '../../../lib/mcp/rutas';
import { handlers } from '../../../lib/mcp/servidores';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

/** POST /mcp/<servidor>: el endpoint MCP de cada servidor, sin sesiones. */
export async function POST(request: Request, { params }: Contexto) {
  const handler = handlers.get((await params).id);
  if (!handler) notFound();
  return handler(request);
}

// Sin sesiones, GET no sirve a los clientes MCP: un navegador va a la ficha y el resto recibe 405.
export async function GET(request: Request, { params }: Contexto) {
  const { id } = await params;
  if (!handlers.has(id)) notFound();
  return openInBrowser(id)(request);
}
