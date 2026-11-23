// @vitest-environment node
// TED sin red: avisos con la forma de la API de búsqueda (recortados de los reales, con las empresas y el expediente
// cambiados) para lo que se puede romper al leerlos: campos multilingües, campos que llegan como texto o como lista,
// el lugar con el país mezclado y la consulta que se envía.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceError } from './comun';
import { buscarTed, verAviso } from './ted';

const fetchJson = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));
function consulta(fetchImpl: ReturnType<typeof fetchJson>) {
  const body = fetchImpl.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('La búsqueda no envió un cuerpo JSON');
  return JSON.parse(body) as { query: string; fields: string[]; page: number; limit: number };
}
const vacio = { notices: [], totalNoticeCount: 0, timedOut: false };

const adjudicacion = {
  'publication-number': '109312-2025',
  'notice-type': 'can-standard',
  'publication-date': '2025-02-20+01:00',
  'title-proc': { spa: 'Suministro de equipamiento electromédico' },
  'buyer-name': { spa: ['Institut Català de la Salut'] },
  'organisation-city-buyer': ["L'Hospitalet de Llobregat (Barcelona)"],
  'place-of-performance': ['ES511', 'ESP', 'ES511', 'ESP'],
  'classification-cpv': ['33151000', '50421000', '33151000'],
  'estimated-value-proc': '276684.67',
  'winner-name': { spa: ['EMPRESA A', 'EMPRESA A', 'EMPRESA B'] },
  // Con un solo procedimiento, TED lo manda como texto y no como lista.
  'internal-identifier-proc': 'CS/AH01/1100123/24',
  'framework-agreement-lot': ['none', 'none'],
  'result-lot-identifier': ['LOT-0001', 'LOT-0002'],
  'tender-value': ['59277.9', '155482.58'],
  'received-submissions-type-val': ['2', '1'],
  'organisation-name-tenderer': { spa: ['EMPRESA A', 'EMPRESA B', 'EMPRESA A'] },
  'winner-decision-date': ['2024-11-20+01:00', '2024-11-20+01:00'],
};

