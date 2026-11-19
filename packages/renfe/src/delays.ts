// Retrasos de toda la red y horas previstas de extremo, del horario GTFS público de Renfe (port de renfe-cli
// `delays.py`). El horario (≈0,7 MB comprimido) se descarga como mucho una vez al día por instancia.

import { inflateRawSync } from 'node:zlib';
import { request } from './client';
import * as config from './config';
import { ApiShapeError, BlockedError, RenfeError, type Retry, UpstreamError } from './errors';
import * as live from './live';
import type { Board, Entry } from './live';
import * as retry from './retry';
import { DAY, iso, wall, weekday } from './time';
import {
  match,
  type Stop,
  serviceDays,
  timetableNumbers,
  tripKey,
  type Trips,
} from './train-numbers';

const TIMETABLE_URL = 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip';
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MAX_UNZIPPED = 256 * 1024 ** 2;
const MAX_DOWNLOAD = 32 * 1024 ** 2;

// --- el ZIP y el CSV, con lo que trae Node ---------------------------------------------------------

function unzip(data: Buffer): Map<string, Buffer> {
  let end = data.length - 22;
  while (end >= 0 && data.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('no zip directory');
  const count = data.readUInt16LE(end + 10);
  let at = data.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(at) !== 0x02014b50) throw new Error('bad zip entry');
    const method = data.readUInt16LE(at + 10);
    const size = data.readUInt32LE(at + 20);
    const length = data.readUInt32LE(at + 24);
    const nameLength = data.readUInt16LE(at + 28);
    const extra = data.readUInt16LE(at + 30) + data.readUInt16LE(at + 32);
    const local = data.readUInt32LE(at + 42);
    const name = data.toString('utf8', at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extra;
    total += length;
    if (total > MAX_UNZIPPED) throw new Error('oversized timetable');
    if (data.readUInt32LE(local) !== 0x04034b50) throw new Error('bad local header');
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const raw = data.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error('unsupported zip method');
  }
  return files;
}

function splitRecord(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(field);
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('unterminated quote');
  out.push(field);
  return out;
}

/** Las filas de una tabla GTFS como objetos. Renfe rellena con espacios la última columna, cabecera incluida. */
function* rows(
  files: Map<string, Buffer>,
  table: string,
  required: string,
): Generator<Record<string, string>> {
  const file = files.get(`${table}.txt`);
  if (!file) throw new Error(`missing ${table}`);
  const lines = file.toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
  const header = splitRecord(lines[0] ?? '').map((h) => h.trim());
  if (!required.split(' ').every((c) => header.includes(c))) throw new Error('missing GTFS column');
  for (let n = 1; n < lines.length; n++) {
    if (!lines[n]) continue;
    const values = splitRecord(lines[n]!);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = values[i] ?? ''));
    yield row;
  }
}

/** Calendario semanal y luego altas y bajas por fecha, para cada día de servicio posible. */
function services(files: Map<string, Buffer>, days: Set<string>): Map<string, Set<string>> {
  const active = new Map<string, Set<string>>();
  const add = (service: string, day: string) =>
    active.set(service, (active.get(service) ?? new Set()).add(day));
  const dates = new Map([...days].map((day) => [day.replaceAll('-', ''), day]));
  const hasCalendar = files.has('calendar.txt');
  if (hasCalendar)
    for (const row of rows(
      files,
      'calendar',
      `service_id start_date end_date ${WEEKDAYS.join(' ')}`,
    )) {
      const [start, end] = [row.start_date!.trim(), row.end_date!.trim()];
      for (const [stamp, day] of dates)
        if (start <= stamp && stamp <= end && row[WEEKDAYS[weekday(day)]!]!.trim() === '1')
          add(row.service_id!.trim(), day);
    }
  if (!hasCalendar || files.has('calendar_dates.txt'))
    for (const row of rows(files, 'calendar_dates', 'service_id date exception_type')) {
      const day = dates.get(row.date!.trim());
      if (!day) continue;
      const service = row.service_id!.trim();
      if (row.exception_type!.trim() === '1') add(service, day);
      else if (row.exception_type!.trim() === '2') active.get(service)?.delete(day);
    }
  return active;
}

/** GTFS usa por ejemplo 24:15:00 para una llegada al día siguiente de la salida. En segundos. */
function offsetSeconds(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (!/^[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]$/.test(t)) throw new Error('invalid GTFS time');
  const [h, m, s] = t.split(':').map(Number) as [number, number, number];
  return h * 3600 + m * 60 + s;
}

