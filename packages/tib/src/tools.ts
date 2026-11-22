// Consultas sobre el índice GTFS: buscar líneas y paradas, paradas de una línea y salidas de una
// parada. Solo leen el índice; no tocan la red.

import type { Index, Route, Stop } from './gtfs';
import { activeServicesOn } from './gtfs';
import { UsageError } from './errors';

/** Modo de una línea según su route_type de GTFS. */
const MODES: Record<number, string> = {
  0: 'Tram',
  1: 'Metro',
  2: 'Tren',
  3: 'Bus',
  4: 'Ferri',
  11: 'Troleibús',
};
const modeName = (type: number) => MODES[type] ?? 'Altres';

/** Sin tildes ni mayúsculas, para buscar «Porto» o «porto» y que coincidan. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export type RouteInfo = {
  id: string;
  linea: string;
  nombre: string;
  modo: string;
  agencia: string;
  color: string;
};

export type StopInfo = {
  id: string;
  codigo: string;
  nombre: string;
  lat: number;
  lon: number;
};

function routeDict(route: Route | undefined): RouteInfo | undefined {
  if (!route) return undefined;
  return {
    id: route.id,
    linea: route.shortName,
    nombre: route.longName,
    modo: modeName(route.type),
    agencia: route.agency,
    color: route.color,
  };
}

function stopDict(stop: Stop | undefined): StopInfo | undefined {
  if (!stop) return undefined;
  return {
    id: stop.id,
    codigo: stop.code,
    nombre: stop.name,
    lat: stop.lat,
    lon: stop.lon,
  };
}

type Scored<T> = { item: T; score: number; key: string };

/** Busca líneas por número o nombre. Sin consulta, las lista todas. */
export function findRoutes(index: Index, query?: string, limit = 10) {
  const q = query === undefined ? '' : fold(query);
  let matched: Route[];
  if (q) {
    matched = index.routes
      .map((r) => {
        const line = fold(r.shortName);
        const name = fold(r.longName);
        let score: number;
        if (line === q) score = 0;
        else if (line.startsWith(q)) score = 1;
        else if (name.includes(q) || line.includes(q)) score = 2;
        else return null;
        return { item: r, score, key: line } satisfies Scored<Route>;
      })
      .filter((x): x is Scored<Route> => x !== null)
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.key.localeCompare(b.key, 'ca', { numeric: true }) ||
          a.item.longName.localeCompare(b.item.longName, 'ca'),
      )
      .map((x) => x.item);
  } else {
    matched = [...index.routes].sort((a, b) =>
      a.shortName.localeCompare(b.shortName, 'ca', { numeric: true }),
    );
  }
  return {
    consulta: query ?? null,
    total: matched.length,
    lineas: matched
      .slice(0, limit)
      .map(routeDict)
      .filter((r): r is RouteInfo => r !== undefined),
  };
}

/** Busca paradas por nombre o código, la mejor primero. */
export function findStops(index: Index, query: string, limit = 10) {
  const q = fold(query);
  const scored = index.stops
    .map((s) => {
      const name = fold(s.name);
      const code = fold(s.code);
      let score: number;
      if (code !== '' && code === q) score = 0;
      else if (name === q) score = 1;
      else if (name.startsWith(q) || (code !== '' && code.startsWith(q))) score = 2;
      else if (name.includes(q) || code.includes(q)) score = 3;
      else return null;
      return { item: s, score, key: name } satisfies Scored<Stop>;
    })
    .filter((x): x is Scored<Stop> => x !== null)
    .sort((a, b) => a.score - b.score || a.key.localeCompare(b.key, 'ca'));
  return {
    consulta: query,
    total: scored.length,
    paradas: scored
      .slice(0, limit)
      .map((x) => stopDict(x.item))
      .filter((s): s is StopInfo => s !== undefined),
  };
}

/** Resuelve una línea por id o por número (nombre corto), o da error con una pista. */
function resolveRoute(index: Index, text: string): Route {
  const t = text.trim();
  const byId = index.routesById.get(t);
  if (byId) return byId;
  const q = fold(t);
  const byLine = index.routes.find((r) => fold(r.shortName) === q);
  if (byLine) return byLine;
  throw new UsageError(`línea «${text}» no encontrada; usa find_routes para buscarla`);
}

/** Resuelve una parada por id, código o nombre exacto, o da error con una pista. */
function resolveStop(index: Index, text: string): Stop {
  const t = text.trim();
  const byId = index.stopsById.get(t);
  if (byId) return byId;
  if (t !== '') {
    const byCode = index.stops.find((s) => s.code === t);
    if (byCode) return byCode;
  }
  const q = fold(t);
  const byName = index.stops.find((s) => fold(s.name) === q);
  if (byName) return byName;
  throw new UsageError(`parada «${text}» no encontrada; usa find_stops para buscarla`);
}

