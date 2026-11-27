// @vitest-environment node
// Ayuntamientos sin red: respuestas con la forma de la API de Ayuntamientos Transparentes.
import { describe, expect, it, vi } from 'vitest';
import { createMunicipiosMcp } from './municipios';

const fetchJson = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));

// Una llamada a una herramienta por el handler MCP, como la hace un asistente.
async function llamar(
  server: ReturnType<typeof createMunicipiosMcp>,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await server.fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  const text = await response.text();
  const body = JSON.parse(/^data: (.*)$/m.exec(text)?.[1] ?? text) as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  return body.result;
}

describe('Ayuntamientos', () => {
  it('asks for the sections in a fixed order and answers a repeated question without asking again', async () => {
    const fetchImpl = fetchJson({ ine: '17079', nombre: 'Girona', fuente: 'Fuente: …' });
    const server = createMunicipiosMcp(fetchImpl);
    await llamar(server, 'ver_municipio', { ine: '17079', secciones: 'sueldos,contratos' });
    await llamar(server, 'ver_municipio', {
      ine: '17079',
      secciones: 'contratos,sueldos,contratos',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://ayuntamientostransparentes.es/api/v1/municipio/17079?secciones=contratos%2Csueldos',
    );
  });

  it('gives the assistant the reason the API gives, and refuses unknown sections before asking', async () => {
    const noExiste = await llamar(
      createMunicipiosMcp(
        fetchJson({ error: 'no hay ningún municipio con el código INE 99999' }, 404),
      ),
      'ver_municipio',
      { ine: '99999' },
    );
    expect(noExiste).toMatchObject({
      isError: true,
      content: [{ text: 'no hay ningún municipio con el código INE 99999' }],
    });
    const fetchImpl = fetchJson({});
    const mala = await llamar(createMunicipiosMcp(fetchImpl), 'ver_municipio', {
      ine: '17079',
      secciones: 'cuentas,fiestas',
    });
    expect(mala.isError).toBe(true);
    expect(mala.content[0]?.text).toContain('Secciones desconocidas: fiestas');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats a reply without the expected shape as a source failure and asks again next time', async () => {
    const fetchImpl = fetchJson(null);
    const server = createMunicipiosMcp(fetchImpl);
    const r = await llamar(server, 'buscar_municipio', { nombre: 'girona' });
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toContain('no se puede leer');
    await llamar(server, 'buscar_municipio', { nombre: 'girona' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('leaves the attribution to the end of the answer instead of repeating it in the data', async () => {
    const r = await llamar(
      createMunicipiosMcp(
        fetchJson({ municipios: [{ ine: '17079', nombre: 'Girona' }], fuente: 'Fuente: repetida' }),
      ),
      'buscar_municipio',
      { nombre: 'girona' },
    );
    expect(r.content[0]?.text).not.toContain('repetida');
    expect(r.content[1]?.text).toMatch(/^Fuente: Ayuntamientos Transparentes/);
  });
});
