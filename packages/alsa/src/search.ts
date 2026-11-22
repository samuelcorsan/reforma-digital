// Viajes y precios como los busca la página de resultados de ALSA (port de queguagua `alsa/search.py`):
//
// 1. `SearchJourneysAction` (acción de portlet en /checkout, con p_auth) guarda la búsqueda en la sesión: paradas,
//    fechas, viajeros por tipo y si es ida, ida y vuelta o vuelta abierta;
// 2. `GetJourneyListResource?journeyDirection=I` (y `V` para la vuelta) devuelve los viajes con sus tarifas;
// 3. si se piden, `GetPackageFaresResource?journeyIndex=N` por viaje: los paquetes (Básica, Flexible,
//    Superflexible...) que se suman a la tarifa.

import { addDays, HOUR, roundHalfEven, today, wall, weekday } from '@reforma-digital/renfe/time';
import { z } from 'zod';
import { type AlsaClient, PURCHASE_PORTLET } from './client';
import { ApiShapeError, UsageError } from './errors';
import { fold, pyRepr, resolve, type Stop } from './stops';

type Doc = Record<string, unknown>;

const MAX_PASSENGERS = 20;
// Ids de tipo de viajero de ALSA, en el orden en que los manda su formulario: `passengerType-<id>=<número>`.
const PASSENGER_TYPES = [
  ['adults', 1],
  ['children', 2],
  ['babies', 3],
  ['young', 4],
  ['seniors', 5],
] as const;
type Passengers = Record<(typeof PASSENGER_TYPES)[number][0], number>;

export const stopName = z.string().min(1).max(100);
const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .optional();
const count = (description: string, value = 0) =>
  z.number().int().min(0).max(20).default(value).describe(description);

export const searchInput = z.object({
  origin: stopName.describe('Origen: nombre de parada o ciudad, o identificador de ALSA.'),
  destination: stopName.describe('Destino: nombre de parada o ciudad, o identificador de ALSA.'),
  date: z
    .string()
    .default('today')
    .describe('Fecha de ida: AAAA-MM-DD, DD/MM/AAAA, today, tomorrow o un día de la semana.'),
  return_date: z.string().optional().describe('Fecha de vuelta, para ida y vuelta.'),
  open_return: z.boolean().default(false).describe('Ida y vuelta abierta, sin fecha de vuelta.'),
  adults: count('Adultos de 26 a 59 años.', 1),
  young: count('Jóvenes de 12 a 25 años.'),
  seniors: count('Mayores de 60 años.'),
  children: count('Niños de 4 a 11 años.'),
  babies: count('Bebés de 0 a 3 años.'),
  after: clock.describe('Solo viajes que salen a partir de HH:MM, hora de la parada.'),
  before: clock.describe('Solo viajes que salen antes de HH:MM, hora de la parada.'),
  arrive_by: clock.describe('Solo viajes que llegan antes de HH:MM el mismo día.'),
  service: z.string().max(40).optional().describe('Solo un servicio: Comfort, Supra, Premium...'),
  available_only: z.boolean().default(false).describe('Solo viajes a la venta.'),
  direct_only: z.boolean().default(false).describe('Solo viajes sin transbordo.'),
  include_packages: z
    .boolean()
    .default(false)
    .describe(
      'Incluir los paquetes Básica, Flexible y Superflexible de cada viaje (una petición más por viaje).',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Máximo de viajes en cada sentido, por hora de salida.'),
});
type SearchArgs = z.infer<typeof searchInput>;

// La verdad de Python sobre un valor: vacíos los textos, listas y objetos vacíos, el cero, null y false.
const truthy = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : isDoc(v) ? Object.keys(v).length > 0 : Boolean(v);
const or = (v: unknown) => (truthy(v) ? v : null);
const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);
const docs = (v: unknown) => (Array.isArray(v) ? v.filter(isDoc) : []);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const lower = (v: unknown) => (truthy(v) ? String(v).toLowerCase() : null);
const digits = (v: unknown) => {
  const text = truthy(v) ? String(v) : '';
  return /^\d+$/.test(text) ? Number(text) : null;
};

const WEEKDAYS = new Map(
  [
    'monday tuesday wednesday thursday friday saturday sunday',
    'lunes martes miercoles jueves viernes sabado domingo',
    'lunes martes miércoles jueves viernes sábado domingo',
  ].flatMap((week) => week.split(' ').map((name, i) => [name, i] as const)),
);

/** El día AAAA-MM-DD si existe, como lo valida `strptime`. */
function realDay(y: string, m: string, d: string) {
  const day = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(day) ? day : undefined;
}

