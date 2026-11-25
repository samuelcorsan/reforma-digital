// Servidor MCP de las incidencias de tráfico de la DGT: un port a TypeScript de la parte de
// incidencias de trafico-cli (https://github.com/aam9063/trafico-cli, MIT, v0.4.1, commit
// b1b0026). Porta su medición del feed, su mapeo de tipos y su nota de cobertura
// (docs/feeds.md) y reutiliza sus fixtures recortadas en testdata/situations.xml.
//
// El feed es el DATEX II v3.7 del Punto de Acceso Nacional de la DGT: XML de unos 7 MB que se
// renueva cada 60 s, sin clave y sin registro, con licencia CC BY.
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const FEED = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';
const SOURCE =
  'Fuente: DGT, Punto de Acceso Nacional (nap.dgt.es), licencia CC BY. Cítala al usar los datos.';

// La nota nombra al gestor que el feed deja fuera, nunca a las provincias: la DGT sí publica
// incidencias suyas en Barcelona, Girona y Tarragona, así que «sin datos de Cataluña» sería falso.
const COBERTURA =
  'Cobertura de la DGT: no incluye las incidencias gestionadas por la SCT (Cataluña) ni por el Gobierno Vasco';

// Las provincias de las comunidades con un gestor de carreteras distinto del Estado. La nota se
// omite solo cuando el filtro de provincia deja la consulta fuera de todas ellas, porque entonces
// la ausencia de incidencias no la explica ningún gestor que falte.
const PROVINCIAS_CON_GESTOR = [
  'Barcelona',
  'Girona',
  'Tarragona',
  'Lleida',
  'Araba/Álava',
  'Bizkaia',
  'Gipuzkoa',
];

const INSTRUCCIONES = `Incidencias de tráfico activas en las carreteras de España, publicadas por la DGT cada minuto.
- buscar_incidencias busca por carretera y punto kilométrico, por provincia, por tipo y por sentido del recorrido.
- incidencias_cerca busca por coordenadas y radio en kilómetros.
- La DGT solo publica la severidad en una parte de las incidencias: cuando falta llega como «desconocida», nunca como «baja».
- Cada respuesta dice cuándo se publicó el feed y qué cobertura tiene.
${COBERTURA}
${SOURCE}`;

/** Los tipos normalizados de incidencia. Son parte del contrato. */
const TIPOS = [
  'accidente',
  'retencion',
  'obras',
  'corte',
  'obstaculo',
  'meteorologia',
  'restriccion',
  'evento',
  'otro',
] as const;
type Tipo = (typeof TIPOS)[number];
type Severidad = 'baja' | 'media' | 'alta' | 'desconocida';
type Estado = 'previsto' | 'activo' | 'terminado';
type Sentido = 'positivo' | 'negativo' | 'ambos';

/** <sit:causeType> al tipo normalizado, para cuando no hay causa detallada. */
const TIPO_POR_CAUSA: Record<string, Tipo> = {
  accident: 'accidente',
  roadMaintenance: 'obras',
  abnormalTraffic: 'retencion',
  poorEnvironment: 'meteorologia',
  environmentalObstruction: 'meteorologia',
  obstruction: 'obstaculo',
  vehicleObstruction: 'obstaculo',
  infrastructureDamageObstruction: 'obstaculo',
  disturbance: 'evento',
  roadOrCarriagewayOrLaneManagement: 'restriccion',
  speedManagement: 'restriccion',
  nonWeatherRelatedRoadConditions: 'otro',
  generalInstructionOrMessageToRoadUsers: 'otro',
  genericSituationRecord: 'otro',
};