describe('TED', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for Spanish buyers and the given sector with the filters, newest first', async () => {
    const fetchImpl = fetchJson(vacio);
    await buscarTed(
      fetchImpl,
      '(classification-cpv=33151*)',
      { lugar: 'ES12', tipo: 'adjudicacion', desde: '2024-01-01', hasta: '2024-12-31' },
      2,
      5,
    );
    expect(consulta(fetchImpl)).toMatchObject({
      query:
        'buyer-country=ESP AND (classification-cpv=33151*) AND place-of-performance=ES12* AND (notice-type=can* AND NOT notice-type=can-modif) AND publication-date>=20240101 AND publication-date<=20241231 SORT BY publication-number DESC',
      page: 2,
      limit: 5,
    });
  });

  it('asks only for calls whose deadline has not passed when en plazo', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-22T10:00:00Z') });
    // Solo convocatorias, se pida o no ese tipo (y sin repetirlo). El plazo de solicitudes es el de los
    // restringidos, los negociados y los sistemas dinámicos, que no traen plazo de ofertas.
    for (const filtros of [{ enPlazo: true }, { enPlazo: true, tipo: 'convocatoria' as const }]) {
      const fetchImpl = fetchJson(vacio);
      await buscarTed(fetchImpl, '(x)', filtros, 1, 20);
      expect(consulta(fetchImpl).query).toBe(
        'buyer-country=ESP AND (x) AND notice-type=cn* AND (deadline-receipt-tender-date-lot>=20261122 OR deadline-receipt-request-date-lot>=20261122) SORT BY publication-number DESC',
      );
    }
  });

  it('says what the API does not give for notices before eForms, instead of empty lists', async () => {
    // Así llega uno de 2019: sin título propio, descripción, lotes ni resultados.
    const antiguo = {
      'publication-number': '100234-2019',
      'notice-type': 'can-standard',
      'publication-date': '2019-03-04+01:00',
      'notice-title': { spa: 'España-Majadahonda: Aparatos y material para radioterapia' },
      'buyer-name': { spa: ['Hospital Universitario Puerta de Hierro de Majadahonda'] },
      'classification-cpv': ['33151000'],
      'procedure-type': 'open',
    };
    const fetchImpl = fetchJson({ ...vacio, notices: [antiguo], totalNoticeCount: 1 });
    const [aviso] = (await buscarTed(fetchImpl, '(x)', {}, 1, 20)).avisos;
    expect(aviso).toMatchObject({
      titulo: 'España-Majadahonda: Aparatos y material para radioterapia',
      descripcion: null,
      lotes: null,
      adjudicatarios: null,
      nota: expect.stringContaining('anterior a eForms'),
    });
    const detalle = await verAviso(fetchImpl, '100234-2019');
    expect(detalle).toMatchObject({ procedimiento: 'open', nota: expect.any(String) });
    expect(detalle).not.toHaveProperty('resultados');
  });

  it('names a contract modification as such, not as an award', async () => {
    const modificacion = { ...adjudicacion, 'notice-type': 'can-modif' };
    const [aviso] = (
      await buscarTed(fetchJson({ ...vacio, notices: [modificacion] }), '(x)', {}, 1, 20)
    ).avisos;
    expect(aviso?.tipo).toBe('modificación del contrato');
  });

  it('cannot be broken by quotes or backslashes in the text', async () => {
    const fetchImpl = fetchJson(vacio);
    await buscarTed(fetchImpl, '(x)', { texto: 'tac "64 cortes\\' }, 1, 20);
    expect(consulta(fetchImpl).query).toContain('AND FT~"tac  64 cortes "');
  });

  it('flattens a notice: Spanish text, NUTS without the country, no repeated CPV or winners', async () => {
    const r = await buscarTed(
      fetchJson({ ...vacio, notices: [adjudicacion], totalNoticeCount: 1 }),
      '(x)',
      {},
      1,
      20,
    );
    expect(r).toEqual({
      total: 1,
      pagina: 1,
      avisos: [
        {
          aviso: '109312-2025',
          tipo: 'adjudicación',
          publicado: '2025-02-20',
          titulo: 'Suministro de equipamiento electromédico',
          descripcion: '',
          comprador: "Institut Català de la Salut (L'Hospitalet de Llobregat (Barcelona))",
          lugar: ['ES511'],
          cpv: ['33151000', '50421000'],
          lotes: [],
          plazo_ofertas: null,
          plazo_solicitudes: null,
          valor_estimado: 276684.67,
          adjudicatarios: ['EMPRESA A', 'EMPRESA B'],
          enlace: 'https://ted.europa.eu/es/notice/-/detail/109312-2025',
        },
      ],
    });
  });

  it('gives the results of a notice in TED order, with the file number the PLACSP uses', async () => {
    const aviso = await verAviso(
      fetchJson({ ...vacio, notices: [adjudicacion], totalNoticeCount: 1 }),
      '109312-2025',
    );
    expect(aviso).toMatchObject({
      expediente: 'CS/AH01/1100123/24',
      acuerdo_marco: false,
      resultados: {
        lotes: ['LOT-0001', 'LOT-0002'],
        importe: [59277.9, 155482.58],
        ofertas_recibidas: [2, 1],
        licitadores: ['EMPRESA A', 'EMPRESA B'],
        fecha_adjudicacion: ['2024-11-20'],
      },
    });
  });

  it('says so when TED has no such notice or cut the search short, instead of an empty answer', async () => {
    await expect(verAviso(fetchJson(vacio), '1-2026')).rejects.toThrow(
      'TED no tiene el aviso 1-2026.',
    );
    await expect(
      buscarTed(fetchJson({ ...vacio, timedOut: true }), '(x)', {}, 1, 20),
    ).rejects.toThrow(SourceError);
    await expect(
      buscarTed(fetchJson({ message: 'Syntax error' }, 400), '(x)', {}, 1, 20),
    ).rejects.toThrow('La fuente respondió 400.');
  });
});
