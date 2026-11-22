// @vitest-environment node
// BOE, Carburantes e INE sin red: respuestas con la forma de cada API (recortadas de las reales)
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
import { buscarLicitaciones, verLicitacion } from './contratacion';
import { buscarTabla as buscarTablaEustat, datosTabla as datosTablaEustat } from './eustat';
import { avisoInterrumpida, buscarTabla, datosSerie, datosTabla } from './ine';

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

describe('Licitaciones', () => {
  const SIND = 'https://contrataciondelestado.es/sindicacion/sindicacion_1044/';
  const HEAD = `${SIND}PlataformasAgregadasSinMenores.atom`;
  const NEXT = `${SIND}PlataformasAgregadasSinMenores_20261121_030041.atom`;
  const feed = (next: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><feed xmlns="http://www.w3.org/2005/Atom"><link href="${next}" rel="next"/>${body}</feed>`;
  // Entradas reales de las agregadas del 21-11-2026, recortadas a lo que se lee.
  const entry = (
    id: string,
    updated: string,
    title: string,
    status: string,
    project: string,
    extra = '',
  ) => `<entry><id>https://contrataciondelestado.es/sindicacion/PlataformasAgregadasSinMenores/${id}</id>
    <link href="https://www.contratacion.euskadi.eus/anuncio/${id}/index.html?a=1&amp;b=2"/>
    <title>${title}</title><updated>${updated}</updated>
    <cac-place-ext:ContractFolderStatus><cbc:ContractFolderID>EXP-${id}</cbc:ContractFolderID>
    <cbc-place-ext:ContractFolderStatusCode languageID="es">${status}</cbc-place-ext:ContractFolderStatusCode>
    <cac-place-ext:LocatedContractingParty><cac:Party><cac:PartyName><cbc:Name>Sociedad Fomento de San Sebastián, S.A.-Presidente</cbc:Name></cac:PartyName>
    <cac:AgentParty><cac:PartyName><cbc:Name>Gobierno Vasco</cbc:Name></cac:PartyName></cac:AgentParty></cac:Party>
    <cac-place-ext:ParentLocatedParty><cac:PartyName><cbc:Name>Sociedad Fomento de San Sebastián</cbc:Name></cac:PartyName></cac-place-ext:ParentLocatedParty></cac-place-ext:LocatedContractingParty>
    <cac:ProcurementProject><cbc:Name>${title}</cbc:Name><cbc:TypeCode listURI="x">3</cbc:TypeCode>${project}</cac:ProcurementProject>${extra}
    <cac:TenderingProcess><cbc:ProcedureCode>1</cbc:ProcedureCode><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-09</cbc:EndDate><cbc:EndTime>09:30:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess>
    </cac-place-ext:ContractFolderStatus></entry>`;
  const budget = (sin: string, con: string) =>
    `<cac:BudgetAmount><cbc:EstimatedOverallContractAmount currencyID="EUR">${sin}</cbc:EstimatedOverallContractAmount><cbc:TotalAmount currencyID="EUR">${con}</cbc:TotalAmount><cbc:TaxExclusiveAmount currencyID="EUR">${sin}</cbc:TaxExclusiveAmount></cac:BudgetAmount>`;
  const cpv = (code: string) =>
    `<cac:RequiredCommodityClassification><cbc:ItemClassificationCode listURI="x">${code}</cbc:ItemClassificationCode></cac:RequiredCommodityClassification>`;
  const nuts = (code: string) =>
    `<cac:RealizedLocation><cbc:CountrySubentityCode listURI="x">${code}</cbc:CountrySubentityCode></cac:RealizedLocation>`;
  const lot = (id: string, name: string, code: string) =>
    `<cac:ProcurementProjectLot><cbc:ID schemeName="ID_LOTE">${id}</cbc:ID><cac:ProcurementProject><cbc:Name>${name}&#xD;
</cbc:Name>${budget('1000', '1210')}${cpv(code)}${nuts('ES212')}</cac:ProcurementProject></cac:ProcurementProjectLot>`;
  const award = (lote: string, winner: string) =>
    `<cac:TenderResult><cbc:ResultCode listURI="x">8</cbc:ResultCode><cbc:AwardDate>2026-11-06</cbc:AwardDate><cbc:ReceivedTenderQuantity>3</cbc:ReceivedTenderQuantity>
    <cac:WinningParty><cac:PartyIdentification><cbc:ID schemeName="NIF">B00000000</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${winner}</cbc:Name></cac:PartyName></cac:WinningParty>
    <cac:AwardedTenderedProject><cbc:ProcurementProjectLotID>${lote}</cbc:ProcurementProjectLotID><cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">900</cbc:TaxExclusiveAmount><cbc:PayableAmount currencyID="EUR">1089</cbc:PayableAmount></cac:LegalMonetaryTotal></cac:AwardedTenderedProject></cac:TenderResult>`;

  const page1 = feed(
    NEXT,
    `<at:deleted-entry ref="https://contrataciondelestado.es/sindicacion/PlataformasAgregadasSinMenores/7721657" when="2026-11-22T00:02:10.506+01:00"><at:comment type="CERRADA"/></at:deleted-entry>` +
      entry(
        '20881482',
        '2026-11-21T09:11:21.918+01:00',
        'Renovación de la carpintería exterior del colegio',
        'ADJ',
        budget('2000', '2420'),
        lot('1', 'Ventanas de aluminio', '44221100') +
          lot('2', 'Puertas', '44221200') +
          award('1', 'CARPINTERÍA METÁLICA URUMEA, S.L.') +
          award('2', 'PUERTAS &amp; CIA, S.L.'),
      ) +
      entry(
        '20849627',
        '2026-11-21T09:11:21.987+01:00',
        'Servicio de atención presencial del Proyecto Talent House',
        'EV',
        budget('71992.28', '87110.66') + cpv('79342320') + nuts('ES212'),
      ) +
      entry(
        '20977272',
        '2026-11-21T19:11:11.194+01:00',
        'Carpintería de Kultur Birika',
        'PUB',
        cpv('45421000'),
      ),
  );
  // La página anterior trae una versión vieja de un expediente ya leído y uno borrado.
  const page2 = feed(
    'https://ejemplo.org/otra.atom',
    entry(
      '20849627',
      '2026-11-20T10:00:00.000+01:00',
      'Versión antigua',
      'PUB',
      budget('1', '1') + cpv('45421000') + nuts('ES212'),
    ) +
      entry(
        '7721657',
        '2026-11-20T09:00:00.000+01:00',
        'Carpintería borrada',
        'PUB',
        cpv('45421000') + nuts('ES212'),
      ) +
      entry(
        '20558211',
        '2026-11-19T15:12:18.251+01:00',
        'Sustitución de carpintería exterior en Ribabellosa',
        'EV',
        budget('135798.95', '164316.73') + cpv('45421130') + nuts('ES211'),
      ) +
      // Un lugar de ejecución más amplio que la provincia: todo el País Vasco.
      entry(
        '20500001',
        '2026-11-19T10:00:00.000+01:00',
        'Carpintería de las sedes de Euskadi',
        'ADJ',
        cpv('45421000') + nuts('ES21'),
      ),
  );
  const feeds = () =>
    vi.fn<typeof fetch>(async (url) => {
      if (url === HEAD) return new Response(page1);
      if (url === NEXT) return new Response(page2);
      return new Response('no', { status: 404 });
    });
  const base = { fuente: 'agregadas' as const, paginas: 2, limite: 20 };

  it('filters by province, CPV prefix and words without accents, newest version first', async () => {
    const fetchImpl = feeds();
    const result = await buscarLicitaciones(fetchImpl, {
      ...base,
      paginas: 3,
      provincia: 'Guipúzcoa',
      cpv: '45421000-4',
      texto: 'CARPINTERIA',
    });
    expect(result.provincia).toEqual({ nuts: 'ES212', nombre: 'Gipuzkoa' });
    // 20977272 no tiene lugar de ejecución: no se cuela, y se dice cuántas así había.
    expect(result.sin_lugar_de_ejecucion).toBe(1);
    // 20500001 es de todo el País Vasco: tampoco sale, pero se cuenta.
    expect(result.lugar_mas_amplio).toBe(1);
    expect(result.revisado).toEqual([
      expect.objectContaining({
        paginas: 2,
        licitaciones: 5,
        desde: '2026-11-19T10:00:00.000+01:00',
        hasta: '2026-11-21T19:11:11.194+01:00',
      }),
    ]);
    // La versión antigua de 20849627 cumpliría el filtro y la borrada también: ninguna sale.
    expect(result.total).toBe(0);
    // Ni se pide la página siguiente de otra web.
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const alava = await buscarLicitaciones(feeds(), { ...base, provincia: 'araba', cpv: '4542' });
    expect(alava.licitaciones).toEqual([
      expect.objectContaining({
        id: '20558211',
        plataforma: 'Gobierno Vasco',
        expediente: 'EXP-20558211',
        organo: 'Sociedad Fomento de San Sebastián, S.A.-Presidente',
        estado: 'Pendiente de adjudicación',
        tipo: 'Obras',
        procedimiento: 'Abierto',
        importe: { sin_iva: 135798.95, con_iva: 164316.73, valor_estimado: 135798.95 },
        lugar: { nuts: 'ES211', nombre: 'Araba/Álava' },
        plazo_presentacion: '2026-12-09 09:30:00',
      }),
    ]);
    // Los lotes cuentan para la provincia y el CPV, y el resumen trae los adjudicatarios.
    const ventanas = await buscarLicitaciones(feeds(), {
      ...base,
      provincia: 'ES21',
      cpv: '44221',
    });
    expect(ventanas.licitaciones).toEqual([
      expect.objectContaining({
        id: '20881482',
        estado: 'Adjudicada',
        cpv: ['44221100', '44221200'],
        lotes: 2,
        // Lo del contrato, no lo de sus lotes.
        lugar: undefined,
        importe: { sin_iva: 2000, con_iva: 2420, valor_estimado: 2000 },
        adjudicatarios: ['CARPINTERÍA METÁLICA URUMEA, S.L.', 'PUERTAS & CIA, S.L.'],
        enlace: 'https://www.contratacion.euskadi.eus/anuncio/20881482/index.html?a=1&b=2',
      }),
    ]);
  });

  it('sorts both pages newest first and filters by state', async () => {
    const all = await buscarLicitaciones(feeds(), base);
    expect(all.licitaciones.map((l) => l.id)).toEqual([
      '20977272',
      '20849627',
      '20881482',
      '20558211',
      '20500001',
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
      // La versión antigua de 20849627 estaba en plazo; la vigente, no.
      const enPlazo = await buscarLicitaciones(feeds(), { ...base, estado: 'en_plazo' });
      expect(enPlazo.licitaciones.map((l) => l.id)).toEqual(['20977272']);
      // La fuente la sigue dando «en plazo» después del 2026-12-09, pero ya no lo está.
      vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
      const cerrada = await buscarLicitaciones(feeds(), { ...base, estado: 'en_plazo' });
      expect(cerrada.total).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes a short CPV as a prefix as it is, and a whole one without its trailing zeros', async () => {
    // «45420» no es «4542»: 45421000 y 45421130 no empiezan por 45420.
    expect((await buscarLicitaciones(feeds(), { ...base, cpv: '45420' })).total).toBe(0);
    // El código entero 45420000 es la clase 4542: sus tres licitaciones vigentes.
    expect((await buscarLicitaciones(feeds(), { ...base, cpv: '45420000' })).total).toBe(3);
  });

  it('follows the next page whatever the order of its attributes', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      if (url === HEAD)
        return new Response(
          page1.replace(`<link href="${NEXT}" rel="next"/>`, `<link rel="next" href="${NEXT}" />`),
        );
      if (url === NEXT) return new Response(page2);
      return new Response('no', { status: 404 });
    });
    const result = await buscarLicitaciones(fetchImpl, base);
    expect(result.revisado).toEqual([expect.objectContaining({ paginas: 2 })]);
  });

  it('gives the lots and the award of each one', async () => {
    const result = await verLicitacion(feeds(), '20881482', 'agregadas', 2);
    expect(result.lotes[0]).toEqual({
      lote: '1',
      nombre: 'Ventanas de aluminio',
      importe: { sin_iva: 1000, con_iva: 1210, valor_estimado: 1000 },
      cpv: ['44221100'],
      lugar: { nuts: 'ES212', nombre: 'Gipuzkoa' },
    });
    expect(result.resultados[1]).toEqual({
      lote: '2',
      resultado: 'Adjudicado',
      fecha: '2026-11-06',
      ofertas_recibidas: 3,
      adjudicatarios: ['PUERTAS & CIA, S.L.'],
      importe: { sin_iva: 900, con_iva: 1089 },
    });
    expect(JSON.stringify(result)).not.toContain('B00000000');
  });

  it('stops reading at the tender, and says how far it read when it is not there', async () => {
    const fetchImpl = feeds();
    await verLicitacion(fetchImpl, '20849627', 'agregadas', 2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(verLicitacion(feeds(), '123', 'agregadas', 2)).rejects.toThrow(
      'no está en lo leído de Plataformas autonómicas agregadas',
    );
    // Una retirada del feed no aparecerá leyendo más páginas.
    await expect(verLicitacion(feeds(), '7721657', 'agregadas', 2)).rejects.toThrow(
      'se retiró del feed como CERRADA el 2026-11-22T00:02:10.506+01:00',
    );
  });

  it('takes a single-province community whole, as entries carry ES300, ES30 or ES3', async () => {
    const madrid = await buscarLicitaciones(feeds(), { ...base, provincia: 'Madrid' });
    expect(madrid.provincia).toEqual({ nuts: 'ES3', nombre: 'Comunidad de Madrid' });
    const navarra = await buscarLicitaciones(feeds(), { ...base, provincia: 'ES220' });
    expect(navarra.provincia).toEqual({ nuts: 'ES22', nombre: 'Comunidad Foral de Navarra' });
  });

  it('refuses an unknown province before downloading, and a page that is not a feed', async () => {
    const fetchImpl = feeds();
    await expect(buscarLicitaciones(fetchImpl, { ...base, provincia: 'Narnia' })).rejects.toThrow(
      'No conozco «Narnia»',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(
      buscarLicitaciones(
        vi.fn<typeof fetch>(async () => new Response('<html>mantenimiento</html>')),
        base,
      ),
    ).rejects.toThrow('no devolvió un feed ATOM');
    // Cortado a media entrada, o sin el cierre del feed: incompleto, no una lista más corta.
    for (const cortado of [
      page1.slice(0, page1.lastIndexOf('</entry>')),
      page1.replace('</feed>', ''),
    ])
      await expect(
        buscarLicitaciones(
          vi.fn<typeof fetch>(async () => new Response(cortado)),
          { ...base, paginas: 1 },
        ),
      ).rejects.toThrow('devolvió un feed incompleto');
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