/** El hijo de <sit:detailedCauseType> al tipo normalizado: gana sobre <sit:causeType>. */
const TIPO_POR_CAUSA_DETALLADA: Record<string, Record<string, Tipo>> = {
  accidentType: { accident: 'accidente' },
  roadMaintenanceType: { roadworks: 'obras' },
  roadOrCarriagewayOrLaneManagementType: {
    // Cerrar la calzada es un corte; lo que deja algún carril abierto es una restricción.
    carriagewayClosures: 'corte',
    roadClosed: 'corte',
    laneClosures: 'corte',
    intermittentShortTermClosures: 'corte',
    singleAlternateLineTraffic: 'restriccion',
    narrowLanes: 'restriccion',
    lanesDeviated: 'restriccion',
    newRoadworksLayout: 'restriccion',
    useOfSpecifiedLanesOrCarriagewaysAllowed: 'restriccion',
    doNotUseSpecifiedLanesOrCarriageways: 'restriccion',
    weightRestrictionInOperation: 'restriccion',
    other: 'restriccion',
  },
  speedManagementType: { speedRestrictionInOperation: 'restriccion' },
  vehicleObstructionType: {
    vehicleStuck: 'obstaculo',
    vehicleOnFire: 'obstaculo',
    vehicleWithOverwideLoad: 'obstaculo',
    abnormalLoad: 'obstaculo',
  },
  obstructionType: {
    obstructionOnTheRoad: 'obstaculo',
    objectOnTheRoad: 'obstaculo',
    spillageOnTheRoad: 'obstaculo',
    peopleOnTheRoadway: 'obstaculo',
  },
  infrastructureDamageType: { damagedRoadSurface: 'obstaculo' },
  environmentalObstructionType: {
    rockfalls: 'meteorologia',
    flooding: 'meteorologia',
    avalanches: 'meteorologia',
  },
  abnormalTrafficType: {
    slowTraffic: 'retencion',
    heavyTraffic: 'retencion',
    queuingTraffic: 'retencion',
    stationaryTraffic: 'retencion',
  },
  poorEnvironmentType: {
    fog: 'meteorologia',
    visibilityReduced: 'meteorologia',
    heavyRain: 'meteorologia',
    snowFall: 'meteorologia',
    strongWinds: 'meteorologia',
  },
  nonWeatherRelatedRoadConditionType: { roadSurfaceInPoorCondition: 'otro' },
  disturbanceActivityType: { demonstration: 'evento' },
  generalInstructionToRoadUsersType: { driveCarefully: 'otro' },
};

const SEVERIDAD: Record<string, Severidad> = {
  low: 'baja',
  medium: 'media',
  high: 'alta',
  highest: 'alta',
};

export type Posicion = { lat: number; lon: number };

/** Una incidencia del contrato. Lo que el feed no trae llega como null, nunca rellenado. */
export type Incidencia = {
  /** «dgt:» y el id del registro, único por localización y causa. */
  id: string;
  /** El id de la situación DATEX II, que agrupa uno o varios registros. */
  situacion: string;
  tipo: Tipo;
  /** El valor DATEX II original de la causa, tal cual lo publica la DGT. */
  subtipo: string;
  severidad: Severidad;
  estado: Estado;
  carretera: string;
  /** El sentido del recorrido. No es el rumbo geográfico del feed. */
  sentido: Sentido | null;
  pk: { desde: number; hasta: number | null } | null;
  ubicacion: {
    inicio: Posicion | null;
    fin: Posicion | null;
    provincia: string;
    municipio: string;
  };
  /** Los carriles afectados, en el vocabulario DATEX II. El feed no publica el total. */
  carriles_afectados: string[];
  inicio: string | null;
  fin: string | null;
  actualizado: string;
};

export type Feed = { publicado: string; incidencias: Incidencia[] };

// --- Lectura del XML -------------------------------------------------------------------------

// Los prefijos de namespace son arbitrarios en cada publicación, así que se quitan y se navega
// por el nombre local del elemento. Los atributos quedan como «@_nombre» porque el id del
// registro y el de la situación son atributos.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  // La declaración <?xml?> no es un elemento: sin esto encabeza el documento parseado.
  ignoreDeclaration: true,
  trimValues: true,
  // Los números se leen aquí, campo a campo: no todo texto del feed es un número.
  parseTagValue: false,
  isArray: (nombre) =>
    nombre === 'situation' || nombre === 'situationRecord' || nombre === 'laneUsage',
});

type Nodo = { [clave: string]: Valor };

/** Un valor del XML ya parseado: el texto de una hoja, un nodo, o una lista de ambos. */
type Valor = string | Nodo | Valor[];

const esNodo = (valor: unknown): valor is Nodo =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** El texto de un elemento hoja, que lleva «#text» cuando además trae atributos. */
function texto(valor: Valor | undefined): string {
  if (typeof valor === 'string') return valor.trim();
  if (esNodo(valor)) {
    const t = valor['#text'];
    return typeof t === 'string' ? t.trim() : '';
  }
  return '';
}

