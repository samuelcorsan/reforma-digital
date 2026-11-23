// Los anuncios de contratación de compradores españoles en TED (Tenders Electronic Daily, el suplemento de
// contratación del Diario Oficial de la UE): su API de búsqueda, sin clave. Solo llegan los contratos armonizados;
// los demás están únicamente en la Plataforma de Contratación del Sector Público.
import { get, SourceError, type Fetch } from './comun';

const API = 'https://api.ted.europa.eu/v3/notices/search';
export const SOURCE_TED =
  'TED (Tenders Electronic Daily), Oficina de Publicaciones de la Unión Europea (ted.europa.eu): los anuncios se pueden reutilizar libremente (Decisión 2011/833/UE), © Unión Europea.';

// Una modificación de contrato también es «can», pero no es una adjudicación.
const TIPO_TED = {
  previo: 'notice-type=pin*',
  convocatoria: 'notice-type=cn*',
  adjudicacion: '(notice-type=can* AND NOT notice-type=can-modif)',
};
export type Tipo = keyof typeof TIPO_TED;
export const TIPOS = Object.keys(TIPO_TED) as [Tipo, ...Tipo[]];
const NOMBRE_TIPO: Record<string, string> = {
  pin: 'anuncio previo',
  cn: 'convocatoria',
  can: 'adjudicación',
  'can-modif': 'modificación del contrato',
  veat: 'transparencia previa',
  corr: 'corrección',
};

// Los avisos anteriores a eForms (hasta finales de 2023) llegan sin título, descripción, lotes ni resultados: la API
// de búsqueda no los desglosa. Se dice, en vez de dar listas vacías que parecerían «sin adjudicatario».
const NOTA_ANTIGUO =
  'Aviso anterior a eForms (hasta finales de 2023): la API de TED no da su título, descripción, lotes, plazos, valor estimado ni resultados, y el título es el genérico de TED (país, ciudad y nombre del CPV). El detalle está en el enlace.';

/**
 * Los campos multilingües llegan como idioma → texto o lista. Los demás, como texto o como lista según el aviso
 * (un solo lote o varios), en el orden en que TED los publica.
 */
type Lista = string | string[];
type Multi = Record<string, Lista>;
type Aviso = {
  'publication-number': string;
  'notice-type': string;
  'publication-date': string;
  'notice-title'?: Multi;
  'title-proc'?: Multi;
  'description-proc'?: Multi;
  'buyer-name'?: Multi;
  'organisation-city-buyer'?: Lista;
  'place-of-performance'?: Lista;
  'classification-cpv'?: Lista;
  'deadline-receipt-tender-date-lot'?: Lista;
  'deadline-receipt-request-date-lot'?: Lista;
  'estimated-value-proc'?: Lista;
  'winner-name'?: Multi;
  'procedure-type'?: Lista;
  'internal-identifier-proc'?: Lista;
  'document-url-lot'?: Lista;
  'title-lot'?: Multi;
  'estimated-value-lot'?: Lista;
  'framework-agreement-lot'?: Lista;
  'result-lot-identifier'?: Lista;
  'tender-value'?: Lista;
  'received-submissions-type-val'?: Lista;
  'organisation-name-tenderer'?: Multi;
  'winner-decision-date'?: Lista;
};

const LISTA = [
  'publication-number',
  'notice-type',
  'publication-date',
  'notice-title',
  'title-proc',
  'description-proc',
  'buyer-name',
  'organisation-city-buyer',
  'place-of-performance',
  'classification-cpv',
  'deadline-receipt-tender-date-lot',
  'deadline-receipt-request-date-lot',
  'estimated-value-proc',
  'winner-name',
  'title-lot',
] as const;
const DETALLE = [
  ...LISTA,
  'procedure-type',
  'internal-identifier-proc',
  'document-url-lot',
  'estimated-value-lot',
  'framework-agreement-lot',
  'result-lot-identifier',
  'tender-value',
  'received-submissions-type-val',
  'organisation-name-tenderer',
  'winner-decision-date',
] as const;

const lista = (valor: Lista | undefined) => (valor === undefined ? [] : [valor].flat());
/** En castellano si el anuncio lo trae; si no, en su idioma (catalán, euskera, gallego…). */
const enCastellano = (valor: Multi | undefined) =>
  lista(valor && (valor.spa ?? Object.values(valor)[0]));
const unicos = (valores: string[]) => [...new Set(valores)];
const fecha = (valor: string) => valor.slice(0, 10);
const primero = (valor: Lista | undefined) => lista(valor)[0] ?? null;
const sinGuiones = (dia: string) => dia.replaceAll('-', '');

async function buscar(
  fetchImpl: Fetch,
  query: string,
  fields: readonly string[],
  page: number,
  limit: number,
) {
  const body = (await (
    await get(fetchImpl, API, 'application/json', { query, fields, page, limit, scope: 'ALL' })
  ).json()) as { notices: Aviso[]; totalNoticeCount: number; timedOut: boolean };
  // Una búsqueda cortada por tiempo trae solo parte de los avisos: no se presenta como completa.
  if (body.timedOut)
    throw new SourceError(
      'TED no terminó la búsqueda a tiempo. Acota el periodo, el lugar o el texto.',
    );
  return body;
}

