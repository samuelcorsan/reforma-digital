// Líneas, paradas y horarios publicados en el GTFS abierto de un operador. Sin tiempo real, así que
// los retrasos no se ven.
import { strFromU8, unzipSync } from 'fflate';
import { fold, get, SourceError, type Fetch } from './comun';

export type Row = Record<string, string>;
/** Las filas de cada fichero del GTFS («stops.txt»). */
export type Files = Map<string, Row[]>;

/** Un operador: `label` es como se le nombra en los errores («GTFS de TIB»). */
export type Feed = {
  label: string;
  /** El zip del GTFS. */
  url: string;
  source: string;
};

const DAY = 24 * 3600;
const WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** CSV con comillas (RFC 4180): comas, comillas dobles y saltos de línea dentro de una celda. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (quoted) {
      if (c !== '"') field += c;
      else if (text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  return rows;
}

/** Un CSV con cabecera como filas, sin las vacías; la EMT rellena las celdas vacías con un espacio. */
export function readCsv(text: string): Row[] {
  const [header = [], ...rows] = parseCsv(text.replace(/^﻿/, ''));
  return rows
    .filter((r) => r.some((cell) => cell.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** Las filas de un fichero con las columnas pedidas; si falta una obligatoria, es un error de la
 * fuente y no una tabla vacía. Las opcionales ausentes valen '' como en el propio GTFS. */
function readTable<R extends string, O extends string = never>(
  files: Files,
  label: string,
  name: string,
  required: readonly R[],
  optional: readonly O[] = [],
): Record<R | O, string>[] {
  const rows = files.get(name);
  if (rows === undefined) throw new SourceError(`Al ${label} le falta ${name}.`);
  const missing = required.find((c) => rows.some((r) => r[c] === undefined));
  if (missing) throw new SourceError(`${name} del ${label} no tiene la columna ${missing}.`);
  return rows.map((r) => {
    const record = {} as Record<R | O, string>;
    for (const c of [...required, ...optional]) record[c] = r[c] ?? '';
    return record;
  });
}

const MODES: Record<number, string> = {
  0: 'Tranvía',
  1: 'Metro',
  2: 'Tren',
  3: 'Autobús',
  4: 'Ferri',
  715: 'Autobús a demanda',
};

/** `nota`: route_desc, para lo que el operador avisa de la línea (a demanda, solo días lectivos…). */
type Route = {
  id: string;
  linea: string;
  nombre: string;
  modo: string;
  agencia: string;
  nota?: string;
};
/** Sin coordenadas si el operador no las publica. */
type Stop = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'parada' | 'estacion';
  lat: number | undefined;
  lon: number | undefined;
};
/** `shifts`: cuánto se adelanta o retrasa cada salida respecto a las horas de stop_times. Un viaje
 * normal sale una vez ([0]); uno de frequencies.txt es una plantilla que se repite. `estimated`: sus
 * salidas son «cada N minutos» (exact_times 0), no horas publicadas. */
type Trip = {
  id: string;
  route: Route;
  service: string;
  cabecera: string;
  shifts: number[];
  estimated: boolean;
};
/** Un paso de un viaje por una parada; `seconds` puede pasar de 24 h (la madrugada siguiente). */
type Call = {
  trip: Trip;
  stop: Stop;
  seq: number;
  seconds: number | undefined;
  arrival: number | undefined;
  /** shape_dist_traveled, para repartir la hora de las paradas sin hora. */
  dist: number | undefined;
  /** La hora no la publica el feed: se ha repartido entre las paradas con hora. */
  estimated: boolean;
  boarding: boolean;
};

export type Index = {
  label: string;
  /** feed_version, si el feed tiene feed_info.txt. */
  version: string | undefined;
  /** Fechas AAAA-MM-DD que cubre el feed. */
  start: string;
  end: string;
  routes: Route[];
  stops: Stop[];
  /** Estación -> sus andenes, para que las salidas de una estación sean las de todos ellos. */
  platforms: Map<string, Stop[]>;
  tripsByRoute: Map<string, Trip[]>;
  callsByTrip: Map<string, Call[]>;
  callsByStop: Map<string, Call[]>;
  services: Map<string, { days: boolean[]; start: string; end: string }>;
  /** `${service_id} ${AAAAMMDD}` -> true si se añade ese día, false si se suprime. */
  exceptions: Map<string, boolean>;
};

const iso = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

function seconds(label: string, time: string): number | undefined {
  if (time === '') return undefined;
  const m = /^(\d+):(\d\d):(\d\d)$/.exec(time);
  if (!m) throw new SourceError(`Hora no válida en el ${label}: ${time}.`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Las paradas sin hora entre dos con hora (el GTFS lo permite y la EMT solo da la hora de unas
 * pocas) se reparten por distancia recorrida o, si falta, por orden. */
function interpolate(calls: Call[]) {
  let from: Call | undefined;
  let gap: Call[] = [];
  for (const call of calls) {
    if (call.seconds === undefined) {
      gap.push(call);
      continue;
    }
    if (from && from.seconds !== undefined && gap.length > 0) {
      const t0 = from.seconds;
      const t1 = call.arrival ?? call.seconds;
      const d0 = from.dist;
      const d1 = call.dist;
      // Distancia solo si la tienen todas: mezclarla con el orden puede poner horas hacia atrás.
      const byDistance =
        d0 !== undefined && d1 !== undefined && d1 > d0 && gap.every((c) => c.dist !== undefined);
      gap.forEach((c, i) => {
        const share =
          byDistance && c.dist !== undefined
            ? (c.dist - d0) / (d1 - d0)
            : (i + 1) / (gap.length + 1);
        c.seconds = Math.round(t0 + share * (t1 - t0));
        c.estimated = true;
      });
    }
    from = call;
    gap = [];
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(files: Files, label: string): Index {
  const table = <R extends string, O extends string = never>(
    name: string,
    required: readonly R[],
    optional: readonly O[] = [],
  ) => readTable(files, label, name, required, optional);
  /** calendar.txt, calendar_dates.txt, frequencies.txt y feed_info.txt pueden faltar. */
  const maybe: typeof table = (name, ...columns) =>
    files.has(name) ? table(name, ...columns) : [];
  const agencies = new Map(
    table('agency.txt', ['agency_name'], ['agency_id']).map((a) => [a.agency_id, a.agency_name]),
  );
  const routesById = new Map<string, Route>();
  for (const r of table(
    'routes.txt',
    ['route_id', 'route_type'],
    ['agency_id', 'route_short_name', 'route_long_name', 'route_desc'],
  )) {
    // Con una sola agencia, el GTFS permite dejar agency_id en blanco en routes.txt.
    const only = agencies.size === 1 ? [...agencies.values()][0] : undefined;
    const agencia = agencies.get(r.agency_id) ?? (r.agency_id === '' ? only : undefined);
    if (agencia === undefined) throw new SourceError(`Línea ${r.route_id} sin agencia en el GTFS.`);
    const type = Number(r.route_type);
    routesById.set(r.route_id, {
      id: r.route_id,
      linea: r.route_short_name,
      nombre: r.route_long_name,
      modo: MODES[type] ?? `tipo ${type}`,
      agencia,
      ...(r.route_desc !== '' && { nota: r.route_desc }),
    });
  }

  // Solo paradas y estaciones: las entradas, nodos y andenes de servicio no tienen salidas.
  const stopsById = new Map<string, Stop>();
  const platforms = new Map<string, Stop[]>();
  for (const s of table(
    'stops.txt',
    ['stop_id'],
    ['stop_code', 'stop_name', 'stop_lat', 'stop_lon', 'location_type', 'parent_station'],
  )) {
    const tipo =
      s.location_type === '1' ? 'estacion' : ['', '0'].includes(s.location_type) ? 'parada' : null;
    if (tipo === null) continue;
    const stop: Stop = {
      id: s.stop_id,
      codigo: s.stop_code,
      nombre: s.stop_name,
      tipo,
      lat: s.stop_lat === '' ? undefined : Number(s.stop_lat),
      lon: s.stop_lon === '' ? undefined : Number(s.stop_lon),
    };
    stopsById.set(stop.id, stop);
    if (tipo === 'parada' && s.parent_station !== '') push(platforms, s.parent_station, stop);
  }

  const services: Index['services'] = new Map();
  for (const c of maybe('calendar.txt', ['service_id', 'start_date', 'end_date', ...WEEK])) {
    services.set(c.service_id, {
      days: WEEK.map((d) => c[d] === '1'),
      start: c.start_date,
      end: c.end_date,
    });
  }
  const exceptions = new Map<string, boolean>();
  for (const c of maybe('calendar_dates.txt', ['service_id', 'date', 'exception_type'])) {
    if (c.exception_type === '1' || c.exception_type === '2') {
      exceptions.set(`${c.service_id} ${c.date}`, c.exception_type === '1');
    }
  }

  const tripsById = new Map<string, Trip>();
  const tripsByRoute = new Map<string, Trip[]>();
  for (const t of table('trips.txt', ['route_id', 'service_id', 'trip_id'], ['trip_headsign'])) {
    const route = routesById.get(t.route_id);
    if (!route) throw new SourceError(`Viaje ${t.trip_id} de una línea que no está en el GTFS.`);
    const trip: Trip = {
      id: t.trip_id,
      route,
      service: t.service_id,
      cabecera: t.trip_headsign,
      shifts: [0],
      estimated: false,
    };
    tripsById.set(trip.id, trip);
    push(tripsByRoute, route.id, trip);
  }

  const callsByTrip = new Map<string, Call[]>();
  const callsByStop = new Map<string, Call[]>();
  for (const st of table(
    'stop_times.txt',
    ['trip_id', 'stop_id', 'stop_sequence'],
    ['arrival_time', 'departure_time', 'pickup_type', 'shape_dist_traveled'],
  )) {
    const trip = tripsById.get(st.trip_id);
    const stop = stopsById.get(st.stop_id);
    if (!trip || !stop) {
      throw new SourceError(`stop_times.txt cita un viaje o parada que no está en el GTFS.`);
    }
    const call: Call = {
      trip,
      stop,
      seq: Number(st.stop_sequence),
      seconds: seconds(label, st.departure_time || st.arrival_time),
      arrival: seconds(label, st.arrival_time || st.departure_time),
      dist: st.shape_dist_traveled === '' ? undefined : Number(st.shape_dist_traveled),
      estimated: false,
      // pickup_type 1: solo se baja (sobre todo en la última parada del viaje).
      boarding: st.pickup_type !== '1',
    };
    push(callsByTrip, trip.id, call);
    push(callsByStop, stop.id, call);
  }
  for (const calls of callsByTrip.values()) {
    calls.sort((a, b) => a.seq - b.seq);
    // La primera parada está en el kilómetro 0 aunque el feed lo deje en blanco (la EMT).
    const first = calls[0];
    if (first && first.dist === undefined) first.dist = 0;
    interpolate(calls);
    // En la última parada el viaje acaba: no es una salida aunque el feed no lo marque.
    const last = calls.at(-1);
    if (last) last.boarding = false;
  }

  // Un viaje de frequencies.txt sale cada headway_secs entre start_time y end_time, con los
  // tiempos de su plantilla en stop_times trasladados a cada salida.
  const starts = new Map<string, number[]>();
  const headwayOnly = new Set<string>();
  for (const f of maybe(
    'frequencies.txt',
    ['trip_id', 'start_time', 'end_time', 'headway_secs'],
    ['exact_times'],
  )) {
    const start = seconds(label, f.start_time);
    const end = seconds(label, f.end_time);
    const headway = Number(f.headway_secs);
    if (start === undefined || end === undefined || !(headway > 0)) {
      throw new SourceError(`frequencies.txt del ${label} tiene una franja no válida.`);
    }
    for (let t = start; t < end; t += headway) push(starts, f.trip_id, t);
    if (f.exact_times !== '1') headwayOnly.add(f.trip_id);
  }
  for (const [id, times] of starts) {
    const trip = tripsById.get(id);
    if (!trip) throw new SourceError(`frequencies.txt cita un viaje que no está en el ${label}.`);
    const template = callsByTrip.get(id)?.[0]?.seconds;
    // Un viaje sin paradas no sale por ninguna: no hay nada que trasladar.
    if (template !== undefined) trip.shifts = times.map((t) => t - template);
    trip.estimated = headwayOnly.has(id);
  }

  // Sin feed_info.txt (la EMT no lo publica) o sin sus fechas, que el GTFS deja como opcionales, el
  // feed vale lo que su calendario.
  const [info] = maybe('feed_info.txt', [], ['feed_start_date', 'feed_end_date', 'feed_version']);
  const days = [
    ...[...services.values()].flatMap((s) => [s.start, s.end]),
    // Un día suprimido no es un día con horarios.
    ...[...exceptions].filter(([, added]) => added).map(([k]) => k.split(' ')[1] ?? ''),
  ].sort();
  const start = info?.feed_start_date || days[0];
  const end = info?.feed_end_date || days.at(-1);
  if (start === undefined || end === undefined) {
    throw new SourceError(`El ${label} no dice qué fechas cubre (ni feed_info ni calendario).`);
  }

  return {
    label,
    version: info && info.feed_version !== '' ? info.feed_version : undefined,
    start: iso(start),
    end: iso(end),
    routes: [...routesById.values()],
    stops: [...stopsById.values()],
    platforms,
    tripsByRoute,
    callsByTrip,
    callsByStop,
    services,
    exceptions,
  };
}

const FILES =
  /^(agency|routes|stops|trips|stop_times|calendar|calendar_dates|feed_info|frequencies)\.txt$/;

/** Descarga el zip y lo indexa; shapes.txt (lo que más pesa) no se descomprime. */
async function loadIndex(fetchImpl: Fetch, feed: Feed): Promise<Index> {
  const response = await get(fetchImpl, feed.url, 'application/zip');
  let zip: Uint8Array;
  try {
    zip = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new SourceError(`La descarga del ${feed.label} se cortó. Prueba más tarde.`);
  }
  const base = (name: string) => name.split('/').pop() ?? name;
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zip, { filter: (file) => FILES.test(base(file.name)) });
  } catch {
    throw new SourceError(`El ${feed.label} no se pudo descomprimir.`);
  }
  const files: Files = new Map();
  for (const [name, data] of Object.entries(unzipped))
    files.set(base(name), readCsv(strFromU8(data)));
  return buildIndex(files, feed.label);
}

// Los horarios cambian unas pocas veces al año. Se guardan un día: un proceso que dure más no se
// queda con los de la temporada anterior.
// Una caché por servidor: dos servidores con otra configuración (la clave del NAP) no comparten.
export function indexCache(fetchImpl: Fetch) {
  const loaded = new Map<string, { at: number; index: Promise<Index> }>();
  return (feed: Feed) => {
    const cached = loaded.get(feed.url);
    if (cached && Date.now() - cached.at <= DAY * 1000) return cached.index;
    const index = loadIndex(fetchImpl, feed).catch((error: unknown) => {
      if (loaded.get(feed.url)?.index === index) loaded.delete(feed.url);
      throw error;
    });
    loaded.set(feed.url, { at: Date.now(), index });
    return index;
  };
}

const stopInfo = ({ id, codigo, nombre, tipo, lat, lon }: Stop) => ({
  id,
  codigo,
  nombre,
  tipo,
  lat,
  lon,
});

/** Primero lo exacto, luego lo que empieza igual y por último lo que lo contiene. */
function rank<T>(items: T[], query: string, keys: (item: T) => string[]) {
  const q = fold(query);
  const score = (item: T) => {
    const ks = keys(item)
      .map(fold)
      .filter((k) => k !== '');
    if (ks.includes(q)) return 0;
    if (ks.some((k) => k.startsWith(q))) return 1;
    if (ks.some((k) => k.includes(q))) return 2;
    return undefined;
  };
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((x): x is { item: T; score: number } => x.score !== undefined)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.item);
}

const byLine = (a: Route, b: Route) => a.linea.localeCompare(b.linea, 'ca', { numeric: true });

export function findRoutes(index: Index, query: string | undefined, limit: number) {
  const sorted = [...index.routes].sort(byLine);
  const matched =
    query === undefined ? sorted : rank(sorted, query, (r) => [r.linea, r.id, r.nombre]);
  return { consulta: query ?? null, total: matched.length, lineas: matched.slice(0, limit) };
}

// TIB pone el código detrás del nombre («Inca (51003)») y la EMT delante («1-Sindicat»): también
// se busca sin él.
const bareName = (stop: Stop) => stop.nombre.replace(/\s*\(\d+\)$/, '').replace(/^\d+-/, '');

export function findStops(index: Index, query: string, limit: number) {
  const matched = rank(index.stops, query, (s) => [s.codigo, s.nombre, bareName(s)]);
  return { consulta: query, total: matched.length, paradas: matched.slice(0, limit).map(stopInfo) };
}

function resolveRoute(index: Index, text: string): Route {
  const q = fold(text);
  const route =
    index.routes.find((r) => r.id === text) ?? index.routes.find((r) => fold(r.linea) === q);
  if (!route) throw new SourceError(`Línea «${text}» no encontrada: búscala con find_routes.`);
  return route;
}

export function routeStops(index: Index, text: string) {
  const route = resolveRoute(index, text);
  const trips = index.tripsByRoute.get(route.id) ?? [];
  // Por cabecera y no por direction_id: TIB lo deja vacío en uno de cada siete viajes. El viaje
  // más largo de cada cabecera hace de recorrido, porque algunos acortan.
  const longest = new Map<string, Call[]>();
  for (const trip of trips) {
    const calls = index.callsByTrip.get(trip.id) ?? [];
    if (calls.length > (longest.get(trip.cabecera)?.length ?? 0)) longest.set(trip.cabecera, calls);
  }
  return {
    linea: route,
    viajes: new Set(
      trips.flatMap((t) => {
        const first = index.callsByTrip.get(t.id)?.[0]?.seconds;
        // El mismo bus repetido con otro trip_id (como el N1 de la EMT) cuenta una vez.
        return first === undefined
          ? []
          : t.shifts.map((s) => `${t.service} ${t.cabecera} ${first + s}`);
      }),
    ).size,
    recorridos: [...longest.entries()].map(([cabecera, calls]) => ({
      cabecera,
      paradas: calls.map((c) => stopInfo(c.stop)),
    })),
  };
}

/** Una parada por id, código o nombre; una estación vale por todos sus andenes, y un nombre por
 * todas las paradas que lo llevan (la EMT da el mismo a las dos aceras: 11 «pl. d'Espanya»). */
function resolveStop(index: Index, text: string): { stop: Stop; ids: Set<string> } {
  const q = fold(text);
  const exact = [
    index.stops.filter((s) => s.id === text),
    index.stops.filter((s) => s.codigo === text),
  ].find((list) => list.length > 0);
  // Si el código es a la vez de una estación y de un andén (40036 en la Intermodal), el andén.
  const chosen = exact
    ? exact
        .filter((s, _, all) => s.tipo === 'parada' || all.every((o) => o.tipo === 'estacion'))
        .slice(0, 1)
    : index.stops.filter((s) => fold(s.nombre) === q || fold(bareName(s)) === q);
  const [stop] = chosen;
  if (!stop) throw new SourceError(`Parada «${text}» no encontrada: búscala con find_stops.`);
  const platforms = chosen.flatMap((s) =>
    s.tipo === 'estacion' ? (index.platforms.get(s.id) ?? []) : [s],
  );
  return { stop, ids: new Set(platforms.map((s) => s.id)) };
}

/** Si un servicio circula un día (AAAA-MM-DD): calendar.txt con las excepciones de calendar_dates. */
export function runsOn(index: Index, service: string, date: string): boolean {
  const ymd = date.replaceAll('-', '');
  const exception = index.exceptions.get(`${service} ${ymd}`);
  if (exception !== undefined) return exception;
  const s = index.services.get(service);
  if (!s || ymd < s.start || ymd > s.end) return false;
  return s.days[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] === true;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const clock = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;

export function stopTimes(
  index: Index,
  text: string,
  opts: { date: string; route?: string; after?: number; limit: number },
) {
  // El día siguiente al último aún tiene los viajes de madrugada del último.
  if (opts.date < index.start || opts.date > addDays(index.end, 1)) {
    throw new SourceError(
      `El ${index.label} publica horarios del ${index.start} al ${index.end}; no hay datos para el ${opts.date}.`,
    );
  }
  const { stop, ids } = resolveStop(index, text);
  const route = opts.route === undefined ? undefined : resolveRoute(index, opts.route);
  const yesterday = addDays(opts.date, -1);
  const rows: { seconds: number; call: Call }[] = [];
  // La EMT repite viajes idénticos con otro trip_id (el N1 de LAB y de SAB, ambos del servicio CAP):
  // una salida con la misma hora, línea, cabecera y andén es el mismo bus.
  const seen = new Set<string>();
  const add = (s: number, call: Call) => {
    const key = `${s} ${call.trip.route.id} ${call.trip.cabecera} ${call.stop.id}`;
    if (seen.has(key) || (opts.after !== undefined && s < opts.after)) return;
    seen.add(key);
    rows.push({ seconds: s, call });
  };
  // Lo que el operador avisa de las líneas de la parada (un cierre, solo días lectivos…), también
  // cuando no hay salidas: explica por qué.
  const avisos = new Map<string, string>();
  for (const id of ids) {
    for (const call of index.callsByStop.get(id) ?? []) {
      const r = call.trip.route;
      if (route && r !== route) continue;
      if (r.nota) avisos.set(r.id, `${r.linea}: ${r.nota}`);
      if (!call.boarding || call.seconds === undefined) continue;
      const today = runsOn(index, call.trip.service, opts.date);
      const before = runsOn(index, call.trip.service, yesterday);
      for (const shift of call.trip.shifts) {
        const s = call.seconds + shift;
        // Lo que pasa de 24:00 es de la madrugada siguiente: sale con su servicio de ayer (00:10)
        // y también con el de hoy, al final y marcado, para que a las 23:50 se vea el nocturno.
        if (today) add(s, call);
        if (s >= DAY && before) add(s - DAY, call);
      }
    }
  }
  rows.sort((a, b) => a.seconds - b.seconds);
  return {
    parada: stopInfo(stop),
    fecha: opts.date,
    horarios: `${index.label}${index.version === undefined ? '' : `, versión ${index.version}`}, del ${index.start} al ${index.end}`,
    total: rows.length,
    salidas: rows.slice(0, opts.limit).map(({ seconds: s, call }) => ({
      hora: clock(s % DAY),
      ...(s >= DAY && { diaSiguiente: true }),
      linea: call.trip.route.linea,
      nombre: call.trip.route.nombre,
      cabecera: call.trip.cabecera,
      ...((call.estimated || call.trip.estimated) && { estimada: true }),
      ...(ids.size > 1 && { anden: call.stop.nombre }),
    })),
    ...(avisos.size > 0 && { avisos: [...avisos.values()] }),
  };
}

export function madrid(now: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    seconds: Number(part('hour')) * 3600 + Number(part('minute')) * 60,
  };
}

/** «today», «tomorrow» o AAAA-MM-DD (que exista) a AAAA-MM-DD, en hora de Madrid. */
export function resolveDate(text: string, now: number): string {
  const word = text.trim().toLowerCase();
  const today = madrid(now).date;
  if (['today', 'hoy', 'avui'].includes(word)) return today;
  if (['tomorrow', 'mañana', 'manana', 'demà'].includes(word)) return addDays(today, 1);
  // Date.parse descarta el mes 13; addDays, el 31 de febrero (lo pasaría al 3 de marzo).
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(word) &&
    !Number.isNaN(Date.parse(word)) &&
    addDays(word, 0) === word
  ) {
    return word;
  }
  throw new SourceError(`Fecha «${text}» no válida: usa AAAA-MM-DD, today o tomorrow.`);
}
