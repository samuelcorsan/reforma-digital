// Retrasos en directo del mapa de trenes de Renfe (port de renfe-cli `live.py`): JSON público, sin clave ni sesión,
// solo larga y media distancia y solo mientras circulan. Un tren que no está en el mapa puede no haber salido,
// haber llegado o estar cancelado: nunca "en hora". El retraso es el último registrado, y el mapa no tiene fecha de
// viaje: pasada la medianoche puede seguir mostrando la circulación de ayer.

import { checkedJson, request } from './client';
import * as config from './config';
import { ApiShapeError, AuthError, RenfeError, type Retry, UsageError } from './errors';
import type { Leg, Train } from './legacy';
import * as retry from './retry';
import { DAY, HOUR, iso, parseIso, roundHalfEven, shiftDays, wall } from './time';

export const LABEL = 'live map';
const NUMBER = /^[0-9]{1,6}$/;
const MINUTES = /^-?[0-9]{1,4}$/;
const SAME_RUN = 12 * HOUR;
const OVERDUE_MOVING = 5 * 60_000;
const OVERDUE_AT_STATION = 10 * 60_000;
const STALE = 45 * 60_000;

export type Entry = {
  number: string;
  delay: number | null;
  origin: string | null;
  destination: string | null;
  previous: string | null;
  next: string | null;
  expected: number | null;
  reported_at: number | null;
};
export type Board = { updated: number | null; trains: Map<string, Entry> };

export const key = (number: string) => number.replace(/^0+/, '') || '0';
export const zfill = (number: string) => number.padStart(5, '0');

export class MapChanged extends ApiShapeError {
  override hint =
    "Renfe's live map may have moved or changed; check config.LIVE_MAP_URL and update renfe/live.py.";
}

export function fetchBoard(
  opts: { retries?: Retry[]; deadline?: number; timeout?: number } = {},
): Promise<Board> {
  return retry.call(LABEL, () => fetchOnce(opts.timeout ?? config.LIVE_TIMEOUT), opts.retries, {
    deadline: opts.deadline,
  });
}

async function fetchOnce(timeout: number): Promise<Board> {
  const response = await request(
    config.LIVE_MAP_URL,
    LABEL,
    { headers: { accept: 'application/json' } },
    timeout,
  );
  let doc: unknown;
  try {
    doc = await checkedJson(response, LABEL); // un 5xx es puntual; una página HTML, con cualquier estado, un bloqueo
  } catch (err) {
    if (err instanceof UsageError || err instanceof AuthError)
      throw new MapChanged(`${LABEL}: unexpected HTTP status ${err.status}`, {
        status: err.status,
      });
    if (err instanceof ApiShapeError) throw new MapChanged(err.message, { status: err.status });
    throw err;
  }
  return parse(doc);
}

const madrid = (value: unknown) =>
  typeof value === 'string' ? (parseIso(value)?.ms ?? null) : null;
const code = (value: unknown) => (typeof value === 'string' && NUMBER.test(value) ? value : null);

function minutes(value: unknown): number | null {
  if (Number.isInteger(value)) return value as number;
  return typeof value === 'string' && MINUTES.test(value) ? Number(value) : null;
}

/** `moment` llevado atrás días enteros cuando va más de 12 h por delante de `around`. */
function notAhead(moment: number | null, around: number | null): number | null {
  if (moment === null || around === null || moment - around <= 12 * HOUR) return moment;
  return shiftDays(moment, -roundHalfEven((moment - around) / DAY));
}

export function parse(doc: unknown): Board {
  const trenes = (doc as { trenes?: unknown })?.trenes;
  if (!doc || typeof doc !== 'object' || !Array.isArray(trenes))
    throw new MapChanged(`${LABEL}: no list of trains`);
  const updated = madrid((doc as Record<string, unknown>).fechaActualizacion);
  const trains = new Map<string, Entry>();
  for (const raw of trenes) {
    const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined;
    const number = r?.codComercial;
    if (!r || typeof number !== 'string' || !NUMBER.test(number) || trains.has(key(number)))
      continue;
    const reported = Number.isInteger(r.time) ? (r.time as number) * 1000 : null;
    trains.set(key(number), {
      number,
      delay: minutes(r.ultRetraso),
      origin: code(r.codOrigen),
      destination: code(r.codDestino),
      previous: code(r.codEstAnt),
      next: code(r.codEstSig),
      expected: notAhead(madrid(r.horaLlegadaSigEst), reported ?? updated),
      reported_at: reported,
    });
  }
  return { updated, trains };
}

const isoOrNull = (ms: number | null) => (ms === null ? null : iso(ms));
const hhmm = (ms: number) => {
  const w = wall(ms);
  return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
};

/** Cuánto va la llegada prevista a la próxima estación por detrás de la hora del mapa (negativo: aún por delante). */
function late(entry: Entry, board: Board): number | null {
  const now = board.updated ?? entry.reported_at;
  return now !== null && entry.expected !== null ? now - entry.expected : null;
}

