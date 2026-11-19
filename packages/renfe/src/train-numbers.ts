// Casa un tren del mapa con viajes fechados del horario y verifica los tramos vendidos con otros números (port de
// renfe-cli `train_numbers.py`). Como en Python, que compara horas de la misma zona en hora de pared, aquí las horas
// son "hora de pared de Madrid en ms" (Date.UTC de la hora local) y solo se pasan a instantes al escribirlas.

import groupsText from '../data/train-number-groups';
import { type Block, matchingBlocks } from './difflib';
import { key, zfill } from './live';
import { DAY, HOUR, iso, zoned } from './time';

const RUN_MARGIN = HOUR;
const MAX_JOIN = 3600; // segundos
// Servicios directos con un enlace documentado aunque sea una parada intermedia de ambos viajes.
const JUNCTIONS = new Map<string, [string, string]>([
  ['4176|13200|17000', ['4366', '11200']],
  ['1181|04307|60911', ['34182', '71801']],
]);

type Group = { origin: string; destination: string; numbers: Set<string> };
let index: Map<string, Group[]> | undefined;
function groups(): Map<string, Group[]> {
  if (index) return index;
  index = new Map();
  for (const line of groupsText.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [origin, destination, numbers] = line.split(/\s+/) as [string, string, string];
    const group = { origin, destination, numbers: new Set(numbers.split('/').map(key)) };
    for (const n of group.numbers) index.set(n, [...(index.get(n) ?? []), group]);
  }
  return index;
}

/** Solo los números publicados junto a estos. Dos filas que comparten un número no forman un grupo mayor. */
export function timetableNumbers(numbers: Set<string>): Set<string> {
  const out = new Set(numbers);
  for (const n of numbers)
    for (const group of groups().get(n) ?? []) for (const peer of group.numbers) out.add(peer);
  return out;
}

export type Stop = {
  sequence: number;
  code: string;
  arrival: number | null;
  departure: number | null;
};
/** (día, número) -> recorridos; la clave es `${día}|${número}`. */
export type Trips = Map<string, Stop[][]>;
type Leg = { number: string; stops: Stop[] };
type Journey = Leg[];
type Edge = [string, number | null, string, number | null];

export const tripKey = (day: string, number: string) => `${day}|${number}`;
const dayOf = (wallMs: number) => new Date(wallMs).toISOString().slice(0, 10);
export const wallMidnight = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** La hora de pared de Madrid como instante, escrita como `isoformat()`. */
function wallIso(wallMs: number) {
  const d = new Date(wallMs);
  return iso(
    zoned(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ),
  );
}

export function serviceDays(reference: number): Set<string> {
  return new Set([dayOf(reference - DAY), dayOf(reference), dayOf(reference + RUN_MARGIN)]);
}

function* legs(
  trips: Trips,
  day: string,
  number: string,
  origin: string | null,
  dest: string | null,
) {
  for (const route of trips.get(tripKey(day, number)) ?? []) {
    for (let i = 0; i < route.length; i++) {
      const start = route[i]!;
      if (start.code !== origin || start.departure === null) continue;
      for (let j = i + 1; j < route.length; j++) {
        const end = route[j]!;
        if (end.code === dest && end.arrival !== null && start.departure < end.arrival)
          yield { number, stops: route.slice(i, j + 1) } as Leg;
      }
    }
  }
}

const edges = (stops: Stop[]): Edge[] =>
  stops.slice(1).map((b, n) => [stops[n]!.code, stops[n]!.departure, b.code, b.arrival]);
const edgeKey = (e: Edge) => e.join('|');

function* sharedRanges(a: Edge[], b: Edge[]): Generator<[number, number]> {
  // Se comparan movimientos con hora. En los bordes de un tramo solo cuentan la salida y la llegada.
  for (const [i, , length] of matchingBlocks(a, b, edgeKey) as Block[]) {
    let start = i;
    for (let k = i; k < i + length; k++) {
      const [src, dep, dest, arr] = a[k]!;
      if (dep === null || arr === null || arr <= dep || src === dest) {
        if (start < k) yield [start, k];
        start = k + 1;
      }
    }
    if (start < i + length) yield [start, i + length];
  }
}

