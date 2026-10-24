import { getHistory, read, slug } from '../../lib/congreso/data';
import { historicalProvinceSchema, mapSchema } from '../../lib/congreso/schema';
import { electionLabel, percent, thousands } from '../../lib/elecciones/format';
import { electionsHref } from '../../lib/elecciones/pages';
import { brand, shortParty } from '../../lib/elecciones/parties';
import { href } from '../congreso/common';
import type { MapProvince, Winner } from './province-map';

// Lo que comparten «Elecciones desde 1977» y la página de cada elección: la elección elegida, el
// ganador de cada provincia en cada elección y las provincias de la elegida para el mapa. Si `id`
// no es una elección, la última.
export async function electionData(id?: string) {
  const [history, map] = await Promise.all([
    getHistory(),
    read('elecciones/geo-provincias.json', mapSchema),
  ]);
  const E = history.elecciones;
  const found = E.findIndex((x) => x.id === id);
  const k = found >= 0 ? found : E.length - 1;
  const e = E[k];
  if (!e) throw new Error('El histórico de elecciones está vacío');
  // La elección elegida: sus candidaturas con escaño (de más a menos), si hubo mayoría absoluta,
  // la legislatura que salió de ella y quién la presidió.
  const withSeats = e.partidos.filter(([, , , , s]) => s > 0).sort((a, b) => b[4] - a[4]);
  const largest = withSeats[0];
  const majority = !!largest && largest[4] >= 176;
  const legislature =
    e.legislatura === 'Constituyente' ? 'Cortes constituyentes' : `${e.legislatura} legislatura`;
  const president = e.presidentes.length
    ? e.presidentes.join(' · ')
    : 'Ninguna investidura: se repitieron las elecciones';
  // El color de cada escaño del hemiciclo, familia a familia.
  const seatColors = history.familias.flatMap((f) =>
    Array<string>(e.fam[f.id]?.[1] ?? 0).fill(f.color),
  );
  // El detalle de cada elección: el ganador de cada provincia es su candidatura más votada (no su
  // familia: en 2015, Podemos e IU iban por separado).
  const details = await Promise.all(
    E.map((x) => read(`elecciones/historico-${x.id}.json`, historicalProvinceSchema)),
  );
  const family = Object.fromEntries(history.familias.map((f) => [f.id, f]));
  const color = (familyId: string) => family[familyId]?.color ?? '#8A8F98';
  const label = (x: (typeof E)[number]) => electionLabel(E, x.fecha);
  const codes = Object.keys(map.provincias).filter((c) => E.at(-1)?.prov[c]);
  const name = (code: string) => map.provincias[code]?.corto ?? code;
  const provinceHref = (code: string) => {
    const circ = map.provincias[code]?.circ;
    return circ ? href(`provincia/${slug(circ)}`) : electionsHref('historico');
  };
  const winner = (j: number, code: string): Winner | null => {
    const p = details[j]?.prov[code];
    const top = p && [...p.c].sort((a, b) => b[2] - a[2])[0];
    if (!p || !top) return null;
    const short = shortParty(top[0]);
    return {
      name: short,
      brand: brand(short),
      color: color(top[1]),
      share: top[2] / p.validos,
      seats: top[3],
    };
  };
  const winners = codes.map((code) => E.map((_, j) => winner(j, code)));
  const brandColor = Object.fromEntries(
    winners.flat().flatMap((w) => (w ? [[w.brand, w.color] as const] : [])),
  );
  // La candidatura más votada de una familia en una elección, para darle nombre.
  const topName = (x: (typeof E)[number], familyId: string) => {
    const top = x.partidos.filter(([, , f]) => f === familyId).sort((a, b) => b[3] - a[3])[0];
    return familyId === 'OTROS' || !top ? 'Otros' : shortParty(top[0]);
  };

  // Las provincias en la elección elegida.
  const provinces: MapProvince[] = codes.flatMap((code, i) => {
    const p = e.prov[code];
    const d = details[k]?.prov[code];
    if (!p || !d) return [];
    return [
      {
        code,
        name: name(code),
        href: provinceHref(code),
        seats: p.e,
        turnout: p.votantes / p.censo,
        price: p.validos / p.e,
        last: d.ultimo
          ? {
              from: shortParty(d.ultimo.gana),
              to: shortParty(d.ultimo.segundo),
              missing: d.ultimo.faltan,
            }
          : null,
        winner: winners[i]?.[k] ?? null,
        before: k > 0 ? (winners[i]?.[k - 1] ?? null) : null,
        shares: Object.fromEntries(Object.entries(p.fam).map(([f, [v]]) => [f, v / p.validos])),
        rows: d.c
          .filter(([, , v, s]) => s > 0 || v >= d.validos * 0.01)
          .sort((a, b) => b[2] - a[2])
          .slice(0, 7)
          .map(([siglas, f, v, s]) => [shortParty(siglas), color(f), v / d.validos, s]),
        history: winners[i]?.map((w) => w?.brand ?? null) ?? [],
      },
    ];
  });
  const byCode = Object.fromEntries(provinces.map((p) => [p.code, p]));
  const tipFor = (code: string) => {
    const p = byCode[code];
    if (!p) return undefined;
    return [
      p.winner && `Ganó ${p.winner.name} (${percent(p.winner.share)}).`,
      `${p.seats} ${p.seats === 1 ? 'escaño' : 'escaños'} · participación ${percent(p.turnout)} · ${thousands(p.price)} votos por escaño.`,
      p.last && `Último escaño por ${thousands(p.last.missing)} votos.`,
    ]
      .filter(Boolean)
      .join(' ');
  };
  // «Voto a…»: las familias con más del 1 % de los votos en toda España.
  const parties = history.familias
    .filter((f) => (e.fam[f.id]?.[0] ?? 0) >= e.validos * 0.01 && f.id !== 'OTROS')
    .sort((a, b) => (e.fam[b.id]?.[0] ?? 0) - (e.fam[a.id]?.[0] ?? 0))
    .slice(0, 9)
    .map((f) => ({ id: f.id, name: topName(e, f.id), color: f.color }));

  return {
    history,
    map,
    E,
    k,
    e,
    withSeats,
    largest,
    majority,
    legislature,
    president,
    seatColors,
    details,
    color,
    label,
    codes,
    name,
    provinceHref,
    winners,
    brandColor,
    topName,
    provinces,
    byCode,
    tipFor,
    parties,
  };
}
export type ElectionData = Awaited<ReturnType<typeof electionData>>;
