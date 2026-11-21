import { siteUrl } from '../site';

export const endpoint = (id: string) => new URL(`/mcp/${id}`, siteUrl).href;
export const fichaPath = (id: string) => `/developers/mcp/${id}`;
/** Cualquier página de /developers en Markdown: la misma ruta con `.md`. */
export const markdownUrl = (path: string) => new URL(`${path}.md`, siteUrl).href;

/** GET de un endpoint MCP: un navegador va a la ficha; el resto, 405 como hasta ahora. */
export function openInBrowser(id: string) {
  return (request: Request) =>
    request.headers.get('accept')?.includes('text/html')
      ? Response.redirect(new URL(fichaPath(id), request.url), 303)
      : new Response(null, { status: 405, headers: { Allow: 'POST' } });
}

/**
 * Lo que copia «Conecta tu agente», como el «Fetch … and follow it» de Vercel: una frase con el
 * Markdown que el agente lee y sigue. Las órdenes de cada cliente viven en ese Markdown.
 */
export function agentPrompt(path: string, what = 'Reforma Digital') {
  return `Conecta ${what} a tu agente. Lee ${markdownUrl(path)} y sigue sus instrucciones.`;
}