function hijo(nodo: unknown, nombre: string): Valor | undefined {
  return esNodo(nodo) ? nodo[nombre] : undefined;
}

function ruta(nodo: unknown, ...nombres: string[]): Valor | undefined {
  let actual: Valor | undefined = esNodo(nodo) ? nodo : undefined;
  for (const nombre of nombres) actual = hijo(actual, nombre);
  return actual;
}

function lista(valor: Valor | undefined): Valor[] {
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function textoDe(valor: Valor | undefined): string[] {
  return lista(valor)
    .map((v) => texto(v))
    .filter(Boolean);
}

function numero(valor: Valor | undefined): number | undefined {
  const t = texto(valor);
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function atributo(nodo: Valor | undefined, nombre: string): string {
  const v = hijo(nodo, `@_${nombre}`);
  return typeof v === 'string' ? v : '';
}

/** Una fecha del feed, en ISO 8601 UTC. Vacía es null; ilegible es un cambio de feed. */
function fecha(valor: string, campo: string): string | null {
  if (valor === '') return null;
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime()))
    throw new SourceError(
      `El feed de la DGT trae una fecha ${campo} que no se puede leer. Prueba más tarde.`,
    );
  return instante.toISOString();
}

function sentidoDe(valor: Valor | undefined): Sentido | null {
  const v = texto(valor);
  if (v === 'positive') return 'positivo';
  if (v === 'negative') return 'negativo';
  if (v === 'both') return 'ambos';
  return null;
}

function posicion(punto: Valor | undefined): Posicion | null {
  const lat = numero(ruta(punto, 'pointCoordinates', 'latitude'));
  const lon = numero(ruta(punto, 'pointCoordinates', 'longitude'));
  return lat === undefined || lon === undefined ? null : { lat, lon };
}

function extension(punto: Valor | undefined, campo: string): string {
  return texto(
    ruta(punto, '_tpegNonJunctionPointExtension', 'extendedTpegNonJunctionPoint', campo),
  );
}

function pkDe(desde: Valor | undefined, hasta: Valor | undefined): Incidencia['pk'] {
  const inicio = numero(extension(desde, 'kilometerPoint'));
  if (inicio === undefined) return null;
  const fin = numero(extension(hasta, 'kilometerPoint'));
  return { desde: inicio, hasta: fin === undefined ? null : fin };
}

/**
 * El estado se deriva de la ventana de validez contra el reloj que se pasa, nunca del
 * validityStatus del feed: una caché vieja no puede etiquetar de activa una incidencia acabada.
 */
function estadoDe(inicio: string | null, fin: string | null, ahora: number): Estado {
  if (inicio !== null && ahora < Date.parse(inicio)) return 'previsto';
  if (fin !== null && ahora > Date.parse(fin)) return 'terminado';
  return 'activo';
}

function tipoDe(causa: Valor | undefined, elementoDetallado: string, valorDetallado: string): Tipo {
  const porDetalle = TIPO_POR_CAUSA_DETALLADA[elementoDetallado];
  if (porDetalle !== undefined) {
    const tipo = porDetalle[valorDetallado];
    if (tipo !== undefined) return tipo;
  }
  const porCausa = TIPO_POR_CAUSA[texto(hijo(causa, 'causeType'))];
  return porCausa === undefined ? 'otro' : porCausa;
}

