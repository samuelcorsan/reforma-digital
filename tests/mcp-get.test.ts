import { describe, expect, it, vi } from 'vitest';

// Los servidores guardan `fetch` al crearse, al importar las rutas: se sustituye antes.
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});
const { GET } = await import('../apps/web/app/mcp/[id]/[tool]/route');

const get = (id: string, tool: string, query = '') =>
  GET(new Request(`http://localhost/mcp/${id}/${tool}?${query}`), {
    params: Promise.resolve({ id, tool }),
  });

describe('GET /mcp/<servidor>/<herramienta> (para Instinct, sin MCP)', () => {
  it('llama a la herramienta con los números como número y el resto como texto', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        Fecha: '22/11/2026 10:00:00',
        ListaEESSPrecio: [
          { Rótulo: 'A', 'Precio Gasoleo A': '1,500' },
          { Rótulo: 'B', 'Precio Gasoleo A': '1,400' },
          { Rótulo: 'C', 'Precio Gasoleo A': '1,600' },
        ],
      }),
    );
    const response = await get(
      'carburantes',
      'gasolineras_baratas',
      'provincia=28&carburante=diesel&limite=2',
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/FiltroProvincia\/28$/),
      expect.anything(),
    );
    const text = await response.text();
    expect(text).toContain('"rotulo": "B"');
    expect(text).toContain('"rotulo": "A"');
    expect(text).not.toContain('"rotulo": "C"');
    expect(text).toContain('Fuente: Ministerio');
  });

  it('responde 422 con el motivo si los parámetros no valen', async () => {
    const response = await get('carburantes', 'gasolineras_baratas', 'carburante=agua');
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('carburante');
  });

  it('responde 422 con el motivo si la fuente falla, sin datos', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const response = await get(
      'carburantes',
      'gasolineras_baratas',
      'provincia=28&carburante=diesel',
    );
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('503');
  });

  it('responde 404 si no existe el servidor o la herramienta', async () => {
    expect((await get('carburantes', 'nope')).status).toBe(404);
    expect((await get('nope', 'buscar_municipio')).status).toBe(404);
  });
});
