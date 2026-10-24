import type { z } from 'zod';
import type { municipalitiesSchema, municipalityVotesSchema } from '../congreso/schema';

// «La geografía del voto»: los municipios con su gente y su voto, y los grupos en que se reparten
// en cada eje. Lo usan el servidor (los textos) y el navegador (el mapa), con los mismos datos.

type Rows = z.infer<typeof municipalitiesSchema>['m'];
type Votes = z.infer<typeof municipalityVotesSchema>;

export const blocs = [
  ['PP', 'PP'],
  ['PSOE', 'PSOE'],
  ['VOX', 'Vox'],
  ['IZQ', 'Sumar'],
  ['OTROS', 'Otros'],
] as const;
export type Bloc = (typeof blocs)[number][0];
type Grouped = Record<Bloc, number> & {
  right: number;
  left: number;
  valid: number;
  voters: number;
};

export type Municipality = {
  code: string;
  name: string;
  x: number;
  y: number;
  km2: number;
  pob: number;
  pob0: number | null;
  renta: number | null;
  may65: number | null;
  // Índice de la familia más votada el 23J en `orden`.
  winner: number | null;
  vote: Grouped | null;
  // Puntos que ganó el bloque de PP, Vox y Cs sobre el de PSOE y Sumar entre 2019 y 2023.
  swing: number | null;
  density: number | null;
};

// Los votos de un municipio en los cuatro grandes y el resto, y los dos bloques del giro.
function group(row: number[], order: string[]): Grouped {
  const g: Grouped = {
    PP: 0,
    PSOE: 0,
    VOX: 0,
    IZQ: 0,
    OTROS: 0,
    right: 0,
    left: 0,
    valid: 0,
    voters: row[1] ?? 0,
  };
  order.forEach((f, i) => {
    const v = row[2 + i] ?? 0;
    g.valid += v;
    g[f === 'PP' || f === 'PSOE' || f === 'VOX' || f === 'IZQ' ? f : 'OTROS'] += v;
    if (f === 'PP' || f === 'VOX' || f === 'CS') g.right += v;
    if (f === 'PSOE' || f === 'IZQ') g.left += v;
  });
  return g;
}

// Una fila de votos de un municipio es [censo, votantes, votos de cada familia en `orden`…]. La
// parte de unas familias sobre los votos a candidaturas y la participación (null si no hay).
export const voteShare = (row: number[], orden: string[], families: string[]) => {
  const total = row.slice(2).reduce((t, v) => t + v, 0);
  return total ? families.reduce((t, f) => t + (row[2 + orden.indexOf(f)] ?? 0), 0) / total : null;
};
export const turnout = (row?: number[]) => (row && row[0] ? (row[1] ?? 0) / row[0] : null);

export function municipalities(m: Rows, v23: Votes, v19: Votes): Municipality[] {
  return Object.entries(m).map(([code, r]) => {
    const now = v23.municipios[code];
    const before = v19.municipios[code];
    const vote = now ? group(now, v23.orden) : null;
    const old = before ? group(before, v19.orden) : null;
    return {
      code,
      name: r[0],
      x: r[1],
      y: r[2],
      km2: r[3] ?? 0,
      pob: r[4],
      pob0: r[5],
      renta: r[6],
      may65: r[8],
      winner: r[9],
      vote,
      swing:
        vote && old && vote.valid && old.valid
          ? ((vote.right - vote.left) / vote.valid - (old.right - old.left) / old.valid) * 100
          : null,
      density: r[3] ? r[4] / r[3] : null,
    };
  });
}

export type Summary = Record<Bloc, number> & {
  n: number;
  pob: number;
  km2: number;
  valid: number;
  // Cuánto ha crecido su población desde el padrón de referencia.
  growth: number | null;
};
export function summarize(list: Municipality[]): Summary {
  const r = {
    n: list.length,
    pob: 0,
    pob0: 0,
    pobWith0: 0,
    km2: 0,
    valid: 0,
    PP: 0,
    PSOE: 0,
    VOX: 0,
    IZQ: 0,
    OTROS: 0,
  };
  for (const d of list) {
    r.pob += d.pob;
    r.km2 += d.km2;
    if (d.pob0) {
      r.pob0 += d.pob0;
      r.pobWith0 += d.pob;
    }
    if (d.vote) {
      r.valid += d.vote.valid;
      for (const [k] of blocs) r[k] += d.vote[k];
    }
  }
  return { ...r, growth: r.pob0 ? r.pobWith0 / r.pob0 - 1 : null };
}
export const share = (r: Summary, k: Bloc) => (r.valid ? r[k] / r.valid : 0);

// Los cortes de renta que reparten la población en cuatro partes iguales (de más a menos renta).
export function rentCuts(list: Municipality[]) {
  const withRent = list
    .filter((d) => d.renta !== null)
    .sort((a, b) => (b.renta ?? 0) - (a.renta ?? 0));
  const total = withRent.reduce((t, d) => t + d.pob, 0);
  const cuts: number[] = [];
  let sum = 0;
  let q = 1;
  for (const d of withRent) {
    sum += d.pob;
    if (sum >= (total * q) / 4 && q < 4) {
      cuts.push(d.renta ?? 0);
      q++;
    }
  }
  return cuts;
}