export function parseDate(value: string, now = Date.now()) {
  const v = value.trim().toLowerCase();
  const base = today(now);
  if (v === 'today' || v === 'hoy') return base;
  if (['tomorrow', 'mañana', 'manana'].includes(v)) return addDays(base, 1);
  const wanted = WEEKDAYS.get(v);
  if (wanted !== undefined) return addDays(base, ((wanted - weekday(base) + 6) % 7) + 1);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  const dmy = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(v);
  const day = iso
    ? realDay(iso[1]!, iso[2]!, iso[3]!)
    : dmy
      ? realDay(dmy[4]!, dmy[3]!, dmy[1]!)
      : undefined;
  if (!day)
    throw new UsageError(
      `bad date ${pyRepr(value)}: use YYYY-MM-DD, DD/MM/YYYY, today, tomorrow or a weekday`,
    );
  return day;
}

const madridOffset = (ms: number) => {
  const w = wall(ms);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - ms;
};

/** El desfase de Madrid para una hora de pared (escrita como si fuera UTC) como `fold=0` de Python: en la hora
 * repetida de octubre y en la que falta en marzo, el de antes del cambio. */
function madridFold0(local: number) {
  const [before, after] = [madridOffset(local - 12 * HOUR), madridOffset(local + 12 * HOUR)];
  return madridOffset(local - before) === before || madridOffset(local - after) !== after
    ? before
    : after;
}

/** ALSA da el instante (UTC) y la hora de pared de la parada («27/11/2026 01:30»): su diferencia es el desfase de la
 * parada, así que sirve igual en Madrid, Canarias, Lisboa o París. */
export function isoLocal(epoch: unknown, local: unknown) {
  const m =
    typeof local === 'string'
      ? /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{1,2})$/.exec(local)
      : null;
  const day = m ? realDay(m[3]!, m[2]!, m[1]!) : undefined;
  if (!m || !day || +m[4]! > 23 || +m[5]! > 59) return null;
  const [h, mi] = [+m[4]!, +m[5]!];
  const naive = Date.parse(`${day}T00:00:00Z`) + (h * 60 + mi) * 60_000;
  const offset =
    typeof epoch === 'number' && epoch
      ? roundHalfEven((naive - epoch) / 900_000) * 900_000
      : madridFold0(naive);
  const abs = Math.abs(offset) / 60_000;
  const zone = `${offset < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${new Date(naive).toISOString().slice(0, 19)}${zone}`;
}

function text(html: unknown) {
  if (!truthy(html)) return null;
  const t = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&euro;', '€')
    .replaceAll('&nbsp;', ' ');
  return t.replace(/\s+/g, ' ').trim() || null;
}

function fare(f: Doc) {
  return {
    index: f.index,
    name: f.fareName,
    price: f.price,
    currency: 'EUR',
    type: f.fareType,
    conditions: or(f.fareConditions) ?? or(f.fareTypeDescription),
    open_return_price: or(f.openReturnPrice),
    promoted: truthy(f.isPromoted),
    promo_codes: docs(f.promotionCodeList).flatMap((p) => (truthy(p.code) ? [p.code] : [])),
    requires_return: f.outwardReturnRequired === 'S',
    per_passenger: docs(f.travellersData).map((t) => ({
      type: t.passengerType,
      count: t.amount,
      price: t.price,
      promotion: or(t.promotionDescription),
    })),
    ...(truthy(f.priceOriginal) ? { price_without_promo: f.priceOriginal } : {}),
  };
}

function farePackage(p: Doc) {
  return {
    id: p.farePackageId,
    name: p.packageName,
    extra_price: 'totalPassengerPackagePrice' in p ? p.totalPassengerPackagePrice : p.packagePrice,
    recommended: truthy(p.recommended),
    available: truthy('enabled' in p ? p.enabled : true),
    highlights: docs(p.packageObservations).flatMap((o) => text(o.description) ?? []),
    conditions: docs(p.packageObservationsOther).flatMap((o) => text(o.description) ?? []),
  };
}

type Fare = ReturnType<typeof fare>;
// Como la CLI: sin precio al final, luego del más barato al más caro.
const cheapestFirst = (a: Fare, b: Fare) =>
  Number(a.price == null) - Number(b.price == null) || Number(a.price ?? 0) - Number(b.price ?? 0);

