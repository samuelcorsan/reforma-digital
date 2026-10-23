import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../apps/web/app/api/eventos/route';

/** Las estadísticas de uso: solo pasan a PostHog los eventos de la lista, sin persona ni GeoIP. */
const enviar = (cuerpo: unknown) =>
  POST(
    new Request('https://reforma-digital.es/api/eventos', {
      method: 'POST',
      body: JSON.stringify(cuerpo),
    }),
  );
const sesion = randomUUID();
let enviados: Record<string, unknown>[] = [];

beforeEach(() => {
  enviados = [];
  vi.stubEnv('POSTHOG_KEY', 'phc_prueba');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      enviados.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('api/eventos', () => {
  it('pasa una página vista con su ruta, sin perfil de persona ni GeoIP', async () => {
    const r = await enviar({ evento: '$pageview', sesion, ruta: '/congreso' });
    expect(r.status).toBe(204);
    expect(enviados).toEqual([
      {
        api_key: 'phc_prueba',
        event: '$pageview',
        distinct_id: sesion,
        properties: expect.objectContaining({
          $pathname: '/congreso',
          $process_person_profile: false,
          $geoip_disable: true,
        }),
      },
    ]);
  });

  it('pasa una acción de la app con sus datos cerrados', async () => {
    const accion = {
      evento: 'tramite_creado',
      sesion,
      version: '0.1.0',
      plataforma: 'darwin',
      proveedor: 'app',
    };
    expect((await enviar(accion)).status).toBe(204);
    expect(enviados[0]?.properties).toMatchObject({
      version: '0.1.0',
      plataforma: 'darwin',
      proveedor: 'app',
    });
  });

  it('rechaza eventos que no están en la lista, campos de más y rutas con query', async () => {
    for (const cuerpo of [
      { evento: 'identificar', sesion },
      { evento: '$pageview', sesion, ruta: '/congreso', texto: 'Mi DNI es 12345678Z' },
      { evento: '$pageview', sesion, ruta: '/buscar?q=12345678Z' },
      { evento: '$pageview', sesion: 'persona@example.com', ruta: '/' },
    ])
      expect((await enviar(cuerpo)).status).toBe(400);
    expect(enviados).toEqual([]);
  });

  it('sin la clave de PostHog no envía nada', async () => {
    vi.stubEnv('POSTHOG_KEY', '');
    expect((await enviar({ evento: '$pageview', sesion, ruta: '/' })).status).toBe(204);
    expect(enviados).toEqual([]);
  });
});