export function parseTimetable(data: Buffer, days: Set<string>, numbers: Set<string>): Trips {
  try {
    const files = unzip(data);
    const active = services(files, days);
    const selected = new Map<string, [string, Set<string>]>();
    for (const row of rows(files, 'trips', 'trip_id trip_short_name service_id')) {
      const number = live.key(row.trip_short_name!.trim());
      const serviceDays_ = active.get(row.service_id!.trim());
      if (numbers.has(number) && serviceDays_?.size)
        selected.set(row.trip_id!.trim(), [number, serviceDays_]);
    }
    const stops = new Map<string, Stop[]>();
    for (const row of rows(
      files,
      'stop_times',
      'trip_id stop_sequence stop_id departure_time arrival_time',
    )) {
      const tid = row.trip_id!.trim();
      if (!selected.has(tid)) continue;
      const sequence = Number(row.stop_sequence!.trim());
      if (!Number.isInteger(sequence)) throw new Error('invalid stop_sequence');
      stops.set(tid, [
        ...(stops.get(tid) ?? []),
        {
          sequence,
          code: row.stop_id!.trim(),
          arrival: offsetSeconds(row.arrival_time!),
          departure: offsetSeconds(row.departure_time!),
        },
      ]);
    }
    const trips: Trips = new Map();
    for (const [tid, route] of stops) {
      route.sort((a, b) => a.sequence - b.sequence);
      const [number, serviceDays_] = selected.get(tid)!;
      for (const day of serviceDays_)
        trips.set(tripKey(day, number), [...(trips.get(tripKey(day, number)) ?? []), route]);
    }
    return trips;
  } catch {
    throw new ApiShapeError('Renfe timetable: unreadable GTFS archive or table');
  }
}

async function download(): Promise<Buffer> {
  const response = await request(TIMETABLE_URL, 'Renfe timetable', {}, config.REQUEST_TIMEOUT);
  const status = response.status;
  if (
    status === 403 ||
    status === 429 ||
    (response.headers.get('content-type') ?? '').toLowerCase().includes('html')
  )
    throw new BlockedError(`Renfe timetable: blocked (HTTP ${status})`, { status });
  const data = Buffer.from(await response.arrayBuffer());
  if (/^\s*<(!doctype html|html|head|body)/i.test(data.subarray(0, 64).toString('latin1')))
    throw new BlockedError(`Renfe timetable: returned an HTML page (HTTP ${status})`, { status });
  if (status !== 200)
    throw new UpstreamError(`Renfe timetable: HTTP ${status}`, {
      status,
      transient: retry.statusFailure(status),
    });
  if (data.length > MAX_DOWNLOAD) throw new ApiShapeError('Renfe timetable: download too large');
  return data;
}

let cached: { at: number; data: Buffer } | undefined;
async function timetable(
  days: Set<string>,
  numbers: Set<string>,
  retries: Retry[],
): Promise<Trips> {
  const age = cached ? Date.now() - cached.at : -1;
  if (cached && age >= 0 && age < DAY) return parseTimetable(cached.data, days, numbers);
  const data = await retry.call('Renfe timetable', download, retries);
  const trips = parseTimetable(data, days, numbers);
  cached = { at: Date.now(), data };
  return trips;
}

// --- estado de un tren y retrasos de la red ------------------------------------------------------

type Load = (days: Set<string>, numbers: Set<string>) => Promise<Trips>;
type Row = Record<string, unknown> & {
  train: string;
  number_segments: { train: string }[];
  notice: string | null;
};

/** La hora de pared de Madrid de un instante, como "ms" de Date.UTC (la escala de train-numbers.ts). */
function wallMs(ms: number) {
  const w = wall(ms);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
}

