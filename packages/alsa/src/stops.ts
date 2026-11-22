// Paradas de ALSA y búsqueda por nombre o identificador (port de queguagua `alsa/stations.py`). La lista viaja con el
// paquete (data/stations.json, unos 5.800 lugares): una ciudad con varias paradas tiene además un grupo, como
// «Madrid (Todas las paradas)» (90155), cuyas `stops` son las sueltas. Solo una parada sin coincidencias hace pedir a
// ALSA su lista actual.

import { ratio } from '@reforma-digital/renfe/difflib';
import bundle from '../data/stations.json';
import { type AlsaClient, JOURNEY_SEARCH_PORTLET } from './client';
import { ApiShapeError, UsageError } from './errors';

type Child = { id: string; name: string };
type Place = {
  id: string;
  name: string;
  province?: string | null;
  country?: string | null;
  stops?: Child[];
  airport?: boolean;
};
type Entry = Place & { group: boolean; in_group?: string };
export type Stop = ReturnType<typeof publicEntry>;

/** Como `repr()` de Python para un texto, para que los mensajes coincidan con la CLI. */
export function pyRepr(text: string) {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  return quote + text.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`) + quote;
}

export function fold(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replaceAll('(todas las paradas)', ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function entries(places: Place[]): Entry[] {
  const out: Entry[] = places.map((p) => ({ ...p, group: Boolean(p.stops?.length) }));
  const seen = new Set(places.map((p) => p.id));
  for (const p of places)
    for (const child of p.stops ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push({
        id: child.id,
        name: child.name,
        province: p.province,
        country: p.country,
        group: false,
        in_group: p.id,
      });
    }
  return out;
}

let shipped: Entry[] | undefined;
const bundled = () => (shipped ??= entries(bundle.stations));

function publicEntry(e: Entry) {
  return {
    id: e.id,
    name: e.name,
    province: e.province ?? null,
    country: e.country ?? null,
    group: e.group,
    ...(e.stops?.length ? { stops: e.stops } : {}),
    ...(e.in_group ? { in_group: e.in_group } : {}),
    ...(e.airport ? { airport: true } : {}),
  };
}

function score(q: string, e: Entry) {
  const name = fold(e.name);
  if (!q) return 0;
  if (name === q) return 100 + (e.group ? 5 : 0);
  if (name.startsWith(q)) return 80 + (e.group ? 5 : 0) - name.length / 100;
  const words = name.split(' ');
  if (q.split(' ').every((w) => words.some((t) => t.startsWith(w))))
    return 60 + (e.group ? 3 : 0) - name.length / 100;
  if (name.includes(q)) return 40 - name.length / 100;
  return 0;
}

export function search(query: string, limit = 10, pool = bundled()) {
  const q = query.trim();
  if (/^\d+$/.test(q))
    return pool
      .filter((e) => e.id === q)
      .slice(0, 1)
      .map(publicEntry);
  const fq = fold(q);
  return pool
    .map((e) => [score(fq, e), e] as const)
    .filter(([s]) => s > 0)
    .sort(([sa, a], [sb, b]) => sb - sa || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, limit)
    .map(([, e]) => publicEntry(e));
}

/** Nombres cercanos, como `difflib.get_close_matches(n=5, cutoff=0.6)`: pistas, nunca una parada elegida. */
export function suggestions(query: string) {
  const folded = new Map<string, string>();
  for (const name of [...new Set(bundled().map((e) => e.name))].sort())
    folded.set(fold(name), name);
  const word = fold(query);
  return [...folded.keys()]
    .map((x) => [ratio(x, word), x] as const)
    .filter(([r]) => r >= 0.6)
    .sort(([ra, a], [rb, b]) => rb - ra || (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, 5)
    .flatMap(([, x]) => folded.get(x) ?? []);
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
function required(v: unknown) {
  const text = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  if (!text) throw new ApiShapeError("ALSA's stop list has a stop without id or name");
  return text;
}

async function remote(client: AlsaClient): Promise<Entry[]> {
  const payload = await client.resourceJson(
    '/home',
    JOURNEY_SEARCH_PORTLET,
    'GetOriginsResourceCommand',
    {
      usualStations: 'false',
    },
  );
  if (!Array.isArray(payload) || !payload.length)
    throw new ApiShapeError("ALSA's stop list came back empty or in a new shape");
  return entries(
    payload.map((x: Record<string, unknown>) => {
      const pc = str(x.provincecountryName);
      const cut = pc.lastIndexOf(', ');
      const [province, country] = cut < 0 ? [pc, ''] : [pc.slice(0, cut), pc.slice(cut + 2)];
      const stops = Array.isArray(x.stopsList)
        ? x.stopsList.map((s: Record<string, unknown>) => ({
            id: required(s.id),
            name: required(s.name),
          }))
        : [];
      return {
        id: required(x.id),
        name: required(x.name),
        province: province || null,
        country: country || null,
        ...(stops.length ? { stops } : {}),
        ...(str(x.icon).includes('airport') ? { airport: true } : {}),
      };
    }),
  );
}

/** La mejor parada o grupo para `query`; la lista actual de ALSA solo si la incluida no tiene ninguna. */
export async function resolve(query: string, client: AlsaClient) {
  let [found] = search(query, 1);
  // A diferencia de la CLI, si la lista actual no llega se devuelve ese error y no «parada desconocida».
  if (!found && !/^\d+$/.test(query.trim())) [found] = search(query, 1, await remote(client));
  if (!found)
    throw new UsageError(`unknown stop ${pyRepr(query)}`, {
      details: { suggestions: suggestions(query) },
    });
  return found;
}
