// Lista de estaciones de Renfe y búsqueda por nombre o código (port de renfe-cli `stations.py`). La lista viaja con
// el paquete (data/stations.json); solo una consulta sin coincidencias pide a Renfe su lista actual, que se guarda
// un día en memoria.

import bundle from '../data/stations.json';
import type { RsvClient } from './client';
import * as config from './config';
import { ratio } from './difflib';
import { ApiShapeError, NoMatch, UsageError } from './errors';

export type Station = {
  code: string;
  name: string;
  province: string | null;
  group: boolean;
  main: boolean;
};

export const toDict = (s: Station) => ({
  code: s.code,
  name: s.name,
  province: s.province,
  group: s.group,
  main: s.main,
});

/** Como `repr()` de Python para un texto, para que los mensajes coincidan con la CLI. */
export function pyRepr(text: string) {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  return quote + text.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`) + quote;
}

export function parse(raw: unknown): Station[] {
  if (!Array.isArray(raw)) throw new ApiShapeError('stations: expected a list');
  if (!raw.length) throw new ApiShapeError('stations: Renfe returned an empty station list');
  return raw.map((item) => {
    if (!item || typeof item !== 'object')
      throw new ApiShapeError('stations: expected objects in the list');
    const {
      _u_i_c_station_code: code,
      name,
      province,
      agglomeration_type,
      main_station,
    } = item as Record<string, unknown>;
    if (typeof code !== 'string' || !code || typeof name !== 'string' || !name)
      throw new ApiShapeError('stations: an entry has no code or name');
    return {
      code,
      name,
      province: typeof province === 'string' && province ? province : null,
      group: agglomeration_type === 'geographical',
      main: main_station === true,
    };
  });
}

let shipped: Station[] | undefined;
export function bundled(): Station[] {
  shipped ??= parse(bundle.stations);
  return shipped;
}

let live: { at: number; stations: Station[] } | undefined;
/** La lista actual de Renfe, guardada un día en memoria. */
export async function load(client: RsvClient): Promise<Station[]> {
  const age = live ? Date.now() - live.at : -1;
  if (live && age >= 0 && age < config.STATIONS_TTL) return live.stations;
  const stations = parse(await client.get(config.STATIONS_PATH, 'stations'));
  live = { at: Date.now(), stations };
  return stations;
}

export function norm(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replaceAll('(todas)', ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 0 código, 1 nombre exacto, 2 empieza por, 3 una palabra empieza por, 4 lo contiene; undefined: no coincide. */
function rank(query: string, station: Station): number | undefined {
  if (query.toUpperCase() === station.code.toUpperCase()) return 0;
  const q = norm(query);
  const name = norm(station.name);
  if (!q) return undefined;
  if (name === q) return 1;
  if (name.startsWith(q)) return 2;
  if (new RegExp(`(?:^| )${escape(q)}`).test(name)) return 3;
  if (name.includes(q)) return 4;
  return undefined;
}

const cmp = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0);
const byQuality = ([ra, a]: [number, Station], [rb, b]: [number, Station]) =>
  cmp(ra, rb) ||
  cmp(Number(!a.group), Number(!b.group)) ||
  cmp(Number(!a.main), Number(!b.main)) ||
  cmp(a.name.length, b.name.length) ||
  cmp(a.name, b.name);

function scored(query: string, stations: Station[]): [number, Station][] {
  return stations
    .map((s) => [rank(query, s), s] as const)
    .filter((rs): rs is [number, Station] => rs[0] !== undefined)
    .sort(byQuality);
}

export function find(query: string, stations: Station[], limit = 20): Station[] {
  return scored(query, stations)
    .slice(0, limit)
    .map(([, s]) => s);
}

/** Grafías cercanas en la lista incluida: pistas, nunca una estación elegida. */
export function suggestions(query: string): Station[] {
  const tokens = norm(query)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  const cache = new Map<string, number>();
  const similarity = (token: string, word: string) => {
    const k = `${token}\u0000${word}`;
    let value = cache.get(k);
    if (value === undefined) cache.set(k, (value = ratio(token, word)));
    return value;
  };
  const ranked: [Station, number][] = [];
  for (const station of bundled()) {
    const words = norm(station.name).split(' ').filter(Boolean);
    const scores = tokens.map((t) => Math.max(0, ...words.map((w) => similarity(t, w))));
    if (Math.min(...scores) >= 0.8) ranked.push([station, scores.reduce((a, b) => a + b, 0)]);
  }
  ranked.sort(
    ([a, sa], [b, sb]) =>
      cmp(Number(!a.group), Number(!b.group)) ||
      cmp(Number(!a.main), Number(!b.main)) ||
      cmp(-sa, -sb) ||
      cmp(a.name.length, b.name.length) ||
      cmp(a.name, b.name) ||
      cmp(a.code, b.code),
  );
  return ranked.slice(0, 5).map(([s]) => s);
}

export function resolve(query: string, stations: Station[]): Station {
  const all = scored(query, stations);
  if (!all.length)
    throw new NoMatch(`no station matches ${pyRepr(query)}; try \`renfe stations ${query}\``);
  const [bestRank, best] = all[0]!;
  const tied = all.filter(
    ([r, s]) => r === bestRank && s.group === best.group && s.main === best.main,
  );
  if (bestRank >= 2 && tied.length > 1) {
    const names = tied
      .slice(0, 5)
      .map(([, s]) => `${s.name} (${s.code})`)
      .join('; ');
    throw new UsageError(
      `${pyRepr(query)} matches several stations: ${names}. Use a code or a longer name.`,
    );
  }
  return best;
}

/** La estación que quiere decir `query`, de la lista incluida; de la de Renfe solo si aquella no tiene ninguna. */
export async function lookup(query: string, client: RsvClient): Promise<Station> {
  try {
    return resolve(query, bundled());
  } catch (err) {
    if (!(err instanceof NoMatch)) throw err;
  }
  try {
    return resolve(query, await load(client));
  } catch (err) {
    if (!(err instanceof NoMatch)) throw err;
    const nearby = suggestions(query);
    if (!nearby.length) throw err;
    const choices = nearby.map((s) => `${s.name} (${s.code})`).join(', ');
    throw new NoMatch(`${err.message}. Did you mean ${choices}?`);
  }
}
