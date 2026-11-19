// Lo que hace cada comando de renfe-cli (`cli.py`), sin la parte de terminal: validar la entrada, llamar a Renfe y
// devolver el mismo JSON. Las herramientas MCP usan estas funciones.

import { RsvClient } from './client';
import * as delays from './delays';
import { RenfeError, UsageError } from './errors';
import * as live from './live';
import { search } from './search';
import * as stations from './stations';
import { addDays, today } from './time';

const MAX_DAYS_AHEAD = 366;

/** Un cliente para la operación; si falla, el error lleva las peticiones reintentadas, como en la CLI. */
async function withClient<T>(produce: (client: RsvClient) => Promise<T>): Promise<T> {
  const client = new RsvClient();
  try {
    return await produce(client);
  } catch (err) {
    if (err instanceof RenfeError && client.retries.length && !err.retries.length)
      err.retries = client.retries.map((e) => ({ ...e, errors: [...e.errors] }));
    throw err;
  }
}

export function parseDate(text: string, now = Date.now()): string {
  const day = today(now);
  const word = text.trim().toLowerCase();
  if (word === 'today' || word === 'hoy') return day;
  if (['tomorrow', 'mañana', 'manana'].includes(word)) return addDays(day, 1);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(word) &&
    new Date(`${word}T00:00:00Z`).toISOString().startsWith(word);
  if (!valid)
    throw new UsageError(
      `date must be YYYY-MM-DD, today or tomorrow (got ${stations.pyRepr(text)})`,
    );
  if (word < day) throw new UsageError(`date ${word} is in the past`);
  if (word > addDays(day, MAX_DAYS_AHEAD))
    throw new UsageError(`date ${word} is more than a year ahead; Renfe doesn't sell that far`);
  return word;
}

/** HH:MM en minutos desde medianoche. */
export function parseTime(text: string | undefined, option: string): number | undefined {
  if (text === undefined) return undefined;
  const t = text.trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
    throw new UsageError(`${option} must be HH:MM (got ${stations.pyRepr(text)})`);
  const [h, m] = t.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function trainNumber(text: string): string {
  const compact = text.trim().replace(/\s*\+\s*/g, '+');
  const parts = /^[0-9]{1,6}(\+[0-9]{1,6})*$/.test(compact)
    ? compact.split('+').map(live.key)
    : undefined;
  if (!parts || parts.length !== 1)
    throw new UsageError(
      `train must be one train number such as 03081; for a train with a change, one leg's (got ${stations.pyRepr(text)})`,
    );
  return parts[0]!;
}

/** Nombres de estación por código: la lista incluida y las estaciones elegidas. */
function names(...picked: stations.Station[]) {
  const out = new Map(stations.bundled().map((s) => [s.code, s.name]));
  for (const s of picked) out.set(s.code, s.name);
  return out;
}

export async function findStations(query: string, limit = 10) {
  let found = stations.find(query, stations.bundled(), limit);
  if (!found.length)
    found = await withClient(async (c) => stations.find(query, await stations.load(c), limit));
  const out: Record<string, unknown> = {
    query,
    count: found.length,
    stations: found.map(stations.toDict),
  };
  if (!found.length) out.suggestions = stations.suggestions(query).map(stations.toDict);
  return out;
}

export async function searchTrains(args: {
  origin: string;
  destination: string;
  date?: string;
  after?: string;
  arrive_by?: string;
  include_fares?: boolean;
  limit?: number;
}) {
  const now = Date.now();
  const day = parseDate(args.date ?? 'today', now);
  const after = parseTime(args.after, 'after');
  const arriveBy = parseTime(args.arrive_by, 'arrive_by');
  const isToday = day === today(now);
  return withClient(async (client) => {
    const src = await stations.lookup(args.origin, client);
    const dst = await stations.lookup(args.destination, client);
    if (src.code === dst.code) throw new UsageError('origin and destination are the same station');
    const map = isToday ? live.inBackground() : undefined; // el mapa se pide a la vez que la búsqueda
    const out = await search(client, src, dst, day, {
      names: names(src, dst),
      after,
      arriveBy,
      fares: args.include_fares ?? true,
      limit: args.limit ?? 10,
      now,
      fromNow: isToday && after === undefined,
    });
    let [board, why, mapRetries] = map ? await map() : [null, null, []];
    try {
      live.annotate(out.trains, board);
    } catch (err) {
      live.annotate(out.trains, null); // el mapa nunca hace fallar una búsqueda
      [board, why] = [null, `${live.LABEL}: unexpected error (${(err as Error)?.name ?? 'Error'})`];
    }
    out.delays_included = board !== null;
    if (why)
      out.notice = out.notice
        ? `${out.notice} Delays are unknown (${why}).`
        : `Delays are unknown (${why}).`;
    out.retries = [...client.retries, ...mapRetries];
    return out;
  });
}

export function trainStatus(train: string) {
  const number = trainNumber(train);
  return withClient(async (client) => {
    const board = await live.fetchBoard({ retries: client.retries });
    return delays.status(board, number, names(), client.retries);
  });
}

export function listDelays(train?: string) {
  const wanted = train === undefined ? undefined : trainNumber(train);
  return withClient(async (client) => {
    const board = await live.fetchBoard({ retries: client.retries });
    return delays.report(board, names(), client.retries, wanted);
  });
}
