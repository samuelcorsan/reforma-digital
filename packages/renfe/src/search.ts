// Búsqueda de trenes (port de renfe-cli `search.py`): el horario (search-travel) y luego los precios de esos trenes
// (journey-search). Antes de la fecha de corte, la tienda antigua da ambos en una búsqueda (legacy.ts); si falla, se
// muestra el horario parcial del sistema nuevo, sin precios. Precios para un adulto sin descuentos.

import type { RsvClient } from './client';
import * as config from './config';
import { ApiShapeError, BlockedError, RenfeError } from './errors';
import * as legacy from './legacy';
import type { Leg, Train } from './legacy';
import * as shop from './shop';
import { type Station, toDict } from './stations';
import {
  addDays,
  dayParts,
  iso,
  MADRID,
  midnight,
  minutesOfDay,
  parseIso,
  today,
  zoned,
} from './time';

type Doc = Record<string, unknown>;

export function utcWindow(day: string): [string, string] {
  return [new Date(midnight(day)).toISOString(), new Date(midnight(addDays(day, 1))).toISOString()];
}

function utc(text: unknown, where: string): number {
  if (typeof text !== 'string') throw new ApiShapeError(`${where}: missing timestamp`);
  const parsed = parseIso(text);
  if (!parsed) throw new ApiShapeError(`${where}: unreadable timestamp`);
  if (!parsed.aware) throw new ApiShapeError(`${where}: timestamp without a timezone`);
  return parsed.ms;
}

/** La hora local de la estación como la etiqueta Renfe (Europe/Madrid si no dice otra). */
function local(moment: number, tz: unknown): string {
  if (typeof tz === 'string' && tz) {
    try {
      return iso(moment, tz);
    } catch {}
  }
  return iso(moment, MADRID);
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value)
    throw new ApiShapeError(`${where}: missing or non-text field`);
  return value;
}

const isInt = (value: unknown): value is number => Number.isInteger(value);

function leg(path: unknown, names: Map<string, string>): Leg {
  const where = 'search-travel leg';
  if (!path || typeof path !== 'object' || Array.isArray(path))
    throw new ApiShapeError(`${where}: not an object`);
  const p = path as Doc;
  const origin = text(p.origin_stop_code, where);
  const destination = text(p.destination_stop_code, where);
  const dep = utc(p.departure_datetime, where);
  const arr = utc(p.arrival_datetime, where);
  const stops = p.intermediate_stop_count;
  return {
    service: text(p.service_name, where),
    type_code: text(p.service_type_code, where),
    origin: { code: origin, name: names.get(origin) ?? null },
    destination: { code: destination, name: names.get(destination) ?? null },
    departure: local(dep, p.departure_datetime_timezone),
    arrival: local(arr, p.arrival_datetime_timezone),
    intermediate_stops: isInt(stops) ? stops : null,
    _dep_utc: dep,
    _arr_utc: arr,
    _schedule_date: text(p.schedule_date, where),
  };
}

const minuteUtc = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const routeKey = (legs: [string, number][]) =>
  legs.map(([service, at]) => `${service}@${minuteUtc(at)}`).join('|');

function faresRequest(origin: Station, destination: Station, day: string, trains: Train[]) {
  const routes = trains.map((train) => ({
    legs: train.legs!.map((l) => ({
      origin: l.origin.code,
      destination: l.destination.code,
      departure: `${new Date(l._dep_utc).toISOString().slice(0, 19)}Z`,
      arrival: `${new Date(l._arr_utc!).toISOString().slice(0, 19)}Z`,
      service_name: l.service,
      service_type: l.type_code,
      service_schedule_date: l._schedule_date,
    })),
  }));
  return {
    is_aftersales: false,
    passengers: [
      {
        disability_type: 'SD',
        type: 'A',
        id: 'passenger_1',
        travel_passes: [],
        discount_cards: [],
      },
    ],
    travels: [
      {
        direction: 'outbound',
        origin: origin.code,
        destination: destination.code,
        excluded_product_types: [...config.EXCLUDED_PRODUCT_TYPES],
        id: 'travel_outbound',
        departure: day,
        routes,
      },
    ],
    promos: [],
  };
}

type Priced = {
  available: boolean | null;
  type: string | null;
  fares: NonNullable<Train['fares']>;
};

function parseFares(doc: unknown): Map<string, Priced> {
  try {
    return parseFaresUnchecked(doc);
  } catch (err) {
    if (err instanceof ApiShapeError) throw err;
    throw new ApiShapeError('journey-search: unexpected response shape');
  }
}