/** Une viajes fechados solo en sus extremos publicados, dentro del mismo grupo de números. */
function* connections(
  group: Set<string>,
  trips: Trips,
  day: string,
  number: string,
  origin: string,
  dest: string,
) {
  const starts = new Map<string, [string, Stop[]][]>();
  for (const peer of group)
    for (const route of trips.get(tripKey(day, peer)) ?? []) {
      const dep = route[0]?.departure ?? null;
      const arr = route.at(-1)?.arrival ?? null;
      if (route.length >= 2 && dep !== null && arr !== null && dep < arr)
        starts.set(route[0]!.code, [...(starts.get(route[0]!.code) ?? []), [peer, route]]);
    }

  function* extend(
    station: string,
    arrival: number | null,
    path: Journey,
    used: Set<string>,
  ): Generator<Journey> {
    for (const [peer, stops] of starts.get(station) ?? []) {
      if (used.has(peer)) continue;
      if (
        arrival !== null &&
        !(0 <= stops[0]!.departure! - arrival && stops[0]!.departure! - arrival <= MAX_JOIN)
      )
        continue;
      const onward = [...path, { number: peer, stops }];
      if (stops.at(-1)!.code === dest) {
        if (path.length && (number === peer || used.has(number))) yield onward;
      } else
        yield* extend(stops.at(-1)!.code, stops.at(-1)!.arrival, onward, new Set([...used, peer]));
    }
  }
  yield* extend(origin, null, [], new Set());
}

function* linked(
  trips: Trips,
  day: string,
  number: string,
  origin: string | null,
  dest: string | null,
) {
  const junction = JUNCTIONS.get(`${number}|${origin}|${dest}`);
  if (junction) {
    const [feeder, station] = junction;
    for (const first of legs(trips, day, feeder, origin, station))
      for (const last of legs(trips, day, number, station, dest)) {
        const gap = last.stops[0]!.departure! - first.stops.at(-1)!.arrival!;
        if (0 <= gap && gap <= MAX_JOIN) yield [first, last] as Journey;
      }
  }
  for (const group of groups().get(number) ?? []) {
    if (origin !== group.origin || dest !== group.destination) continue;
    yield* connections(group.numbers, trips, day, number, origin, dest);
    // Un número hermano puede cubrir todo el viaje del mapa, con el número en directo en un tramo compartido.
    for (const peer of group.numbers) {
      if (peer === number) continue;
      for (const leg of legs(trips, day, peer, origin, dest)) {
        const e = edges(leg.stops);
        if (
          (trips.get(tripKey(day, number)) ?? []).some(
            (route) => !sharedRanges(e, edges(route)).next().done,
          )
        )
          yield [leg] as Journey;
      }
    }
  }
}

type Section = {
  number: string;
  origin: string;
  destination: string;
  departure: number;
  arrival: number;
};
const sectionKey = (s: Section) =>
  `${s.number}|${s.origin}|${s.destination}|${s.departure}|${s.arrival}`;

function intersect(sets: Map<string, Section>[]): Map<string, Section> {
  const [first, ...rest] = sets;
  return new Map([...first!].filter(([k]) => rest.every((s) => s.has(k))));
}

function sections(
  trips: Trips,
  day: string,
  number: string,
  paths: Journey[],
): Map<string, Section> {
  const midnight = wallMidnight(day);
  const declared: Map<string, Section>[] = [];
  const alternatives: Edge[][] = [];
  for (const path of paths) {
    const own = new Map<string, Section>();
    const pathEdges: Edge[] = [];
    for (const leg of path) {
      const first = leg.stops[0]!;
      const last = leg.stops.at(-1)!;
      const s = {
        number: leg.number,
        origin: first.code,
        destination: last.code,
        departure: midnight + first.departure! * 1000,
        arrival: midnight + last.arrival! * 1000,
      };
      own.set(sectionKey(s), s);
      pathEdges.push(...edges(leg.stops));
    }
    declared.push(own);
    alternatives.push(pathEdges);
  }
  const out = intersect(declared);
  for (const peer of timetableNumbers(new Set([number])))
    for (const route of trips.get(tripKey(day, peer)) ?? []) {
      const e = edges(route);
      let spans: [number, number][] = [[0, e.length]];
      // Se quedan los tramos que respalda cada posible patrón de paradas con esas horas de extremo.
      for (const alternative of alternatives) {
        const shared = [...sharedRanges(e, alternative)];
        const next = new Map<string, [number, number]>();
        for (const [a, b] of spans)
          for (const [c, d] of shared) {
            const [lo, hi] = [Math.max(a, c), Math.min(b, d)];
            if (lo < hi) next.set(`${lo}|${hi}`, [lo, hi]);
          }
        spans = [...next.values()];
        if (!spans.length) break;
      }
      for (const [start, end] of spans) {
        const [src, dep] = e[start]!;
        const [, , dst, arr] = e[end - 1]!;
        const s = {
          number: peer,
          origin: src,
          destination: dst,
          departure: midnight + dep! * 1000,
          arrival: midnight + arr! * 1000,
        };
        out.set(sectionKey(s), s);
      }
    }
  return out;
}

