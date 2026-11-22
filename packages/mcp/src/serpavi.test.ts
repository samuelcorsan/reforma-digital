// @vitest-environment node
// SERPAVI sin red. fixtures/vdp001-recorte.csv son líneas literales del CSV oficial VDP001
// (descarga del 22/11/2026, Last-Modified 22/05/2026), con su BOM, CRLF y la última línea sin
// salto: todo 2024 de Madrid, Móstoles, El Molar (Madrid y Tarragona), L'Hospitalet y Donostia, y
// la vivienda colectiva de Madrid en 2023.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSerpaviMcp } from './serpavi';

const csv = readFileSync(new URL('../fixtures/vdp001-recorte.csv', import.meta.url), 'utf8');
const PUBLICADO = 'Fri, 22 May 2026 09:06:11 GMT';
const ORIGEN = 'Origen de los datos: Ministerio de Vivienda y Agenda Urbana';

const fuente = () =>
  vi.fn<typeof fetch>(async () => new Response(csv, { headers: { 'last-modified': PUBLICADO } }));

async function llamar(
  mcp: ReturnType<typeof createSerpaviMcp>,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await mcp.fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
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
  const { result } = JSON.parse(/^data: (.*)$/m.exec(text)?.[1] ?? text) as {
    result: { content: { text: string }[]; isError?: boolean };
  };
  return {
    isError: result.isError === true,
    texto: result.content.map((c) => c.text).join('\n'),
    datos: () => JSON.parse(result.content[0]?.text ?? '') as Record<string, unknown>,
  };
}

