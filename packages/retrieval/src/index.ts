import {
  normalizeText,
  compatibleJurisdiction,
  type Evidence,
  type QueryUnderstanding,
  type Region,
} from '@reforma-digital/core';
import { approvedSource } from '@reforma-digital/government';
const stop = new Set(
  'como que donde cuando cuanto cuales puedo necesito para una uno unos las los del por con sin sobre quiero hacer tengo este esta hay me mi el la de en y a se es al un'.split(
    ' ',
  ),
);
// Only requests without a subject are ambiguous. An unknown subject must still
// reach retrieval: absence from an organization heuristic is not lack of intent.
const genericRequestWords = new Set([
  ...stop,
  ...'mis tus sus esto eso algo alguna algun algunos algun otro otra ayuda ayudas renovar renovacion papeles certificado certificados presentar solicitud solicitudes pago pagar ha llegado carta hago cambio cambiar datos corresponde prestacion prestaciones recurso recursos darme alta puede online cuesta tramite tramites acaba plazo cita documentacion x necesito necesita montar monto crear abrir constituir obtener sacar pedir solicitar hacer'.split(
    ' ',
  ),
]);
// Whole words only: "ibi" also appears inside "recibido", "percibir" or "posibilidad".
const municipalProcedure = /\b(?:padron|empadron|basura)|\bibi\b/;
export function understandQuery(query: string, region?: Region | null): QueryUnderstanding {
  const q = normalizeText(query);
  const limitedCompany =
    /\b(?:sl|s l|srl|s r l|slu|s l u)\b|sociedad (?:de responsabilidad )?limitada/.test(q);
  const locationText = q.replace(/\bno en [a-z ]+(?=,|$)/g, '');
  let jurisdiction: string | undefined;
  let location: string | undefined;
  const places: [RegExp, string, string][] = [
    [/alcala de henares/, 'ES-MD-ALCALA', 'Alcalá de Henares'],
    [/alcobendas/, 'ES-MD-ALCOBENDAS', 'Alcobendas'],
    [/barcelona|cataluna/, 'ES-CT-BARCELONA', 'Barcelona / Cataluña'],
    [/valencia/, 'ES-VC-VALENCIA', 'Valencia'],
    [/sevilla|andalucia/, 'ES-AN-SEVILLA', 'Sevilla / Andalucía'],
    [/bilbao|pais vasco/, 'ES-PV-BILBAO', 'Bilbao / País Vasco'],
    [/galicia|santiago/, 'ES-GA', 'Galicia'],
    [/canarias/, 'ES-CN', 'Canarias'],
    [/murcia/, 'ES-MC', 'Murcia'],
    [/comunidad de madrid/, 'ES-MD', 'Comunidad de Madrid'],
    [/madrid/, 'ES-MD-MADRID', 'Madrid'],
  ];
  const destination =
    locationText.match(/para (?:darme de alta|empadronarme) en ([a-z ]+)/)?.[1] ?? locationText;
  for (const [re, j, l] of places)
    if (re.test(destination)) {
      jurisdiction = j;
      location = l;
      break;
    }
  if (/para toda espana/.test(q)) {
    jurisdiction = 'ES';
    location = 'España';
  }
  if (region !== undefined) {
    if (region === null) {
      if (jurisdiction !== 'ES') {
        jurisdiction = undefined;
        location = undefined;
      }
    } else if (!jurisdiction?.startsWith(`${region}-`)) {
      jurisdiction = region;
      location = undefined;
    }
  }
  const likelyOrganizations: string[] = [];
  const mapping: [RegExp, string][] = [
    [/ley|boe|normativa|procedimiento administrativo/, 'boe'],
    [/dni|pasaporte|fnmt|certificado electronico/, 'administracion'],
    [/dni|pasaporte|cita previa dni/, 'interior'],
    [
      /autonom|hacienda|renta|irpf|iva|036|030|censal|tributari|domicilio fiscal|datos fiscales/,
      'aeat',
    ],
    [/autonom|vida laboral|cotiza|seguridad social|nuss|naf/, 'seg-social'],
    [/paro|desempleo|prestacion contributiva|subsidio|sepe/, 'sepe'],
    [/beca|mec|estudi/, 'educacion'],
    [/conduc|carnet|coche|vehiculo|multa|puntos/, 'dgt'],
    [municipalProcedure, 'ayuntamiento-madrid'],
    [
      /demanda(?:nte)? de empleo|inscrib.*demanda|renov.*demanda|sanitaria|familia numerosa|dependencia|discapacidad/,
      'comunidad-madrid',
    ],
  ];
  for (const [re, id] of mapping) if (re.test(q)) likelyOrganizations.push(id);
  if (limitedCompany) {
    for (const id of ['administracion', 'aeat'])
      if (!likelyOrganizations.includes(id)) likelyOrganizations.push(id);
  }
  let clarification: string | undefined;
  const hasSubject =
    limitedCompany ||
    q.split(' ').some((word) => word.length > 1 && !genericRequestWords.has(word));
  if (!hasSubject)
    clarification =
      '¿Qué trámite o ayuda necesitas? Dime su nombre y, si depende de dónde vives, tu municipio o comunidad autónoma.';
  if (municipalProcedure.test(q) && !jurisdiction)
    clarification =
      '¿En qué municipio quieres hacer el trámite? Los requisitos y el organismo dependen del ayuntamiento.';
  if (
    /demanda(?:nte)? de empleo|inscrib.*demanda|renov.*demanda|sanitaria|familia numerosa|dependencia|discapacidad/.test(
      q,
    ) &&
    !jurisdiction
  )
    clarification = '¿En qué comunidad autónoma necesitas hacer el trámite?';
  if (/me aprobaran|me concederan|mi expediente|citas libres/.test(q))
    clarification =
      'No puedo consultar expedientes personales, garantizar una concesión ni comprobar citas disponibles. Puedo ayudarte a encontrar los requisitos y canales oficiales del trámite.';
  const keywords = q.split(' ').filter((w) => w.length > 2 && !stop.has(w));
  if (limitedCompany) keywords.push('sociedad', 'limitada', 'constitución', 'empresa');
  const expansions: [RegExp, string[]][] = [
    [/autonom/, ['alta', 'trabajo', 'autónomo']],
    [/paro/, ['prestación', 'desempleo']],
    [/mec/, ['beca', 'general']],
    [/empadron/, ['padrón']],
    [/carnet/, ['permiso', 'conducir']],
    [/dni/, ['dni', 'documento', 'identidad', 'cita']],
  ];
  for (const [re, words] of expansions) if (re.test(q)) keywords.push(...words);
  const year = q.match(/para presentar la renta (?:de )?(20\d{2})/) ?? q.match(/\b(20\d{2})\b/);
  return {
    normalizedQuery: q,
    intent: /document|requisit/.test(q)
      ? 'requirements'
      : /cuanto|coste|cuesta|importe/.test(q)
        ? 'cost'
        : /plazo|cuando/.test(q)
          ? 'deadline'
          : 'procedure',
    ...(location ? { location } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(region !== undefined ? { region } : {}),
    likelyOrganizations,
    keywords: [...new Set(keywords)],
    ...(clarification ? { clarification } : {}),
    temporal: /plazo|importe|cuesta|coste|renta|beca|cuota|202\d/.test(q),
    ...(year ? { requestedYear: Number(year[1]) } : {}),
  };
}
/** Offline examples only; live queries always use Web Search. */
export function previewCandidates(q: QueryUnderstanding, corpus: Evidence[]): Evidence[] {
  return corpus
    .filter(
      (e) =>
        e.available &&
        compatibleJurisdiction(e.jurisdiction, q.jurisdiction) &&
        approvedSource(e.canonicalUrl, e.sourceId) &&
        (!e.validUntil || Date.parse(e.validUntil) > Date.now()) &&
        (!q.likelyOrganizations.length || q.likelyOrganizations.includes(e.sourceId)),
    )
    .map((e) => {
      const text = normalizeText(e.title + ' ' + e.content);
      return {
        ...e,
        score: q.keywords.filter((w) => text.includes(normalizeText(w))).length,
      };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
}
