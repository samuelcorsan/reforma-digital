// @vitest-environment node
// BOE, Carburantes, INE, Eustat y Red Eléctrica sin red: respuestas con la forma de cada API (recortadas de las reales)
// para lo que se puede romper al leerlas.
import { describe, expect, it, vi } from 'vitest';
import {
  buscarLegislacion,
  createBoeMcp,
  indiceNorma,
  sumario,
  textoBloque,
  verBloque,
} from './boe';
import { buscarMunicipio, gasolinerasBaratas } from './carburantes';
import { run, SourceError } from './comun';
import { buscarTabla as buscarTablaEustat, datosTabla as datosTablaEustat } from './eustat';
import { avisoInterrumpida, buscarTabla, datosSerie, datosTabla } from './ine';
import { generacion, precioLuz, precioLuzPeriodo } from './red-electrica';

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

  it('gives an empty list when the search finds nothing', async () => {
    // Así responde la API real a `titulo:"norma foral"`.
    const fetchImpl = fetchJson({ status: { code: '200', text: 'ok' }, data: '' });
    expect(await buscarLegislacion(fetchImpl, 'norma foral', 1, 10)).toEqual({
      pagina: 1,
      resultados: [],
    });
  });

  it('accepts the ids of consolidated regional norms, as search returns them', async () => {
    const fetchImpl = fetchJson({
      data: [{ titulo: 'Decreto Foral Legislativo 4/2008', url_html_consolidada: 'https://boe' }],
    });
    const response = await createBoeMcp(fetchImpl).fetch(
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
          params: { name: 'indice_norma', arguments: { id: 'BON-n-2008-90013' } },
        }),
      }),
    );
    expect(await response.text()).toContain('Decreto Foral Legislativo 4/2008');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/id/BON-n-2008-90013/metadatos'),
      expect.anything(),
    );
  });

  it('tells a norm that is not consolidated from a block the norm does not have', async () => {
    // La API responde igual, 404 con este XML, si falta la norma o si falta el bloque.
    const missing = `<response><status><code>404</code><text>La información solicitada no existe</text></status><data/></response>`;
    const api = (existing: string) =>
      vi.fn<typeof fetch>(async (url) =>
        (url instanceof Request ? url.url : url.toString()).includes(`/id/${existing}/metadatos`)
          ? Response.json({ data: [{ titulo: 'Ley', url_html_consolidada: 'https://boe' }] })
          : new Response(missing, { status: 404 }),
      );
    const noNorm = /BOE-A-2004-21950 no está en la legislación consolidada.*buscar_legislacion/;
    await expect(verBloque(api('BOE-A-2015-11430'), 'BOE-A-2004-21950', 'a1')).rejects.toThrow(
      noNorm,
    );
    await expect(indiceNorma(api('BOE-A-2015-11430'), 'BOE-A-2004-21950')).rejects.toThrow(noNorm);
    await expect(verBloque(api('BOE-A-2015-11430'), 'BOE-A-2015-11430', 'a999')).rejects.toThrow(
      'La norma BOE-A-2015-11430 no tiene el bloque a999. Consulta los ids de sus bloques con indice_norma.',
    );
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

it('warns when the publication of a series has moved on without it', () => {
  const meta = {
    Operacion: { Codigo: 'IPC' },
    Publicacion: { Id: 8, Nombre: 'Índice de Precios de Consumo' },
    Clasificacion: { Nombre: 'Base 2021 (IPC)' },
  };
  const ultimo = (Anyo: number, T3_Periodo: string) => ({
    COD: 'S',
    Nombre: 'Nacional. Índice general. Variación anual. ',
    Data: [{ Fecha: `${Anyo}-01-01T00:00:00.000+01:00`, Anyo, T3_Periodo, Valor: 2.9 }],
  });
  const salio = (Fecha: string, Anyo: number, T3_Periodo: string) => ({
    Fecha: `${Fecha}T09:00:00.000+01:00`,
    Anyo,
    T3_Periodo,
  });
  const calendario = [
    salio('2026-01-30', 2026, 'M01'), // avance
    salio('2026-02-13', 2026, 'M01'),
    salio('2026-02-18', 2020, 'M06'), // republicación de un periodo antiguo
    salio('2026-11-13', 2026, 'M10'),
    salio('2099-12-15', 2099, 'M11'), // prevista, aún no ha salido
    salio('2026-02-25', 2025, 'A'),
    salio('2024-06-24', 2074, 'A'), // proyecciones: se apuntan con su año final
    salio('2026-06-17', 2076, 'A'),
  ];
  expect(avisoInterrumpida(ultimo(2025, 'M12'), meta, calendario)).toBe(
    'Esta serie (Base 2021 (IPC)) acaba en 2025M12, pero el INE ya ha publicado «Índice de Precios de Consumo» con 2 periodos posteriores, hasta 2026M10. Probablemente esté interrumpida (por ejemplo, por un cambio de base) y su último dato no sea el más reciente. Si hay una serie que la sustituye, búscala con buscar_tabla en la operación IPC.',
  );
  const { Clasificacion: _, ...sinClasificacion } = meta;
  expect(avisoInterrumpida(ultimo(2025, 'M12'), sinClasificacion, calendario)).toMatch(
    /^Esta serie acaba en 2025M12,/,
  );
  // Al día, o un solo periodo por detrás (como cuando ha salido el avance y aún no el dato): sin aviso.
  expect(avisoInterrumpida(ultimo(2026, 'M10'), meta, calendario)).toBeUndefined();
  expect(avisoInterrumpida(ultimo(2026, 'M09'), meta, calendario)).toBeUndefined();
  // Un año se compara con los años publicados (2025, en 2026), no con los meses ni con el año final
  // de unas proyecciones.
  expect(avisoInterrumpida(ultimo(2025, 'A'), meta, calendario)).toBeUndefined();
  // Los datos de un día, como los de la ECP, no se comparan.
  expect(avisoInterrumpida(ultimo(2025, '1 de octubre de'), meta, calendario)).toBeUndefined();
});

it('gives the warning with the data of the series, and the data error for an unknown code', async () => {
  const api = (datos: Response, meta = 200) =>
    vi.fn<typeof fetch>(async (url) => {
      const path = url instanceof Request ? url.url : url.toString();
      if (path.includes('/DATOS_SERIE/')) return datos;
      if (path.includes('/SERIE/'))
        return Response.json(
          {
            Operacion: { Codigo: 'IPC' },
            Publicacion: { Id: 8, Nombre: 'Índice de Precios de Consumo' },
          },
          { status: meta },
        );
      expect(path).toContain('/PUBLICACIONFECHA_PUBLICACION/8?');
      return Response.json([
        { Fecha: '2026-10-14T09:00:00.000+02:00', Anyo: 2026, T3_Periodo: 'M09' },
        { Fecha: '2026-11-13T09:00:00.000+01:00', Anyo: 2026, T3_Periodo: 'M10' },
      ]);
    });
  const viejo = () =>
    Response.json({
      COD: 'IPC251856',
      Nombre: 'Nacional. Índice general. Variación anual. ',
      Data: [{ Fecha: '2025-12-01T00:00:00.000+01:00', Anyo: 2025, T3_Periodo: 'M12', Valor: 2.9 }],
    });
  expect(await datosSerie(api(viejo()), 'IPC251856', 1)).toMatchObject({
    aviso: expect.stringContaining('acaba en 2025M12'),
    datos: [{ periodo: '2025M12', valor: 2.9 }],
  });
  // Si la comprobación falla, los datos salen con un aviso de que no se ha podido hacer.
  expect(await datosSerie(api(viejo(), 503), 'IPC251856', 1)).toMatchObject({
    aviso: expect.stringContaining('No se ha podido comprobar'),
    datos: [{ periodo: '2025M12', valor: 2.9 }],
  });
  const calendarioVacio = vi.fn<typeof fetch>(async (url) => {
    const path = url instanceof Request ? url.url : url.toString();
    if (path.includes('/DATOS_SERIE/')) return viejo();
    if (path.includes('/SERIE/'))
      return Response.json({ Operacion: { Codigo: 'IPC' }, Publicacion: { Id: 8, Nombre: 'IPC' } });
    return new Response('');
  });
  expect(await datosSerie(calendarioVacio, 'IPC251856', 1)).toMatchObject({
    aviso: expect.stringContaining('No se ha podido comprobar'),
  });
  // El INE responde 500 a DATOS_SERIE y 200 sin cuerpo a SERIE.
  const desconocida = vi.fn<typeof fetch>(async (url) =>
    (url instanceof Request ? url.url : url.toString()).includes('/DATOS_SERIE/')
      ? Response.json({}, { status: 500 })
      : new Response(''),
  );
  await expect(datosSerie(desconocida, 'NOEXISTE1', 1)).rejects.toThrow('La fuente respondió 500.');
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

describe('Red Eléctrica', () => {
  // PVPC real del 25 de octubre de 2026, el día de 25 horas: la 02:00 sale dos veces.
  const pvpcDst = [
    ['00:00+02:00', 261.99],
    ['01:00+02:00', 233.96],
    ['02:00+02:00', 226.3],
    ['02:00+01:00', 212.01],
    ...[
      190.29, 177.63, 187.3, 213.09, 232.58, 118.97, 44.08, 42.76, 41.66, 41.38, 42.14, 42.86,
      46.32, 54.49, 187.66, 309.45, 332.48, 346.83, 332.4, 325.84, 314.04,
    ].map((v, i) => [`${String(i + 3).padStart(2, '0')}:00+01:00`, v] as const),
  ] as const;
  const at = (dia: string, hora: string) =>
    `${dia}T${hora.slice(0, 5)}:00.000${hora.slice(5) || '+01:00'}`;
  const serie = (
    id: string,
    title: string,
    values: { value: number; datetime: string }[],
    type = title,
  ) => ({
    id,
    type: title,
    attributes: { title, type, 'last-update': '2026-10-24T20:46:05.000+02:00', values },
  });
  const pvpc = (values: { value: number; datetime: string }[]) => serie('1001', 'PVPC', values);
  const mercado = (values: { value: number; datetime: string }[]) =>
    serie('600', 'Precio mercado spot', values);
  const horas = (dia: string, n: number, value: (h: number) => number) =>
    Array.from({ length: n }, (_, h) => ({
      value: value(h),
      datetime: at(dia, `${String(h).padStart(2, '0')}:00`),
    }));
  // El mercado en cuartos de hora, como desde octubre de 2025: cuatro valores por hora.
  const cuartos = (dia: string, n: number, value: (h: number) => number) =>
    Array.from({ length: n * 4 }, (_, q) => ({
      value: value(Math.floor(q / 4)),
      datetime: at(
        dia,
        `${String(Math.floor(q / 4)).padStart(2, '0')}:${String((q % 4) * 15).padStart(2, '0')}`,
      ),
    }));
  const respuesta = (...included: unknown[]) => Response.json({ data: {}, included });

  it('labels the 25 hours of the October change in local time, none lost or merged', async () => {
    const valores = pvpcDst.map(([h, value]) => ({ value, datetime: at('2026-10-25', h) }));
    const fetchImpl = vi.fn<typeof fetch>(async () => respuesta(pvpc(valores), mercado(valores)));
    const dia = await precioLuz(fetchImpl, '2026-10-25', 'peninsular');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=2026-10-25T00:00&end_date=2026-10-25T23:59&time_trunc=hour',
      expect.anything(),
    );
    expect(dia.horas_del_dia).toBe(25);
    expect(dia.pvpc?.horas.slice(2, 4)).toEqual([
      { hora: '02:00', inicio: '2026-10-25T02:00:00+02:00', eur_kwh: 0.2263, eur_mwh: 226.3 },
      { hora: '02:00', inicio: '2026-10-25T02:00:00+01:00', eur_kwh: 0.21201, eur_mwh: 212.01 },
    ]);
    expect(dia.mercado_diario?.horas).toHaveLength(25);
    expect(dia.pvpc?.mas_baratas[0]).toEqual({
      hora: '12:00',
      inicio: '2026-10-25T12:00:00+01:00',
      eur_kwh: 0.04138,
    });
    expect(dia.pvpc?.mas_caras[0]?.eur_kwh).toBe(0.34683);
    expect(dia.nota).toContain('25 horas');
  });

  it('says tomorrow’s PVPC is not out yet instead of giving today’s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T13:30:00+01:00'));
    try {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        respuesta(mercado(horas('2026-11-23', 96 / 4, () => 205.2))),
      );
      const manana = await precioLuz(fetchImpl, '2026-11-23', 'peninsular');
      // REData guarda cada URL un día: la de mañana pedida antes de publicarse no puede servir luego.
      expect(fetchImpl).toHaveBeenCalledWith(
        expect.stringContaining('end_date=2026-11-23T23:51'),
        expect.anything(),
      );
      expect(manana.pvpc).toBeUndefined();
      expect(manana.nota).toContain('aún no está publicado');
      await expect(precioLuz(fetchImpl, '2026-11-24', 'peninsular')).rejects.toThrow(
        'No hay precios del 2026-11-24',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells a REE outage apart from data it does not have', async () => {
    const con = (status: number) => vi.fn<typeof fetch>(async () => Response.json({}, { status }));
    await expect(precioLuz(con(400), '2026-11-21', 'peninsular')).rejects.toThrow(
      'Puede que aún no estén publicados',
    );
    await expect(precioLuz(con(503), '2026-11-21', 'peninsular')).rejects.toThrow(
      'REE no está disponible ahora (respondió 503)',
    );
  });

  it('rejects an incomplete day, a missing PVPC and systems without prices', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      respuesta(
        pvpc(horas('2026-11-21', 23, () => 200)),
        mercado(horas('2026-11-21', 24, () => 190)),
      ),
    );
    await expect(precioLuz(fetchImpl, '2026-11-21', 'peninsular')).rejects.toThrow(
      'REE ha publicado 23 valores de PVPC para el 2026-11-21, que tiene 24 horas',
    );
    const sinPvpc = vi.fn<typeof fetch>(async () =>
      respuesta(mercado(horas('2026-11-21', 24, () => 190))),
    );
    await expect(precioLuz(sinPvpc, '2026-11-21', 'peninsular')).rejects.toThrow(
      'no ha devuelto todos los precios',
    );
    // El mismo hueco antes de la tarifa 2.0TD no es un fallo: se dice que no hay PVPC.
    const antiguo = vi.fn<typeof fetch>(async () =>
      respuesta(mercado(horas('2014-01-15', 24, () => 50))),
    );
    expect((await precioLuz(antiguo, '2014-01-15', 'peninsular')).nota).toContain(
      'no tiene el PVPC antes del 2021-06-01',
    );
    await expect(precioLuz(fetchImpl, '2026-11-21', 'canarias')).rejects.toThrow(
      'solo publica el PVPC y el precio del mercado del sistema peninsular',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 24 valores con la 02:00 repetida y sin la 03:00 no son un día entero.
    const repetida = horas('2026-11-21', 24, () => 200);
    repetida[3] = { ...repetida[3]!, datetime: repetida[2]!.datetime };
    await expect(
      precioLuz(
        vi.fn<typeof fetch>(async () =>
          respuesta(pvpc(repetida), mercado(cuartos('2026-11-21', 24, () => 190))),
        ),
        '2026-11-21',
        'peninsular',
      ),
    ).rejects.toThrow('el día está incompleto');
  });

  it('averages a range by month, with the market per hour and partial months marked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T13:30:00+01:00'));
    try {
      const fetchImpl = vi.fn<typeof fetch>(async (url) => {
        const path = url instanceof Request ? url.url : url.toString();
        const dia = /start_date=(\d{4}-\d{2}-\d{2})/.exec(path)![1]!;
        // Octubre en cuartos de hora: el 30 a 100 €/MWh, el 31 a 200 en cuatro cuartos por hora.
        if (dia === '2026-10-30')
          return respuesta(
            pvpc([...horas('2026-10-30', 24, () => 100), ...horas('2026-10-31', 24, () => 300)]),
            mercado([
              ...horas('2026-10-30', 24, () => 100),
              ...cuartos('2026-10-31', 24, () => 200),
            ]),
          );
        return respuesta(
          pvpc(horas('2026-11-01', 24, () => 50)),
          mercado(horas('2026-11-01', 24, () => 40)),
        );
      });
      const r = await precioLuzPeriodo(fetchImpl, '2026-10-30', '2026-11-01', 'mes');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(r.periodos).toEqual([
        {
          periodo: '2026-10',
          parcial: 'solo del 2026-10-30 al 2026-10-31',
          pvpc_media_eur_kwh: 0.2,
          pvpc_min_eur_kwh: 0.1,
          pvpc_max_eur_kwh: 0.3,
          mercado_media_eur_mwh: 150,
        },
        {
          periodo: '2026-11',
          parcial: 'solo del 2026-11-01 al 2026-11-01',
          pvpc_media_eur_kwh: 0.05,
          pvpc_min_eur_kwh: 0.05,
          pvpc_max_eur_kwh: 0.05,
          mercado_media_eur_mwh: 40,
        },
      ]);
      await expect(precioLuzPeriodo(fetchImpl, '2026-11-01', '2026-11-23', 'dia')).rejects.toThrow(
        'El PVPC de mañana (2026-11-23) aún no está publicado',
      );
      await expect(precioLuzPeriodo(fetchImpl, '2021-05-01', '2021-06-30', 'dia')).rejects.toThrow(
        'antes del 2021-06-01',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives the mix of the system asked for, its renewable share, and refuses today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T13:30:00+01:00'));
    try {
      const dia = (value: number) => [{ value, datetime: '2026-11-21T00:00:00.000+01:00' }];
      // Canarias el 21 de noviembre de 2026, recortado a tres tecnologías.
      const fetchImpl = vi.fn<typeof fetch>(async (url) =>
        (url instanceof Request ? url.url : url.toString()).includes('demanda')
          ? respuesta(serie('10297', 'Demanda', dia(13849.21)))
          : respuesta(
              serie('1454', 'Ciclo combinado', dia(11821.24), 'No-Renovable'),
              serie('10291', 'Eólica', dia(1152.64), 'Renovable'),
              serie('1458', 'Solar fotovoltaica', dia(875.33), 'Renovable'),
              serie('10296', 'Generación total', dia(13849.21), 'total'),
            ),
      );
      const r = await generacion(fetchImpl, '2026-11-21', '2026-11-21', 'dia', 'canarias');
      expect(fetchImpl).toHaveBeenCalledWith(
        // Ayer aún puede cambiar: la URL cambia cada dos horas para no recibir la copia guardada.
        'https://apidatos.ree.es/es/datos/generacion/estructura-generacion?start_date=2026-11-21T00:00&end_date=2026-11-21T23:51&time_trunc=day&geo_trunc=electric_system&geo_limit=canarias&geo_ids=8742',
        expect.anything(),
      );
      expect(r).toMatchObject({
        generacion_mwh: 13849.2,
        renovable_pct: 14.6,
        demanda_mwh: 13849.2,
      });
      expect(r.tecnologias[0]).toEqual({
        tecnologia: 'Ciclo combinado',
        renovable: false,
        mwh: 11821.2,
        pct: 85.4,
      });
      await expect(
        generacion(fetchImpl, '2026-11-22', '2026-11-22', 'dia', 'nacional'),
      ).rejects.toThrow('Pide hasta ayer (2026-11-21)');
      // Un día pedido que no llega es un hueco, no un total más bajo.
      await expect(
        generacion(fetchImpl, '2026-11-20', '2026-11-21', 'dia', 'nacional'),
      ).rejects.toThrow('de 1 de los 2 periodos');
      await expect(
        generacion(fetchImpl, '2026-10-01', '2026-11-05', 'dia', 'nacional'),
      ).rejects.toThrow('el máximo es 31');
      // Un año por meses se pide de trimestre en trimestre y vuelve como una sola serie.
      const porTrimestre = vi.fn<typeof fetch>(async (url) => {
        const path = url instanceof Request ? url.url : url.toString();
        const [, d, h] = /start_date=(\d{4}-\d{2})-\d{2}.*end_date=(\d{4}-\d{2})/.exec(path)!;
        const mesesDel = Number(h!.slice(5)) - Number(d!.slice(5)) + 1;
        const vals = (v: number) =>
          Array.from({ length: mesesDel }, (_, i) => ({
            value: v,
            datetime: `2025-${String(Number(d!.slice(5)) + i).padStart(2, '0')}-01T00:00:00.000+01:00`,
          }));
        return path.includes('demanda')
          ? respuesta(serie('10297', 'Demanda', vals(90)))
          : respuesta(
              serie('10291', 'Eólica', vals(60), 'Renovable'),
              serie('1454', 'Ciclo combinado', vals(40), 'No-Renovable'),
              serie('10296', 'Generación total', vals(100), 'total'),
            );
      });
      const anual = await generacion(porTrimestre, '2025-01-01', '2025-12-31', 'mes', 'nacional');
      expect(porTrimestre).toHaveBeenCalledTimes(8);
      expect(anual).toMatchObject({ generacion_mwh: 1200, renovable_pct: 60, demanda_mwh: 1080 });
      // Sin la eólica, las tecnologías no suman el total: no se da un % renovable más bajo.
      const sinEolica = vi.fn<typeof fetch>(async (url) =>
        (url instanceof Request ? url.url : url.toString()).includes('demanda')
          ? respuesta(serie('10297', 'Demanda', dia(13849.21)))
          : respuesta(
              serie('1454', 'Ciclo combinado', dia(11821.24), 'No-Renovable'),
              serie('1458', 'Solar fotovoltaica', dia(875.33), 'Renovable'),
              serie('10296', 'Generación total', dia(13849.21), 'total'),
            ),
      );
      await expect(
        generacion(sinEolica, '2026-11-21', '2026-11-21', 'dia', 'canarias'),
      ).rejects.toThrow('no suma su generación total');
    } finally {
      vi.useRealTimers();
    }
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