function parseFaresUnchecked(doc: unknown): Map<string, Priced> {
  const offer = ((doc as Doc).data as Doc).offer as Doc;
  const routes = ((offer.travels as Doc[])[0] as Doc).routes;
  if (!Array.isArray(routes)) throw new ApiShapeError('journey-search: routes is not a list');
  const families = new Map<unknown, unknown>();
  for (const f of (offer.product_families as unknown[]) || [])
    if (f && typeof f === 'object') families.set((f as Doc).id, (f as Doc).name);
  const out = new Map<string, Priced>();
  for (const route of routes as Doc[]) {
    const legs = route.legs;
    if (!Array.isArray(legs) || !legs.length)
      throw new ApiShapeError('journey-search: a route has no legs');
    const key = routeKey(
      legs.map((l: Doc) => [
        l.service_name as string,
        utc((l.departure_station as Doc).departure_timestamp, 'journey-search leg'),
      ]),
    );
    const fares: Priced['fares'] = [];
    for (const bundle of ((route.bundles as Doc[]) || []) as Doc[]) {
      const price = bundle.price;
      if (typeof price !== 'number') continue;
      if (!Number.isFinite(price) || price < 0)
        throw new ApiShapeError('journey-search: a fare has no usable price');
      const name = families.get(bundle.product_family_id) || bundle.product_family_id;
      fares.push({
        name: typeof name === 'string' ? name : null,
        price: Math.round(price * 100) / 100,
        currency: typeof bundle.currency === 'string' ? bundle.currency : 'EUR',
      });
    }
    fares.sort((a, b) => a.price - b.price);
    const availability = route.bundle_availability;
    const available =
      availability && typeof availability === 'object'
        ? (availability as Doc).availability
        : undefined;
    const typeNames = legs.map((l: Doc) => {
      const t = l.service_type;
      return t && typeof t === 'object' ? (t as Doc).name : null;
    });
    out.set(key, {
      available: typeof available === 'boolean' ? available : null,
      type: typeNames.every((n) => typeof n === 'string') ? typeNames.join(' + ') : null,
      fares,
    });
  }
  return out;
}

function timetable(doc: unknown, names: Map<string, string>): [Train[], number | null] {
  if (!doc || typeof doc !== 'object' || !Array.isArray((doc as Doc).travel_options))
    throw new ApiShapeError('search-travel: no travel_options list');
  const trains = ((doc as Doc).travel_options as unknown[]).map((option) => {
    const path = option && typeof option === 'object' ? (option as Doc).travel_path : undefined;
    if (!Array.isArray(path) || !path.length)
      throw new ApiShapeError('search-travel: an option has no travel_path');
    const legs = path.map((p) => leg(p, names));
    const duration = (option as Doc).travel_duration;
    return {
      service: legs.map((l) => l.service).join('+'),
      type: null,
      type_code: legs[0]!.type_code,
      departure: legs[0]!.departure,
      arrival: legs.at(-1)!.arrival,
      duration_minutes: isInt(duration) ? duration : null,
      changes: legs.length - 1,
      legs,
      available: null,
      fares: null,
    } satisfies Train;
  });
  const total = (doc as Doc).total_count;
  return [trains, isInt(total) ? total : null];
}

const SKIPPED = Symbol('skipped'); // un lote nunca enviado porque otro falló

/** Una llamada journey-search por lote, hasta FARE_WORKERS a la vez, empezadas en orden. Un bloqueo deja un
 * resultado parcial; cualquier otro error de Renfe se lanza (el primero en orden de lotes). */
async function fetchFares(
  client: RsvClient,
  origin: Station,
  destination: Station,
  day: string,
  batches: Train[][],
): Promise<unknown[]> {
  const answers: unknown[] = batches.map(() => SKIPPED);
  const pending = batches.map((_, i) => i);
  let failed = false;
  const work = async () => {
    while (!failed) {
      const index = pending.shift();
      if (index === undefined) return;
      try {
        answers[index] = await client.post(
          config.JOURNEY_SEARCH_PATH,
          faresRequest(origin, destination, day, batches[index]!),
          'journey-search',
          () => !failed,
        );
      } catch (err) {
        answers[index] = err;
        failed = true;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(config.FARE_WORKERS, batches.length)) }, work),
  );
  const errors = answers.filter((a): a is Error => a instanceof Error);
  const bug = errors.find((e) => !(e instanceof RenfeError));
  if (bug) throw bug;
  if (errors.some((e) => e instanceof BlockedError))
    return answers.map((a) => (a instanceof Error && !(a instanceof BlockedError) ? SKIPPED : a));
  if (errors.length) throw errors[0];
  return answers;
}