function convertir(
  situacionId: string,
  severidadGlobal: string,
  registro: Valor | undefined,
  ahora: number,
): Incidencia {
  const causa = hijo(registro, 'cause');
  const detallada = hijo(causa, 'detailedCauseType');
  const elementoDetallado = esNodo(detallada) ? (Object.keys(detallada)[0] ?? '') : '';
  const valorDetallado = texto(hijo(detallada, elementoDetallado));

  const localizacion = hijo(registro, 'locationReference');
  const descripcion = hijo(localizacion, 'supplementaryPositionalDescription');

  // Una localización es un tramo con desde/hasta o un punto suelto; las dos comparten la
  // extensión española con el punto kilométrico, la provincia y el municipio.
  const tramo = hijo(localizacion, 'tpegLinearLocation');
  const punto = hijo(localizacion, 'tpegPointLocation');
  const geom =
    tramo === undefined
      ? {
          sentido: ruta(
            punto,
            '_tpegSimplePointExtension',
            'extendedTpegSimplePoint',
            'tpegDirectionRoad',
          ),
          desde: hijo(punto, 'point'),
          hasta: undefined,
        }
      : {
          sentido: ruta(
            tramo,
            '_tpegLinearLocationExtension',
            'extendedTpegLinearLocation',
            'tpegDirectionRoad',
          ),
          desde: hijo(tramo, 'from'),
          hasta: hijo(tramo, 'to'),
        };

  const inicio = fecha(
    texto(ruta(registro, 'validity', 'validityTimeSpecification', 'overallStartTime')),
    'de inicio',
  );
  const fin = fecha(
    texto(ruta(registro, 'validity', 'validityTimeSpecification', 'overallEndTime')),
    'de fin',
  );
  const actualizado = fecha(
    texto(hijo(registro, 'situationRecordVersionTime')),
    'de actualización',
  );

  return {
    id: `dgt:${atributo(registro, 'id')}`,
    situacion: situacionId,
    tipo: tipoDe(causa, elementoDetallado, valorDetallado),
    subtipo: valorDetallado || texto(hijo(causa, 'causeType')),
    severidad: SEVERIDAD[texto(hijo(registro, 'severity')) || severidadGlobal] ?? 'desconocida',
    estado: estadoDe(inicio, fin, ahora),
    carretera: normalizarCarretera(texto(ruta(descripcion, 'roadInformation', 'roadName'))),
    sentido: sentidoDe(geom.sentido),
    pk: pkDe(geom.desde, geom.hasta),
    ubicacion: {
      inicio: posicion(geom.desde),
      fin: posicion(geom.hasta),
      provincia: extension(geom.desde, 'province') || extension(geom.hasta, 'province'),
      municipio: extension(geom.desde, 'municipality') || extension(geom.hasta, 'municipality'),
    },
    carriles_afectados: textoDe(ruta(descripcion, 'carriageway', 'lane', 'laneUsage')),
    inicio,
    fin,
    actualizado: actualizado === null ? '' : actualizado,
  };
}

/**
 * Lee una publicación de situaciones de la DGT (DATEX II v3.7) y la convierte al contrato.
 * `ahora` es el reloj con el que se deriva el estado: quien llama lo controla, así los tests y
 * una caché no dependen del reloj de pared.
 *
 * La hora de publicación es obligatoria: es la única fuente válida de frescura, y un cuerpo
 * vacío o truncado tiene que fallar en vez de parecer un feed sin incidencias.
 */
export function parsearSituaciones(xml: string, ahora: number): Feed {
  if (XMLValidator.validate(xml) !== true)
    throw new SourceError('El feed de la DGT no llegó como un XML legible. Prueba más tarde.');

  const documento: unknown = parser.parse(xml);
  // El elemento raíz de una SituationPublication es d2:payload, y el prefijo ya está quitado.
  const raiz = hijo(documento, 'payload');
  if (!esNodo(raiz))
    throw new SourceError('El feed de la DGT llegó vacío o con otra forma. Prueba más tarde.');

  const publicado = fecha(texto(hijo(raiz, 'publicationTime')), 'de publicación');
  if (publicado === null)
    throw new SourceError(
      'El feed de la DGT no dice cuándo se publicó, así que no se puede saber si está al día.',
    );

  const incidencias: Incidencia[] = [];
  for (const situacion of lista(hijo(raiz, 'situation'))) {
    const id = atributo(situacion, 'id');
    const severidadGlobal = texto(hijo(situacion, 'overallSeverity'));
    for (const registro of lista(hijo(situacion, 'situationRecord')))
      incidencias.push(convertir(id, severidadGlobal, registro, ahora));
  }
  return { publicado, incidencias };
}

/** Descarga el feed y lo convierte. Es la única función de este módulo que sale a la red. */
export async function leerFeed(fetchImpl: Fetch): Promise<{ feed: Feed; consultado: string }> {
  const consultado = new Date().toISOString();
  const cuerpo = await (await get(fetchImpl, FEED, 'application/xml', undefined, 30_000)).text();
  return { feed: parsearSituaciones(cuerpo, Date.now()), consultado };
}

