import Link from 'next/link';
import { Button } from '@reforma-digital/design/ui/button';
import type { ReactNode } from 'react';
import { getGeography, getHistory, read } from '../../lib/congreso/data';
import {
  ageSchema,
  mapSchema,
  municipalitiesSchema,
  municipalityVotesSchema,
} from '../../lib/congreso/schema';
import { decimal, ink, percent, thousands } from '../../lib/elecciones/format';
import {
  axes,
  blocs,
  municipalities,
  rentCuts,
  share,
  spains,
  summarize,
  type Axis,
  type Bloc,
  type Summary,
} from '../../lib/elecciones/geography';
import { electionsHref } from '../../lib/elecciones/pages';
import { href } from '../congreso/common';
import { ReportIntro } from './report';
import { Tips } from './tips';
import { VoteStory, type Step } from './vote-story';

const millions = (n: number) => `${decimal(n / 1e6, 2)} millones`;
const people = (n: number) =>
  n >= 1e6 ? `${millions(n)} de habitantes` : `${thousands(n)} habitantes`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${percent(Math.abs(n), 0)}`;
const others = '#8A8F98';
// Los botones de elegir: el estado lo marca `VoteStory` con `aria-pressed`.
const pressed = 'aria-pressed:bg-foreground aria-pressed:text-background';
// El tono de cada eje en el mapa.
const tones: Record<Axis, string> = {
  ciudad: '#4F7AA6',
  vacia: '#B4613A',
  edad: '#8A5AA8',
  dinero: '#2E7D5B',
};
const Num = ({ children }: { children: ReactNode }) => (
  <b className="font-medium text-foreground tabular-nums">{children}</b>
);

// «La geografía del voto»: cómo vota cada España, municipio a municipio, en siete ejes y con un
// mapa que se queda quieto mientras se lee. Estructura de Escaño Abierto.
export async function GeographyVote() {
  const [M, v23, v19, age, geography, map, history] = await Promise.all([
    read('geografia/municipios.json', municipalitiesSchema),
    read('elecciones/municipios-202307.json', municipalityVotesSchema),
    read('elecciones/municipios-201911.json', municipalityVotesSchema),
    read('elecciones/voto-edad.json', ageSchema),
    getGeography(),
    read('elecciones/geo-provincias.json', mapSchema),
    getHistory(),
  ]);
  const family = Object.fromEntries(history.familias.map((f) => [f.id, f]));
  const blocColor = (k: Bloc | 'SUMAR') =>
    k === 'OTROS' ? others : (family[k === 'SUMAR' ? 'IZQ' : k]?.color ?? others);
  const D = municipalities(M.m, v23, v19);
  const N = D.length;
  const all = summarize(D);
  const total = all.pob;
  const area = all.km2;
  const sh = (r: Summary, k: Bloc) => percent(share(r, k), 0);
  const region = Object.fromEntries(
    Object.entries(geography.ccaa).flatMap(([id, c]) => c.provincias.map((p) => [p, id])),
  );
  const provinceName = (code: string) => map.provincias[code]?.corto ?? code;

  // Cifras de «El mapa engaña».
  const byWinner = new Map<number, typeof D>();
  for (const d of D)
    if (d.winner !== null) byWinner.set(d.winner, [...(byWinner.get(d.winner) ?? []), d]);
  const popOf = (l: typeof D) => l.reduce((t, d) => t + d.pob, 0);
  const [smallWinner, smallList = []] =
    [...byWinner]
      .filter(([, l]) => l.length >= 100)
      .sort(([, a], [, b]) => b.length / popOf(b) - a.length / popOf(a))[0] ?? [];
  const byPop = [...D].sort((a, b) => b.pob - a.pob);
  let half = 0;
  for (let sum = 0; sum < total / 2; half++) sum += byPop[half]?.pob ?? 0;
  const tiny = D.filter((d) => d.pob < 100).length;
  const winnerName = (i: number | undefined) =>
    i === undefined ? '' : (family[M.orden[i] ?? '']?.nombre ?? '');
  const winners = [...byWinner]
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 7)
    .map(([i]) => ({ label: winnerName(i), color: family[M.orden[i] ?? '']?.color ?? others }));

  // Los ejes.
  const cuts = rentCuts(D);
  const buckets = axes(cuts);
  const subtitle: Record<string, string> = {
    gc: '100.000 habitantes o más',
    cm: 'de 20.000 a 100.000',
    pg: 'de 5.000 a 20.000',
    pu: 'de 1.000 a 5.000',
    ru: 'menos de 1.000',
    va: `pierden más del 25 % desde ${M.anio0}`,
    pi: 'hasta un 25 % menos',
    cr: 'hasta un 25 % más',
    cmu: 'más de un 25 %',
    j: 'menos del 18 % con 65 o más',
    m: 'del 18 al 25 %',
    e: 'del 25 al 33 %',
    me: 'uno de cada tres o más',
    a: `más de ${thousands(cuts[0] ?? 0)} € por persona`,
    ma: `de ${thousands(cuts[1] ?? 0)} a ${thousands(cuts[0] ?? 0)} €`,
    mb: `de ${thousands(cuts[2] ?? 0)} a ${thousands(cuts[1] ?? 0)} €`,
    b: `menos de ${thousands(cuts[2] ?? 0)} €`,
  };
  const summed = (axis: Axis) => buckets[axis].map((b) => summarize(D.filter(b.test)));
  const summaries: Record<Axis, Summary[]> = {
    ciudad: summed('ciudad'),
    vacia: summed('vacia'),
    edad: summed('edad'),
    dinero: summed('dinero'),
  };
  const tone = (axis: Axis, t: number) =>
    axis === 'vacia'
      ? `color-mix(in oklab, ${t < 0 ? tones.vacia : '#3D7CB0'} ${Math.round(Math.abs(t) ** 0.8 * 90 + 10)}%, var(--muted))`
      : `color-mix(in oklab, ${tones[axis]} ${Math.round(10 + 90 * t)}%, var(--muted))`;
  const bar = (r: Summary) => (
    <span
      className="flex h-2.5 overflow-hidden rounded-full"
      role="img"
      aria-label={blocs.map(([k, t]) => `${t} ${percent(share(r, k), 0)}`).join(', ')}
    >
      {blocs.map(([k]) =>
        r[k] ? (
          <i key={k} className="block h-full" style={{ flex: r[k], background: blocColor(k) }} />
        ) : null,
      )}
    </span>
  );
  const partyLegend = (
    <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {blocs.map(([k, t]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-full" style={{ background: blocColor(k) }} />
          {t}
        </span>
      ))}
      <span>· voto del 23J</span>
    </p>
  );
  const groups = (axis: Axis) => (
    <div className="grid gap-3">
      <ul className="m-0 grid list-none gap-1 p-0">
        {buckets[axis].map((b, i) => {
          const r = summaries[axis][i];
          if (!r) return null;
          return (
            <li
              key={b.key}
              tabIndex={0}
              data-bucket={`${axis}:${b.key}`}
              className="grid cursor-pointer grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg p-2 transition-colors outline-none hover:bg-muted focus-visible:bg-muted data-[on]:bg-muted"
            >
              <i
                className="mt-1.5 block size-3 rounded-xs"
                style={{ background: tone(axis, b.tone) }}
              />
              <span className="grid gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <b className="font-medium">{b.title}</b>
                  <span className="text-sm text-muted-foreground">
                    {thousands(r.n)} municipios · {percent(r.pob / total, 0)} de la gente
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {subtitle[b.key]}
                  {r.valid > 0 &&
                    ` · PP ${sh(r, 'PP')}, PSOE ${sh(r, 'PSOE')}, Vox ${sh(r, 'VOX')}, Sumar ${sh(r, 'IZQ')}`}
                </span>
                {bar(r)}
              </span>
            </li>
          );
        })}
      </ul>
      {partyLegend}
      <p className="m-0 text-sm text-muted-foreground">
        Pasa el cursor (o toca) un grupo para iluminar sus municipios.
      </p>
    </div>
  );
  const [cG, , , , cRu] = summaries.ciudad;
  const [vVa, , , vCm] = summaries.vacia;
  const [eJ, , , eMe] = summaries.edad;
  const [dA, , , dB] = summaries.dinero;
  const halfOld = D.filter((d) => (d.may65 ?? 0) >= 50).length;

  // Las Españas.
  const spainList = spains((p) => region[p]).map((s) => ({ ...s, r: summarize(D.filter(s.test)) }));
  const spainText = (key: string, r: Summary) =>
    ({
      laponia: `Los ${thousands(r.n)} municipios con menos de 8 habitantes por km², el umbral con el que la UE define las zonas muy escasamente pobladas, como la Laponia. Ocupan el ${percent(r.km2 / area, 0)} de España y tienen ${people(r.pob)}. Su corazón es la Serranía Celtibérica, entre Soria, Teruel, Cuenca y Guadalajara.`,
      castillas: `Castilla y León y Castilla-La Mancha: el ${percent(r.km2 / area, 0)} del territorio, el ${percent(r.pob / total, 0)} de la población y ${thousands(r.n)} municipios, más de la mitad de los de España.`,
      verde: `Galicia, Asturias, Cantabria y el País Vasco: la cornisa atlántica y cantábrica, con ${people(r.pob)}.`,
      medi: `Las provincias de la costa mediterránea, de Girona a Almería: ${people(r.pob)}, el ${percent(r.pob / total, 0)} de España, en el ${percent(r.km2 / area, 0)} de su territorio.`,
      corona: `Los ${thousands(r.n)} municipios de la Comunidad de Madrid sin la capital, con ${people(r.pob)}${r.growth !== null ? `: han crecido un ${percent(r.growth, 0)} desde ${M.anio0}` : ''}.`,
      islas: `Baleares y Canarias: ${people(r.pob)}${r.growth !== null ? `, un ${percent(r.growth, 0)} más que en ${M.anio0}` : ''}.`,
      grandes: `Los ${r.n} municipios de más de 250.000 habitantes. En ellos vive el ${percent(r.pob / total, 0)} de la población.`,
    })[key] ?? '';

  // Cada edad, según el CIS.
  const ageParties = [
    ['PP', 'PP'],
    ['PSOE', 'PSOE'],
    ['VOX', 'Vox'],
    ['SUMAR', 'Sumar'],
    ['OTROS', 'Otros'],
  ] as const;
  const A = age.ajustado;
  const nAll = age.n.reduce((t, x) => t + x, 0);
  const youngShare =
    [0, 1].reduce((t, j) => t + ((A[j]?.VOX ?? 0) + (A[j]?.SUMAR ?? 0)) * (age.n[j] ?? 0), 0) /
    ((age.n[0] ?? 0) + (age.n[1] ?? 0) || 1);
  const oldShare = (A[6]?.VOX ?? 0) + (A[6]?.SUMAR ?? 0);
  const leader = A.map(
    (a) =>
      Object.entries(a)
        .filter(([k]) => k !== 'OTROS')
        .sort((x, y) => y[1] - x[1])[0]?.[0] ?? '',
  );
  const spans: Record<string, [number, number][]> = {};
  leader.forEach((g, j) => {
    const list = (spans[g] ??= []);
    const last = list.at(-1);
    if (last && last[1] === j - 1) last[1] = j;
    else list.push([j, j]);
  });
  const from = (j: number) => age.edades[j]?.split(/[-+]/)[0] ?? '';
  const to = (j: number) =>
    age.edades[j]?.includes('+') ? null : (age.edades[j]?.split('-')[1] ?? null);
  const range = ([a, b]: [number, number]) =>
    to(b) ? `de ${from(a)} a ${to(b)}` : `de ${from(a)} o más`;
  const join = (l: string[]) =>
    l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l.at(-1)}` : (l[0] ?? '');
  const byAge = Object.entries(spans)
    .map(
      ([g, l]) =>
        `${g === 'PP' ? 'el PP' : g === 'PSOE' ? 'el PSOE' : g} gana ${join(l.map(range))} años`,
    )
    .join('; ');
  const ageLabel = (e: string) => e.replace('75+', '75 y más');

  // El peso del voto.
  const perSeat = Object.entries(geography.provincias)
    .map(([c, p]) => ({ c, h: p.pob / p.esc }))
    .sort((a, b) => a.h - b.h);
  const light = perSeat[0];
  const heavy = perSeat.at(-1);

  // El giro.
  const bloc = (V: typeof v23) => {
    let right = 0;
    let left = 0;
    let valid = 0;
    for (const row of Object.values(V.municipios))
      V.orden.forEach((f, i) => {
        const v = row[2 + i] ?? 0;
        valid += v;
        if (f === 'PP' || f === 'VOX' || f === 'CS') right += v;
        if (f === 'PSOE' || f === 'IZQ') left += v;
      });
    return { right: right / valid, left: left / valid };
  };
  const B23 = bloc(v23);
  const B19 = bloc(v19);
  const withSwing = D.filter((d) => d.swing !== null);
  const toRight = withSwing.filter((d) => (d.swing ?? 0) > 0).length;

  const steps: Step[] = [
    {
      id: 'engana',
      short: 'El mapa engaña',
      kicker: 'El mapa engaña',
      title: 'El territorio no vota. La gente, sí.',
      body: (
        <>
          <p>
            Cada punto es un municipio, pintado del color del partido más votado el 23J. Vistos
            todos iguales, pesan lo mismo los <Num>{thousands(tiny)}</Num> pueblos de menos de cien
            vecinos que {byPop[0]?.name}, con {millions(byPop[0]?.pob ?? 0)} de habitantes.
          </p>
          <p>
            Pero la mitad de la población vive en solo <Num>{thousands(half)}</Num> municipios, el{' '}
            {percent(half / N, 1)}. Si cada punto pesa lo que pesa su gente, el mapa cambia: unos
            pocos círculos enormes en un mar de pueblos pequeños, y hay colores que casi
            desaparecen. {winnerName(smallWinner)} ganó en {thousands(smallList.length)} municipios,
            pero en ellos vive el {percent(popOf(smallList) / total, 1)} de la gente.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tamaño de los puntos">
            <Button variant="outline" size="sm" data-size="mun" className={pressed}>
              Por municipio
            </Button>
            <Button variant="outline" size="sm" data-size="pob" className={pressed}>
              Por habitantes
            </Button>
          </div>
        </>
      ),
    },
    {
      id: 'ciudad',
      short: 'Ciudad y campo',
      kicker: 'Eje 1 · Ciudad y campo',
      title: 'Las ciudades y los pueblos',
      body: cG && cRu && (
        <>
          <p>
            Los <Num>{thousands(cG.n)}</Num> municipios de más de cien mil habitantes reúnen al{' '}
            {percent(cG.pob / total, 0)} de la población; los {thousands(cRu.n)} de menos de mil, al{' '}
            {percent(cRu.pob / total, 1)}. El 23J el PP sacó el {sh(cRu, 'PP')} de los votos en la
            España rural y el {sh(cG, 'PP')} en las grandes ciudades; Sumar, el {sh(cRu, 'IZQ')} y
            el {sh(cG, 'IZQ')}.
          </p>
          {groups('ciudad')}
        </>
      ),
    },
    {
      id: 'vacia',
      short: 'La España vacía',
      kicker: 'Eje 2 · La España vacía',
      title: 'La España que se vacía',
      body: vVa && vCm && (
        <>
          <p>
            <Num>{thousands(vVa.n)}</Num> municipios han perdido más de una cuarta parte de sus
            vecinos desde {M.anio0}. Ocupan el <Num>{percent(vVa.km2 / area, 0)}</Num> del
            territorio y hoy vive en ellos el {percent(vVa.pob / total, 1)} de la población. En el
            otro extremo, {thousands(vCm.n)} municipios han crecido más de un 25 %, sobre todo en la
            costa, en las islas y alrededor de las grandes ciudades.
          </p>
          {groups('vacia')}
        </>
      ),
    },
    {
      id: 'edad',
      short: 'La edad',
      kicker: 'Eje 3 · La edad',
      title: 'Los pueblos que envejecen',
      body: eJ && eMe && (
        <>
          <p>
            En <Num>{thousands(eMe.n)}</Num> municipios al menos uno de cada tres vecinos tiene 65
            años o más, y en {thousands(halfOld)} ya son la mitad. El envejecimiento dibuja casi el
            mismo mapa que la pérdida de población: donde se van los jóvenes, quedan los mayores.
          </p>
          <p>
            Donde más mayores hay, el PP sacó el {sh(eMe, 'PP')} de los votos; en los municipios más
            jóvenes, el {sh(eJ, 'PP')}.
          </p>
          {groups('edad')}
        </>
      ),
    },
    {
      id: 'generaciones',
      short: 'Cada edad',
      kicker: 'Eje 3 · La edad',
      title: 'Cómo vota cada edad',
      body: (
        <>
          <p>
            El mapa enseña pueblos que envejecen, pero no cómo vota la gente según su edad. Eso lo
            dice la encuesta postelectoral del CIS, con <Num>{thousands(nAll)}</Num> votantes
            entrevistados después del 23J.
          </p>
          <p>
            Entre los menores de 35, Vox y Sumar se llevaron juntos el{' '}
            <Num>{decimal(youngShare, 0)} %</Num> de los votos; entre los mayores de 75, el{' '}
            {decimal(oldShare, 0)} %. Por edades, {byAge}.
          </p>
          <Tips>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
              {age.edades.map((e, j) => (
                <li
                  key={e}
                  tabIndex={0}
                  data-tip={`De ${e.replace('75+', '75 o más').replace('-', ' a ')} años`}
                  data-tip-text={ageParties
                    .map(
                      ([k, t]) =>
                        `${t} ${decimal(A[j]?.[k] ?? 0, 1)} % (dicen ${decimal(age.crudo[j]?.[k] ?? 0, 1)} %)`,
                    )
                    .join(' · ')}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3"
                >
                  <span className="font-mono text-muted-foreground">{ageLabel(e)}</span>
                  <span className="flex h-6 overflow-hidden rounded-xs">
                    {ageParties.map(([k]) => {
                      const v = A[j]?.[k] ?? 0;
                      return (
                        <i
                          key={k}
                          className="flex items-center justify-center font-mono text-xs not-italic"
                          style={{
                            width: `${v}%`,
                            background: blocColor(k),
                            color: ink(blocColor(k)),
                          }}
                        >
                          {v >= 9 ? Math.round(v) : ''}
                        </i>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Tips>
          <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {ageParties.map(([k, t]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <i className="block size-2.5 rounded-full" style={{ background: blocColor(k) }} />
                {t}
              </span>
            ))}
          </p>
          <div className="grid gap-1.5 text-sm">
            <p className="m-0 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Dicen que no votaron
            </p>
            {age.edades.map((e, j) => (
              <p
                key={e}
                className="m-0 grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3"
              >
                <span className="font-mono text-muted-foreground">{ageLabel(e)}</span>
                <span className="h-2 rounded-full bg-muted">
                  <i
                    className="block h-full rounded-full bg-muted-foreground"
                    style={{
                      width: `${((age.no_voto[j] ?? 0) / Math.max(...age.no_voto)) * 100}%`,
                    }}
                  />
                </span>
                <b className="text-right font-mono font-medium tabular-nums">
                  {decimal(age.no_voto[j] ?? 0, 0)} %
                </b>
              </p>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            El recuerdo de voto del CIS se queda corto con el PP y Vox y largo con Sumar: cada
            partido se ha escalado para que el total cuadre con el resultado del 23J, sin tocar la
            diferencia entre edades. Al pasar por cada fila, lo que dijeron sin ajustar.{' '}
            <Link href={age.url} className="underline underline-offset-4">
              La tabla del CIS
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'dinero',
      short: 'El dinero',
      kicker: 'Eje 4 · El dinero',
      title: 'La renta',
      body: dA && dB && (
        <>
          <p>
            Ordenados por renta neta por persona (Atlas de renta del INE, {geography.fuentes.renta}
            ), cada grupo reúne a una cuarta parte de la población. El cuarto con más renta vive en{' '}
            <Num>{thousands(dA.n)}</Num> municipios; el de menos, en {thousands(dB.n)}.
          </p>
          <p>
            En los municipios de renta alta el PP sacó el {sh(dA, 'PP')} y el PSOE el{' '}
            {sh(dA, 'PSOE')}; en los de renta baja, el {sh(dB, 'PP')} y el {sh(dB, 'PSOE')}.
          </p>
          {groups('dinero')}
        </>
      ),
    },
    {
      id: 'espanas',
      short: 'Las Españas',
      kicker: 'Eje 5 · Las Españas',
      title: 'Las Españas que no salen en el mapa autonómico',
      body: (
        <>
          <p>
            Hay regiones que comparten paisaje, economía y forma de vivir sin coincidir con una
            comunidad. Elige una para ver dónde está, cuánta gente vive en ella y cómo votó.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elige una España">
            {spainList.map((s) => (
              <Button
                key={s.key}
                variant="outline"
                size="sm"
                data-spain={s.key}
                className={pressed}
              >
                {s.title}
              </Button>
            ))}
          </div>
          {spainList.map((s) => (
            <div
              key={s.key}
              data-spain-detail={s.key}
              className="grid gap-2 rounded-xl bg-muted p-4"
              hidden
            >
              <h4 className="m-0 text-base font-medium">
                {s.title}
                {s.approx && (
                  <small className="ml-2 text-sm font-normal text-(--text-secondary)">
                    · límites aproximados: provincias enteras
                  </small>
                )}
              </h4>
              <p className="m-0 text-sm">{spainText(s.key, s.r)}</p>
              <p className="m-0 text-sm text-(--text-secondary)">
                El 23J: PP {sh(s.r, 'PP')}, PSOE {sh(s.r, 'PSOE')}, Vox {sh(s.r, 'VOX')}, Sumar{' '}
                {sh(s.r, 'IZQ')}, otros {sh(s.r, 'OTROS')}.
                {s.r.growth !== null && ` Población desde ${M.anio0}: ${signed(s.r.growth)}.`}
              </p>
            </div>
          ))}
          <ul className="m-0 grid list-none gap-1 p-0">
            {spainList.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  data-spain={s.key}
                  className="grid w-full grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted aria-pressed:bg-muted"
                >
                  <b className="font-medium">{s.title}</b>
                  {bar(s.r)}
                  <span className="text-right font-mono tabular-nums">
                    {decimal(s.r.pob / 1e6, 2)} M
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {partyLegend}
        </>
      ),
    },
    {
      id: 'giro',
      short: 'El giro',
      kicker: 'Eje 6 · El giro',
      title: 'Hacia dónde se movió el mapa',
      body: (
        <>
          <p>
            Entre noviembre de 2019 y julio de 2023, el bloque de PP, Vox y Cs pasó del{' '}
            {percent(B19.right, 1)} al <Num>{percent(B23.right, 1)}</Num> de los votos, y el de PSOE
            y Sumar (Unidas Podemos en 2019), del {percent(B19.left, 1)} al{' '}
            <Num>{percent(B23.left, 1)}</Num>.
          </p>
          <p>
            El <Num>{percent(toRight / (withSwing.length || 1), 0)}</Num> de los municipios se movió
            hacia la derecha. Cada flecha apunta a la derecha si ganó terreno el bloque de PP, Vox y
            Cs, y a la izquierda si lo ganó el de PSOE y Sumar; cuanto más larga, mayor el giro, y
            cuanto más gruesa, más votantes. Los partidos nacionalistas y regionalistas no cuentan
            en ninguno de los dos bloques.
          </p>
        </>
      ),
    },
    {
      id: 'peso',
      short: 'El peso del voto',
      kicker: 'Eje 7 · El peso del voto',
      title: 'Un voto, distinto peso',
      body: light && heavy && (
        <>
          <p>
            Los escaños no se reparten por municipios ni por territorio, sino por provincias. Cada
            una tiene dos fijos y el resto va por población.
          </p>
          <p>
            Por eso en {provinceName(light.c)} un diputado representa a{' '}
            <Num>{thousands(light.h)}</Num> habitantes, y en {provinceName(heavy.c)}, a{' '}
            <Num>{thousands(heavy.h)}</Num>: un voto de {provinceName(light.c)} pesa{' '}
            {decimal(heavy.h / light.h, 1)} veces más.
          </p>
        </>
      ),
    },
    {
      id: 'fichas',
      short: 'Las fichas',
      kicker: 'Y ahora, tu provincia',
      title: 'Cada provincia, cada municipio',
      body: (
        <>
          <p>
            Cada provincia tiene su historia electoral desde 1977, y cada comunidad y provincia, su
            ficha geográfica.
          </p>
          <p className="grid gap-1">
            <Link
              href={`${electionsHref('historico')}#provincias`}
              className="underline underline-offset-4"
            >
              Las 52 circunscripciones →
            </Link>
            <Link href={href('geografia')} className="underline underline-offset-4">
              La geografía de España, sin votos →
            </Link>
          </p>
        </>
      ),
    },
  ];

  return (
    <>
      <ReportIntro title="La geografía del voto">
        <p>
          Ciudad y campo, la España vacía, la edad, el dinero, las Españas, el giro y el peso del
          voto: cómo vota cada España, municipio a municipio.
        </p>
      </ReportIntro>
      <VoteStory
        count={N}
        steps={steps}
        winners={winners}
        order={M.orden}
        colors={Object.fromEntries(history.familias.map((f) => [f.id, f.color]))}
        regions={region}
        tones={tones}
        swingColors={{ right: blocColor('PP'), left: blocColor('PSOE') }}
      />
      <p className="m-0 mt-8 max-w-[65ch] text-sm text-muted-foreground">
        Datos: INE (padrón municipal {M.anio} y {M.anio0}, Atlas de distribución de renta de los
        hogares {geography.fuentes.renta}) y Ministerio del Interior (generales de noviembre de 2019
        y julio de 2023, sin el voto desde el extranjero). Los grupos de renta reparten la población
        en cuartos; los municipios sin dato del Atlas quedan fuera de ese eje. «El corredor
        mediterráneo» toma provincias enteras.
      </p>
    </>
  );
}
