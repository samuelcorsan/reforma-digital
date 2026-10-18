import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as modelo } from '../apps/web/app/api/escritorio/v1/chat/completions/route';
import { POST as buscar } from '../apps/web/app/api/escritorio/buscar/route';
import { LIMITES, USD_POR_MILLON_DE_TOKENS } from '../apps/web/lib/escritorio';

/** Las rutas del servidor de la app de escritorio, con NaN Builders y Exa simulados. */
const peticion = (
  url: string,
  cuerpo: unknown,
  instalacion: string | null = randomUUID(),
  ip?: string,
) =>
  new Request(`https://reforma-digital.es${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(instalacion ? { 'x-rd-instalacion': instalacion } : {}),
      ...(ip ? { 'x-vercel-forwarded-for': ip } : {}),
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
const alModelo = (cuerpo: unknown, instalacion?: string | null) =>
  modelo(peticion('/api/escritorio/v1/chat/completions', cuerpo, instalacion));
const mensajes = { messages: [{ role: 'user', content: 'Hola' }] };
/** Una petición de un millón de bytes: su reserva pasa un poco de 0,03 $. */
const enorme = { messages: [{ role: 'user', content: 'x'.repeat(1_000_000) }] };
/** Una petición de otra instalación desde `ip`, como la da Vercel: al modelo o al buscador. */
const desde = async (ip: string, alBuscador = false) => {
  vi.stubEnv('VERCEL', '1');
  const r = alBuscador
    ? await buscar(peticion('/api/escritorio/buscar', { consulta: 'padrón Getafe' }, undefined, ip))
    : await modelo(peticion('/api/escritorio/v1/chat/completions', mensajes, undefined, ip));
  return r.status;
};
/** Tokens que cuestan `usd` dólares. */
const tokens = (usd: number) => Math.ceil((usd / USD_POR_MILLON_DE_TOKENS) * 1e6);

/** Una respuesta en streaming de la API de OpenAI, partida en trozos que cortan las líneas. */
function streaming(uso: { prompt_tokens: number; completion_tokens: number }) {
  const sse = [
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hola' } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: uso })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');
  const bytes = new TextEncoder().encode(sse);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

let enviados: { url: string; cuerpo: Record<string, unknown>; auth: string | null }[] = [];
let respuesta: () => Response;
let dia = 0;

beforeEach(() => {
  enviados = [];
  // Un día propio en cada prueba: el gasto de una no cuenta en otra.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2030, 0, 1 + dia++, 12)));
  vi.stubEnv('NAN_API_KEY', 'clave-nan');
  vi.stubEnv('EXA_API_KEY', 'clave-exa');
  vi.stubEnv('DATABASE_URL', '');
  respuesta = () =>
    Response.json({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    enviados.push({
      url,
      cuerpo: JSON.parse(String(init.body)) as Record<string, unknown>,
      auth: new Headers(init.headers).get('authorization'),
    });
    return respuesta();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('servidor de la app de escritorio', () => {
  it('pasa a NaN Builders con su clave, su modelo y su máximo, y solo los campos del agente', async () => {
    const r = await alModelo({
      ...mensajes,
      model: 'gpt-caro',
      max_tokens: 1_000_000,
      tools: [{ type: 'function' }],
      user: 'campo-que-no-pasa',
    });
    expect(r.status).toBe(200);
    expect(enviados).toHaveLength(1);
    const { url, cuerpo, auth } = enviados[0]!;
    expect(url).toBe('https://api.nan.builders/v1/chat/completions');
    expect(auth).toBe('Bearer clave-nan');
    expect(cuerpo.model).toBe('deepseek-v4-flash');
    expect(cuerpo.max_tokens).toBe(8192);
    expect(cuerpo.tools).toEqual([{ type: 'function' }]);
    expect(cuerpo).not.toHaveProperty('user');
  });

  it('rechaza sin instalación, con un cuerpo enorme, con una petición que no es del agente o sin claves', async () => {
    expect((await alModelo(mensajes, null)).status).toBe(400);
    expect((await alModelo(mensajes, 'no-es-un-uuid')).status).toBe(400);
    expect((await alModelo('x'.repeat(2_000_001))).status).toBe(413);
    expect((await alModelo({ messages: [] })).status).toBe(400);
    expect((await alModelo('{')).status).toBe(400);
    vi.stubEnv('NAN_API_KEY', '');
    expect((await alModelo(mensajes)).status).toBe(503);
    vi.stubEnv('EXA_API_KEY', '');
    expect((await buscar(peticion('/api/escritorio/buscar', { consulta: 'padrón' }))).status).toBe(
      503,
    );
    expect(enviados).toHaveLength(0);
  });

  it('deja de leer un cuerpo sin Content-Length en cuanto pasa del máximo', async () => {
    let leidos = 0;
    const sinFin = new ReadableStream<Uint8Array>({
      pull(c) {
        leidos += 65_536;
        c.enqueue(new Uint8Array(65_536));
      },
    });
    const r = await modelo(
      new Request('https://reforma-digital.es/api/escritorio/v1/chat/completions', {
        method: 'POST',
        headers: { 'x-rd-instalacion': randomUUID() },
        body: sinFin,
        duplex: 'half',
      }),
    );
    expect(r.status).toBe(413);
    expect(leidos).toBeLessThan(2_200_000);
    expect(enviados).toHaveLength(0);
  });

  it('en producción no pasa nada sin Postgres ni sin la IP que da Vercel', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await alModelo(mensajes)).status).toBe(503);
    vi.stubEnv('DATABASE_URL', 'postgres://reforma@db.example/escritorio');
    expect((await alModelo(mensajes)).status).toBe(503);
    vi.stubEnv('VERCEL', '1');
    expect((await alModelo(mensajes)).status).toBe(503);
    expect((await buscar(peticion('/api/escritorio/buscar', { consulta: 'padrón' }))).status).toBe(
      503,
    );
    vi.stubEnv('DATABASE_URL', '');
    expect(await desde('192.0.2.1')).toBe(503);
    expect(enviados).toHaveLength(0);
  });

  it('no pasa tal cual los errores de NaN Builders', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    respuesta = () =>
      new Response('<html>detalle interno</html>', {
        status: 400,
        headers: { 'content-type': 'text/html' },
      });
    const r = await alModelo(mensajes);
    expect(r.status).toBe(400);
    expect(r.headers.get('content-type')).toBe('application/json');
    expect(await r.text()).not.toContain('detalle interno');
    respuesta = () => new Response('detalle interno', { status: 500 });
    expect((await alModelo(mensajes)).status).toBe(502);
  });

  it('devuelve lo reservado cuando NaN Builders no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const instalacion = randomUUID();
    respuesta = () => new Response('', { status: 500 });
    // Sin devolverlo, la reserva de 0,03 $ de cada una agotaría el límite antes de la vigésima.
    for (let i = 0; i < 20; i++) expect((await alModelo(enorme, instalacion)).status).toBe(502);
    respuesta = () =>
      Response.json({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    expect((await alModelo(enorme, instalacion)).status).toBe(200);
  });

  it('corta a cada persona al llegar a su gasto del día, también en streaming', async () => {
    const instalacion = randomUUID();
    // Cada respuesta cuesta medio límite: la tercera ya no pasa.
    respuesta = () =>
      streaming({ prompt_tokens: tokens(LIMITES.usdPorUsuario / 2), completion_tokens: 0 });
    const primera = await alModelo({ ...mensajes, stream: true }, instalacion);
    expect(await primera.text()).toContain('"content":"Hola"');
    expect(enviados[0]!.cuerpo.stream_options).toEqual({ include_usage: true });
    expect(await (await alModelo({ ...mensajes, stream: true }, instalacion)).text()).toContain(
      '[DONE]',
    );
    expect((await alModelo({ ...mensajes, stream: true }, instalacion)).status).toBe(429);
    expect(enviados).toHaveLength(2);
    // Otra persona sigue pudiendo.
    expect((await alModelo(mensajes)).status).toBe(200);
  });

  it('cuenta las búsquedas con lo que cobra Exa', async () => {
    const instalacion = randomUUID();
    respuesta = () => Response.json({ results: [], costDollars: { total: LIMITES.usdPorUsuario } });
    const busqueda = () =>
      buscar(peticion('/api/escritorio/buscar', { consulta: 'padrón Getafe' }, instalacion));
    expect((await busqueda()).status).toBe(200);
    expect(enviados[0]!.url).toBe('https://api.exa.ai/search');
    expect((await busqueda()).status).toBe(429);
    expect((await alModelo(mensajes, instalacion)).status).toBe(429);
  });

  it('cobra lo reservado a quien corta la respuesta antes de que llegue el uso', async () => {
    const instalacion = randomUUID();
    // Cada petición reserva algo más de 0,03 $; el uso que no llega costaría casi nada.
    respuesta = () => streaming({ prompt_tokens: 1, completion_tokens: 1 });
    let cortadas = 0;
    for (let i = 0; i < 50; i++) {
      const r = await alModelo({ ...enorme, stream: true }, instalacion);
      if (r.status === 429) break;
      const lector = r.body!.getReader();
      await lector.read();
      await lector.cancel();
      cortadas++;
    }
    expect(cortadas).toBe(Math.floor(LIMITES.usdPorUsuario / 0.03));
    expect(enviados).toHaveLength(cortadas);
  });

  it('no deja pasar a la vez más peticiones de las que caben en el límite', async () => {
    const instalacion = randomUUID();
    respuesta = () =>
      Response.json({ choices: [], usage: { prompt_tokens: 1_000_000, completion_tokens: 0 } });
    const r = await Promise.all(Array.from({ length: 40 }, () => alModelo(enorme, instalacion)));
    const pasadas = r.filter((x) => x.status === 200).length;
    expect(pasadas).toBe(Math.floor(LIMITES.usdPorUsuario / 0.03));
    expect(r.filter((x) => x.status === 429)).toHaveLength(40 - pasadas);
  });

  it('corta también por IP, aunque se reinstale la app para tener otra instalación', async () => {
    respuesta = () =>
      Response.json({
        choices: [],
        usage: { prompt_tokens: tokens(LIMITES.usdPorUsuario), completion_tokens: 0 },
      });
    for (let i = 0; i < LIMITES.usdPorIp / LIMITES.usdPorUsuario; i++)
      expect((await alModelo(mensajes)).status).toBe(200);
    expect((await alModelo(mensajes)).status).toBe(429);
  });

  it('cuenta por IP toda una red IPv6 /64', async () => {
    respuesta = () =>
      Response.json({
        choices: [],
        usage: { prompt_tokens: tokens(LIMITES.usdPorUsuario), completion_tokens: 0 },
      });
    for (let i = 0; i < LIMITES.usdPorIp / LIMITES.usdPorUsuario; i++)
      expect(await desde(`2001:db8:1:2:${i + 1}::1`)).toBe(200);
    expect(await desde('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(429);
    expect(await desde('2001:db8:1:3::1')).toBe(200);
  });

  it('cuenta una IPv4 igual aunque llegue como IPv6', async () => {
    respuesta = () =>
      Response.json({
        choices: [],
        usage: { prompt_tokens: tokens(LIMITES.usdPorUsuario), completion_tokens: 0 },
      });
    for (let i = 0; i < LIMITES.usdPorIp / LIMITES.usdPorUsuario; i++)
      expect(await desde('192.0.2.1')).toBe(200);
    expect(await desde('::ffff:192.0.2.1')).toBe(429);
    expect(await desde('::ffff:c000:201')).toBe(429);
    expect(await desde('192.0.2.2')).toBe(200);
  });

  it('corta a todos al llegar al gasto del día de cada servicio, aunque cambien de IP', async () => {
    respuesta = () =>
      Response.json({
        choices: [],
        usage: { prompt_tokens: tokens(LIMITES.usdPorUsuario), completion_tokens: 0 },
      });
    for (let i = 0; i < LIMITES.usdEntreTodos.modelo / LIMITES.usdPorUsuario; i++)
      expect(await desde(`192.0.2.${i}`)).toBe(200);
    expect(await desde('198.51.100.1')).toBe(429);
    // Exa se paga aparte: el buscador tiene su propio tope.
    respuesta = () => Response.json({ results: [], costDollars: { total: LIMITES.usdPorUsuario } });
    for (let i = 0; i < LIMITES.usdEntreTodos.busqueda / LIMITES.usdPorUsuario; i++)
      expect(await desde(`198.51.100.${i}`, true)).toBe(200);
    expect(await desde('203.0.113.1', true)).toBe(429);
  });
});
