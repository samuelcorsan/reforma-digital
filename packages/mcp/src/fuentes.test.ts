// @vitest-environment node
// BOE, Carburantes, Catastro e INE sin red: respuestas con la forma de cada API (recortadas de las
// reales) para lo que se puede romper al leerlas.
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
import {
  buscarCoordenadas,
  buscarDireccion,
  letrasControl,
  provinciaForal,
  verInmueble,
} from './catastro';
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

describe('Catastro', () => {
  // Respuestas del Catastro (recortadas de las reales) por operación, o según la consulta, y las
  // URL pedidas.
  const catastro = (respuestas: Record<string, unknown>) =>
    vi.fn<typeof fetch>(async (url) => {
      const u = new URL(url instanceof Request ? url.url : url);
      const operacion = u.pathname.split('/').at(-1)!;
      const r = respuestas[operacion];
      return Response.json({
        [`${operacion}Result`]: typeof r === 'function' ? r(u.searchParams) : r,
      });
    });
  const ninguna = {
    control: { cuerr: 1 },
    lerr: { err: [{ cod: '10', des: 'NO HAY COINCIDENCIAS EN LA BÚSQUEDA DE VÍAS' }] },
  };
  const pedida = (fetchImpl: ReturnType<typeof catastro>, operacion: string) =>
    fetchImpl.mock.calls
      .map(([u]) => new URL(u instanceof Request ? u.url : u))
      .find((u) => u.pathname.endsWith(operacion))!.searchParams;
  const dir = { cv: '2365', tv: 'CL', nv: 'FUENCARRAL', pnp: '83', snp: '0' };
  const unidad = (car: string, cc: string, pt: string, pu: string, luso: string) => ({
    rc: { pc1: '0555705', pc2: 'VK4705F', car, cc1: cc[0], cc2: cc[1] },
    dt: {
      np: 'MADRID',
      nm: 'MADRID',
      locs: { lous: { lourb: { dir, loint: { es: '1', pt, pu }, dp: '28004' } } },
    },
    debi: { luso, sfc: '77', cpt: '5,500000', ant: '1900' },
  });
  const bloque = {
    control: { cudnp: 3 },
    lrcdnp: {
      rcdnp: [
        unidad('0001', 'RB', '-1', 'DR', 'Comercial'),
        unidad('0004', 'UM', '01', 'DR', 'Residencial'),
        unidad('0005', 'IQ', '01', 'CN', 'Residencial'),
      ],
    },
  };
  const provincias = {
    control: { cuprov: 3 },
    provinciero: {
      prov: [
        { cpine: '03', np: 'ALACANT' },
        { cpine: '15', np: 'A CORUÑA' },
        { cpine: '28', np: 'MADRID' },
      ],
    },
  };

  it('reads a property with its constructions, and checks the control letters', async () => {
    const fetchImpl = catastro({
      Consulta_DNPRC: {
        control: { cudnp: 1, cucons: 2 },
        bico: {
          bi: {
            idbi: { cn: 'UR', rc: unidad('0004', 'UM', '01', 'DR', '').rc },
            dt: unidad('0004', 'UM', '01', 'DR', '').dt,
            ldt: 'CL FUENCARRAL 83 Es:1 Pl:01 Pt:DR 28004 MADRID (MADRID)',
            debi: { luso: 'Residencial', sfc: '77', cpt: '5,499900', ant: '1900' },
          },
          finca: {
            ltp: 'Parcela con varios inmuebles (division horizontal)',
            dff: { ss: '213' },
            infgraf: { igraf: 'https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=x' },
          },
          lcons: [
            {
              lcd: 'VIVIENDA',
              dt: { lourb: { loint: { es: '1', pt: '01', pu: 'DR' } } },
              dfcons: { stl: '70' },
              dvcons: { dtip: 'VIVIENDA COLECTIVA' },
            },
            { lcd: 'ELEMENTOS COMUNES', dfcons: { stl: '7' } },
          ],
        },
      },
    });
    const piso = await verInmueble(fetchImpl, '0555705 VK4705F 0004 um', { pagina: 1, limite: 50 });
    expect(pedida(fetchImpl, 'Consulta_DNPRC').get('RefCat')).toBe('0555705VK4705F0004UM');
    expect(piso).toMatchObject({
      referencia: '0555705VK4705F0004UM',
      clase: 'urbano',
      uso: 'Residencial',
      superficie_construida_m2: 77,
      coeficiente_participacion: 5.4999,
      año_construccion: 1900,
      planta: '01',
      parcela: { referencia: '0555705VK4705F', superficie_suelo_m2: 213 },
      construcciones: [
        { uso: 'VIVIENDA', planta: '01', puerta: 'DR', superficie_m2: 70 },
        { uso: 'ELEMENTOS COMUNES', superficie_m2: 7 },
      ],
    });
    // Letras de referencias reales, urbanas y rústica; las letras desde la O cuentan la Ñ.
    expect(letrasControl('9872023VH5797S0001WX')).toBe('WX');
    expect(letrasControl('18161A037000810000SD')).toBe('SD');
    expect(letrasControl('9653202VK3795D0316IQ')).toBe('IQ');
    await expect(
      verInmueble(fetchImpl, '0555705VK4705F0004UX', { pagina: 1, limite: 50 }),
    ).rejects.toThrow('no cuadran');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('pages the properties of a parcel and refuses a list cut short', async () => {
    const pagina2 = await verInmueble(catastro({ Consulta_DNPRC: bloque }), '0555705VK4705F', {
      pagina: 2,
      limite: 2,
    });
    expect(pagina2).toMatchObject({
      total: 3,
      pagina: 2,
      paginas: 2,
      inmuebles: [
        {
          referencia: '0555705VK4705F0005IQ',
          uso: 'Residencial',
          coeficiente_participacion: 5.5,
          direccion: 'CL FUENCARRAL 83',
          escalera: '1',
          planta: '01',
          puerta: 'CN',
        },
      ],
    });
    const cortada = { ...bloque, control: { cudnp: 18 } };
    await expect(
      verInmueble(catastro({ Consulta_DNPRC: cortada }), '0555705VK4705F', {
        pagina: 1,
        limite: 50,
      }),
    ).rejects.toThrow('incompleta');
  });

  it('sends foral territories to their own cadastre instead of an empty answer', async () => {
    const fetchImpl = catastro({});
    const pagina = { pagina: 1, limite: 50 };
    // Una rústica lleva la provincia delante: 20 es Gipuzkoa.
    await expect(verInmueble(fetchImpl, '20069A00100001', pagina)).rejects.toThrow(
      'Catastro de Gipuzkoa',
    );
    await expect(
      buscarDireccion(
        fetchImpl,
        { provincia: 'Vizcaya', municipio: 'Bilbao', via: 'Gran Vía', numero: 1 },
        pagina,
      ),
    ).rejects.toThrow('Catastro de Bizkaia');
    await expect(
      buscarDireccion(
        fetchImpl,
        { provincia: '31', municipio: 'Pamplona', via: 'Mayor', numero: 1 },
        pagina,
      ),
    ).rejects.toThrow('Riqueza Territorial de Navarra');
    expect(fetchImpl).not.toHaveBeenCalled();
    // El Catastro responde a una urbana de allí como a una que no existe.
    const noExiste = catastro({
      Consulta_DNPRC: {
        control: { cuerr: 1 },
        lerr: [{ cod: '5', des: 'NO EXISTE NINGÚN INMUEBLE CON LOS PARÁMETROS INDICADOS' }],
      },
    });
    await expect(verInmueble(noExiste, '9872023VH5797X', pagina)).rejects.toThrow(
      /No hay ningún inmueble.*catastro foral propio/,
    );
  });

  it('resolves names without accents and passes every filter of the address', async () => {
    const fetchImpl = catastro({
      ObtenerProvincias: provincias,
      ObtenerMunicipios: {
        control: { cumun: 2 },
        municipiero: { muni: [{ nm: 'ALICANTE/ALACANT' }, { nm: "SANT JOAN D'ALACANT" }] },
      },
      // El callejero busca sin tildes pero no sin la Ñ: «ESPANA» no sale y «ESPA» sí.
      ObtenerCallejero: (q: URLSearchParams) =>
        q.get('NomVia') === 'ESPA'
          ? {
              control: { cuca: 3 },
              callejero: {
                calle: [
                  { dir: { tv: 'AV', nv: 'CAPITAL DE ESPAÑA MADRID' } },
                  { dir: { tv: 'BO', nv: 'CHAMARTIN-NUEVA ESPAÑA' } },
                  { dir: { tv: 'PZ', nv: 'ESPAÑA' } },
                ],
              },
            }
          : ninguna,
      Consulta_DNPLOC: bloque,
    });
    const result = await buscarDireccion(
      fetchImpl,
      {
        provincia: 'Alicante',
        municipio: 'alicante',
        via: 'Plaza de Espana',
        numero: 10,
        escalera: '1',
        planta: '1',
      },
      { pagina: 1, limite: 50 },
    );
    expect(Object.fromEntries(pedida(fetchImpl, 'Consulta_DNPLOC'))).toEqual({
      Provincia: 'ALACANT',
      Municipio: 'ALICANTE/ALACANT',
      Sigla: 'PZ',
      Calle: 'ESPAÑA',
      Numero: '10',
      Bloque: '',
      Escalera: '1',
      Planta: '1',
      Puerta: '',
    });
    expect(result).toMatchObject({
      direccion: 'PZ ESPAÑA 10, ALICANTE/ALACANT (ALACANT)',
      total: 3,
    });
  });

  it('answers a wrong address with what does exist', async () => {
    const pagina = { pagina: 1, limite: 50 };
    const madrid = { provincia: 'madrid', municipio: 'Madrid', numero: 83 };
    const respuestas = (dnploc: unknown) =>
      catastro({
        ObtenerProvincias: provincias,
        ObtenerMunicipios: { control: { cumun: 1 }, municipiero: { muni: [{ nm: 'MADRID' }] } },
        ObtenerCallejero: {
          control: { cuca: 2 },
          callejero: {
            calle: [
              { dir: { tv: 'CL', nv: 'FUENCARRAL' } },
              { dir: { tv: 'CM', nv: 'FUENCARRAL' } },
            ],
          },
        },
        Consulta_DNPLOC: dnploc,
      });
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Fuencarral' }, pagina),
    ).rejects.toThrow('encaja con 2 vías en MADRID: CL FUENCARRAL; CM FUENCARRAL');
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Calle Fuencaral' }, pagina),
    ).rejects.toThrow('Con nombre parecido: CL FUENCARRAL; CM FUENCARRAL');
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Avenida Fuencarral' }, pagina),
    ).rejects.toThrow('encaja con 2 vías');
    const sinNumero = respuestas({
      control: { cunum: 2, cuerr: 1 },
      numerero: { nump: [{ num: { pnp: '81' } }, { num: { pnp: '85' } }, { num: { pnp: '85' } }] },
      lerr: [{ cod: '43', des: 'EL NUMERO NO EXISTE' }],
    });
    await expect(
      buscarDireccion(sinNumero, { ...madrid, via: 'Calle Fuencarral' }, pagina),
    ).rejects.toThrow('Números que sí existen: 81, 85.');
    const sinPiso = respuestas({
      control: { cuerr: 1 },
      lerr: [{ cod: '5', des: 'NO EXISTE NINGÚN INMUEBLE CON LOS PARÁMETROS INDICADOS' }],
    });
    await expect(
      buscarDireccion(sinPiso, { ...madrid, via: 'Calle Fuencarral', planta: '99' }, pagina),
    ).rejects.toThrow('no hay inmuebles con planta 99');
  });

  it('gives the parcel at a point, the nearby ones, and the foral cadastre when there is none', async () => {
    const cercanas = (lpcd?: unknown[]) =>
      catastro({
        Consulta_RCCOOR_Distancia: {
          control: { cucoor: 1 },
          coordenadas_distancias: { coordd: [{ geo: { srs: 'EPSG:4326' }, lpcd }] },
        },
      });
    const fetchImpl = cercanas([
      { pc: { pc1: '0555705', pc2: 'VK4705F' }, ldt: 'CL FUENCARRAL 83 MADRID (MADRID)', dis: '0' },
      { pc: { pc1: '0555706', pc2: 'VK4705F' }, ldt: 'CL PALMA 4 MADRID (MADRID)', dis: '1.11' },
    ]);
    expect(await buscarCoordenadas(fetchImpl, 40.4262, -3.7015)).toMatchObject({
      parcela: { referencia: '0555705VK4705F', distancia_m: 0 },
      cercanas: [{ referencia: '0555706VK4705F', distancia_m: 1.11 }],
    });
    expect(Object.fromEntries(pedida(fetchImpl, 'Consulta_RCCOOR_Distancia'))).toEqual({
      CoorX: '-3.7015',
      CoorY: '40.4262',
      SRS: 'EPSG:4326',
    });
    expect(
      await buscarCoordenadas(
        cercanas([
          { pc: { pc1: '5924026', pc2: 'TG3452S' }, ldt: 'CL FLORIDA (LA) 2', dis: '11.97' },
        ]),
        37.3891,
        -5.9845,
      ),
    ).toMatchObject({ parcela: null, cercanas: [{ distancia_m: 11.97 }] });
    // Donostia, Bilbao, Vitoria y Pamplona; el Condado de Treviño es de Burgos.
    await expect(buscarCoordenadas(cercanas(), 43.3224, -1.9846)).rejects.toThrow(
      'Catastro de Gipuzkoa',
    );
    expect([
      provinciaForal(43.263, -2.935),
      provinciaForal(42.8467, -2.6727),
      provinciaForal(42.8125, -1.6432),
      provinciaForal(42.7346, -2.7469),
    ]).toEqual(['48', '01', '31', undefined]);
    await expect(buscarCoordenadas(cercanas(), 48.85, 2.35)).rejects.toThrow(
      'No hay ninguna parcela del Catastro en ese punto',
    );
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
