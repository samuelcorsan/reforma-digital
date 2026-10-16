import type { ChatGuard, Span } from '@nationaldesignstudio/rampart';
import { redactQuery } from './redact';
import { protectionDetails, type ProtectedText } from './pii-display';
declare global {
  interface Navigator {
    // Chromium only; missing from lib.dom.
    connection?: { saveData?: boolean };
  }
}
let guard: Promise<ChatGuard> | undefined;
export const PROTECTION_TIMEOUT_MS = 60_000;
export class ProtectionTimeoutError extends Error {
  constructor() {
    super(
      'La protección de datos ha tardado demasiado. No se ha enviado la consulta. Inténtalo de nuevo.',
    );
    this.name = 'ProtectionTimeoutError';
  }
}
// Rampart's model tags form numbers ("modelo 303") as street numbers and the Catalan "Com"
// as an email. Address numbers stay only next to a street, and emails only with an @.
export function plausibleSpans(spans: Span[]): Span[] {
  const street = spans.some((span) => span.label === 'STREET_NAME');
  return spans.filter((span) =>
    span.label === 'EMAIL'
      ? span.text.includes('@')
      : street || (span.label !== 'BUILDING_NUMBER' && span.label !== 'SECONDARY_ADDRESS'),
  );
}
const load = () =>
  import('@nationaldesignstudio/rampart').then(async (m) => {
    const classifier = await m.loadNerClassifier();
    return m.createGuard({
      ner: async (text) => plausibleSpans(await m.detectNer(text, classifier)),
    });
  });
// Starts the model download while the question is being written. Failures surface on send.
// With the browser's data saver on, the download waits for the send.
export function warm(): void {
  if (guard || navigator.connection?.saveData) return;
  const current = (guard = load());
  current.catch(() => {
    if (guard === current) guard = undefined;
  });
}
// Browser only. Rejects if Rampart cannot load or run, so nothing is sent unprotected.
async function protectMessage(text: string): Promise<ProtectedText> {
  guard ??= load();
  const current = guard;
  try {
    const loaded = await current;
    const result = await loaded.protect(redactQuery(text));
    return protectionDetails(text, result.text, result.placeholders ?? [], (token) =>
      loaded.reveal(token),
    );
  } catch (e) {
    if (guard === current) guard = undefined;
    throw e;
  }
}

// Bound the whole batch, including model loading. Late results never reach fetch.
export async function protectMessages(
  texts: string[],
  signal: AbortSignal,
): Promise<ProtectedText[]> {
  signal.throwIfAborted();
  const cancellation = new AbortController();
  const workSignal = AbortSignal.any([signal, cancellation.signal]);
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new ProtectionTimeoutError()), PROTECTION_TIMEOUT_MS);
  });
  const work = (async () => {
    const safe: ProtectedText[] = [];
    for (const text of texts) {
      workSignal.throwIfAborted();
      safe.push(await protectMessage(text));
    }
    return safe;
  })();
  const current = guard;
  try {
    return await Promise.race([work, interrupted]);
  } catch (error) {
    // A stalled instance must not hold up retries or run concurrently with them.
    if (guard === current) guard = undefined;
    throw error;
  } finally {
    cancellation.abort();
    clearTimeout(timer!);
    signal.removeEventListener('abort', abort!);
  }
}