/** Paradas de una línea, ordenadas, por sentido (ida y vuelta). */
export function routeStops(index: Index, routeId: string) {
  const route = resolveRoute(index, routeId);
  const trips = index.tripsByRoute.get(route.id) ?? [];
  // Por sentido, el viaje con más paradas como representante del recorrido.
  const representative = new Map<number, string>();
  const lengths = new Map<string, number>();
  for (const t of trips) {
    const len = index.stopTimesByTrip.get(t.id)?.length ?? 0;
    const current = representative.get(t.directionId);
    if (current === undefined || (lengths.get(current) ?? 0) < len) {
      representative.set(t.directionId, t.id);
      lengths.set(t.id, len);
    }
  }
  const directions = [...representative.entries()]
    .map(([direction, tripId]) => {
      const trip = index.tripsById.get(tripId);
      const stt = index.stopTimesByTrip.get(tripId) ?? [];
      return {
        direccion: direction,
        cabecera: trip?.headsign ?? '',
        paradas: stt
          .map((st) => stopDict(index.stopsById.get(st.stopId)))
          .filter((s): s is StopInfo => s !== undefined),
      };
    })
    .sort((a, b) => a.direccion - b.direccion);
  return {
    linea: routeDict(route),
    viajes: trips.length,
    direcciones: directions,
  };
}

/** «HH:MM:SS» u «HH:MM» a segundos desde medianoche (los tiempos >24h son pasada la medianoche). */
function toSeconds(time: string): number {
  const [h, m, s] = time.split(':').map((x) => Number.parseInt(x, 10));
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/** Salidas programadas de una parada en una fecha, opcionalmente filtradas por línea y hora. */
export function stopTimes(
  index: Index,
  stopId: string,
  opts: { date: string; route?: string; after?: number; limit: number },
) {
  const stop = resolveStop(index, stopId);
  const wantedRoute = opts.route === undefined ? undefined : resolveRoute(index, opts.route);
  const departures = index.departuresByStop.get(stop.id) ?? [];
  const active = activeServicesOn(index, opts.date);
  const rows: { route: RouteInfo | undefined; cabecera: string; seconds: number; hora: string }[] =
    [];
  for (const d of departures) {
    const trip = index.tripsById.get(d.tripId);
    if (!trip || !active.has(trip.serviceId)) continue;
    if (wantedRoute !== undefined && trip.routeId !== wantedRoute.id) continue;
    const seconds = toSeconds(d.time);
    if (opts.after !== undefined && seconds < opts.after) continue;
    rows.push({
      route: routeDict(index.routesById.get(trip.routeId)),
      cabecera: trip.headsign,
      seconds,
      hora: d.time.slice(0, 5),
    });
  }
  rows.sort((a, b) => a.seconds - b.seconds);
  return {
    parada: stopDict(stop),
    fecha: opts.date,
    total: rows.length,
    salidas: rows.slice(0, opts.limit).map((r) => ({
      linea: r.route?.linea ?? '',
      nombre: r.route?.nombre ?? '',
      cabecera: r.cabecera,
      hora: r.hora,
    })),
  };
}

/** Fecha de hoy en Madrid (AAAA-MM-DD), para el valor por defecto de «today». */
export function madridDate(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** Hora actual en Madrid (HH:MM). */
export function madridTime(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour').padStart(2, '0')}:${get('minute').padStart(2, '0')}`;
}

/** Resuelve «today», «tomorrow» o AAAA-MM-DD a AAAA-MM-DD, en hora de Madrid. */
export function resolveDate(text: string | undefined, now = Date.now()): string {
  const today = madridDate(now);
  const word = (text ?? 'today').trim().toLowerCase();
  if (word === 'today' || word === 'hoy' || word === 'avui') return today;
  if (word === 'tomorrow' || word === 'mañana' || word === 'manana' || word === 'demà') {
    const d = new Date(
      Date.UTC(int(today.slice(0, 4)), int(today.slice(4, 6)) - 1, int(today.slice(6, 8))),
    );
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(word);
  if (!m) throw new UsageError(`fecha no válida: usa AAAA-MM-DD, today o tomorrow (got «${text}»)`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function int(text: string): number {
  return Number.parseInt(text, 10);
}

/** «HH:MM» a segundos desde medianoche; undefined si no es una hora. */
export function parseTime(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const t = text.trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
    throw new UsageError(`hora no válida: usa HH:MM (got «${text}»)`);
  const [h, m] = t.split(':').map(int);
  return (h ?? 0) * 3600 + (m ?? 0) * 60;
}