export type SearchOptions = {
  names?: Map<string, string>;
  after?: number; // minutos desde medianoche, hora local
  arriveBy?: number; // minutos desde medianoche, hora de Madrid
  fares?: boolean;
  limit?: number;
  now?: number;
  fromNow?: boolean;
};

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export async function search(
  client: RsvClient,
  origin: Station,
  destination: Station,
  day: string,
  opts: SearchOptions = {},
) {
  const names = opts.names ?? new Map<string, string>();
  const fares = opts.fares ?? true;
  let after = opts.after;
  const notices: string[] = [];
  const soldHere = day >= config.NSV_FIRST_SALE_DATE;
  let trains: Train[] | undefined;
  let legacyFailure: string | undefined;
  let legacyEmpty = false;
  if (!soldHere) {
    try {
      trains = await legacy.trains(origin, destination, day, names, client.retries);
    } catch (err) {
      if (!(err instanceof RenfeError)) throw err;
      legacyFailure = err.message;
    }
    // Sin fiar: una estación desconocida o una respuesta cambiada pueden parecerse a esto (se comprueba abajo).
    if (trains?.length === 0)
      [trains, legacyFailure, legacyEmpty] = [undefined, 'it listed no trains', true];
  }
  const fromLegacy = trains !== undefined;
  if (trains === undefined) {
    const [afterUtc, beforeUtc] = utcWindow(day);
    const doc = await client.post(
      config.SEARCH_TRAVEL_PATH,
      {
        depart_after_datetime: afterUtc,
        depart_before_datetime: beforeUtc,
        travel_path: [{ code: origin.code }, { code: destination.code }],
        direction: 'OUTBOUND',
      },
      'search-travel',
    );
    let total: number | null;
    [trains, total] = timetable(doc, names);
    if (total !== null && total > trains.length)
      notices.push(
        `Renfe reported ${total} trains but returned ${trains.length}; some may be missing.`,
      );
  }
  const minute = opts.now === undefined ? undefined : Math.floor(opts.now / 60_000) * 60_000;
  const leaving = minute !== undefined && trains.some((t) => parseIso(t.departure)!.ms >= minute);
  if (opts.fromNow && minute !== undefined) after = minutesOfDay(iso(minute));
  if (after !== undefined) {
    const from = after;
    trains = trains.filter((t) => minutesOfDay(t.departure) >= from);
  }
  if (legacyEmpty && minute !== undefined && day === today(minute) && !leaving && !trains.length)
    legacyFailure = undefined; // hoy, sin nada más que salga: el día ha terminado, no ha fallado nada
  const noMoreDepartures = Boolean(opts.fromNow) && !trains.length;
  if (opts.arriveBy !== undefined) {
    const [y, mo, d] = dayParts(day);
    const deadline = zoned(y, mo, d, Math.floor(opts.arriveBy / 60), opts.arriveBy % 60);
    trains = trains.filter((t) => parseIso(t.arrival)!.ms <= deadline);
  }
  trains.sort((a, b) => a.legs![0]!._dep_utc - b.legs![0]!._dep_utc);
  if (opts.limit !== undefined) trains = trains.slice(0, opts.limit);

  if (fromLegacy && !fares)
    for (const train of trains) Object.assign(train, { available: null, fares: null });
  let faresError: Record<string, unknown> | undefined;
  if (fares && trains.length && soldHere) {
    const batches: Train[][] = [];
    for (let i = 0; i < trains.length; i += config.FARE_BATCH)
      batches.push(trains.slice(i, i + config.FARE_BATCH));
    const answers = await fetchFares(client, origin, destination, day, batches);
    let unpriced = 0;
    batches.forEach((batch, i) => {
      const answer = answers[i];
      if (answer === SKIPPED || answer instanceof BlockedError) {
        if (answer instanceof BlockedError && faresError === undefined)
          faresError = answer.toDict();
        unpriced += batch.length;
        return;
      }
      const priced = parseFares(answer);
      let matched = 0;
      for (const train of batch) {
        const hit = priced.get(routeKey(train.legs!.map((l) => [l.service, l._dep_utc])));
        if (hit) {
          matched += 1;
          Object.assign(train, { available: hit.available, fares: hit.fares, type: hit.type });
        }
      }
      if (priced.size && !matched)
        throw new ApiShapeError('journey-search: no returned fare matches the requested trains');
      unpriced += batch.length - matched;
    });
    if (faresError !== undefined)
      notices.push(
        `Renfe stopped answering fare requests; ${unpriced} train(s) have no fares. Wait before trying again.`,
      );
    else if (unpriced) notices.push(`${unpriced} train(s) came back without fares.`);
  }
  if (legacyFailure !== undefined)
    notices.push(
      `Renfe's legacy shop (${config.LEGACY_SHOP_URL}), which sells trips before ${config.NSV_FIRST_SALE_DATE}, ` +
        `failed (${legacyFailure}), so this list is from Renfe's new system: ${fares ? 'no fares, and ' : ''}` +
        "it may be missing trains. `shop.url` opens the full list on Renfe's website.",
    );
  if (noMoreDepartures && after !== undefined)
    notices.push(`No more trains today after ${hhmm(after)}; try --date tomorrow.`);

  for (const train of trains) {
    for (const l of train.legs ?? []) {
      delete (l as Partial<Leg>)._dep_utc;
      delete l._arr_utc;
      delete l._schedule_date;
    }
    if (train.changes === 0) {
      train.intermediate_stops = train.legs![0]!.intermediate_stops;
      delete train.legs;
    }
  }

  const out: Record<string, unknown> = {
    date: day,
    origin: toDict(origin),
    destination: toDict(destination),
    passengers: { adults: 1 },
    fares_included: Boolean(fares && (soldHere || fromLegacy) && faresError === undefined),
    notice: notices.join(' ') || null,
    count: trains.length,
    trains,
    shop: shop.link(origin, destination, day),
  };
  if (faresError) out.fares_error = faresError;
  return out as { trains: Train[]; notice: string | null } & Record<string, unknown>;
}