async function scheduledRows(
  board: Board,
  entries: Entry[],
  names: Map<string, string>,
  load: Load,
  unchecked: string | null = 'unmatched',
): Promise<[Row[], string | null]> {
  const rows: Row[] = [];
  const references = new Map<string, number>();
  for (const entry of entries) {
    const row = live.status(board, entry.number, names) as Row;
    delete row.retries; // todos los trenes comparten las peticiones registradas arriba
    Object.assign(row, {
      scheduled_departure: null,
      scheduled_arrival: null,
      schedule_match: unchecked,
      number_segments: [],
    });
    rows.push(row);
    // El mapa no tiene fecha de servicio: se deshace el retraso en la próxima parada para situar el tren en su
    // ventana del horario, incluido el servicio de ayer que va tarde o de noche.
    const moment = entry.expected || board.updated || entry.reported_at;
    if (moment && entry.delay !== null)
      references.set(entry.number, wallMs(moment) - entry.delay * 60_000);
  }
  let notice: string | null = null;
  if (references.size) {
    const days = new Set([...references.values()].flatMap((moment) => [...serviceDays(moment)]));
    const numbers = timetableNumbers(new Set([...references.keys()].map(live.key)));
    let trips: Trips | undefined;
    try {
      trips = await load(days, numbers);
    } catch (err) {
      if (!(err instanceof RenfeError)) throw err;
      notice = err.message;
      for (const row of rows) row.schedule_match = 'unavailable';
    }
    if (trips)
      rows.forEach((row, i) => {
        const reference = references.get(row.train);
        if (reference !== undefined)
          Object.assign(row, match(trips, entries[i]!, reference, names));
      });
  }
  return [rows, notice];
}

const matches = (row: Row, wanted: string) =>
  live.key(row.train) === wanted || row.number_segments.some((s) => live.key(s.train) === wanted);

export async function status(
  board: Board,
  number: string,
  names: Map<string, string>,
  retries: Retry[],
) {
  const wanted = live.key(number);
  let candidates = timetableNumbers(new Set([wanted]));
  if (board.trains.has(wanted)) candidates = new Set([wanted]);
  const entries = [...board.trains].filter(([k]) => candidates.has(k)).map(([, e]) => e);
  const [rows, notice] = await scheduledRows(
    board,
    entries,
    names,
    (d, n) => timetable(d, n, retries),
    null,
  );
  const found = rows.filter((r) => matches(r, wanted));
  if (found.length === 1) {
    const result: Row = { ...found[0]!, requested_train: live.zfill(wanted), retries };
    if (notice) result.notice = [result.notice, notice].filter(Boolean).join(' ');
    return result;
  }
  const result: Row = {
    ...(live.status(board, wanted, names, retries) as Row),
    requested_train: live.zfill(wanted),
    scheduled_departure: null,
    scheduled_arrival: null,
    schedule_match: null,
    number_segments: [],
  };
  if (found.length) {
    result.schedule_match = 'ambiguous';
    result.matching_trains = found.map((r) => r.train).sort();
    result.notice =
      'Several live trains use this ticket number on a verified section. Check their routes.';
  } else if (notice) {
    result.schedule_match = 'unavailable';
    result.notice += ` Ticket-number lookup unavailable. ${notice}`;
  }
  result.retries = retries;
  return result;
}

export async function report(
  board: Board,
  names: Map<string, string>,
  retries: Retry[],
  train?: string,
) {
  const delays = [...board.trains.values()].map((e) => e.delay);
  let entries = [...board.trains.values()]
    .filter((e) => (e.delay ?? 0) > 0)
    .sort((a, b) => b.delay! - a.delay! || Number(a.number) - Number(b.number));
  const count = entries.length;
  const wanted = train === undefined ? undefined : live.key(train);
  if (wanted !== undefined) {
    const candidates = timetableNumbers(new Set([wanted]));
    entries = entries.filter((e) => candidates.has(live.key(e.number)));
  }
  const [rows, notice] = await scheduledRows(board, entries, names, (d, n) =>
    timetable(d, n, retries),
  );
  const result: Record<string, unknown> = {
    map_updated: board.updated === null ? null : iso(board.updated),
    mapped_trains: delays.length,
    delayed: count,
    on_time: delays.filter((d) => d === 0).length,
    early: delays.filter((d) => d !== null && d < 0).length,
    unknown: delays.filter((d) => d === null).length,
    trains: rows,
    notice,
    retries,
  };
  if (wanted !== undefined) {
    result.requested_train = live.zfill(wanted);
    result.trains = rows.filter((r) => matches(r, wanted));
    result.matched_trains = (result.trains as Row[]).length;
  }
  const counts: Record<string, number> = {
    exact: 0,
    linked: 0,
    ambiguous: 0,
    unmatched: 0,
    unavailable: 0,
  };
  for (const row of result.trains as Row[]) counts[row.schedule_match as string]! += 1;
  result.schedule_matches = counts;
  return result;
}
