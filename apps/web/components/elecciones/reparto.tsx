'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@reforma-digital/design/ui/button';
import { clusters, seatRadius, sunflower } from '../../lib/elecciones/seats';
import { Label } from './report';
import { Tips } from './tips';

export type RepartoElection = {
  id: string;
  short: string;
  long: string;
  prov: Record<string, { e: number; fam: Record<string, [number, number]> }>;
};

// Cuántos escaños tenía cada provincia en cada elección, un punto por escaño del color de la
// familia que lo ganó. Se elige la elección o se reproducen todas.
export function Reparto({
  elections,
  families,
  provinces,
  centres,
  width,
  height,
  background,
}: {
  elections: RepartoElection[];
  families: { id: string; nombre: string; color: string }[];
  provinces: Record<string, { name: string; href: string }>;
  centres: Record<string, [number, number]>;
  width: number;
  height: number;
  background: ReactNode;
}) {
  const router = useRouter();
  const [k, setK] = useState(elections.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (k >= elections.length - 1) return setPlaying(false);
    const timer = setTimeout(() => setK(k + 1), 1700);
    return () => clearTimeout(timer);
  }, [playing, k, elections.length]);

  // Las posiciones de cada elección: un racimo por provincia, del tamaño de sus escaños.
  const layouts = useMemo(
    () =>
      elections.map((e) =>
        clusters(Object.fromEntries(Object.entries(e.prov).map(([c, p]) => [c, p.e])), centres),
      ),
    [elections, centres],
  );
  const most = useMemo(() => {
    const max: Record<string, number> = {};
    for (const e of elections)
      for (const [c, p] of Object.entries(e.prov)) max[c] = Math.max(max[c] ?? 0, p.e);
    return max;
  }, [elections]);

  const e = elections[k];
  const first = elections[0];
  const previous = elections[k - 1];
  if (!e || !first) return null;
  const layout = layouts[k] ?? {};
  const name = (c: string) => provinces[c]?.name ?? c;
  const colorsOf = (c: string) =>
    families.flatMap((f) => Array<string>(e.prov[c]?.fam[f.id]?.[1] ?? 0).fill(f.color));
  const changes = (against: RepartoElection) =>
    Object.keys(e.prov)
      .map((c) => ({ c, from: against.prov[c]?.e ?? 0, to: e.prov[c]?.e ?? 0 }))
      .filter((x) => x.from !== x.to)
      .sort((a, b) => b.to - b.from - (a.to - a.from));
  const changeList = (against: RepartoElection) => {
    const list = changes(against);
    return list.length ? (
      <ul className="m-0 grid list-none p-0">
        {list.map(({ c, from, to }) => (
          <li
            key={c}
            className="flex items-baseline justify-between gap-3 border-t border-border py-1.5 text-sm first:border-t-0"
          >
            <Link href={provinces[c]?.href ?? '#'} className="hover:underline underline-offset-4">
              {name(c)}
            </Link>
            <span className="font-mono text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {from} → {to} ({to > from ? '+' : '−'}
              {Math.abs(to - from)})
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="m-0 text-sm text-muted-foreground">Los mismos escaños en cada provincia.</p>
    );
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="sunset"
          size="sm"
          onClick={() => {
            if (playing) return setPlaying(false);
            if (k >= elections.length - 1) setK(0);
            setPlaying(true);
          }}
        >
          {playing ? 'Pausa' : 'Reproducir'}
        </Button>
        {elections.map((x, i) => (
          <Button
            key={x.id}
            size="sm"
            variant={i === k ? 'default' : 'ghost'}
            aria-pressed={i === k}
            onClick={() => {
              setPlaying(false);
              setK(i);
            }}
          >
            {x.short}
          </Button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Tips>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Escaños de cada provincia en ${e.long}`}
            className="block h-auto w-full"
          >
            {background}
            {Object.entries(most).flatMap(([c, max]) => {
              const centre = layout[c];
              const spiral = sunflower(max);
              const colors = colorsOf(c);
              const seats = e.prov[c]?.e ?? 0;
              const tip = families
                .filter((f) => (e.prov[c]?.fam[f.id]?.[1] ?? 0) > 0)
                .map((f) => `${f.nombre} ${e.prov[c]?.fam[f.id]?.[1]}`)
                .join(' · ');
              return Array.from({ length: max }, (_, j) => {
                const x = (centre?.x ?? 0) + (spiral[j]?.x ?? 0);
                const y = (centre?.y ?? 0) + (spiral[j]?.y ?? 0);
                return (
                  <circle
                    key={`${c}-${j}`}
                    r={seatRadius}
                    fill={colors[j] ?? '#8A8F98'}
                    className="cursor-pointer stroke-background transition-[transform,opacity] duration-700 ease-(--ease-brand) motion-reduce:transition-none"
                    strokeWidth={0.8}
                    style={{ transform: `translate(${x}px, ${y}px)`, opacity: j < seats ? 1 : 0 }}
                    data-tip={name(c)}
                    data-tip-text={`${seats} escaños en ${e.short}${tip ? `: ${tip}` : ''}`}
                    onClick={() => router.push(provinces[c]?.href ?? '#')}
                  />
                );
              });
            })}
          </svg>
        </Tips>
        <div className="grid content-start gap-5" aria-live="polite">
          <Label>
            {e.long}
            {Object.values(e.prov).every((p) => !Object.keys(p.fam).length) && ' · aún sin votar'}
          </Label>
          {previous && (
            <div className="grid gap-2">
              <h3 className="m-0 font-heading text-xl font-normal">Frente a {previous.short}</h3>
              {changeList(previous)}
            </div>
          )}
          {k > 0 ? (
            <div className="grid gap-2">
              <h3 className="m-0 font-heading text-xl font-normal">Frente a {first.short}</h3>
              {changeList(first)}
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              El reparto de las primeras elecciones. Elige otra para ver qué provincias ganaron o
              perdieron escaños.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
