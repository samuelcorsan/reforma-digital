// Carga e indexación del GTFS de TIB (Consorci de Transports de Mallorca).
// El feed es un zip estático (CC BY 4.0, sin clave) que se descarga una vez por proceso y se
// indexa en memoria. Las funciones puras (parseCsv, buildIndex, activeServicesOn) no tocan la red
// para poder probarlas con ficheros locales.

import { strFromU8, unzipSync } from 'fflate';
import { SourceError } from './errors';

/** URL pública del GTFS de TIB (Mallorca: bus, tren y metro). */
const FEED_URL = 'https://www.tib.org/documents/20124/478141/ctm-mallorca-es.zip';

export type Fetch = typeof fetch;

export type Route = {
  id: string;
  shortName: string;
  longName: string;
  /** route_type de GTFS: 0 tram, 1 metro, 2 tren, 3 bus, 4 ferri. */
  type: number;
  color: string;
  agency: string;
  url: string;
};

export type Stop = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  parentStation?: string;
};

type Service = {
  id: string;
  /** lunes..domingo, en orden. */
  weekdays: boolean[];
  startDate: string;
  endDate: string;
};

type Trip = {
  id: string;
  routeId: string;
  serviceId: string;
  headsign: string;
  /** 0 o 1 (ida o vuelta). */
  directionId: number;
};

type Departure = { tripId: string; time: string; seq: number };
type StopTime = { stopId: string; time: string; seq: number };

/** Todo el GTFS indexado en memoria. */
export type Index = {
  feedVersion: string;
  routes: Route[];
  routesById: Map<string, Route>;
  stops: Stop[];
  stopsById: Map<string, Stop>;
  tripsById: Map<string, Trip>;
  tripsByRoute: Map<string, Trip[]>;
  /** Parada -> salidas (una fila por viaje que pasa por ella). */
  departuresByStop: Map<string, Departure[]>;
  /** Viaje -> paradas en orden de secuencia. */
  stopTimesByTrip: Map<string, StopTime[]>;
  services: Map<string, Service>;
  /** service_id -> (fecha AAAA-MM-DD -> 1 añadido | 2 suprimido). */
  overrides: Map<string, Map<string, 1 | 2>>;
};

/** CSV con comillas según RFC 4180: celdas entre comillas, comillas dobles escapadas y saltos de
 * línea dentro de una celda. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Convierte filas CSV en objetos con la primera fila como cabecera. */
function toObjects(rows: string[][]): Array<Record<string, string>> {
  const header = rows[0] ?? [];
  if (header.length === 0) return [];
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((name, i) => {
        obj[name] = r[i] ?? '';
      });
      return obj;
    });
}

const num = (text: string) => Number.parseFloat(text);
const int = (text: string) => Number.parseInt(text, 10);

