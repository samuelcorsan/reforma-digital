import { afterEach, describe, expect, it, vi } from 'vitest';
import { search } from '../packages/ai/src/index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const classification = (query: string, region: string | null) =>
  Response.json({
    id: 'classification-test',
    model: 'deepseek-v4-flash',
    created: 0,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: JSON.stringify({ query, region }) },
      },
    ],
    usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
  });

describe('chat web retrieval', () => {
  it('searches official domains with Exa and keeps its excerpts as evidence', async () => {
    vi.stubEnv('NAN_API_KEY', 'test-only-key');
    vi.stubEnv('EXA_API_KEY', 'test-only-exa');
    vi.stubEnv('DATABASE_URL', '');
    const content = 'Puedes solicitar el informe de vida laboral en Importass.';
    const result = (url: string, excerpt = content) => ({
      url,
      title: 'Vida laboral',
      highlights: excerpt ? [excerpt] : [],
    });
    const fetch = vi.fn(async (_input, _init) =>
      Response.json({
        results: [
          result('https://portal.seg-social.gob.es/vida-laboral'),
          result('https://portal.seg-social.gob.es/vida-laboral?utm_source=test'),
          result('https://example.com/vida-laboral'),
          result('https://portal.seg-social.gob.es/no-excerpt', ''),
          result('https://sede.madrid.es/local'),
          result('https://portal.seg-social.gob.es.evil.com/vida-laboral'),
        ],
        costDollars: { total: 0.005 },
      }),
    );
    fetch.mockResolvedValueOnce(classification('Cómo obtener mi vida laboral', null));
    vi.stubGlobal('fetch', fetch);
    const found = await search('Cómo obtener mi vida laboral', {
      mode: 'live',
      retrievalOnly: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0][0])).toBe('https://api.nan.builders/v1/chat/completions');
    expect(String(fetch.mock.calls[1][0])).toBe('https://api.exa.ai/search');
    const init = fetch.mock.calls[1][1] as RequestInit;
    expect(new Headers(init.headers).get('x-api-key')).toBe('test-only-exa');
    const request = await new Response(init.body).json();
    expect(request).toMatchObject({ query: 'Cómo obtener mi vida laboral', numResults: 8 });
    expect(request.includeDomains).toContain('portal.seg-social.gob.es');
    expect(request.includeDomains).not.toContain('sede.madrid.es');
    expect(found.evidence).toHaveLength(1);
    expect(found.evidence[0]).toMatchObject({
      content,
      sourceId: 'seg-social',
      jurisdiction: 'ES',
    });
    expect(found.understanding.region).toBeNull();
    expect(found.tokens).toBe(3);
    // NaN does not bill per token, so the total cost is unknown, not zero.
    expect(found.costUsd).toBeNull();
  });

  it('does not search when the user must clarify the municipality', async () => {
    vi.stubEnv('NAN_API_KEY', 'test-only-key');
    vi.stubEnv('EXA_API_KEY', 'test-only-exa');
    const fetch = vi.fn().mockResolvedValue(classification('Cómo empadronarme', null));
    vi.stubGlobal('fetch', fetch);
    const result = await search('Cómo empadronarme', { mode: 'live' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.answer.status).toBe('needs_clarification');
  });

  it('usa la comunidad validada del modelo y conserva intacta una pregunta sin historial', async () => {
    vi.stubEnv('NAN_API_KEY', 'test-only-key');
    vi.stubEnv('EXA_API_KEY', 'test-only-exa');
    const query = 'Vengo de Madrid y necesito una ayuda en Aragón';
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(classification('Pregunta reformulada por el modelo', 'ES-AR'))
      .mockResolvedValue(Response.json({ results: [] }));
    vi.stubGlobal('fetch', fetch);
    const result = await search(query, { mode: 'live', retrievalOnly: true });
    expect(result.query).toBe(query);
    expect(result.resolvedQuery).toBeUndefined();
    expect(result.understanding.jurisdiction).toBe('ES-AR');
    expect(result.understanding.region).toBe('ES-AR');
    const request = await new Response((fetch.mock.calls[1][1] as RequestInit).body).json();
    expect(request.includeDomains).not.toContain('sede.madrid.es');
  });

  it('rechaza una comunidad fuera de la lista validada', async () => {
    vi.stubEnv('NAN_API_KEY', 'test-only-key');
    vi.stubEnv('EXA_API_KEY', 'test-only-exa');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(classification('Una ayuda en Aragón', 'ES-XX')),
    );
    await expect(search('Una ayuda en Aragón', { mode: 'live' })).rejects.toThrow();
  });

  it('no simula una clasificación del modelo en preview', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await search('Una ayuda en Aragón', { mode: 'preview' });
    expect(result.understanding.region).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