export function journey(j: Doc, direction: 'I' | 'V') {
  // Un viaje a la venta sin tarifas sería un viaje gratis: es que ALSA cambió la respuesta.
  if (j.canBeSold === 'V' && !Array.isArray(j.fares))
    throw new ApiShapeError('GetJourneyListResource sent a journey on sale without fares');
  const dep = j.departureDate;
  const arr = j.arrivalDate;
  const bc = isDoc(j.busCharacteristic) ? j.busCharacteristic : {};
  const fares = docs(j.fares).map(fare).sort(cheapestFirst);
  return {
    index: j.index,
    direction: direction === 'I' ? 'outward' : 'return',
    departure: isoLocal(dep, j.departureDataToFilter),
    arrival: isoLocal(arr, j.arrivalDataToFilter),
    duration_minutes:
      typeof dep === 'number' && dep && typeof arr === 'number' && arr
        ? roundHalfEven((arr - dep) / 60_000)
        : null,
    origin: { id: j.originId, name: j.originName },
    destination: { id: j.destinationId, name: j.destinationName },
    service: list(j.serviceTypeDescList),
    service_codes: list(j.serviceTypeList),
    line: or(j.lineName),
    changes: or(j.transfersNumber) ?? 0,
    change_at: list(j.transfersTown).map((t) => (isDoc(t) ? t.name : t)),
    stops: digits(j.totalNumberOfStops),
    available: j.canBeSold === 'V',
    sale_status:
      j.canBeSold === 'V' ? 'on_sale' : j.canBeSold === 'F' ? 'sold_out_or_closed' : j.canBeSold,
    fares,
    cheapest: fares[0] ? fares[0].price : null,
    features: docs(bc.characteristicList).flatMap((c) =>
      truthy(c.description) ? [c.description] : [],
    ),
    night_bus: truthy(bc.isNightBus),
    non_stop: truthy(bc.isNonStopBus),
    double_decker: truthy(bc.isDoubleDeckerBus),
    abono_unico_ok: truthy(bc.isFreeVoucherApplyable),
    pets: lower(j.petAvailability),
    sport_equipment: lower(j.sportAvailability),
    wheelchair: lower(j.handicappedAvailability),
    block_adjacent_seat: lower(j.contiguousPaxAvailability),
    warning: text(j.warning),
    observations: text(j.observations),
    service_code: or(j.serviceCodes),
    company: or(j.companyService),
    train: truthy(j.isTrainTrip),
    wheelchair_places: or(j.numberPMRSeats) ?? 0,
  };
}
type Journey = ReturnType<typeof journey> & { packages?: ReturnType<typeof farePackage>[] };

export function voucher(v: Doc) {
  return {
    name: or(v.voucherName) ?? v.digitalVoucherName,
    type: v.voucherType,
    price: v.amount,
    trips: or(v.voucherTripsNumber),
    validity_days: digits(v.validDays),
    service: v.serviceNameType,
    abono_unico: truthy(v.isUnifiedVoucher),
    start_between: truthy(v.minDateFrom) ? [v.minDateFrom, v.maxDateFrom] : null,
    observations: text(v.observations),
  };
}

function validate(p: Passengers) {
  if (p.adults + p.young + p.seniors + p.children < 1)
    throw new UsageError('at least one adult, young, senior or child passenger');
  if (p.adults + p.young + p.seniors + p.children + p.babies > MAX_PASSENGERS)
    throw new UsageError(`ALSA sells at most ${MAX_PASSENGERS} passengers per booking`);
  if (p.babies > p.adults + p.young + p.seniors)
    throw new UsageError('each baby needs an adult, young or senior passenger');
}

const hhmm = (iso: string | null) => (iso ? iso.slice(11, 16) : null);

function applyFilters(journeys: Journey[], f: SearchArgs, travelDate: string) {
  const service = f.service ? fold(f.service) : undefined;
  return journeys
    .filter((j) => {
      const dep = hhmm(j.departure);
      const arr = hhmm(j.arrival);
      if (f.after && dep && dep < f.after) return false;
      if (f.before && dep && dep > f.before) return false;
      if (
        f.arrive_by &&
        (!arr || (j.arrival ?? '').slice(0, 10) !== travelDate || arr > f.arrive_by)
      )
        return false;
      if (service !== undefined && !j.service.some((s) => fold(String(s)).includes(service)))
        return false;
      if (f.available_only && !j.available) return false;
      return !(f.direct_only && truthy(j.changes));
    })
    .slice(0, f.limit);
}

async function journeyList(client: AlsaClient, direction: 'I' | 'V') {
  const payload = await client.resourceJson(
    '/checkout',
    PURCHASE_PORTLET,
    'GetJourneyListResource',
    {
      journeyDirection: direction,
    },
  );
  if (!isDoc(payload) || !Array.isArray(payload.journeys))
    throw new ApiShapeError('GetJourneyListResource changed shape');
  return {
    journeys: docs(payload.journeys).map((j) => journey(j, direction)),
    voucherList: payload.voucherList,
    carbonFootprint: payload.carbonFootprint,
  };
}