describe('SERPAVI', () => {
  it('gives the monthly rent, the area and a derived €/m², with the source and its date', async () => {
    const r = await llamar(createSerpaviMcp(fuente()), 'alquiler_municipio', {
      codigo: '28079',
      tipo_vivienda: 'colectiva',
    });
    expect(r.datos()).toEqual({
      municipio: 'Madrid',
      codigo: '28079',
      provincia: 'Madrid',
      anio: 2024,
      colectiva: {
        renta_eur_mes: { mediana: 868.8, percentil25: 700, percentil75: 1166.2 },
        superficie_m2: { mediana: 66, percentil25: 52, percentil75: 84 },
        eur_m2_derivado: 13.16,
        viviendas: 300447,
      },
      csv_actualizado: PUBLICADO,
    });
    expect(r.texto).toContain(ORIGEN);
  });

  it('says when a town only has a count of homes, without estimating a rent', async () => {
    const r = await llamar(createSerpaviMcp(fuente()), 'alquiler_municipio', { codigo: '43085' });
    expect(r.datos()).toMatchObject({
      municipio: 'Molar, El',
      colectiva: { viviendas: 3, nota: expect.stringContaining('Solo hay recuento') },
    });
    expect(r.texto).not.toContain('renta_eur_mes');
    expect(r.texto).not.toContain('eur_m2_derivado');
  });

  it('finds towns by their INE name, the usual one or either language', async () => {
    const mcp = createSerpaviMcp(fuente());
    const codigos = async (args: Record<string, unknown>) =>
      (
        (await llamar(mcp, 'buscar_municipio', args)).datos().municipios as { codigo: string }[]
      ).map((m) => m.codigo);
    expect(await codigos({ nombre: 'L’Hospitalet' })).toEqual(['08101']);
    expect(await codigos({ nombre: 'san sebastian' })).toEqual(['20069']);
    expect(await codigos({ nombre: 'El Molar' })).toEqual(['28086', '43085']);
    expect(await codigos({ nombre: 'El Molar', provincia: 'Madrid' })).toEqual(['28086']);
    const narnia = await llamar(mcp, 'buscar_municipio', { nombre: 'molar', provincia: 'Narnia' });
    expect(narnia).toMatchObject({ isError: true });
    expect(narnia.texto).toContain('No hay ninguna provincia');
  });

  it('ranks a province by rent or derived €/m², only with towns that have a rent', async () => {
    const mcp = createSerpaviMcp(fuente());
    const ranking = async (orden: string) =>
      (await llamar(mcp, 'ranking_provincia', { provincia: '28', orden })).datos();
    expect(await ranking('renta')).toMatchObject({
      anio: 2024,
      con_dato: 3,
      ranking: [
        { codigo: '28079', renta_eur_mes: { mediana: 868.8 } },
        { codigo: '28092', renta_eur_mes: { mediana: 700 } },
        { codigo: '28086', renta_eur_mes: { mediana: 570 } },
      ],
    });
    expect(
      ((await ranking('eur_m2')).ranking as { eur_m2_derivado: number }[]).map(
        (p) => p.eur_m2_derivado,
      ),
    ).toEqual([13.16, 9.09, 7.7]);
  });

  it('says a year has no rents in the province instead of giving an empty ranking', async () => {
    const r = await llamar(createSerpaviMcp(fuente()), 'ranking_provincia', {
      provincia: 'Madrid',
      anio: 2020,
    });
    expect(r).toMatchObject({ isError: true });
    expect(r.texto).toContain('Años con renta: 2023, 2024');
  });

  it('compares towns in the last year they all have', async () => {
    const r = await llamar(createSerpaviMcp(fuente()), 'comparar_municipios', {
      codigos: '28079,28092',
      tipo_vivienda: 'colectiva',
    });
    expect(r.datos()).toMatchObject({
      anio: 2024,
      municipios: [
        { codigo: '28079', colectiva: { renta_eur_mes: { mediana: 868.8 } } },
        { codigo: '28092', colectiva: { renta_eur_mes: { mediana: 700 } } },
      ],
    });
  });

  it('downloads the CSV once and then only asks whether it changed', async () => {
    const fetchImpl = fuente().mockResolvedValueOnce(
      new Response(csv, { headers: { 'last-modified': PUBLICADO } }),
    );
    fetchImpl.mockResolvedValue(new Response(null, { status: 304 }));
    const mcp = createSerpaviMcp(fetchImpl);
    await llamar(mcp, 'alquiler_municipio', { codigo: '28079' });
    const r = await llamar(mcp, 'alquiler_municipio', { codigo: '28079', anio: 2023 });
    expect(r.datos()).toMatchObject({ anio: 2023, csv_actualizado: PUBLICADO });
    expect(r.datos().aviso).toBeUndefined();
    const segunda = fetchImpl.mock.calls[1]?.[1];
    expect(new Headers(segunda?.headers).get('if-modified-since')).toBe(PUBLICADO);
  });

  it('serves the earlier copy with a warning if the source fails, and an error without one', async () => {
    const caida = vi.fn<typeof fetch>(async () => new Response('', { status: 503 }));
    const sinCopia = await llamar(createSerpaviMcp(caida), 'alquiler_municipio', {
      codigo: '28079',
    });
    expect(sinCopia).toMatchObject({ isError: true });
    expect(sinCopia.texto).toContain('503');

    const fetchImpl = fuente();
    const mcp = createSerpaviMcp(fetchImpl);
    await llamar(mcp, 'alquiler_municipio', { codigo: '28079' });
    fetchImpl.mockImplementation(caida);
    const r = await llamar(mcp, 'alquiler_municipio', { codigo: '28079' });
    expect(r.datos().aviso).toContain('No se ha podido comprobar');
    expect(r.datos().aviso).toContain(PUBLICADO);
    expect(r.datos()).toMatchObject({ colectiva: { renta_eur_mes: { mediana: 868.8 } } });
  });

  it('reads the CSV as it arrives, whatever the pieces cut', async () => {
    const bytes = new TextEncoder().encode(csv);
    // La posición en bytes donde empieza `texto` en el fixture.
    const en = (texto: string) => new TextEncoder().encode(csv.slice(0, csv.indexOf(texto))).length;
    const cortes = [
      1, // el BOM (3 bytes) partido en tres
      2,
      bytes.indexOf(13) + 1, // el \r de la cabecera en un trozo y su \n en el siguiente
      en('Móstoles') + 2, // a mitad de la «ó», que son 2 bytes
      en(';SUPERFICIE;UNIFAMILIAR;') + 5, // a mitad de una línea
      en('RECUENTO;2023;291225') + 12, // la última línea, sin salto, en dos trozos
    ].sort((a, b) => a - b);
    const enTrozos = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              for (const [i, hasta] of [...cortes, bytes.length].entries())
                controller.enqueue(bytes.slice(cortes[i - 1] ?? 0, hasta));
              controller.close();
            },
          }),
          { headers: { 'last-modified': PUBLICADO } },
        ),
    );
    const troceado = createSerpaviMcp(enTrozos);
    const entero = createSerpaviMcp(fuente());
    for (const [name, args] of [
      ['alquiler_municipio', { codigo: '28079' }],
      ['alquiler_municipio', { codigo: '28092' }],
      ['buscar_municipio', { nombre: 'mostoles' }],
      ['ranking_provincia', { provincia: 'Madrid' }],
    ] as const)
      expect((await llamar(troceado, name, args)).datos()).toEqual(
        (await llamar(entero, name, args)).datos(),
      );
    expect(
      (await llamar(troceado, 'alquiler_municipio', { codigo: '28079', anio: 2023 })).datos(),
    ).toMatchObject({ colectiva: { viviendas: 291225 } });
  });

  it('refuses a CSV whose format changed instead of reading it wrong', async () => {
    const cambiado = vi.fn<typeof fetch>(
      async () => new Response(csv.replace('TIPO_MEDIDA', 'MEDIDA')),
    );
    const r = await llamar(createSerpaviMcp(cambiado), 'alquiler_municipio', { codigo: '28079' });
    expect(r).toMatchObject({ isError: true });
    expect(r.texto).toContain('ha cambiado de formato');
  });
});
