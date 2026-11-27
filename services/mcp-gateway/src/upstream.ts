import { setTimeout as delay } from 'node:timers/promises';
import { config } from './config.js';
import type { ModuleName } from './modules/common.js';

export class UpstreamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'UpstreamError';
  }
}

/** Fixed module/tool names; never accept an arbitrary URL from a tool caller. */
function endpoint(module: ModuleName, tool: string, args: Record<string, unknown>): URL {
  const base = config.UPSTREAM_BASE_URL.replace(/\/+$/, '') + '/';
  const url = new URL(`${module}/${tool}`, base);
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return url;
}

/** Limit memory use even when Content-Length is absent or false. */
async function readBounded(response: Response): Promise<string> {
  const advertised = Number(response.headers.get('content-length') ?? 0);
  if (advertised > config.UPSTREAM_MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError('Respuesta upstream demasiado grande.', 502);
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > config.UPSTREAM_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new UpstreamError('Respuesta upstream demasiado grande.', 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total).toString('utf8');
}

const retryable = new Set([429, 500, 502, 503, 504]);

/** The Reforma Digital documentation exposes GET /mcp/<module>/<tool> for every tool. */
export async function callPublicTool(
  module: ModuleName,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const url = endpoint(module, tool, args);
  for (let attempt = 0; attempt <= config.UPSTREAM_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(config.UPSTREAM_TIMEOUT_MS),
        headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.1' },
        redirect: 'error'
      });
      if (retryable.has(response.status) && attempt < config.UPSTREAM_RETRIES) {
        await response.body?.cancel().catch(() => undefined);
        await delay(250 * (2 ** attempt));
        continue;
      }
      const body = await readBounded(response);
      if (!response.ok) {
        throw new UpstreamError(
          `Reforma Digital respondió HTTP ${response.status}: ${body.slice(0, 350)}`,
          response.status
        );
      }
      return body || 'Sin contenido.';
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if (attempt === config.UPSTREAM_RETRIES) {
        const isTimeout = error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError');
        throw new UpstreamError(
          isTimeout ? 'Tiempo de espera agotado al consultar Reforma Digital.'
            : 'No se pudo contactar con Reforma Digital.',
          isTimeout ? 504 : 502
        );
      }
      await delay(250 * (2 ** attempt));
    }
  }
  throw new UpstreamError('Número de reintentos agotado.', 502);
}
