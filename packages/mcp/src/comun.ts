// Lo que comparten los servidores MCP que consultan una API pública de fuera (BOE, Carburantes,
// INE): un handler sin estado que responde JSON, herramientas de solo lectura y errores sin
// detalles internos.
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';

export const READ_ONLY_EXTERNAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Un fallo de la fuente que sí se puede contar al asistente (código y motivo). */
export class SourceError extends Error {}

export type Fetch = typeof fetch;

/**
 * GET con tiempo límite (o POST, si lleva un cuerpo JSON): la respuesta si es 2xx; si no, un
 * SourceError con el código.
 */
export async function get(
  fetchImpl: Fetch,
  url: string,
  accept = 'application/json',
  body?: unknown,
) {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...(body === undefined
        ? { headers: { Accept: accept } }
        : {
            method: 'POST',
            headers: { Accept: accept, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La fuente no responde. Prueba más tarde.');
  }
  if (!response.ok) throw new SourceError(`La fuente respondió ${response.status}.`);
  return response;
}

/** Ejecuta una herramienta: el resultado en JSON con la fuente al final, o el error para el asistente. */
export async function run<T>(source: string, produce: () => Promise<T>) {
  try {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(await produce(), null, 2) },
        { type: 'text' as const, text: source },
      ],
    };
  } catch (error) {
    // Solo los errores de la fuente llevan su mensaje: otro podría llevar URLs o datos internos.
    const message =
      error instanceof SourceError ? error.message : 'Error interno al consultar la fuente.';
    return { content: [{ type: 'text' as const, text: message }], isError: true };
  }
}

export function server(
  info: { name: string; title: string },
  instructions: string,
  register: (server: McpServer) => void,
) {
  return createMcpHandler(
    () => {
      const s = new McpServer({ ...info, version: '0.1.0' }, { instructions });
      register(s);
      return s;
    },
    { responseMode: 'json' },
  );
}

/** Sin tildes ni mayúsculas, para buscar «Malaga» o «cadiz». */
export const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