const growth = (d: Municipality) => (d.pob0 ? d.pob / d.pob0 - 1 : null);
export type Axis = 'ciudad' | 'vacia' | 'edad' | 'dinero';
export type Bucket = { key: string; title: string; test: (d: Municipality) => boolean };
// Los grupos de cada eje, en el orden en que se cuentan; `tone` es su intensidad en el mapa.
export function axes(cuts: number[]): Record<Axis, (Bucket & { tone: number })[]> {
  const [a = 0, b = 0, c = 0] = cuts;
  return {
    ciudad: [
      { key: 'gc', title: 'Grandes ciudades', tone: 1, test: (d) => d.pob >= 1e5 },
      { key: 'cm', title: 'Ciudades medias', tone: 0.85, test: (d) => d.pob >= 2e4 && d.pob < 1e5 },
      { key: 'pg', title: 'Pueblos grandes', tone: 0.7, test: (d) => d.pob >= 5e3 && d.pob < 2e4 },
      { key: 'pu', title: 'Pueblos', tone: 0.56, test: (d) => d.pob >= 1e3 && d.pob < 5e3 },
      { key: 'ru', title: 'La España rural', tone: 0.42, test: (d) => d.pob < 1e3 },
    ],
    vacia: [
      {
        key: 'va',
        title: 'Se vacían',
        tone: -1,
        test: (d) => (growth(d) ?? 0) <= -0.25 && d.pob0 !== null,
      },
      {
        key: 'pi',
        title: 'Pierden',
        tone: -0.5,
        test: (d) => d.pob0 !== null && (growth(d) ?? 0) > -0.25 && d.pob < d.pob0,
      },
      {
        key: 'cr',
        title: 'Crecen',
        tone: 0.5,
        test: (d) => d.pob0 !== null && d.pob >= d.pob0 && (growth(d) ?? 0) < 0.25,
      },
      {
        key: 'cmu',
        title: 'Crecen mucho',
        tone: 1,
        test: (d) => d.pob0 !== null && (growth(d) ?? 0) >= 0.25,
      },
    ],
    edad: [
      { key: 'j', title: 'Jóvenes', tone: 0.4, test: (d) => d.may65 !== null && d.may65 < 18 },
      {
        key: 'm',
        title: 'En la media',
        tone: 0.6,
        test: (d) => d.may65 !== null && d.may65 >= 18 && d.may65 < 25,
      },
      {
        key: 'e',
        title: 'Envejecidos',
        tone: 0.8,
        test: (d) => d.may65 !== null && d.may65 >= 25 && d.may65 < 100 / 3,
      },
      {
        key: 'me',
        title: 'Muy envejecidos',
        tone: 1,
        test: (d) => d.may65 !== null && d.may65 >= 100 / 3,
      },
    ],
    dinero: [
      { key: 'a', title: 'Renta alta', tone: 1, test: (d) => d.renta !== null && d.renta >= a },
      {
        key: 'ma',
        title: 'Por encima de la media',
        tone: 0.8,
        test: (d) => d.renta !== null && d.renta >= b && d.renta < a,
      },
      {
        key: 'mb',
        title: 'Por debajo de la media',
        tone: 0.6,
        test: (d) => d.renta !== null && d.renta >= c && d.renta < b,
      },
      { key: 'b', title: 'Renta baja', tone: 0.4, test: (d) => d.renta !== null && d.renta < c },
    ],
  };
}

// Las Españas: regiones con nombre propio que no coinciden con el mapa autonómico. `region` da la
// comunidad de cada provincia.
export function spains(region: (province: string) => string | undefined) {
  const province = (d: Municipality) => d.code.slice(0, 2);
  const islands = ['07', '35', '38'];
  return [
    {
      key: 'laponia',
      title: 'La Laponia del sur',
      test: (d: Municipality) =>
        d.density !== null && d.density < 8 && !islands.includes(province(d)),
    },
    {
      key: 'castillas',
      title: 'Las dos Castillas',
      test: (d: Municipality) => ['07', '08'].includes(region(province(d)) ?? ''),
    },
    {
      key: 'verde',
      title: 'La España verde',
      test: (d: Municipality) => ['12', '03', '06', '16'].includes(region(province(d)) ?? ''),
    },
    {
      key: 'medi',
      title: 'El corredor mediterráneo',
      approx: true,
      test: (d: Municipality) =>
        ['17', '08', '43', '12', '46', '03', '30', '04'].includes(province(d)),
    },
    {
      key: 'corona',
      title: 'La corona de Madrid',
      test: (d: Municipality) => province(d) === '28' && d.code !== '28079',
    },
    { key: 'islas', title: 'Las islas', test: (d: Municipality) => islands.includes(province(d)) },
    { key: 'grandes', title: 'Las grandes capitales', test: (d: Municipality) => d.pob >= 25e4 },
  ];
}
