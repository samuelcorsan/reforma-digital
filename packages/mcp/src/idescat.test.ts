// @vitest-environment node
// Idescat sin red: respuestas con la forma de la API Taules v2 (recortadas de las reales) para lo
// que se puede romper al leerlas.
import { describe, expect, it, vi } from 'vitest';
import { buscarTabla as buscarTablaIdescat, datosTabla as datosTablaIdescat } from './idescat';

describe('Idescat', () => {
  const API = 'https://api.idescat.cat/taules/v2';
  const coleccion = (items: [string, string][]) => ({
    class: 'collection',
    label: 'colección',
    link: { item: items.map(([path, label]) => ({ href: `${API}/${path}?lang=es`, label })) },
  });
  // Tasas de actividad, empleo y paro (e03/22274/26671/cat), recortada.
  const dim = (label: string, labels: Record<string, string>) => ({
    label,
    category: { index: Object.keys(labels), label: labels },
  });
  const paro = {
    label: 'Tasas de actividad, empleo y paro. Cataluña',
    updated: '2026-11-12',
    id: ['MONTH', 'CAT', 'CONCEPT'],
    size: [3, 1, 2],
    role: { time: ['MONTH'], geo: ['CAT'], metric: ['CONCEPT'] },
    dimension: {
      MONTH: dim('mes', { '2026M08': '08/2026', '2026M09': '09/2026', '2026M10': '10/2026' }),
      CAT: dim('Cataluña', { TOTAL: 'Catalunya' }),
      CONCEPT: dim('concepto', { EMP_RT: 'tasa de empleo', UN_RATE: 'tasa de paro' }),
    },
  };

  it('searches the topics of every statistic without accents, and asks again after a failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json(
          coleccion([
            ['pmh', 'Padrón municipal de habitantes'],
            ['e03', 'Estimación mensual de la población activa'],
          ]),
        ),
      )
      .mockResolvedValueOnce(Response.json(coleccion([['pmh/446', 'Población a 1 de enero']])))
      .mockResolvedValueOnce(
        Response.json(coleccion([['e03/22274', 'Tasas de actividad, empleo y paro']])),
      );
    await expect(buscarTablaIdescat(fetchImpl, 'paro')).rejects.toThrow('respondió 503');
    expect(await buscarTablaIdescat(fetchImpl, 'poblacion paro')).toEqual({
      total: 1,
      nodos: [
        {
          id: 'e03/22274',
          nombre: 'Tasas de actividad, empleo y paro',
          estadistica: 'Estimación mensual de la población activa',
        },
      ],
    });
    // Con el índice hecho, buscar no vuelve a pedir nada.
    await buscarTablaIdescat(fetchImpl, 'padron');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('asks only for the filtered codes and the last periods, newest first with their status', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(paro))
      .mockResolvedValueOnce(
        Response.json({
          ...paro,
          size: [2, 1, 1],
          dimension: {
            ...paro.dimension,
            MONTH: dim('mes', { '2026M09': '09/2026', '2026M10': '10/2026' }),
            CONCEPT: dim('concepto', { UN_RATE: 'tasa de paro' }),
          },
          value: [8.5, null],
          status: { '0': 'p', '1': 'a' },
          extension: { status: { label: { a: 'Dato avanzado', p: 'Dato provisional' } } },
        }),
      );
    const result = await datosTablaIdescat(fetchImpl, 'e03/22274/26671', 'cat', 2, undefined, {
      concept: 'PARO',
    });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      `${API}/e03/22274/26671/cat/data?lang=es&CONCEPT=UN_RATE&MONTH=2026M09%2C2026M10`,
      expect.anything(),
    );
    expect(result.series).toEqual([
      {
        nombre: 'Catalunya · tasa de paro',
        datos: [
          { periodo: '10/2026', valor: null, estado: 'Dato avanzado' },
          { periodo: '09/2026', valor: 8.5, estado: 'Dato provisional' },
        ],
      },
    ]);
  });

  it('takes the place that matches the whole name, and every filtered period', async () => {
    const poblacion = {
      label: 'Población. Por sexo. Municipios',
      updated: '2026-02-25',
      id: ['YEAR', 'MUN', 'SEX'],
      size: [3, 3, 2],
      role: { time: ['YEAR'], geo: ['MUN'] },
      dimension: {
        YEAR: dim('año', { '2023': '2023', '2024': '2024', '2025': '2025' }),
        MUN: dim('municipio', {
          '170792': 'Girona',
          '170850': 'Sant Gregori',
          '171': 'Girona, la',
        }),
        SEX: dim('sexo', { M: 'hombres', TOTAL: 'total' }),
      },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(poblacion))
      .mockResolvedValueOnce(
        Response.json({ ...poblacion, size: [3, 1, 1], value: [104038, 106476, 108352] }),
      );
    await datosTablaIdescat(fetchImpl, 'censph/538/565', 'mun', 1, 'girona', {
      YEAR: '202',
      SEX: 'total',
    });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      `${API}/censph/538/565/mun/data?lang=es&YEAR=2023%2C2024%2C2025&SEX=TOTAL&MUN=170792`,
      expect.anything(),
    );
  });

  it('refuses unknown or territorial dimensions, empty filters and oversized queries before asking for data', async () => {
    const serie = (n: number, prefix: string) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, `${prefix}${i}`]));
    const largo = {
      ...paro,
      size: [300, 1, 20],
      dimension: {
        ...paro.dimension,
        MONTH: dim('mes', serie(300, 'm')),
        CONCEPT: dim('concepto', { ...serie(19, 'tasa '), UN_RATE: 'tasa de paro' }),
      },
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(largo));
    const pide = (filtros: Record<string, string>, ultimos = 1, lugar?: string) =>
      datosTablaIdescat(fetchImpl, 'e03/22274/26671', 'cat', ultimos, lugar, filtros);
    await expect(pide({ SEX: 'total' })).rejects.toThrow('no tiene la dimensión «SEX»');
    await expect(pide({ CAT: 'Catalunya' })).rejects.toThrow('el lugar va en `lugar`');
    await expect(pide({ CONCEPT: 'actividad' })).rejects.toThrow('Ningún valor de «CONCEPT»');
    await expect(pide({}, 1, 'Girona')).rejects.toThrow('Ningún valor de «CAT»');
    // 60 meses × 20 conceptos.
    await expect(pide({}, 60)).rejects.toThrow('pide 1200 datos');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('keeps apart the series of values that share a name', async () => {
    // PIB por ramas (piba/21120/24932): la rama F y su detalle F41-F43 se llaman igual.
    const pib = {
      label: 'PIB oferta',
      updated: '2026-10-01',
      id: ['YEAR', 'BRANCH'],
      size: [1, 3],
      role: { time: ['YEAR'] },
      dimension: {
        YEAR: dim('año', { '2025': '2025' }),
        BRANCH: dim('rama', { F: 'construcción', 'F41-F43': 'construcción', L: 'inmobiliarias' }),
      },
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(pib))
      .mockResolvedValueOnce(
        Response.json({
          ...pib,
          size: [1, 2],
          dimension: {
            ...pib.dimension,
            BRANCH: dim('rama', { F: 'construcción', 'F41-F43': 'construcción' }),
          },
          value: [100, 60],
        }),
      );
    const result = await datosTablaIdescat(fetchImpl, 'piba/21120/24932', 'cat', 1, undefined, {
      BRANCH: 'construccion',
    });
    expect(result.series).toEqual([
      { nombre: 'construcción (F)', datos: [{ periodo: '2025', valor: 100 }] },
      { nombre: 'construcción (F41-F43)', datos: [{ periodo: '2025', valor: 60 }] },
    ]);
  });

  it('refuses data that does not match the filters it asked for', async () => {
    // Con un código que no existe, la API devuelve la dimensión entera en vez de un error.
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(paro))
      .mockResolvedValueOnce(Response.json({ ...paro, value: [1, 2, 3, 4, 5, 6] }));
    await expect(
      datosTablaIdescat(fetchImpl, 'e03/22274/26671', 'cat', 3, undefined, { CONCEPT: 'paro' }),
    ).rejects.toThrow('otros datos que los pedidos');
  });
});
