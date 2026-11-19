// Fallos puntuales, reintentados (port de renfe-cli `retry.py`): un 500, 502, 503 o 504 (en la tienda antigua solo
// 500 y 502) y una conexión rechazada o cortada. Hasta 3 intentos, con 1 s y 2 s de pausa. Nunca se reintenta un
// bloqueo (403, 429), una página HTML, otro 4xx, una respuesta ilegible ni un timeout.

import { RenfeError, type Retry } from './errors';

export const PAUSES = [1000, 2000];
export const LEGACY_STATUSES = [500, 502];
const STATUSES = [500, 502, 503, 504];

export const timing = {
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  now: () => performance.now(),
};

export function statusFailure(status: number, statuses = STATUSES): string | undefined {
  return statuses.includes(status) ? `server error (${status})` : undefined;
}

/** Qué falló al conectar, como lo nombra renfe-cli; undefined para un timeout. */
export function connectionFailure(error: unknown): string | undefined {
  const code = (error as { cause?: { code?: string } })?.cause?.code ?? '';
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|CONNECT_TIMEOUT/.test(code))
    return 'no connection (ConnectError)';
  return 'connection dropped (ReadError)';
}

export function isTimeout(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export async function call<T>(
  request: string,
  send: () => Promise<T>,
  log: Retry[] | undefined,
  opts: {
    mayRetry?: () => boolean;
    deadline?: number;
    resend?: (err: RenfeError) => string | undefined;
    describe?: (err: RenfeError) => string | undefined;
  } = {},
): Promise<T> {
  let entry: Retry | undefined;
  let paused = 0;
  for (let n = 0; n <= PAUSES.length; n++) {
    const started = timing.now();
    try {
      const result = await send();
      if (entry) {
        entry.tries = n + 1;
        entry.recovered = true;
      }
      return result;
    } catch (err) {
      if (!(err instanceof RenfeError)) throw err;
      const took = timing.now() - started;
      const last = n === PAUSES.length;
      let what = err.transient;
      let pause = last ? undefined : PAUSES[paused];
      if (what === undefined && opts.resend) {
        const answer = opts.resend(err); // también en el último intento: una sesión rechazada se descarta igual
        [what, pause] = last ? [undefined, undefined] : [answer, 0];
      }
      let again =
        what !== undefined &&
        pause !== undefined &&
        (opts.deadline === undefined || timing.now() + pause + took <= opts.deadline) &&
        (opts.mayRetry === undefined || opts.mayRetry());
      if (again && pause) {
        await timing.sleep(pause);
        paused += 1;
        again = opts.mayRetry === undefined || opts.mayRetry();
      }
      const text = opts.describe?.(err) ?? what ?? err.message;
      if (!again) {
        if (entry) {
          entry.tries = n + 1;
          entry.errors.push(text);
        }
        throw err;
      }
      if (!entry) {
        entry = { request, tries: 0, errors: [], recovered: false };
        log?.push(entry);
      }
      entry.tries = n + 1;
      entry.errors.push(text);
    }
  }
  throw new Error('unreachable');
}