function resumen(n: Aviso) {
  const antiguo = n['title-proc'] === undefined;
  const ciudad = primero(n['organisation-city-buyer']);
  const plazo = (campo: 'deadline-receipt-tender-date-lot' | 'deadline-receipt-request-date-lot') =>
    lista(n[campo]).map(fecha).sort()[0] ?? null;
  const valor = primero(n['estimated-value-proc']);
  const tipo = n['notice-type'];
  return {
    aviso: n['publication-number'],
    tipo: NOMBRE_TIPO[tipo] ?? NOMBRE_TIPO[tipo.replace(/-.*/, '')] ?? tipo,
    publicado: fecha(n['publication-date']),
    titulo: enCastellano(antiguo ? n['notice-title'] : n['title-proc']).join(' '),
    descripcion: antiguo ? null : enCastellano(n['description-proc']).join(' '),
    comprador: [
      ...enCastellano(n['buyer-name']).slice(0, 1),
      ...(ciudad ? [`(${ciudad})`] : []),
    ].join(' '),
    // El lugar mezcla códigos NUTS (ES112) con el del país (ESP).
    lugar: unicos(lista(n['place-of-performance']).filter((c) => /^ES\d/.test(c))),
    cpv: unicos(lista(n['classification-cpv'])),
    lotes: antiguo ? null : enCastellano(n['title-lot']),
    plazo_ofertas: plazo('deadline-receipt-tender-date-lot'),
    // En los restringidos, los negociados y los sistemas dinámicos, el plazo es el de pedir participar.
    plazo_solicitudes: plazo('deadline-receipt-request-date-lot'),
    valor_estimado: valor === null ? null : Number(valor),
    adjudicatarios: antiguo ? null : unicos(enCastellano(n['winner-name'])),
    ...(antiguo ? { nota: NOTA_ANTIGUO } : {}),
    enlace: `https://ted.europa.eu/es/notice/-/detail/${n['publication-number']}`,
  };
}
export type AvisoTed = ReturnType<typeof resumen>;

/** `sector` es la parte de la consulta que dice qué se busca (CPV y palabras, en la sintaxis de TED). */
export async function buscarTed(
  fetchImpl: Fetch,
  sector: string,
  filtros: {
    texto?: string;
    lugar?: string;
    tipo?: Tipo;
    enPlazo?: boolean;
    desde?: string;
    hasta?: string;
  },
  pagina: number,
  limite: number,
) {
  const { texto, lugar, tipo, enPlazo, desde, hasta } = filtros;
  const hoy = sinGuiones(new Date().toISOString().slice(0, 10));
  const tipoTed = enPlazo ? 'convocatoria' : tipo;
  const partes = [
    'buyer-country=ESP',
    sector,
    ...(texto ? [frase(texto)] : []),
    ...(lugar ? [`place-of-performance=${lugar}*`] : []),
    ...(tipoTed ? [TIPO_TED[tipoTed]] : []),
    ...(enPlazo
      ? [`(deadline-receipt-tender-date-lot>=${hoy} OR deadline-receipt-request-date-lot>=${hoy})`]
      : []),
    ...(desde ? [`publication-date>=${sinGuiones(desde)}`] : []),
    ...(hasta ? [`publication-date<=${sinGuiones(hasta)}`] : []),
  ];
  const body = await buscar(
    fetchImpl,
    `${partes.join(' AND ')} SORT BY publication-number DESC`,
    LISTA,
    pagina,
    limite,
  );
  return { total: body.totalNoticeCount, pagina, avisos: body.notices.map(resumen) };
}

/** Búsqueda de texto libre de TED, que no distingue tildes. Una comilla o una barra romperían la consulta. */
export const frase = (texto: string) => `FT~"${texto.replaceAll(/["\\]/g, ' ')}"`;

export async function verAviso(fetchImpl: Fetch, aviso: string) {
  const body = await buscar(fetchImpl, `publication-number=${aviso}`, DETALLE, 1, 1);
  const n = body.notices[0];
  if (!n) throw new SourceError(`TED no tiene el aviso ${aviso}.`);
  const r = resumen(n);
  const procedimiento = primero(n['procedure-type']);
  if (r.nota) return { ...r, procedimiento };
  return {
    ...r,
    procedimiento,
    expediente: primero(n['internal-identifier-proc']),
    pliegos: unicos(lista(n['document-url-lot'])),
    acuerdo_marco: lista(n['framework-agreement-lot']).some((v) => v !== 'none'),
    valor_estimado_lotes: lista(n['estimated-value-lot']).map(Number),
    // TED no enlaza cada importe con su lote y su adjudicatario: van en el orden en que los publica.
    resultados: {
      lotes: lista(n['result-lot-identifier']),
      importe: lista(n['tender-value']).map(Number),
      ofertas_recibidas: lista(n['received-submissions-type-val']).map(Number),
      adjudicatarios: enCastellano(n['winner-name']),
      licitadores: unicos(enCastellano(n['organisation-name-tenderer'])),
      fecha_adjudicacion: unicos(lista(n['winner-decision-date']).map(fecha)),
    },
  };
}
