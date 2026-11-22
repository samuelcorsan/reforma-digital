// @vitest-environment node
// BOE, Carburantes e INE sin red: respuestas con la forma de cada API (recortadas de las reales)
// para lo que se puede romper al leerlas.
import { describe, expect, it, vi } from 'vitest';
import { buscarLegislacion, sumario, textoBloque } from './boe';
import { buscarMunicipio, gasolinerasBaratas } from './carburantes';
import { run, SourceError } from './comun';
import { buscarTabla as buscarTablaEustat, datosTabla as datosTablaEustat } from './eustat';
import { buscarTabla, datosTabla } from './ine';

const fetchJson = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));

describe('BOE', () => {
  it('flattens the summary, whether items come as one object or a list', async () => {
    const fetchImpl = fetchJson({
      data: {
        sumario: {
          diario: [
            {
              numero: '289',
              seccion: [
                {
                  codigo: '1',
                  nombre: 'I. Disposiciones generales',
                  departamento: {
                    nombre: 'CORTES GENERALES',
                    epigrafe: [
                      {
                        nombre: 'Medidas urgentes',
                        item: { identificador: 'A1', titulo: 'Real Decreto sobre Vivienda' },
                      },
                    ],
                  },
                },
                {
                  codigo: '3',
                  nombre: 'III. Otras disposiciones',
                  departamento: [
                    {
                      nombre: 'HACIENDA',
                      item: [{ identificador: 'A2', titulo: 'Orden de becas' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    const all = await sumario(fetchImpl, '2026-11-20');
    expect(all.disposiciones.map((d) => (d as { id: string }).id)).toEqual(['A1', 'A2']);
    const filtered = await sumario(fetchImpl, '2026-11-20', '1', 'vivienda');
    expect(filtered.disposiciones).toMatchObject([{ id: 'A1', epigrafe: 'Medidas urgentes' }]);
  });

  it('says there is no BOE on days without one', async () => {
    const result = await sumario(fetchJson({}, 404), '2026-11-22');
    expect(result).toMatchObject({ disposiciones: [], nota: 'No hay BOE ese día.' });
  });

  it('escapes the search syntax so a title search cannot break the query', async () => {
    const fetchImpl = fetchJson({ data: [] });
    await buscarLegislacion(fetchImpl, 'ley (orgánica)', 1, 5);
    const pedido = fetchImpl.mock.calls[0]?.[0];
    const url = new URL(pedido instanceof Request ? pedido.url : (pedido ?? ''));
    expect(JSON.parse(url.searchParams.get('query') ?? '')).toEqual({
      query: { query_string: { query: 'titulo:ley AND titulo:\\(orgánica\\)' } },
    });
  });

  it('reads the latest version of a block as plain text', () => {
    const xml = `<bloque><version fecha_vigencia="20230526"><p>Antiguo</p></version>
      <version fecha_vigencia="20261007"><p class="articulo">Artículo 3.</p><p>Más de 1.500 m&#178; &amp; <em>trasteros</em></p></version></bloque>`;
    expect(textoBloque(xml)).toEqual({
      vigente_desde: '2026-10-07',
      texto: 'Artículo 3.\nMás de 1.500 m² & trasteros',
    });
  });
});

it('sorts stations by price and leaves out those without the fuel', async () => {
  const station = (direccion: string, precio: string) => ({
    Dirección: direccion,
    'Precio Gasoleo A': precio,
    Latitud: '40,4',
    'Longitud (WGS84)': '-3,7',
  });
  const result = await gasolinerasBaratas(
    fetchJson({
      Fecha: 'hoy',
      ListaEESSPrecio: [station('B', '1,649'), station('C', ''), station('A', '1,579')],
    }),
    { municipio: '4354' },
    'diesel',
    10,
  );
  expect(result.gasolineras.map((g) => [g.direccion, g.precio])).toEqual([
    ['A', 1.579],
    ['B', 1.649],
  ]);
  expect(result.gasolineras[0]?.latitud).toBe(40.4);
});

it('finds towns by their usual name when the source puts the article last', async () => {
  const municipio = (IDMunicipio: string, Municipio: string) => ({
    IDMunicipio,
    Municipio,
    Provincia: 'P',
    CCAA: 'C',
  });
  const fetchImpl = fetchJson([
    municipio('1', 'Coruña (A)'),
    municipio('2', "Hospitalet de Llobregat (L')"),
  ]);
  expect(await buscarMunicipio(fetchImpl, 'A Coruña')).toMatchObject([
    { id: '1', municipio: 'Coruña (A)' },
  ]);
  expect(await buscarMunicipio(fetchImpl, 'l’hospitalet')).toMatchObject([{ id: '2' }]);
  // El nombre que devuelve la herramienta también sirve para buscar.
  expect(await buscarMunicipio(fetchImpl, 'Coruña (A)')).toMatchObject([{ id: '1' }]);
});

it('filters INE series without accents and names each period, newest first', async () => {
  const result = await datosTabla(
    fetchJson([
      {
        COD: 'IPC1',
        Nombre: 'Nacional. Índice general. Variación anual. ',
        Data: [
          { Fecha: '2026-09-01T00:00:00.000+02:00', Anyo: 2026, T3_Periodo: 'M09', Valor: 4.9 },
          { Fecha: '2026-10-01T00:00:00.000+02:00', Anyo: 2026, T3_Periodo: 'M10', Valor: 4.9 },
        ],
      },
      {
        COD: 'EPA1',
        Nombre: 'Tasa de paro. Variación anual. ',
        Data: [
          { Fecha: '2025-01-01T00:00:00.000+01:00', Anyo: 2025, T3_Periodo: 'A', Valor: 10.5 },
        ],
      },
      {
        COD: 'ECP1',
        Nombre: 'Población. Variación anual. ',
        Data: [
          {
            Fecha: '2026-10-01T00:00:00.000+02:00',
            Anyo: 2026,
            T3_Periodo: '1 de octubre de',
            Valor: 49935642,
          },
        ],
      },
      { COD: 'IPC2', Nombre: 'Nacional. Índice general. Índice. ', Data: [] },
    ]),
    76134,
    2,
    'variacion ANUAL',
  );
  expect(result.series).toEqual([
    {
      codigo: 'IPC1',
      nombre: 'Nacional. Índice general. Variación anual.',
      datos: [
        { periodo: '2026M10', valor: 4.9 },
        { periodo: '2026M09', valor: 4.9 },
      ],
    },
    {
      codigo: 'EPA1',
      nombre: 'Tasa de paro. Variación anual.',
      datos: [{ periodo: '2025', valor: 10.5 }],
    },
    {
      codigo: 'ECP1',
      nombre: 'Población. Variación anual.',
      datos: [{ periodo: '1 de octubre de 2026', valor: 49935642 }],
    },
  ]);
});

it('asks the INE for the tables of an operation once, and again after a failure', async () => {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}, { status: 500 }))
    .mockImplementation(async () =>
      Response.json([{ Id: 1, Nombre: 'Tasas de paro', T3_Periodicidad: 'Trimestral' }]),
    );
  await expect(buscarTabla(fetchImpl, 'PRUEBA')).rejects.toThrow(SourceError);
  await buscarTabla(fetchImpl, 'prueba');
  expect(await buscarTabla(fetchImpl, 'PRUEBA', 'paro')).toMatchObject({
    tablas: [{ id: 1, periodicidad: 'Trimestral' }],
  });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

describe('Eustat', () => {
  const ipc = {
    title: 'IPC por territorio histórico, índice y mes',
    variables: [
      {
        code: 'territorio histórico',
        text: 'territorio histórico',
        values: ['00', '20'],
        valueTexts: ['C.A. de Euskadi', 'Gipuzkoa'],
      },
      {
        code: 'índice',
        text: 'índice',
        values: ['10', '30'],
        valueTexts: ['Índice', 'Tasa de variación interanual'],
      },
      {
        code: 'periodo',
        text: 'periodo',
        values: ['202609', '202610'],
        valueTexts: ['2026-09', '2026-10'],
        time: true,
      },
    ],
  };

  it('puts the most recently updated tables first and matches without accents', async () => {
    const fetchImpl = fetchJson([
      {
        id: 'PX_viejo.px',
        text: 'Índice de precios (IPC). Base 2016',
        updated: '2021-02-16T11:15:00',
      },
      { id: 'PX_nuevo.px', text: 'Índice de precios (IPC)', updated: '2026-11-13T09:20:29' },
      { id: 'PX_paro.px', text: 'Paro registrado', updated: '2026-11-20T09:00:00' },
    ]);
    expect(await buscarTablaEustat(fetchImpl, 'indice IPC')).toEqual({
      total: 2,
      tablas: [
        { id: 'PX_nuevo.px', nombre: 'Índice de precios (IPC)', actualizada: '2026-11-13' },
        {
          id: 'PX_viejo.px',
          nombre: 'Índice de precios (IPC). Base 2016',
          actualizada: '2021-02-16',
        },
      ],
    });
  });

  it('asks only for the filtered values and the last periods, newest first', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(ipc))
      .mockResolvedValueOnce(
        Response.json({
          label: 'IPC',
          id: ['ContentsCode', 'territorio histórico', 'índice', 'periodo'],
          size: [1, 2, 1, 2],
          value: [4.6, 4.8, 4.7, null],
          role: { time: ['periodo'], metric: ['ContentsCode'] },
          dimension: {
            ContentsCode: { category: { index: { V: 0 }, label: { V: 'IPC' } } },
            'territorio histórico': {
              category: {
                index: { '00': 0, '20': 1 },
                label: { '00': 'C.A. de Euskadi', '20': 'Gipuzkoa' },
              },
            },
            índice: {
              category: { index: { '30': 0 }, label: { '30': 'Tasa de variación interanual' } },
            },
            periodo: {
              category: {
                index: { '202609': 0, '202610': 1 },
                label: { '202609': '2026-09', '202610': '2026-10' },
              },
            },
          },
        }),
      );
    const result = await datosTablaEustat(fetchImpl, 'PX_ipc.px', 2, { Indice: 'INTERANUAL' });
    const body = JSON.stringify({
      query: [
        { code: 'territorio histórico', selection: { filter: 'item', values: ['00', '20'] } },
        { code: 'índice', selection: { filter: 'item', values: ['30'] } },
        { code: 'periodo', selection: { filter: 'top', values: ['2'] } },
      ],
      response: { format: 'json-stat2' },
    });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://www.eustat.eus/bankupx/api/v1/es/DB/PX_ipc.px',
      expect.objectContaining({ method: 'POST', body }),
    );
    expect(result.series).toEqual([
      {
        nombre: 'C.A. de Euskadi · Tasa de variación interanual',
        datos: [
          { periodo: '2026-10', valor: 4.8 },
          { periodo: '2026-09', valor: 4.6 },
        ],
      },
      {
        nombre: 'Gipuzkoa · Tasa de variación interanual',
        datos: [
          { periodo: '2026-10', valor: null },
          { periodo: '2026-09', valor: 4.7 },
        ],
      },
    ]);
  });

  it('takes only the value that matches the whole filter when there is one', async () => {
    const procedencia = {
      code: 'procedencia',
      text: 'procedencia',
      values: ['T', 'E', 'X'],
      valueTexts: ['TOTAL', '-TOTAL ESTADO', '-TOTAL EXTRANJERO'],
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ title: 'Turismo', variables: [procedencia] }))
      .mockResolvedValueOnce(
        Response.json({ label: 'Turismo', id: [], size: [], value: [], role: {}, dimension: {} }),
      );
    await datosTablaEustat(fetchImpl, 'PX_turismo.px', 1, { procedencia: 'total' });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          query: [{ code: 'procedencia', selection: { filter: 'item', values: ['T'] } }],
          response: { format: 'json-stat2' },
        }),
      }),
    );
  });

  it('refuses unknown variables, empty or period filters and oversized queries before asking for data', async () => {
    const meses = Array.from({ length: 300 }, (_, i) => String(i));
    const largo = {
      ...ipc,
      variables: [
        ...ipc.variables.slice(0, 2),
        { code: 'periodo', text: 'periodo', values: meses, valueTexts: meses, time: true },
      ],
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(largo));
    await expect(
      datosTablaEustat(fetchImpl, 'PX_ipc.px', 1, { municipio: 'Irun' }),
    ).rejects.toThrow('La tabla no tiene la variable «municipio»');
    await expect(
      datosTablaEustat(fetchImpl, 'PX_ipc.px', 1, { índice: 'mensual' }),
    ).rejects.toThrow('Ningún valor de «índice»');
    // Un año pedido por filtro daría el último periodo como si fuera ese año.
    await expect(datosTablaEustat(fetchImpl, 'PX_ipc.px', 1, { periodo: '2024' })).rejects.toThrow(
      '«periodo» no se filtra',
    );
    // 2 territorios × 2 índices × 300 meses.
    await expect(datosTablaEustat(fetchImpl, 'PX_ipc.px', 300)).rejects.toThrow('pide 1200 datos');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});

it('only tells the assistant the reason of source errors', async () => {
  const fromSource = await run('fuente', async () => {
    throw new SourceError('La fuente respondió 503.');
  });
  expect(fromSource).toMatchObject({
    isError: true,
    content: [{ text: 'La fuente respondió 503.' }],
  });
  const internal = await run('fuente', async () => {
    throw new Error('https://interno/?token=secreto');
  });
  expect(JSON.stringify(internal)).not.toContain('secreto');
});
