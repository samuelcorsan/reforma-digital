import {
  apiMarkdown,
  instinctMarkdown,
  mcpMarkdown,
  serverMarkdown,
} from '../../../../lib/developers/markdown';

export const runtime = 'nodejs';

// /developers/<ruta>.md llega aquí por la reescritura de next.config.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/');
  const markdown =
    path === 'api'
      ? apiMarkdown()
      : path === 'instinct'
        ? await instinctMarkdown()
        : path === 'mcp'
          ? await mcpMarkdown()
          : path.startsWith('mcp/')
            ? await serverMarkdown(path.slice(4))
            : undefined;
  if (!markdown) return new Response('No existe esa página.\n', { status: 404 });
  return new Response(`${markdown}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
