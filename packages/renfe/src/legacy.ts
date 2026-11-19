// La tienda antigua de Renfe (venta.renfe.com/vol): todos los trenes, con precios para un adulto, para viajes antes
// de config.NSV_FIRST_SALE_DATE (port de renfe-cli `legacy.py`). Solo búsqueda, como invitado:
//   1. POST del formulario de www.renfe.com a buscarTren.do, que responde 302 a la página de resultados;
//   2. GET de esa página (buscarTrenEnlaces.do);
//   3. DWR __System.generateId: el id de sesión DWR de la página;
//   4. DWR trainEnlacesManager.getTrainsList(filtro): los trenes, como un literal de JavaScript que se lee aquí
//      como datos y nunca se evalúa.
// Un fallo puntual en cualquier paso repite la búsqueda entera con cookies nuevas, hasta 2 veces más. Borrar este
// módulo cuando pase la fecha de corte.

import { request } from './client';
import * as config from './config';
import { ApiShapeError, BlockedError, type Retry, UpstreamError } from './errors';
import * as retry from './retry';
import type { Station } from './stations';
import { addDays, dayParts, iso, zoned } from './time';

const BASE = 'https://venta.renfe.com/vol';
const SEARCH_URL = `${BASE}/buscarTren.do?Idioma=es&Pais=ES`;
const RESULTS_PATH = '/vol/buscarTrenEnlaces.do';
const RESULTS_URL = `https://venta.renfe.com${RESULTS_PATH}`;
const SESSION_URL = `${BASE}/dwr/call/plaincall/__System.generateId.dwr`;
const TRAINS_URL = `${BASE}/dwr/call/plaincall/trainEnlacesManager.getTrainsList.dwr`;
const WWW = 'https://www.renfe.com';
const ADMIN = '0071';

const SESSION_ID = /r\.handleCallback\("0","0","([A-Za-z0-9$*_.!-]{8,64})"\)/;
const TRAINS_CALL = 'r.handleCallback("1","0",';
const PRICE = /^([0-9]{1,5})(?:,([0-9]{1,2}))?$/;
const HOUR = /^([01][0-9]|2[0-3]):([0-5][0-9])(?::[0-5][0-9])?$/;
const ON_SALE = ['', '8'];

export type Leg = {
  service: string;
  type_code: string | null;
  origin: { code: string; name: string | null };
  destination: { code: string; name: string | null };
  departure: string;
  arrival: string;
  intermediate_stops: number | null;
  _dep_utc: number;
  _arr_utc?: number;
  _schedule_date?: string;
  _type?: unknown;
  delay_minutes?: number | null;
};

export type Train = {
  service: string;
  type: string | null;
  type_code: string | null;
  departure: string;
  arrival: string;
  duration_minutes: number | null;
  changes: number;
  legs?: Leg[];
  available: boolean | null;
  fares: { name: string | null; price: number; currency: string }[] | null;
  intermediate_stops?: number | null;
  delay_minutes?: number | null;
};

export function trains(
  origin: Station,
  destination: Station,
  day: string,
  names: Map<string, string>,
  retries?: Retry[],
): Promise<Train[]> {
  return retry.call(
    'legacy shop search (all four requests, started over)',
    () => search(origin, destination, day, names),
    retries,
  );
}

