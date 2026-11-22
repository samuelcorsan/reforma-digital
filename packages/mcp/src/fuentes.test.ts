// @vitest-environment node
// BOE, Carburantes e INE sin red: respuestas con la forma de cada API (recortadas de las reales)
// para lo que se puede romper al leerlas.
import { describe, expect, it, vi } from 'vitest';
import { buscarLegislacion, sumario, textoBloque } from './boe';
import { buscarMunicipio, gasolinerasBaratas } from './carburantes';
import { run, SourceError } from './comun';
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
  const api = (datos: Response) =>
    vi.fn<typeof fetch>(async (url) => {
      const path = url instanceof Request ? url.url : url.toString();
      if (path.includes('/DATOS_SERIE/')) return datos;
      if (path.includes('/SERIE/'))
        return Response.json({
          Operacion: { Codigo: 'IPC' },
          Publicacion: { Id: 8, Nombre: 'Índice de Precios de Consumo' },
        });
      expect(path).toContain('/PUBLICACIONFECHA_PUBLICACION/8?');
      return Response.json([
        { Fecha: '2026-10-14T09:00:00.000+02:00', Anyo: 2026, T3_Periodo: 'M09' },
        { Fecha: '2026-11-13T09:00:00.000+01:00', Anyo: 2026, T3_Periodo: 'M10' },
      ]);
    });
  const viejo = Response.json({
    COD: 'IPC251856',
    Nombre: 'Nacional. Índice general. Variación anual. ',
    Data: [{ Fecha: '2025-12-01T00:00:00.000+01:00', Anyo: 2025, T3_Periodo: 'M12', Valor: 2.9 }],
  });
  expect(await datosSerie(api(viejo), 'IPC251856', 1)).toMatchObject({
    aviso: expect.stringContaining('acaba en 2025M12'),
    datos: [{ periodo: '2025M12', valor: 2.9 }],
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
