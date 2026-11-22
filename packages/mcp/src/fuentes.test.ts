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
import { actosProvincia, buscarEmpresa, inscripciones, sumarioBorme } from './borme';
import { buscarMunicipio, gasolinerasBaratas } from './carburantes';
import { run, SourceError } from './comun';
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

describe('BORME', () => {
  // Con la forma de los documentos reales; las empresas y las personas son inventadas.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<documento>
  <metadatos><identificador>BORME-A-2026-223-20</identificador><titulo>GIPUZKOA</titulo></metadatos>
  <texto>
    <p class="articulo">500001 - TALLERES EJEMPLO &amp; HIJOS SL.</p>
    <p class="parrafo">Constitución. Comienzo de operaciones: 6.10.26. Objeto social: Asesoría. Constitución y gestión de sociedades. Domicilio: C/ MAYOR 1 (DONOSTIA). Capital: 3.000,00 Euros. Nombramientos. Adm. Unico: PERSONA UNO.  Datos registrales. S 8 , H SS 1, I/A 1 (10.11.26).</p>
    <p class="articulo">500002 - COMERCIAL PRUEBA SA.</p>
    <p class="parrafo">Cierre provisional hoja registral Art.485 TRLC. Insuficiencia de masa activa. Situación concursal. Procedimiento concursal 1/2026. Auto de declaración de concurso.- Ceses/Dimisiones. Consejero: PERSONA DOS Datos registrales. S 8 , H SS 2, I/A 9 (9.11.26).</p>
    <p class="articulo">500003 - NUEVA FORMA SL.</p>
    <p class="parrafo">Acto que aún no se conoce. Extinción.  Datos registrales. S 8 , H SS 3, I/A 4 (9.11.26).</p>
  </texto>
</documento>`;

  const item = (id: string, titulo: string) => ({
    identificador: id,
    titulo,
    url_html: `https://www.boe.es/diario_borme/txt.php?id=${id}`,
    url_xml: `https://www.boe.es/diario_borme/xml.php?id=${id}`,
    url_pdf: { texto: `https://www.boe.es/borme/dias/2026/11/20/pdfs/${id}.pdf` },
  });
  // Un solo documento llega como objeto y varios como lista, como en la API.
  const dia = {
    data: {
      sumario: {
        diario: [
          {
            numero: '223',
            sumario_diario: {
              identificador: 'BORME-S-2026-223',
              url_pdf: {
                texto: 'https://www.boe.es/borme/dias/2026/11/20/pdfs/BORME-S-2026-223.pdf',
              },
            },
            seccion: [
              {
                codigo: 'A',
                nombre: 'SECCIÓN PRIMERA. Empresarios. Actos inscritos',
                item: [
                  item('BORME-A-2026-223-01', 'ARABA/ÁLAVA'),
                  item('BORME-A-2026-223-20', 'GIPUZKOA'),
                ],
              },
              {
                codigo: 'C',
                nombre: 'SECCIÓN SEGUNDA. Anuncios y avisos legales',
                apartado: {
                  nombre: 'CONVOCATORIAS DE JUNTAS',
                  item: item('BORME-C-2026-1', 'TALLERES EJEMPLO & HIJOS, S.L.'),
                },
              },
            ],
          },
        ],
      },
    },
  };
  const ruta = (url: string | URL | Request) => (url instanceof Request ? url.url : url.toString());
  /** El BORME del 2026-11-20 con el documento de Gipuzkoa; los demás días, 404. */
  const borme = (status = 404) =>
    vi.fn<typeof fetch>(async (url) =>
      ruta(url).endsWith('/sumario/20261120')
        ? Response.json(dia)
        : ruta(url).includes('xml.php')
          ? new Response(xml)
          : new Response('', { status }),
    );

  it('splits each entry into its acts, with the registry data apart', () => {
    expect(inscripciones(xml)).toEqual([
      {
        numero: '500001',
        empresa: 'TALLERES EJEMPLO & HIJOS SL',
        actos: [
          {
            acto: 'Constitución',
            detalle:
              'Comienzo de operaciones: 6.10.26. Objeto social: Asesoría. Constitución y gestión de sociedades. Domicilio: C/ MAYOR 1 (DONOSTIA). Capital: 3.000,00 Euros',
          },
          { acto: 'Nombramientos', detalle: 'Adm. Unico: PERSONA UNO' },
        ],
        datos_registrales: 'S 8 , H SS 1, I/A 1 (10.11.26)',
      },
      {
        numero: '500002',
        empresa: 'COMERCIAL PRUEBA SA',
        actos: [
          {
            // El acto con su nombre de la lista; la variante del boletín, en el detalle.
            acto: 'Cierre provisional de la hoja registral',
            detalle: 'Cierre provisional hoja registral Art.485 TRLC. Insuficiencia de masa activa',
          },
          {
            acto: 'Situación concursal',
            detalle: 'Procedimiento concursal 1/2026. Auto de declaración de concurso',
          },
          { acto: 'Ceses/Dimisiones', detalle: 'Consejero: PERSONA DOS' },
        ],
        datos_registrales: 'S 8 , H SS 2, I/A 9 (9.11.26)',
      },
      {
        numero: '500003',
        empresa: 'NUEVA FORMA SL',
        // Un acto que no está en la lista no se pierde.
        actos: [
          { acto: 'Sin clasificar', detalle: 'Acto que aún no se conoce' },
          { acto: 'Extinción' },
        ],
        datos_registrales: 'S 8 , H SS 3, I/A 4 (9.11.26)',
      },
    ]);
  });

  it('lists the documents of the day and says when there is no BORME', async () => {
    const fetchImpl = borme();
    const result = await sumarioBorme(fetchImpl, '2026-11-20');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.boe.es/datosabiertos/api/borme/sumario/20261120',
      expect.anything(),
    );
    expect(result.diarios[0]?.secciones.map((s) => s.documentos.map((d) => d.id))).toEqual([
      ['BORME-A-2026-223-01', 'BORME-A-2026-223-20'],
      ['BORME-C-2026-1'],
    ]);
    await expect(sumarioBorme(fetchImpl, '2026-11-21')).rejects.toThrow(
      'No hay BORME del 2026-11-21',
    );
    // Antes de 2009 la API no tiene el BORME, aunque se publicara.
    await expect(sumarioBorme(fetchImpl, '2008-01-02')).rejects.toThrow(
      'Los datos abiertos del BORME empiezan en 2009-01-01',
    );
  });

  it('gives the acts of a province by any of its names, filtered by type of act', async () => {
    const result = await actosProvincia(borme(), '2026-11-20', 'Guipúzcoa', {
      acto: 'concursal',
      pagina: 1,
      limite: 25,
    });
    expect(result).toMatchObject({ provincia: 'Gipuzkoa', id: 'BORME-A-2026-223-20', total: 1 });
    expect(result.inscripciones.map((i) => i.empresa)).toEqual(['COMERCIAL PRUEBA SA']);
    // El nombre de la lista encuentra el acto aunque el boletín escriba otra variante.
    expect(
      await actosProvincia(borme(), '2026-11-20', 'Gipuzkoa', {
        acto: 'Cierre provisional de la hoja registral',
        pagina: 1,
        limite: 25,
      }),
    ).toMatchObject({ total: 1 });
    // Un día con BORME pero sin documento de la provincia: cero, y dicho.
    expect(
      await actosProvincia(borme(), '2026-11-20', 'Soria', { pagina: 1, limite: 25 }),
    ).toMatchObject({
      total: 0,
      nota: 'El BORME del 2026-11-20 no publica actos inscritos de Soria.',
    });
  });

  it('refuses unknown provinces and types of act before asking the BOE', async () => {
    const fetchImpl = borme();
    const filtros = { pagina: 1, limite: 25 };
    await expect(actosProvincia(fetchImpl, '2026-11-20', 'Narnia', filtros)).rejects.toThrow(
      '«Narnia» no es una provincia',
    );
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: 'concurso' }),
    ).rejects.toThrow('«concurso» no es un tipo de acto');
    // «de» está en casi todos los actos: filtraría sin filtrar.
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: 'de' }),
    ).rejects.toThrow('El tipo de acto necesita al menos una palabra de tres letras');
    await expect(buscarEmpresa(fetchImpl, '. , .', 'Gipuzkoa', 3, '2026-11-20')).rejects.toThrow(
      'El nombre de la empresa necesita al menos una palabra',
    );
    await expect(buscarEmpresa(fetchImpl, 'talleres', 'Gipuzkoa', 3, '2999-01-01')).rejects.toThrow(
      'es una fecha futura',
    );
    // Un filtro dado pero en blanco no se ignora: la respuesta parecería filtrada.
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: '   ' }),
    ).rejects.toThrow('El tipo de acto necesita al menos una palabra');
    // Los días anteriores a 2009 saldrían como días sin BORME.
    await expect(buscarEmpresa(fetchImpl, 'talleres', 'Gipuzkoa', 5, '2009-01-03')).rejects.toThrow(
      'La API del BORME empieza el 2009-01-01',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('takes a type of act by its exact name before the ones that contain it', async () => {
    const cancelaciones = xml.replace(
      'Acto que aún no se conoce. Extinción.',
      'Cancelaciones de oficio de nombramientos. Adm. Unico: PERSONA TRES.',
    );
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      ruta(url).includes('xml.php') ? new Response(cancelaciones) : Response.json(dia),
    );
    const filtros = { pagina: 1, limite: 25 };
    const nombramientos = await actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', {
      ...filtros,
      acto: 'nombramientos',
    });
    expect(nombramientos.inscripciones.map((i) => i.numero)).toEqual(['500001']);
    const canceladas = await actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', {
      ...filtros,
      acto: 'cancelaciones',
    });
    expect(canceladas.inscripciones.map((i) => i.numero)).toEqual(['500003']);
  });

  it('refuses a summary without the section of registered acts instead of reporting none', async () => {
    const sinA = structuredClone(dia);
    const diario = sinA.data.sumario.diario[0]!;
    diario.seccion = diario.seccion.filter((s) => s.codigo !== 'A');
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(sinA));
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { pagina: 1, limite: 25 }),
    ).rejects.toThrow('El sumario del BORME no trae la sección de actos inscritos');
  });

  it('refuses a document whose entries cannot be read instead of reporting no acts', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      ruta(url).includes('xml.php')
        ? new Response('<documento><texto/></documento>')
        : Response.json(dia),
    );
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { pagina: 1, limite: 25 }),
    ).rejects.toThrow('No se han podido leer las inscripciones de BORME-A-2026-223-20');
  });

  it('searches a company over the last days, telling which ones had no BORME', async () => {
    const result = await buscarEmpresa(
      borme(),
      'talleres ejemplo s.l.',
      'gipuzkoa',
      3,
      '2026-11-22',
    );
    expect(result).toMatchObject({
      desde: '2026-11-20',
      dias_con_borme: 1,
      dias_sin_borme: ['2026-11-22', '2026-11-21'],
      total_inscripciones: 1,
      inscripciones: [{ fecha: '2026-11-20', numero: '500001', id: 'BORME-A-2026-223-20' }],
      total_anuncios: 1,
      anuncios: [{ id: 'BORME-C-2026-1', apartado: 'CONVOCATORIAS DE JUNTAS' }],
    });
    // Si falla un día, la búsqueda falla entera: sin ese día no se sabe si hubo actos.
    await expect(
      buscarEmpresa(borme(503), 'talleres ejemplo', 'gipuzkoa', 3, '2026-11-22'),
    ).rejects.toThrow('La fuente respondió 503.');
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