const render = (s: Section, names: Map<string, string>) => ({
  train: zfill(s.number),
  origin: { code: s.origin, name: names.get(s.origin) ?? null },
  destination: { code: s.destination, name: names.get(s.destination) ?? null },
  scheduled_departure: wallIso(s.departure),
  scheduled_arrival: wallIso(s.arrival),
});

const cmp = (a: number | string | boolean, b: number | string | boolean) =>
  a < b ? -1 : a > b ? 1 : 0;

export function match(
  trips: Trips,
  entry: { number: string; origin: string | null; destination: string | null },
  reference: number,
  names: Map<string, string>,
): Record<string, unknown> {
  const number = key(entry.number);
  const { origin, destination: dest } = entry;
  // Primero el número que puso Renfe en el mapa; sus hermanos publicados, solo si hace falta.
  for (const direct of [true, false]) {
    const matches = new Map<
      string,
      { dep: number; arr: number; candidates: [string, Journey][] }
    >();
    for (const day of serviceDays(reference)) {
      const midnight = wallMidnight(day);
      const paths: Iterable<Journey> = direct
        ? (function* () {
            for (const leg of legs(trips, day, number, origin, dest)) yield [leg];
          })()
        : linked(trips, day, number, origin, dest);
      for (const path of paths) {
        const dep = midnight + path[0]!.stops[0]!.departure! * 1000;
        const arr = midnight + path.at(-1)!.stops.at(-1)!.arrival! * 1000;
        if (dep - RUN_MARGIN <= reference && reference <= arr + RUN_MARGIN) {
          const k = `${dep}|${arr}`;
          const hit = matches.get(k) ?? { dep, arr, candidates: [] };
          hit.candidates.push([day, path]);
          matches.set(k, hit);
        }
      }
    }
    if (!matches.size) continue;
    if (matches.size > 1) return { schedule_match: 'ambiguous' };
    const { dep, arr, candidates } = [...matches.values()][0]!;
    // Varias variantes del horario pueden coincidir en los extremos: solo cuentan los tramos que respaldan todas.
    const byDay = new Map<string, Journey[]>();
    for (const [day, path] of candidates) byDay.set(day, [...(byDay.get(day) ?? []), path]);
    const all = intersect([...byDay].map(([day, paths]) => sections(trips, day, number, paths)));
    // Una variante corta suele repetir parte de otra más larga con el mismo número.
    const maximal = [...all.values()].filter(
      (s) =>
        ![...all.values()].some(
          (o) =>
            o.number === s.number &&
            o.departure <= s.departure &&
            s.arrival <= o.arrival &&
            (o.departure !== s.departure || o.arrival !== s.arrival),
        ),
    );
    maximal.sort(
      (a, b) =>
        cmp(a.departure, b.departure) ||
        cmp(-(a.arrival - a.departure), -(b.arrival - b.departure)) ||
        cmp(a.number !== number, b.number !== number) ||
        cmp(a.number, b.number) ||
        cmp(a.origin, b.origin) ||
        cmp(a.destination, b.destination),
    );
    if (!direct && !maximal.some((s) => s.number === number))
      return { schedule_match: 'ambiguous' };
    const result: Record<string, unknown> = {
      schedule_match: direct ? 'exact' : 'linked',
      scheduled_departure: wallIso(dep),
      scheduled_arrival: wallIso(arr),
      number_segments: maximal.map((s) => render(s, names)),
    };
    if (!direct) result.schedule_trains = [...new Set(maximal.map((s) => zfill(s.number)))];
    return result;
  }
  return { schedule_match: 'unmatched' };
}