async function packageFares(client: AlsaClient, index: unknown, direction: 'I' | 'V') {
  const payload = await client.resourceJson(
    '/checkout',
    PURCHASE_PORTLET,
    'GetPackageFaresResource',
    {
      journeyIndex: String(index),
      journeyDirection: direction,
    },
  );
  if (!isDoc(payload) || !Array.isArray(payload.packageFareList))
    throw new ApiShapeError('GetPackageFaresResource changed shape');
  return docs(payload.packageFareList).map(farePackage);
}

/** Por qué rechaza ALSA la búsqueda: el último `params["errorMessageKey"] = '…'` de la página, leído como
 * `pageparams.py` (null, false, [] y {} no son un error). */
function errorKey(html: string) {
  const all = [
    ...html.matchAll(
      /params\[\s*["']errorMessageKey["']\s*\]\s*=\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/gs,
    ),
  ];
  const last = all.at(-1);
  // ponytail: sin deshacer los escapes de JavaScript; ALSA pone aquí una clave de mensaje.
  const value = last ? (last[1] ?? last[2] ?? '') : '';
  const json = value.trim();
  if (/^(\[|\{|null$|false$)/.test(json)) {
    try {
      if (!truthy(JSON.parse(json))) return '';
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
  }
  return value.slice(0, 300);
}

const pick = ({ id, name, group }: Stop) => ({ id, name, group });

export async function run(client: AlsaClient, args: SearchArgs) {
  const origin = await resolve(args.origin, client);
  const destination = await resolve(args.destination, client);
  const departure = parseDate(args.date);
  const returnDate = args.return_date ? parseDate(args.return_date) : undefined;
  if (args.open_return && returnDate) throw new UsageError('use either return_date or open_return');
  const p = {
    adults: args.adults,
    young: args.young,
    seniors: args.seniors,
    children: args.children,
    babies: args.babies,
  };
  validate(p);
  if (returnDate && returnDate < departure)
    throw new UsageError('the return date is before the departure date');
  const travelType = args.open_return ? 'OPEN_RETURN' : returnDate ? 'RETURN' : 'OUTWARD';
  const params: Record<string, string> = {
    alsaspam: '',
    originStationId: origin.id,
    destinationStationId: destination.id,
    departureDate: departure.split('-').reverse().join('/'),
    returnDate: returnDate ? returnDate.split('-').reverse().join('/') : '',
    seats: String(p.adults + p.young + p.seniors + p.children + p.babies),
    promoCode: '',
    youngPromoCode: '',
    travelType,
    employee: 'false',
  };
  for (const [kind, id] of PASSENGER_TYPES)
    if (p[kind]) params[`passengerType-${id}`] = String(p[kind]);
  const page = await client.action('/checkout', PURCHASE_PORTLET, 'SearchJourneysAction', params);
  const refused = errorKey(page.text);
  if (refused) throw new UsageError('ALSA rejected the search', { alsaMessage: refused });

  const outList = await journeyList(client, 'I');
  const shown = applyFilters(outList.journeys, args, departure);
  let back: { all: Journey[]; shown: Journey[] } | undefined;
  if (returnDate) {
    const all = (await journeyList(client, 'V')).journeys;
    const untimed = { ...args, after: undefined, before: undefined, arrive_by: undefined };
    back = { all, shown: applyFilters(all, untimed, returnDate) };
  }
  // Uno detrás de otro, como la CLI: en paralelo, ALSA llegó a responder HTML. El plazo del cliente acota el total.
  if (args.include_packages)
    for (const j of [...shown, ...(back?.shown ?? [])])
      if (j.available)
        j.packages = await packageFares(client, j.index, j.direction === 'outward' ? 'I' : 'V');
  const vouchers = docs(outList.voucherList).map(voucher);
  return {
    date: departure,
    return_date: returnDate ?? null,
    trip: { OUTWARD: 'one_way', RETURN: 'round_trip', OPEN_RETURN: 'open_return' }[travelType],
    origin: pick(origin),
    destination: pick(destination),
    passengers: Object.fromEntries(Object.entries(p).filter(([, n]) => n)),
    promo: null,
    count: outList.journeys.length,
    shown: shown.length,
    journeys: shown,
    ...(back ? { return_count: back.all.length, return_journeys: back.shown } : {}),
    ...(vouchers.length ? { bonos_for_route: vouchers } : {}),
    ...(outList.carbonFootprint == null ? {} : { co2_kg_per_passenger: outList.carbonFootprint }),
    ...(!outList.journeys.length
      ? { notice: 'ALSA lists no journeys for that route and date.' }
      : !shown.length
        ? { notice: 'No journey matches the filters.' }
        : {}),
    retries: client.retries,
  };
}