/** Construye el índice desde el contenido de los ficheros GTFS, ya descomprimidos y en texto. */
export function buildIndex(files: Record<string, string>): Index {
  const routesById = new Map<string, Route>();
  const routes: Route[] = [];
  const stopsById = new Map<string, Stop>();
  const stops: Stop[] = [];
  const tripsById = new Map<string, Trip>();
  const tripsByRoute = new Map<string, Trip[]>();
  const departuresByStop = new Map<string, Departure[]>();
  const stopTimesByTrip = new Map<string, StopTime[]>();
  const services = new Map<string, Service>();
  const overrides = new Map<string, Map<string, 1 | 2>>();

  const agencies = new Map<string, string>();
  const agencyText = files['agency.txt'];
  if (agencyText) {
    for (const a of toObjects(parseCsv(agencyText))) {
      const id = a['agency_id'];
      const name = a['agency_name'];
      if (id && name) agencies.set(id, name);
    }
  }

  const routesText = files['routes.txt'];
  if (routesText) {
    for (const r of toObjects(parseCsv(routesText))) {
      const routeId = r['route_id'];
      if (!routeId) continue;
      const route: Route = {
        id: routeId,
        shortName: r['route_short_name'] ?? '',
        longName: r['route_long_name'] ?? '',
        type: int(r['route_type'] ?? '3'),
        color: r['route_color'] ?? '',
        agency: agencies.get(r['agency_id'] ?? '') ?? '',
        url: r['route_url'] ?? '',
      };
      routes.push(route);
      routesById.set(route.id, route);
    }
  }

  const stopsText = files['stops.txt'];
  if (stopsText) {
    for (const s of toObjects(parseCsv(stopsText))) {
      const stopId = s['stop_id'];
      if (!stopId) continue;
      const stop: Stop = {
        id: stopId,
        code: s['stop_code'] ?? '',
        name: s['stop_name'] ?? '',
        lat: num(s['stop_lat'] ?? ''),
        lon: num(s['stop_lon'] ?? ''),
        parentStation: s['parent_station'] || undefined,
      };
      stops.push(stop);
      stopsById.set(stop.id, stop);
    }
  }

  const calendarText = files['calendar.txt'];
  if (calendarText) {
    for (const c of toObjects(parseCsv(calendarText))) {
      const serviceId = c['service_id'];
      if (!serviceId) continue;
      services.set(serviceId, {
        id: serviceId,
        weekdays: [
          c['monday'],
          c['tuesday'],
          c['wednesday'],
          c['thursday'],
          c['friday'],
          c['saturday'],
          c['sunday'],
        ].map((v) => v === '1'),
        startDate: c['start_date'] ?? '',
        endDate: c['end_date'] ?? '',
      });
    }
  }

  const datesText = files['calendar_dates.txt'];
  if (datesText) {
    for (const c of toObjects(parseCsv(datesText))) {
      const serviceId = c['service_id'];
      const date = c['date'];
      if (!serviceId || !date) continue;
      const type = int(c['exception_type'] ?? '');
      if (type !== 1 && type !== 2) continue;
      let map = overrides.get(serviceId);
      if (!map) {
        map = new Map();
        overrides.set(serviceId, map);
      }
      map.set(date, type);
    }
  }

  const tripsText = files['trips.txt'];
  if (tripsText) {
    for (const t of toObjects(parseCsv(tripsText))) {
      const tripId = t['trip_id'];
      const routeId = t['route_id'];
      if (!tripId || !routeId) continue;
      const trip: Trip = {
        id: tripId,
        routeId,
        serviceId: t['service_id'] ?? '',
        headsign: t['trip_headsign'] ?? '',
        directionId: t['direction_id'] === '1' ? 1 : 0,
      };
      tripsById.set(trip.id, trip);
      const list = tripsByRoute.get(trip.routeId);
      if (list) list.push(trip);
      else tripsByRoute.set(trip.routeId, [trip]);
    }
  }

  const stopTimesText = files['stop_times.txt'];
  if (stopTimesText) {
    for (const st of toObjects(parseCsv(stopTimesText))) {
      const tripId = st['trip_id'];
      const stopId = st['stop_id'];
      if (!tripId || !stopId) continue;
      const seq = int(st['stop_sequence'] ?? '0');
      const time = st['departure_time'] ?? st['arrival_time'] ?? '';
      const d = departuresByStop.get(stopId);
      if (d) d.push({ tripId, time, seq });
      else departuresByStop.set(stopId, [{ tripId, time, seq }]);
      const s = stopTimesByTrip.get(tripId);
      if (s) s.push({ stopId, time, seq });
      else stopTimesByTrip.set(tripId, [{ stopId, time, seq }]);
    }
    for (const stt of stopTimesByTrip.values()) stt.sort((a, b) => a.seq - b.seq);
  }

  let feedVersion = '';
  const feedText = files['feed_info.txt'];
  if (feedText) {
    const info = toObjects(parseCsv(feedText))[0];
    feedVersion = info?.['feed_version'] ?? '';
  }

  return {
    feedVersion,
    routes,
    routesById,
    stops,
    stopsById,
    tripsById,
    tripsByRoute,
    departuresByStop,
    stopTimesByTrip,
    services,
    overrides,
  };
}

/** Descarga y descomprime el GTFS de TIB y lo indexa. */
export async function loadGtfs(fetchImpl: Fetch = fetch): Promise<Index> {
  let response: Response;
  try {
    response = await fetchImpl(FEED_URL, {
      headers: { Accept: 'application/zip' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new SourceError('No se pudo descargar el GTFS de TIB. Prueba más tarde.');
  }
  if (!response.ok) throw new SourceError(`TIB respondió ${response.status}.`);
  let files: Record<string, string>;
  try {
    const buffer = new Uint8Array(await response.arrayBuffer());
    const unzipped = unzipSync(buffer);
    files = {};
    for (const [name, data] of Object.entries(unzipped)) {
      const base = name.split('/').pop() ?? '';
      if (base.endsWith('.txt')) files[base] = strFromU8(data);
    }
  } catch {
    throw new SourceError('El GTFS de TIB no se pudo descomprimir o leer.');
  }
  return buildIndex(files);
}

/** Día de la semana en el orden de GTFS: 0 lunes … 6 domingo, para una fecha AAAA-MM-DD. */
function gtfsWeekday(date: string): number {
  const year = int(date.slice(0, 4));
  const month = int(date.slice(4, 6)) - 1;
  const day = int(date.slice(6, 8));
  const jsDay = new Date(year, month, day).getDay(); // 0 domingo … 6 sábado
  return (jsDay + 6) % 7;
}

/** Servicios que circulan en una fecha (AAAA-MM-DD): calendario base más las excepciones de
 * calendar_dates (1 añade, 2 suprime). */
export function activeServicesOn(index: Index, date: string): Set<string> {
  // El calendario del GTFS usa fechas AAAA-MM-DD (sin guiones); la herramienta envía AAAA-MM-DD.
  const ymd = date.replace(/-/g, '');
  const active = new Set<string>();
  const weekday = gtfsWeekday(ymd);
  for (const [id, svc] of index.services) {
    const inRange = svc.startDate <= ymd && ymd <= svc.endDate;
    const runs = inRange && (svc.weekdays[weekday] ?? false);
    const override = index.overrides.get(id)?.get(ymd);
    if (override === 1) active.add(id);
    else if (override === 2) {
      // suprimido ese día
    } else if (runs) active.add(id);
  }
  // Servicios que solo existen como excepción (sin fila en calendar.txt).
  for (const [id, map] of index.overrides) {
    if (!index.services.has(id) && map.get(ymd) === 1) active.add(id);
  }
  return active;
}
