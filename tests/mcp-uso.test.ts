import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contarUso } from '../apps/web/lib/mcp/uso';
import { createCarburantesMcp } from '../packages/mcp/src/carburantes';

/** El uso de los servidores MCP en PostHog: servidor, herramienta y resultado, sin argumentos. */
let enviados: { event: string; properties: Record<string, unknown> }[] = [];
let fuente: () => Response;
const mcp = createCarburantesMcp(async () => fuente());
// `after` solo existe dentro de una petición de Next: aquí se guarda la tarea y se ejecuta a mano.
const pendientes: (() => Promise<void>)[] = [];
const POST = contarUso(
  'carburantes',
  (request) => mcp.fetch(request),
  (tarea) => {
    pendientes.push(tarea);
  },
);

const rpc = async (method: string, params?: unknown) => {
  const response = await POST(
    new Request('http://localhost/mcp/carburantes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  await Promise.all(pendientes.splice(0).map((tarea) => tarea()));
  return response;
};
const llamar = () =>
  rpc('tools/call', {
    name: 'gasolineras_baratas',
    arguments: { provincia: '28', carburante: 'diesel', limite: 2 },
  });

beforeEach(() => {
  enviados = [];
  vi.stubEnv('POSTHOG_KEY', 'phc_prueba');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      enviados.push(await new Response(init.body).json());
      return new Response(null, { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('uso de los servidores MCP', () => {
  it('cuenta una llamada con el servidor, la herramienta y el resultado, sin los argumentos', async () => {
    fuente = () =>
      Response.json({
        Fecha: '22/11/2026 10:00:00',
        ListaEESSPrecio: [{ Rótulo: 'A', 'Precio Gasoleo A': '1,500' }],
      });
    expect((await llamar()).status).toBe(200);
    expect(enviados).toEqual([
      {
        api_key: 'phc_prueba',
        event: 'mcp_tool_call',
        distinct_id: expect.any(String),
        properties: {
          servidor: 'carburantes',
          herramienta: 'gasolineras_baratas',
          resultado: 'ok',
          duracionMs: expect.any(Number),
          $process_person_profile: false,
          $geoip_disable: true,
        },
      },
    ]);
  });

  it('cuenta como error una llamada con la fuente caída', async () => {
    fuente = () => new Response(null, { status: 503 });
    await llamar();
    expect(enviados.map((e) => e.properties.resultado)).toEqual(['error']);
  });

  it('no cuenta lo que no es una llamada a una herramienta', async () => {
    await rpc('tools/list');
    expect(enviados).toEqual([]);
  });

  it('no manda el nombre de una herramienta que no existe, que podría ser cualquier texto', async () => {
    await rpc('tools/call', { name: 'calle_mayor_tres_madrid', arguments: {} });
    expect(enviados).toEqual([]);
  });

  it('sin la clave de PostHog no envía nada', async () => {
    vi.stubEnv('POSTHOG_KEY', '');
    fuente = () => Response.json({ Fecha: '22/11/2026 10:00:00', ListaEESSPrecio: [] });
    await llamar();
    expect(enviados).toEqual([]);
  });
});
