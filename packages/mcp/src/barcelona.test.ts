// @vitest-environment node
// Open Data BCN sin red: respuestas con la forma de la API CKAN del portal, recortadas de las
// reales del 22/11/2026.
import { describe, expect, it, vi } from 'vitest';
import { consultarDatos, verConjunto } from './barcelona';

const fetchJson = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));
const requested = (fetchImpl: ReturnType<typeof fetchJson>) => {
  const url = fetchImpl.mock.calls[0]?.[0];
  return new URL(url instanceof Request ? url.url : String(url));
};

const resource = (id: string, name: string, created: string, datastore_active = true) => ({
  id,
  name,
  format: 'CSV',
  created,
  datastore_active,
});

describe('Open Data BCN', () => {
  // El catálogo se guarda por proceso: cada prueba de búsqueda carga el módulo de nuevo.
  const freshSearch = async () => {
    vi.resetModules();
    return (await import('./barcelona')).buscarConjunto;
  };
  const catalog = fetchJson({
    success: true,
    result: {
      count: 3,
      results: [
        {
          name: 'pad_mdbas_sexe',
          title: 'Population by neighborhood',
          title_translated: { ca: 'Població per barri', es: 'Población por barrio' },
          metadata_modified: '2026-05-04T10:00:00',
          frequency: 'ANUAL',
          resources: [resource('p1', '2025_pad.csv', '2026-05-04')],
        },
        {
          name: 'estat-estacions-bicing',
          title: 'Bicing stations status',
          title_translated: { ca: 'Estat de les estacions', es: 'Estado de las estaciones' },
          notes_translated: { es: 'Estado de cada estación por barrio, en tiempo real.' },
          metadata_modified: '2026-11-03T08:00:00',
          frequency: 'IMMEDIATA',
          token_required: 'Yes',
          resources: [resource('b1', 'estat.json', '2026-11-03')],
        },
        {
          name: 'us-del-servei-bicing',
          title: 'Bicing use',
          title_translated: { ca: 'Ús del servei Bicing', es: 'Uso del servicio Bicing' },
          metadata_modified: '2026-03-26T08:00:00',
          frequency: 'SERIE_INTERROMPUDA',
          resources: [
            resource('u1', 'us.csv', '2026-03-26'),
            resource('u2', 'us.7z', '2026-03-26', false),
          ],
        },
      ],
    },
  });

  it('finds Spanish titles without accents, plurals included, titles before descriptions', async () => {
    const buscarConjunto = await freshSearch();
    const result = await buscarConjunto(catalog, 'poblacion barrios', 10);
    expect(result.conjuntos.map((c) => c.id)).toEqual(['pad_mdbas_sexe', 'estat-estacions-bicing']);
    expect(result.conjuntos[0]).toMatchObject({
      titulo: 'Población por barrio',
      frecuencia: 'anual',
    });
  });

  it('does not count resources behind a token and flags interrupted series', async () => {
    const buscarConjunto = await freshSearch();
    const { conjuntos } = await buscarConjunto(catalog, 'del bicing', 10);
    expect(conjuntos).toMatchObject([
      { id: 'estat-estacions-bicing', recursos_consultables: 0, nota: expect.any(String) },
      { id: 'us-del-servei-bicing', recursos_consultables: 1, frecuencia: 'serie_interrompuda' },
    ]);
    await expect(buscarConjunto(catalog, 'de (y)', 10)).rejects.toThrow('Busca por el tema');
  });

  it('refuses to search a catalog that did not arrive whole', async () => {
    const buscarConjunto = await freshSearch();
    const partial = fetchJson({ success: true, result: { count: 1200, results: [] } });
    await expect(buscarConjunto(partial, 'bicing', 10)).rejects.toThrow(
      'El catálogo tiene 1200 conjuntos y solo llegaron 0.',
    );
  });

  it('asks for the catalog once, and again after a failure', async () => {
    const buscarConjunto = await freshSearch();
    const down = fetchJson({}, 503);
    await expect(buscarConjunto(down, 'bicing', 10)).rejects.toThrow('La fuente respondió 503.');
    const up = catalog;
    up.mockClear();
    await buscarConjunto(up, 'bicing', 10);
    await buscarConjunto(up, 'barrio', 10);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('lists the queryable resources newest first, though the portal does not order them, and pages back', async () => {
    const fetchImpl = fetchJson({
      success: true,
      result: {
        name: 'qualitat-aire-detall-bcn',
        title: 'Qualitat aire',
        title_translated: { es: 'Calidad del aire' },
        metadata_modified: '2026-06-18T14:02:46',
        license_title: 'Creative Commons Attribution 4.0',
        fuente: 'Generalitat de Catalunya',
        resources: [
          resource('detall', 'Qualitat_Aire_Detall.csv', '2018-06-15', false),
          resource('gener', '2026_01_Gener_qualitat_aire_BCN.csv', '2026-02-03'),
          resource('marc', '2026_03_Marc_qualitat_aire_BCN.csv', '2026-04-02'),
          resource('desembre', '2018_12_Desembre_qualitat_aire_BCN.csv', '2019-01-06'),
          resource('vell', '2012_qualitat_aire_BCN.csv', '2026-05-20'),
        ],
      },
    });
    const result = await verConjunto(fetchImpl, 'qualitat-aire-detall-bcn');
    // Por el periodo del nombre: el de 2012 va último aunque se subiera en 2026.
    expect(result.recursos.map((r) => r.id)).toEqual(['marc', 'gener', 'desembre', 'vell']);
    expect(result).toMatchObject({ recursos_consultables: 4, fuente: 'Generalitat de Catalunya' });
    const older = await verConjunto(fetchImpl, 'qualitat-aire-detall-bcn', 2);
    expect(older.recursos.map((r) => r.id)).toEqual(['desembre', 'vell']);
  });

  it('says why a dataset has nothing to query instead of an empty list without reason', async () => {
    const result = await verConjunto(
      fetchJson({
        success: true,
        result: {
          name: 'zbe-ambit',
          title: 'ZBE',
          metadata_modified: '2025-09-23T11:21:25',
          resources: [{ ...resource('gpkg', 'ambit.gpkg', '2023-01-27', false), format: 'GPKG' }],
        },
      }),
      'zbe-ambit',
    );
    expect(result.recursos).toEqual([]);
    expect(result.nota).toContain('no tiene recursos consultables');
  });

  it('sends each query parameter once and leaves out the internal columns', async () => {
    const fetchImpl = fetchJson({
      success: true,
      result: {
        total: 287,
        fields: [
          { id: '_id', type: 'int4' },
          { id: 'ESTACIO', type: 'numeric' },
          { id: 'H01', type: 'text' },
        ],
        records: [{ _id: 186, rank: 0.05, _full_count: '287', ESTACIO: '42', H01: '14' }],
      },
    });
    const result = await consultarDatos(fetchImpl, {
      recurso: '25cf65ca-e5e5-4db1-a1fd-c6608b749395',
      filtros: { ESTACIO: ['42', '4'] },
      campos: ['ESTACIO', 'H01'],
      q: '42',
      orden: 'DIA desc',
      limite: 1,
      desde: 0,
    });
    const params = requested(fetchImpl).searchParams;
    expect([...params.keys()]).toEqual([
      'resource_id',
      'limit',
      'offset',
      'filters',
      'q',
      'fields',
      'sort',
    ]);
    expect(params.get('filters')).toBe('{"ESTACIO":["42","4"]}');
    expect(result).toEqual({
      total: 287,
      campos: ['ESTACIO (numeric)', 'H01 (text)'],
      filas: [{ ESTACIO: '42', H01: '14' }],
    });
  });

  it('keeps a real column named rank when there is no text search', async () => {
    const result = await consultarDatos(
      fetchJson({
        success: true,
        result: {
          total: 1,
          fields: [
            { id: '_id', type: 'int4' },
            { id: 'rank', type: 'numeric' },
          ],
          records: [{ _id: 1, rank: '3' }],
        },
      }),
      { recurso: 'x', limite: 1, desde: 0 },
    );
    expect(result).toEqual({ total: 1, campos: ['rank (numeric)'], filas: [{ rank: '3' }] });
  });

  it('says no row matches when the portal leaves out the total, and why it may be', async () => {
    const empty = () =>
      fetchJson({
        success: true,
        result: { fields: [{ id: 'Nom_districte', type: 'text' }], records: [] },
      });
    const none = await consultarDatos(empty(), {
      recurso: 'x',
      filtros: { Nom_districte: 'Gracia' },
      limite: 5,
      desde: 0,
    });
    expect(none).toMatchObject({ total: 0, filas: [], nota: expect.stringContaining('tildes') });
    await expect(consultarDatos(empty(), { recurso: 'x', limite: 5, desde: 900 })).rejects.toThrow(
      'pide desde 0',
    );
  });

  it('gives the total when only the fields are asked for, as the portal leaves it out with limit 0', async () => {
    const fetchImpl = fetchJson({
      success: true,
      result: {
        total: 7741,
        fields: [{ id: 'Nom_districte', type: 'text' }],
        records: [{ _id: 1, Nom_districte: 'Gràcia' }],
      },
    });
    const result = await consultarDatos(fetchImpl, { recurso: 'x', limite: 0, desde: 0 });
    expect(requested(fetchImpl).searchParams.get('limit')).toBe('1');
    expect(result).toEqual({ total: 7741, campos: ['Nom_districte (text)'], filas: [] });
  });

  it('passes on what the portal says is wrong with a field, and a missing resource', async () => {
    const invalid = fetchJson(
      {
        success: false,
        error: { __type: 'Validation Error', sort: ['invalid value "nope desc"'] },
      },
      409,
    );
    await expect(
      consultarDatos(invalid, { recurso: 'x', orden: 'nope desc', limite: 1, desde: 0 }),
    ).rejects.toThrow('Parámetro no válido: sort: invalid value "nope desc".');
    const missing = fetchJson(
      {
        success: false,
        error: { __type: 'Not Found Error', message: 'Not found: Resource "x" was not found.' },
      },
      404,
    );
    await expect(consultarDatos(missing, { recurso: 'x', limite: 1, desde: 0 })).rejects.toThrow(
      'No existe ese conjunto o recurso',
    );
  });

  it('sends one request at a time, as the portal rejects simultaneous ones, and goes on after a failure', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      calls += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return calls === 2
        ? new Response('<h1>Service Unavailable</h1>', { status: 503 })
        : Response.json({ success: true, result: { total: 1, fields: [], records: [{}] } });
    });
    const args = { recurso: 'x', limite: 1, desde: 0 };
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() => consultarDatos(fetchImpl, args)),
    );
    expect(maxInFlight).toBe(1);
    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
  });

  it('gives only the status when the portal fails with an HTML page', async () => {
    const html = (status: number) =>
      vi.fn<typeof fetch>(async () => new Response('<h1>Server Error</h1>', { status }));
    await expect(verConjunto(html(500), 'x')).rejects.toThrow('La fuente respondió 500.');
    await expect(verConjunto(html(409), 'x')).rejects.toThrow('La fuente respondió 409.');
  });
});