/** El feed se renueva cada 60 s: dentro de esa ventana la respuesta es la misma. */
const TTL_MS = 60_000;

/**
 * Una descarga por minuto y proceso: el feed se renueva cada 60 s, así que dentro de esa ventana
 * la respuesta es la misma y `desde_cache` lo dice.
 */
export function descargaConCache(fetchImpl: Fetch) {
  let ultimo: { at: number; feed: Feed; consultado: string } | undefined;
  return async () => {
    const ahora = Date.now();
    if (ultimo !== undefined && ahora - ultimo.at < TTL_MS)
      return { feed: ultimo.feed, consultado: ultimo.consultado, desdeCache: true };
    const { feed, consultado } = await leerFeed(fetchImpl);
    ultimo = { at: ahora, feed, consultado };
    return { feed, consultado, desdeCache: false };
  };
}

// --- Normalización y filtros -----------------------------------------------------------------

const CARRETERA_NUMERADA = /^([A-Z]{1,3})[ .]?(\d.*)$/;

/**
 * El nombre canónico de una carretera: mayúsculas, espacios colapsados y un solo guion entre la
 * letra y el número, así que «a7», «A 7» y «A-7» son la misma. Nunca inventa un guion donde el
 * origen no lo tiene («GC-1 AM» o «Avda. Andalucía» se quedan como están).
 */
export function normalizarCarretera(nombre: string): string {
  const limpio = nombre.toUpperCase().split(/\s+/).filter(Boolean).join(' ');
  const partes = CARRETERA_NUMERADA.exec(limpio);
  if (partes === null || partes[1] === undefined || partes[2] === undefined) return limpio;
  return `${partes[1]}-${partes[2]}`;
}

/** El mismo criterio de provincia que el filtro de origen: sin tildes ni mayúsculas, y las dos
 * mitades de un nombre bilingüe («Alacant/Alicante») valen igual. */
export function mismaProvincia(a: string, b: string): boolean {
  const na = fold(a);
  const nb = fold(b);
  if (na === nb) return true;
  const mitad = nb.split('/');
  return na.split('/').some((h) => h !== '' && mitad.includes(h));
}

type Resultado = { incidencias: Incidencia[]; total: number; sinUbicacion: number };

export type Filtro = {
  carretera?: string;
  pkDesde?: number;
  pkHasta?: number;
  provincia?: string;
  tipo?: Tipo[];
  sentido?: 'positivo' | 'negativo';
};

/** [inferior, superior] de un intervalo con extremos opcionales; un solo extremo es un punto. */
function extremos(desde: number | null, hasta: number | null): [number | null, number | null] {
  if (desde !== null && hasta !== null) return desde <= hasta ? [desde, hasta] : [hasta, desde];
  if (desde !== null) return [desde, desde];
  if (hasta !== null) return [hasta, hasta];
  return [null, null];
}

/**
 * El rango de puntos kilométricos se compara por solape, no por contención: una incidencia que
 * ocupa del 95 al 105 entra en una consulta del 100 al 140. Un registro sin punto kilométrico no
 * afirma nada sobre su extensión y por tanto no coincide.
 */
function seSolapaPk(pk: Incidencia['pk'], desde: number | null, hasta: number | null): boolean {
  if (pk === null) return false;
  const [lo, hi] = extremos(pk.desde, pk.hasta);
  const [rlo, rhi] = extremos(desde, hasta);
  if (rlo !== null && hi !== null && rlo > hi) return false;
  if (lo !== null && rhi !== null && lo > rhi) return false;
  return true;
}

function sentidoEncaja(incidente: Sentido | null, filtro: 'positivo' | 'negativo'): boolean {
  if (incidente === null) return false;
  // Una incidencia que corta los dos sentidos afecta también al que se pidió.
  if (incidente === 'ambos') return true;
  return incidente === filtro;
}

/**
 * Las incidencias activas que cumplen el filtro. Solo cuentan como «sin ubicación» las que
 * habrían coincidido y no se pueden situar por provincia, así que el número explica cuántas
 * filas se quedaron fuera por falta de dato y no por no encajar.
 */
