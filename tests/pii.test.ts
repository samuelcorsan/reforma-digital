import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PiiLabel } from '../apps/web/node_modules/@nationaldesignstudio/rampart';

const createGuard = vi.hoisted(() => vi.fn());
// Path, not package name: Rampart is only a dependency of apps/web.
vi.mock('../apps/web/node_modules/@nationaldesignstudio/rampart', () => ({
  createGuard,
  loadNerClassifier: async () => ({}),
  detectNer: async () => [],
}));

const guard = (protect: (text: string) => Promise<{ text: string }>) => ({ protect });

describe('pii protection', () => {
  beforeEach(() => {
    vi.resetModules();
    createGuard.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cancels a pending model load immediately and allows retry', async () => {
    let finish!: (value: unknown) => void;
    createGuard.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { protectMessages } = await import('../apps/web/lib/pii');
    const controller = new AbortController();
    const pending = protectMessages(['Soy Ana', 'segunda pregunta'], controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(createGuard).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
    const oldProtect = vi.fn(async (text: string) => ({ text }));
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    expect(await protectMessages(['Otra pregunta'], new AbortController().signal)).toMatchObject([
      { text: 'Otra pregunta' },
    ]);
    finish(guard(oldProtect));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(oldProtect).toHaveBeenCalledTimes(1);
  });

  it('bounds the whole batch and discards a late inference without starting the next text', async () => {
    let finish!: (value: { text: string }) => void;
    const inference = vi.fn(
      () =>
        new Promise<{ text: string }>((resolve) => {
          finish = resolve;
        }),
    );
    createGuard.mockResolvedValue(guard(inference));
    const { protectMessages, PROTECTION_TIMEOUT_MS } = await import('../apps/web/lib/pii');
    vi.useFakeTimers();
    const pending = protectMessages(
      ['Primera pregunta', 'segunda pregunta'],
      new AbortController().signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({ name: 'ProtectionTimeoutError' });
    await vi.advanceTimersByTimeAsync(PROTECTION_TIMEOUT_MS);
    await rejected;
    finish({ text: 'late result' });
    await vi.advanceTimersByTimeAsync(0);
    expect(inference).toHaveBeenCalledTimes(1);
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    expect(await protectMessages(['Reintento'], new AbortController().signal)).toMatchObject([
      { text: 'Reintento' },
    ]);
  });

  it('never initializes protection for an already cancelled request', async () => {
    const { protectMessages } = await import('../apps/web/lib/pii');
    const controller = new AbortController();
    controller.abort();
    await expect(protectMessages(['Pregunta'], controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(createGuard).not.toHaveBeenCalled();
  });

  it('hands Rampart text that the Spanish rules already redacted', async () => {
    const seen: string[] = [];
    createGuard.mockResolvedValue(
      guard(async (text) => {
        seen.push(text);
        return { text: text.replace('Ana', '[GIVEN_NAME_1]') };
      }),
    );
    const { protectMessages } = await import('../apps/web/lib/pii');
    expect(
      await protectMessages(['Soy Ana, DNI 12345678Z'], new AbortController().signal),
    ).toMatchObject([{ text: 'Soy [GIVEN_NAME_1], DNI [DNI omitido]' }]);
    expect(seen).toEqual(['Soy Ana, DNI [DNI omitido]']);
  });

  it('keeps form numbers and Catalan "Com" that Rampart mistakes for an address or an email', async () => {
    const { plausibleSpans } = await import('../apps/web/lib/pii');
    const kept = (...spans: [string, PiiLabel][]) =>
      plausibleSpans(
        spans.map(([text, label]) => ({
          start: 0,
          end: text.length,
          label,
          score: 1,
          source: 'ner' as const,
          text,
        })),
      ).map((span) => span.text);
    // "Com presento el model 303", "modelo 036 y modelo 130"
    expect(kept(['Com', 'EMAIL'], ['303', 'BUILDING_NUMBER'])).toEqual([]);
    expect(kept(['036', 'BUILDING_NUMBER'], ['130', 'SECONDARY_ADDRESS'])).toEqual([]);
    // "Presento el 303 y me llamo Ana"
    expect(kept(['303', 'BUILDING_NUMBER'], ['Ana', 'GIVEN_NAME'])).toEqual(['Ana']);
    // "Avenida de América 45, piso 2"
    expect(
      kept(
        ['Avenida de América', 'STREET_NAME'],
        ['45', 'BUILDING_NUMBER'],
        ['piso 2', 'SECONDARY_ADDRESS'],
      ),
    ).toEqual(['Avenida de América', '45', 'piso 2']);
    expect(kept(['ana @ example . com', 'EMAIL'])).toEqual(['ana @ example . com']);
  });

  it('fails closed when Rampart cannot load, then retries', async () => {
    createGuard.mockRejectedValueOnce(new Error('model unavailable'));
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    const { protectMessages } = await import('../apps/web/lib/pii');
    await expect(protectMessages(['Soy Ana'], new AbortController().signal)).rejects.toThrow(
      'model unavailable',
    );
    expect(await protectMessages(['Soy Ana'], new AbortController().signal)).toMatchObject([
      { text: 'Soy Ana' },
    ]);
  });

  it('warms up once and reuses the loaded model on send', async () => {
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    const { protectMessages, warm } = await import('../apps/web/lib/pii');
    warm();
    warm();
    await protectMessages(['Soy Ana'], new AbortController().signal);
    expect(createGuard).toHaveBeenCalledOnce();
  });

  it('does not warm up with data saver on, but still protects on send', async () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    const { protectMessages, warm } = await import('../apps/web/lib/pii');
    warm();
    expect(createGuard).not.toHaveBeenCalled();
    await protectMessages(['Soy Ana'], new AbortController().signal);
    expect(createGuard).toHaveBeenCalledOnce();
  });

  it('retries on send after a failed warm-up', async () => {
    createGuard.mockRejectedValueOnce(new Error('model unavailable'));
    createGuard.mockResolvedValue(guard(async (text) => ({ text })));
    const { protectMessages, warm } = await import('../apps/web/lib/pii');
    warm();
    await vi.waitFor(() => expect(createGuard).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await protectMessages(['Soy Ana'], new AbortController().signal)).toMatchObject([
      { text: 'Soy Ana' },
    ]);
  });

  it('fails closed when Rampart throws while protecting', async () => {
    createGuard.mockResolvedValue(
      guard(async () => {
        throw new Error('inference failed');
      }),
    );
    const { protectMessages } = await import('../apps/web/lib/pii');
    await expect(protectMessages(['Soy Ana'], new AbortController().signal)).rejects.toThrow(
      'inference failed',
    );
  });
});