/** Las cookies de una búsqueda: todo va a venta.renfe.com. */
class Jar {
  private cookies = new Map<string, string>();
  take(response: Response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair!.indexOf('=');
      if (at > 0) this.cookies.set(pair!.slice(0, at).trim(), pair!.slice(at + 1).trim());
    }
  }
  set(name: string, value: string) {
    this.cookies.set(name, value);
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function send(jar: Jar, method: string, url: string, label: string, init: RequestInit = {}) {
  const cookie = jar.header();
  let response: Response;
  try {
    response = await request(url, label, {
      ...init,
      method,
      headers: { ...(init.headers as Record<string, string>), ...(cookie ? { cookie } : {}) },
    });
  } catch (err) {
    if (err instanceof UpstreamError && err.transient) err.transient = `${label}: ${err.transient}`;
    throw err;
  }
  jar.take(response);
  const status = response.status;
  if (status === 403 || status === 429)
    throw new BlockedError(
      `${label}: Renfe refused the request (${status}); wait before trying again`,
      { status },
    );
  if (status >= 500) {
    // aquí un 503 o 504 puede ser un rechazo del edge o una sala de espera, y Retry-After pide esperar
    const again = response.headers.has('retry-after')
      ? undefined
      : retry.statusFailure(status, retry.LEGACY_STATUSES);
    throw new UpstreamError(`${label}: Renfe returned a server error (${status})`, {
      status,
      transient: again && `${label}: ${again}`,
    });
  }
  return response;
}

const stationKey = (s: Station) => `${ADMIN},${s.code},${s.group ? 'null' : s.code}`;
const shown = (day: string) => {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
};

/** Como `quote(value, safe='')` de Python. */
const quote = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

function searchForm(origin: Station, destination: Station, day: string): Record<string, string> {
  const date = shown(day);
  return {
    tipoBusqueda: 'autocomplete',
    currenLocation: 'menuBusqueda',
    vengoderenfecom: 'SI',
    desOrigen: origin.name.toUpperCase(),
    desDestino: destination.name.toUpperCase(),
    cdgoOrigen: stationKey(origin),
    cdgoDestino: stationKey(destination),
    idiomaBusqueda: 'ES',
    FechaIdaSel: date,
    FechaVueltaSel: '',
    _fechaIdaVisual: date,
    _fechaVueltaVisual: '',
    minPriceDeparture: 'false',
    minPriceReturn: 'false',
    adultos_: '1',
    ninos_: '0',
    ninosMenores: '0',
    codPromocional: '',
    plazaH: 'false',
    sinEnlace: 'false',
    conMascota: 'false',
    conBicicleta: 'false',
    asistencia: 'false',
    Idioma: 'es',
    Pais: 'ES',
    franjaHoraI: '',
    franjaHoraV: '',
  };
}

function resultsRedirect(status: number, location: string): string {
  let target: URL | undefined;
  try {
    target = new URL(location, SEARCH_URL);
  } catch {}
  if (
    status !== 302 ||
    target?.protocol !== 'https:' ||
    target.host !== 'venta.renfe.com' ||
    target.pathname !== RESULTS_PATH
  )
    throw new BlockedError(
      `legacy shop search: Renfe didn't send the search to its results page (${status}); a waiting room or bot protection?`,
      { status },
    );
  return target.href;
}

async function search(
  origin: Station,
  destination: Station,
  day: string,
  names: Map<string, string>,
) {
  const jar = new Jar();
  // 1-2: el formulario de www.renfe.com y la página de resultados a la que redirige
  const form = new URLSearchParams(searchForm(origin, destination, day)).toString();
  let response = await send(jar, 'POST', SEARCH_URL, 'legacy shop search', {
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: WWW,
      referer: `${WWW}/`,
    },
  });
  const results = resultsRedirect(response.status, response.headers.get('location') ?? '');
  const label = 'legacy shop results page';
  response = await send(jar, 'GET', results, label, { headers: { referer: `${WWW}/` } });
  if (response.status !== 200 || !(await response.text()).includes('trainEnlacesManager'))
    throw new BlockedError(
      `${label}: not the results page (${response.status}); a waiting room or bot protection?`,
      {
        status: response.status,
      },
    );

  // 3: la sesión DWR, que el script de la página guarda también como cookie DWRSESSIONID
  const sessionText = await dwr(jar, SESSION_URL, 'legacy shop session', [
    'callCount=1',
    'c0-scriptName=__System',
    'c0-methodName=generateId',
    'c0-id=0',
    'batchId=0',
    'instanceId=0',
    `page=${quote(RESULTS_PATH)}`,
    'scriptSessionId=',
    'windowName=',
  ]);
  const session = SESSION_ID.exec(sessionText)?.[1];
  if (!session) throw new ApiShapeError('legacy shop session: no session id in the answer');
  jar.set('DWRSESSIONID', session);

  // 4: getTrainsList para un adulto, solo ida, con transbordos
  const fields: Record<string, string> = {
    origen: origin.code,
    destino: destination.code,
    fechaSalida: shown(day),
    fechaVuelta: '',
    trayecto: 'I',
    idaVuelta: '',
    adultos: '1',
    ninos: '0',
    ninosMenores: '0',
    sinEnlace: 'false',
    conMascota: 'false',
    conBicicleta: 'false',
    plazaH: 'false',
    atendo: 'false',
    tipoFranjaI: '',
    horaFranjaIda: '',
    tipoFranjaV: '',
    horaFranjaVuelta: '',
    codPromo: '',
  };
  const names_ = Object.keys(fields);
  const values = Object.values(fields);
  const lines = [
    'callCount=1',
    'nextReverseAjaxIndex=0',
    'c0-scriptName=trainEnlacesManager',
    'c0-methodName=getTrainsList',
    'c0-id=0',
    ...values.map((v, n) => `c0-e${n + 1}=string:${quote(v)}`),
    `c0-param0=Object_Object:{${names_.map((k, n) => `${k}:reference:c0-e${n + 1}`).join(', ')}}`,
    'batchId=1',
    'instanceId=0',
    `page=${quote(RESULTS_PATH)}`,
    `scriptSessionId=${session}/${random(10)}-${random(9)}`,
    'windowName=',
  ];
  // el script de la página manda también los valores del filtro en esta cabecera, con 1/0 (no es un secreto)
  const akamai = values
    .map((v) => ({ true: '1', false: '0' })[v] ?? v)
    .join(', ')
    .trim();
  const text = await dwr(jar, TRAINS_URL, 'legacy shop train list', lines, {
    'akamai-key': akamai,
  });
  const start = text.indexOf(TRAINS_CALL);
  if (start < 0) {
    if (text.includes('r.handleException("1","0"'))
      throw new UpstreamError("legacy shop train list: Renfe's shop failed to list trains");
    throw new ApiShapeError('legacy shop train list: no train list in the answer');
  }
  const [doc, end] = readLiteral(text, start + TRAINS_CALL.length);
  if (!/^\s*\);/.test(text.slice(end)))
    throw new ApiShapeError('legacy shop train list: unreadable answer');
  return parseTrains(doc, origin, destination, names);
}