export function buscar(incidencias: Incidencia[], filtro: Filtro, limite: number): Resultado {
  const desde = filtro.pkDesde === undefined ? null : filtro.pkDesde;
  const hasta = filtro.pkHasta === undefined ? null : filtro.pkHasta;
  const pidePk = desde !== null || hasta !== null;

  if (pidePk && filtro.carretera === undefined)
    throw new SourceError(
      'Para filtrar por punto kilométrico hay que indicar también la carretera.',
    );
  if (desde !== null && hasta !== null && desde > hasta)
    throw new SourceError(
      'El rango de puntos kilométricos está invertido: pk_desde supera a pk_hasta.',
    );

  const carretera = filtro.carretera === undefined ? null : normalizarCarretera(filtro.carretera);
  const encontradas: Incidencia[] = [];
  let sinUbicacion = 0;

  for (const incidencia of incidencias) {
    if (incidencia.estado !== 'activo') continue;
    if (carretera !== null && incidencia.carretera !== carretera) continue;
    if (pidePk && !seSolapaPk(incidencia.pk, desde, hasta)) continue;
    if (filtro.sentido !== undefined && !sentidoEncaja(incidencia.sentido, filtro.sentido))
      continue;
    if (
      filtro.tipo !== undefined &&
      filtro.tipo.length > 0 &&
      !filtro.tipo.includes(incidencia.tipo)
    )
      continue;
    if (filtro.provincia !== undefined) {
      if (incidencia.ubicacion.provincia === '') {
        sinUbicacion++;
        continue;
      }
      if (!mismaProvincia(incidencia.ubicacion.provincia, filtro.provincia)) continue;
    }
    encontradas.push(incidencia);
  }

  return { incidencias: encontradas.slice(0, limite), total: encontradas.length, sinUbicacion };
}

const RADIO_TIERRA_KM = 6371.0088;