export function status(
  board: Board,
  number: string,
  names: Map<string, string>,
  retries: Retry[] = [],
) {
  const entry = board.trains.get(key(number));
  const station = (c: string | null) => (c ? { code: c, name: names.get(c) ?? null } : null);
  const out: Record<string, unknown> = {
    train: entry ? entry.number : zfill(number),
    on_map: entry !== undefined,
    delay_minutes: null,
    origin: null,
    destination: null,
    previous_station: null,
    next_station: null,
    overdue: null,
    reported_at: null,
    map_updated: isoOrNull(board.updated),
    notice: null,
    retries: [...retries],
  };
  if (!entry) {
    const empty = board.trains.size
      ? ''
      : "Renfe's live map lists no trains right now (it is empty at night). ";
    out.notice =
      `${empty}Train ${out.train} isn't on Renfe's live map, which lists long- and medium-distance trains only ` +
      "while they run: it may not have left yet, may have arrived or been cancelled, or isn't one of those trains. " +
      'Its delay is unknown, not zero.';
    return out;
  }
  const next = station(entry.next) as Record<string, unknown> | null;
  if (next) next.expected_arrival = isoOrNull(entry.expected);
  Object.assign(out, {
    delay_minutes: entry.delay,
    origin: station(entry.origin),
    destination: station(entry.destination),
    previous_station: station(entry.previous),
    next_station: next,
    reported_at: isoOrNull(entry.reported_at),
  });
  const atStation = entry.previous === entry.next;
  const behind = late(entry, board);
  const grace = atStation ? OVERDUE_AT_STATION : OVERDUE_MOVING;
  out.overdue = Boolean(next && behind !== null && behind > grace && (entry.delay ?? 0) >= 0);
  const where = next && (next.name || next.code);
  const since = entry.expected !== null ? `, since about ${hhmm(entry.expected)}` : '';
  if (next && atStation) {
    const held = out.overdue
      ? ', longer than a stop: its delay is the last one Renfe recorded'
      : '';
    out.notice = `The train is probably stopped at ${where}${since}${held}.`;
  } else if (out.overdue) {
    out.notice =
      `Its expected arrival at ${where} (${hhmm(entry.expected!)}) has already passed, so the delay is the last ` +
      'one Renfe recorded and may be growing.';
  }
  return out;
}

/** Empieza a pedir el mapa sin que la búsqueda lo espere. La función devuelta espera como mucho hasta
 * LIVE_SEARCH_BUDGET desde el inicio y da el mapa, o null y el motivo, y sus reintentos. Nunca lanza. */
export function inBackground(): () => Promise<[Board | null, string | null, Retry[]]> {
  const budget = config.LIVE_SEARCH_BUDGET;
  const deadline = retry.timing.now() + budget;
  const log: Retry[] = [];
  const got: { board?: Board; why?: string } = {};
  const task = fetchBoard({ retries: log, deadline, timeout: budget }).then(
    (board) => void (got.board = board),
    (err: unknown) =>
      void (got.why =
        err instanceof RenfeError
          ? err.message
          : `${LABEL}: unexpected error (${(err as Error)?.name ?? 'Error'})`),
  );
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      task,
      new Promise(
        (resolve) => (timer = setTimeout(resolve, Math.max(0, deadline - retry.timing.now()))),
      ),
    ]);
    clearTimeout(timer);
    const done = { ...got };
    const running = done.board === undefined && done.why === undefined;
    const retries = log.map((e) => ({ ...e, errors: [...e.errors] }));
    if (running)
      for (const e of retries) {
        e.tries += 1;
        e.recovered = false;
        e.errors.push(`no answer within the search's ${budget / 1000} s budget`);
      }
    const why = done.board ? null : (done.why ?? `${LABEL}: no answer within ${budget / 1000} s`);
    return [done.board ?? null, why, retries];
  };
}

/** Pone `delay_minutes` en cada tren de una búsqueda: su retraso en el mapa, o null si no hay mapa, el tren no está
 * o la entrada parece de otro día. Cada tramo lleva el suyo y el tren, el primero que tenga el mapa. */
export function annotate(trains: Train[], board: Board | null) {
  for (const train of trains) {
    const legs: (Leg | Train)[] = train.legs ?? [train];
    const found = legs.map((part) => delay(part, board));
    if (train.legs) train.legs.forEach((l, i) => (l.delay_minutes = found[i]));
    train.delay_minutes = found.find((d) => d !== null) ?? null;
  }
}

function delay(part: Leg | Train, board: Board | null): number | null {
  const entry = board?.trains.get(key(part.service));
  const seen = entry && (entry.reported_at || board!.updated);
  if (!entry || !seen || entry.delay === null) return null;
  const behind = late(entry, board!);
  if (behind !== null && behind > STALE) return null; // una entrada sobrante: su número pasaría por actual
  const start = parseIso(part.departure)!.ms;
  const end = parseIso(part.arrival)!.ms;
  return start - SAME_RUN <= seen && seen <= end + SAME_RUN ? entry.delay : null;
}