async function dwr(
  jar: Jar,
  url: string,
  label: string,
  lines: string[],
  headers: Record<string, string> = {},
) {
  const response = await send(jar, 'POST', url, label, {
    body: `${lines.join('\n')}\n`,
    headers: {
      'content-type': 'text/plain',
      origin: 'https://venta.renfe.com',
      referer: RESULTS_URL,
      ...headers,
    },
  });
  const ctype = (response.headers.get('content-type') ?? '').toLowerCase();
  if (ctype.includes('html') || response.status !== 200)
    throw new BlockedError(
      `${label}: got ${ctype.includes('html') ? 'an HTML page' : response.status} instead of a DWR answer (bot protection?)`,
      { status: response.status },
    );
  return response.text();
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function random(n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// --- la respuesta ----------------------------------------------------------------------------------

function parseTrains(
  doc: unknown,
  origin: Station,
  destination: Station,
  names: Map<string, string>,
): Train[] {
  let trains: Train[];
  try {
    trains = parseUnchecked(doc, names);
  } catch (err) {
    if (err instanceof ApiShapeError || err instanceof UpstreamError) throw err;
    throw new ApiShapeError('legacy shop train list: unexpected answer shape');
  }
  for (const train of trains) {
    const legs = train.legs!;
    if (
      (!origin.group && legs[0]!.origin.code !== origin.code) ||
      (!destination.group && legs.at(-1)!.destination.code !== destination.code)
    )
      throw new ApiShapeError('legacy shop train list: the answer is for other stations');
  }
  return trains;
}

type Row = Record<string, unknown>;

function parseUnchecked(doc: unknown, names: Map<string, string>): Train[] {
  const lists = (doc as Row).listadoTrenes;
  if (!Array.isArray(lists) || lists.length !== 1) throw new TypeError('one list per direction');
  const outbound = lists[0] as Row;
  if (outbound.hayError === true)
    throw new UpstreamError(
      "legacy shop train list: Renfe's shop reported an error for this search",
    );
  const rows = outbound.listviajeViewEnlaceBean || [];
  if (!Array.isArray(rows))
    throw new ApiShapeError('legacy shop train list: the trains are not a list');
  return rows.map((row: Row) => train(row, names));
}

function train(row: Row, names: Map<string, string>): Train {
  const raw = row.trayectos;
  if (!Array.isArray(raw)) throw new TypeError('trayectos');
  const legs = raw.map((leg: Row) => parseLeg(leg, names));
  if (!legs.length) throw new ApiShapeError('legacy shop train list: a train has no legs');
  const fares = ((row.tarifasDisponibles as Row[] | undefined) || [])
    .map(fare)
    .sort((a, b) => a.price - b.price);
  const kinds = legs.map((leg) => {
    const kind = leg._type;
    delete leg._type;
    return kind;
  });
  const duration = row.duracionViajeTotalEnMinutos;
  return {
    service: legs.map((l) => l.service).join('+'),
    type: kinds.every((k) => typeof k === 'string' && k) ? kinds.join(' + ') : null,
    type_code: null,
    departure: legs[0]!.departure,
    arrival: legs.at(-1)!.arrival,
    duration_minutes: Number.isInteger(duration) ? (duration as number) : null,
    changes: legs.length - 1,
    legs,
    available: onSale(row, fares),
    fares,
  };
}

function onSale(row: Row, fares: unknown[]) {
  return (
    ON_SALE.includes(row.razonNoDisponible as string) &&
    row.completo !== true &&
    !(row.soloPlazaH === true && row.plazaHDisponible === true) &&
    fares.length > 0
  );
}

function parseLeg(leg: Row, names: Map<string, string>): Leg {
  const origin = code(leg.cdgoEstacionOrigenTrayecto);
  const destination = code(leg.cdgoEstacionDestinoTrayecto);
  const day = leg.fecha;
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('fecha');
  const departure = at(day, leg.horaSalida);
  let arrival = at(day, leg.horaLlegada);
  if (arrival <= departure) arrival = at(addDays(day, 1), leg.horaLlegada); // llega después de medianoche
  const service = leg.cdgoTren;
  if (typeof service !== 'string' || !/^[0-9]{1,6}$/.test(service))
    throw new ApiShapeError('legacy shop train list: a leg has no train number');
  return {
    service,
    type_code: null,
    origin: { code: origin, name: names.get(origin) ?? null },
    destination: { code: destination, name: names.get(destination) ?? null },
    departure: iso(departure),
    arrival: iso(arrival),
    intermediate_stops: null,
    _dep_utc: departure,
    _type: leg.tipoTren,
  };
}

function code(value: unknown): string {
  if (typeof value !== 'string' || !value)
    throw new ApiShapeError('legacy shop train list: a leg has no station code');
  return value;
}

/** Una hora de pared de Madrid en `day` ("06:27" o "06:27:00"). */
function at(day: string, hour: unknown): number {
  const m = typeof hour === 'string' ? HOUR.exec(hour) : null;
  if (!m) throw new ApiShapeError('legacy shop train list: unreadable time');
  const [y, mo, d] = dayParts(day);
  return zoned(y, mo, d, Number(m[1]), Number(m[2]));
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  euro: '€',
  iexcl: '¡',
  iquest: '¿',
  ordm: 'º',
  ordf: 'ª',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
  Uuml: 'Ü',
  ccedil: 'ç',
  Ccedil: 'Ç',
  agrave: 'à',
  egrave: 'è',
  ograve: 'ò',
};

/** Lo de `html.unescape` que aparece en los nombres de tarifa: entidades numéricas y las habituales. */
function unescape(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (all, ref: string) => {
    if (ref[0] === '#') {
      const n =
        ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[ref] ?? all;
  });
}

function fare(f: Row) {
  const m = typeof f.precioTarifa === 'string' ? PRICE.exec(f.precioTarifa) : null;
  if (!m) throw new ApiShapeError('legacy shop train list: a fare has no usable price');
  const name = f.titulo;
  return {
    name: typeof name === 'string' && name ? unescape(name) : null,
    price: Math.round(Number(`${m[1]}.${m[2] ?? '0'}`) * 100) / 100,
    currency: 'EUR',
  };
}

// --- un literal de JavaScript, leído como datos ------------------------------------------------------

const TOKEN =
  /("(?:[^"\\\x00-\x1f]|\\.)*")|([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*:)|(true|false|null)|(-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)|([{[])|([}\]])|([:,])|(\s+)/y;
const KINDS = ['string', 'key', 'word', 'number', 'open', 'close', 'mark', 'space'] as const;
const MAX_DEPTH = 40;

/** El valor escrito en text[start:] y el índice justo detrás. Claves sin comillas se citan y el resto se lee como
 * JSON; cualquier otra cosa (una llamada, una variable, una fecha) es ApiShapeError. No se evalúa nada. */
export function readLiteral(text: string, start = 0): [unknown, number] {
  const parts: string[] = [];
  let depth = 0;
  let i = start;
  for (;;) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(text);
    if (!m) throw new ApiShapeError('legacy shop train list: unreadable answer');
    i = TOKEN.lastIndex;
    const kind = KINDS[m.slice(1).findIndex((g) => g !== undefined)]!;
    let part = m[0];
    if (kind === 'key') part = JSON.stringify(part);
    else if (kind === 'string')
      part = part.replace(/\\(.)/gs, (all, c: string) => (c === "'" ? "'" : all));
    depth += kind === 'open' ? 1 : kind === 'close' ? -1 : 0;
    if (depth < 0 || depth > MAX_DEPTH)
      throw new ApiShapeError('legacy shop train list: unreadable answer');
    parts.push(part);
    if (depth === 0 && ['string', 'word', 'number', 'close'].includes(kind)) break;
  }
  try {
    return [JSON.parse(parts.join('')), i];
  } catch {
    throw new ApiShapeError('legacy shop train list: unreadable answer');
  }
}