/** La distancia en línea recta entre dos posiciones, en kilómetros. */
function distanciaKm(a: Posicion, b: Posicion): number {
  const radianes = Math.PI / 180;
  const lat1 = a.lat * radianes;
  const lat2 = b.lat * radianes;
  const dLat = lat2 - lat1;
  const dLon = (b.lon - a.lon) * radianes;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Las incidencias activas cuyo punto de inicio cae dentro del radio, con el borde incluido. Una
 * incidencia sin coordenadas no puede situarse y cuenta como «sin ubicación».
 */
export function cercanas(
  incidencias: Incidencia[],
  centro: Posicion,
  radioKm: number,
  limite: number,
): Resultado {
  const encontradas: Incidencia[] = [];
  let sinUbicacion = 0;

  for (const incidencia of incidencias) {
    if (incidencia.estado !== 'activo') continue;
    const punto = incidencia.ubicacion.inicio;
    if (punto === null) {
      sinUbicacion++;
      continue;
    }
    if (distanciaKm(centro, punto) <= radioKm) encontradas.push(incidencia);
  }

  return { incidencias: encontradas.slice(0, limite), total: encontradas.length, sinUbicacion };
}

// --- El servidor ----------------------------------------------------------------------------

/** La nota de cobertura solo se omite si el filtro deja la consulta fuera de las comunidades
 * con gestor propio: ahí la cobertura de la DGT para esa pregunta sí es completa. */
function llevaCobertura(provincia: string | undefined): boolean {
  if (provincia === undefined) return true;
  return PROVINCIAS_CON_GESTOR.some((conGestor) => mismaProvincia(provincia, conGestor));
}

type Respuesta<T> = {
  schema_version: 1;
  consulta: T;
  meta: {
    publicado: string;
    consultado: string;
    edad_segundos: number;
    desde_cache: boolean;
    total: number;
    sin_ubicacion: number;
    cobertura?: string;
  };
  incidencias: Incidencia[];
  atribucion: { fuente: string; licencia: string; url: string; consultado: string };
};

function respuesta<T>(
  feed: Feed,
  consultado: string,
  desdeCache: boolean,
  consulta: T,
  resultado: Resultado,
  conCobertura: boolean,
): Respuesta<T> {
  const edad = Math.floor((Date.parse(consultado) - Date.parse(feed.publicado)) / 1000);
  const meta: Respuesta<T>['meta'] = {
    publicado: feed.publicado,
    consultado,
    // Un desfase de reloj nunca da una edad negativa.
    edad_segundos: edad < 0 ? 0 : edad,
    desde_cache: desdeCache,
    total: resultado.total,
    sin_ubicacion: resultado.sinUbicacion,
  };
  if (conCobertura) meta.cobertura = COBERTURA;
  return {
    schema_version: 1,
    consulta,
    meta,
    incidencias: resultado.incidencias,
    atribucion: {
      fuente: 'DGT, Punto de Acceso Nacional',
      licencia: 'CC BY',
      url: 'https://nap.dgt.es/',
      consultado,
    },
  };
}

export function createTraficoMcp(fetchImpl: Fetch = fetch) {
  const descargar = descargaConCache(fetchImpl);

  return server(
    { name: 'reforma-digital-trafico', title: 'Incidencias de tráfico' },
    INSTRUCCIONES,
    (s) => {
      s.registerTool(
        'buscar_incidencias',
        {
          title: 'Buscar incidencias',
          description:
            'Las incidencias de tráfico activas en una carretera y un tramo de puntos kilométricos, o en una provincia, filtrando por tipo y sentido del recorrido.',
          inputSchema: z.object({
            carretera: z
              .string()
              .min(1)
              .max(60)
              .optional()
              .describe('Nombre de la carretera, como A-7 o AP-7; se reconoce también a7 y A 7.'),
            pk_desde: z
              .number()
              .nonnegative()
              .optional()
              .describe('Punto kilométrico inicial del tramo. Necesita carretera.'),
            pk_hasta: z
              .number()
              .nonnegative()
              .optional()
              .describe('Punto kilométrico final del tramo. Necesita carretera.'),
            provincia: z
              .string()
              .min(2)
              .max(60)
              .optional()
              .describe('Provincia, sin distinguir mayúsculas ni tildes, como Alicante o Alacant.'),
            tipo: z
              .array(z.enum(TIPOS))
              .optional()
              .describe('Tipos de incidencia que se quieren, como accidente u obras.'),
            sentido: z
              .enum(['positivo', 'negativo'])
              .optional()
              .describe('Sentido del recorrido: positivo o negativo, según el punto kilométrico.'),
            limite: z
              .number()
              .int()
              .min(1)
              .max(50)
              .default(10)
              .describe('Cuántas incidencias devolver (10).'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ carretera, pk_desde, pk_hasta, provincia, tipo, sentido, limite }) =>
          run(SOURCE, async () => {
            const { feed, consultado, desdeCache } = await descargar();
            const resultado = buscar(
              feed.incidencias,
              { carretera, pkDesde: pk_desde, pkHasta: pk_hasta, provincia, tipo, sentido },
              limite,
            );
            return respuesta(
              feed,
              consultado,
              desdeCache,
              {
                carretera: carretera === undefined ? null : normalizarCarretera(carretera),
                pk_desde,
                pk_hasta,
                provincia,
                tipo,
                sentido,
                limite,
              },
              resultado,
              llevaCobertura(provincia),
            );
          }),
      );

      s.registerTool(
        'incidencias_cerca',
        {
          title: 'Incidencias cerca de un punto',
          description:
            'Las incidencias de tráfico activas a menos de un radio en kilómetros de unas coordenadas, con la distancia en línea recta.',
          inputSchema: z.object({
            lat: z
              .number()
              .min(-90)
              .max(90)
              .describe('Latitud del centro, en grados decimales (WGS84).'),
            lon: z
              .number()
              .min(-180)
              .max(180)
              .describe('Longitud del centro, en grados decimales (WGS84).'),
            radio_km: z
              .number()
              .positive()
              .max(200)
              .default(10)
              .describe('Radio en kilómetros (10).'),
            limite: z
              .number()
              .int()
              .min(1)
              .max(50)
              .default(10)
              .describe('Cuántas incidencias devolver (10).'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ lat, lon, radio_km, limite }) =>
          run(SOURCE, async () => {
            const { feed, consultado, desdeCache } = await descargar();
            const resultado = cercanas(feed.incidencias, { lat, lon }, radio_km, limite);
            return respuesta(
              feed,
              consultado,
              desdeCache,
              { lat, lon, radio_km, limite },
              resultado,
              // Sin filtro de provincia la consulta cubre todo el país, incluido lo que la DGT
              // no publica: la nota siempre viaja.
              true,
            );
          }),
      );
    },
  );
}
