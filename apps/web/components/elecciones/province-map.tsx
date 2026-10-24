'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button, buttonVariants } from '@reforma-digital/design/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { percent, ramp, thousands } from '../../lib/elecciones/format';
import { Icon } from '../brand/icon';
import { Cell, Label } from './report';
import { Tips } from './tips';
import { useWidth } from './use-width';

export type Winner = { name: string; brand: string; color: string; share: number; seats: number };
export type MapProvince = {
  code: string;
  name: string;
  href: string;
  seats: number;
  turnout: number;
  price: number;
  last: { from: string; to: string; missing: number } | null;
  winner: Winner | null;
  before: Winner | null;
  // Parte de los votos válidos de cada familia.
  shares: Record<string, number>;
  // Las candidaturas con escaño o con el 1 %: [nombre, color, parte de los votos, escaños].
  rows: [string, string, number, number][];
  // La marca ganadora en cada elección, de la primera a la última.
  history: (string | null)[];
};
type Mode = 'first' | 'vote' | 'seats' | 'turnout' | 'price' | 'margin';

const modes: [Mode, string][] = [
  ['first', 'Primera fuerza'],
  ['vote', 'Voto a…'],
  ['seats', 'Escaños'],
  ['turnout', 'Participación'],
  ['price', 'Votos por escaño'],
  ['margin', 'Último escaño'],
];
const isMode = (v: unknown): v is Mode => modes.some(([m]) => m === v);
const mix = (color: string, amount: number) =>
  `color-mix(in oklab, ${color} ${Math.round(amount)}%, var(--background))`;

// «Provincia a provincia»: el mapa de la elección elegida, pintado según lo que se elija; al lado,
// el resumen o, si se pulsa una provincia, su resultado sin salir de la página.
export function ProvinceMap({
  year,
  previous,
  years,
  provinces,
  parties,
  brandColor,
  centres,
  size: [mapWidth, mapHeight],
  map,
}: {
  year: string;
  previous: string | null;
  years: string[];
  provinces: MapProvince[];
  parties: { id: string; name: string; color: string }[];
  brandColor: Record<string, string>;
  centres: Record<string, [number, number]>;
  size: [number, number];
  map: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>('first');
  const [party, setParty] = useState(parties[0]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 600);
  const byCode = Object.fromEntries(provinces.map((p) => [p.code, p]));
  const changed = (p: MapProvince) =>
    mode === 'first' && !!p.winner && !!p.before && p.winner.brand !== p.before.brand;

  // Lo que se pinta y la escala de cada modo.
  const numeric: Record<Exclude<Mode, 'first' | 'vote'>, (p: MapProvince) => number | null> = {
    seats: (p) => p.seats,
    turnout: (p) => p.turnout,
    price: (p) => p.price,
    margin: (p) => p.last?.missing ?? null,
  };
  const format: Record<Exclude<Mode, 'first'>, (v: number) => string> = {
    vote: (v) => percent(v),
    seats: (v) => `${v} ${v === 1 ? 'escaño' : 'escaños'}`,
    turnout: (v) => percent(v),
    price: (v) => `${thousands(v)} votos`,
    margin: (v) => `${thousands(v)} votos`,
  };
  const partyColor = parties.find((x) => x.id === party)?.color ?? 'var(--foreground)';
  const values =
    mode === 'first'
      ? []
      : provinces.flatMap((p) => {
          const v = mode === 'vote' ? (p.shares[party] ?? 0) : numeric[mode](p);
          return v === null || (mode === 'vote' && v <= 0) ? [] : [[p.code, v] as const];
        });
  const value = Object.fromEntries(values);
  const nums = values.map(([, v]) => v);
  const low = mode === 'seats' || mode === 'vote' ? 0 : Math.min(...nums);
  const high = Math.max(...nums, 0.0001);
  const t = (v: number) =>
    mode === 'margin'
      ? 1 - Math.sqrt((v - low) / (high - low || 1))
      : mode === 'seats'
        ? Math.sqrt(v / high)
        : (v - low) / (high - low || 1);
  const fill = (p: MapProvince) => {
    if (mode === 'first')
      // El color del ganador, más intenso cuanto más holgada la victoria: del 25 % al 50 % o más.
      return p.winner
        ? mix(
            p.winner.color,
            Math.max(32, Math.min(100, 32 + ((p.winner.share - 0.25) / 0.25) * 68)),
          )
        : '';
    const v = value[p.code];
    if (v === undefined) return '';
    return mode === 'vote' ? mix(partyColor, 12 + (v / high) * 88) : ramp('price', t(v));
  };

  // El mapa llega dibujado del servidor: aquí se pinta cada provincia y se marcan la elegida y las
  // que cambian de manos.
  useEffect(() => {
    for (const path of box.current?.querySelectorAll<SVGElement>('[data-province]') ?? []) {
      const p = byCode[path.getAttribute('data-province') ?? ''];
      path.style.fill = p ? fill(p) : '';
      path.toggleAttribute('data-changed', !!p && changed(p));
      path.toggleAttribute('data-selected', p?.code === selected);
    }
  });

  const pick = (code: string | null) => setSelected(code === selected ? null : code);
  const ranked = [...values].sort(([, a], [, b]) => b - a);
  const list = (title: string, items: (readonly [string, number])[]) => (
    <div className="grid gap-1.5">
      <Label>{title}</Label>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {items.map(([code, v]) => (
          <li key={code}>
            <button
              type="button"
              onClick={() => pick(code)}
              className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span>{byCode[code]?.name}</span>
              <b className="font-mono font-medium tabular-nums">
                {mode === 'first' ? '' : format[mode](v)}
              </b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // El resumen de cada modo.
  let summary: ReactNode;
  let legend: ReactNode;
  if (mode === 'first') {
    const count = new Map<string, number>();
    for (const p of provinces)
      if (p.winner) count.set(p.winner.brand, (count.get(p.winner.brand) ?? 0) + 1);
    const counts = [...count].sort(([, a], [, b]) => b - a);
    const most = counts[0]?.[1] ?? 1;
    const turned = provinces.filter(changed);
    summary = (
      <>
        <div className="grid gap-2">
          <Label>Primera fuerza en…</Label>
          <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
            {counts.map(([b, n]) => (
              <li
                key={b}
                className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_2rem] items-center gap-2"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <i
                    className="block size-2.5 shrink-0 rounded-full"
                    style={{ background: brandColor[b] }}
                  />
                  {b}
                </span>
                <span className="h-2.5">
                  <i
                    className="block h-full rounded-xs"
                    style={{ width: `${(n / most) * 100}%`, background: brandColor[b] }}
                  />
                </span>
                <b className="text-right font-mono font-medium tabular-nums">{n}</b>
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-muted-foreground">provincias de {provinces.length}</p>
        </div>
        {previous && (
          <div className="grid gap-1.5">
            <Label>
              {turned.length ? `Cambian de manos: ${turned.length}` : 'Ninguna cambia de manos'}
            </Label>
            <ul className="m-0 grid max-h-80 list-none gap-0.5 overflow-y-auto p-0">
              {turned.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    onClick={() => pick(p.code)}
                    className="flex min-h-9 w-full flex-wrap items-center justify-between gap-x-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <b className="font-medium">{p.name}</b>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <i
                        className="block size-2 rounded-full"
                        style={{ background: p.before?.color }}
                      />
                      {p.before?.brand} →
                      <i
                        className="block size-2 rounded-full"
                        style={{ background: p.winner?.color }}
                      />
                      {p.winner?.brand}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
    legend = (
      <>
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
          Victoria ajustada
          <span
            className="block h-2.5 w-28 rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--muted), var(--foreground))' }}
          />
          holgada
        </p>
        {previous && (
          <p className="m-0 text-sm text-muted-foreground">
            Con borde, las que cambian de manos respecto a {previous}.
          </p>
        )}
      </>
    );
  } else {
    const titles: Record<Exclude<Mode, 'first'>, [string, string]> = {
      vote: ['Donde más votos tuvo', 'Donde menos'],
      seats: ['Más escaños', 'Menos escaños'],
      turnout: ['Más participación', 'Menos participación'],
      price: ['Escaño más caro', 'Escaño más barato'],
      margin: ['Último escaño más holgado', 'Último escaño más ajustado'],
    };
    const [hi, lo] = titles[mode];
    const top = ranked.slice(0, 5);
    const bottom = ranked.slice(-5).reverse();
    summary =
      mode === 'margin' ? (
        <>
          {list(lo, bottom)}
          {list(hi, top)}
        </>
      ) : (
        <>
          {list(hi, top)}
          {list(lo, bottom)}
        </>
      );
    const from = mode === 'vote' ? mix(partyColor, 12) : ramp('price', mode === 'margin' ? 1 : 0);
    const to = mode === 'vote' ? partyColor : ramp('price', mode === 'margin' ? 0 : 1);
    legend = (
      <>
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
          {format[mode](low)}
          <span
            className="block h-2.5 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
          />
          {format[mode](high)}
        </p>
        {mode === 'vote' && values.length < provinces.length && (
          <p className="m-0 text-sm text-muted-foreground">En gris, donde no se presentó.</p>
        )}
      </>
    );
  }

  const chosen = selected ? byCode[selected] : undefined;
  const title =
    mode === 'vote'
      ? `Voto a ${parties.find((x) => x.id === party)?.name ?? ''} · ${year}`
      : `${modes.find(([m]) => m === mode)?.[1]} · ${year}`;

  return (
    <>
      <div className="col-span-12 grid gap-3">
        <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tabs value={mode} onValueChange={(v) => isMode(v) && setMode(v)}>
            <TabsList aria-label="Qué se pinta">
              {modes.map(([m, text]) => (
                <TabsTrigger key={m} value={m} className="px-3">
                  {text}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {mode === 'vote' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Partido">
            {parties.map((x) => (
              <Button
                key={x.id}
                size="sm"
                variant={x.id === party ? 'default' : 'outline'}
                aria-pressed={x.id === party}
                onClick={() => setParty(x.id)}
              >
                <i className="block size-2 rounded-full" style={{ background: x.color }} />
                {x.name}
              </Button>
            ))}
          </div>
        )}
      </div>
      <Cell span={7}>
        <h3 className="m-0 text-base font-medium">{title}</h3>
        <div
          ref={box}
          className="relative [&_[data-changed]]:stroke-foreground [&_[data-changed]]:[stroke-width:1.6] [&_[data-selected]]:stroke-brand [&_[data-selected]]:[stroke-width:2.5]"
          onClick={(event) =>
            event.target instanceof Element &&
            pick(event.target.closest('[data-province]')?.getAttribute('data-province') ?? null)
          }
        >
          <Tips>{map}</Tips>
          {mode === 'seats' && (
            <svg
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {provinces.map((p) => {
                const [x, y] = centres[p.code] ?? [0, 0];
                return (
                  <text
                    key={p.code}
                    x={x}
                    y={y}
                    dy=".35em"
                    textAnchor="middle"
                    className="fill-foreground font-mono font-medium"
                    style={{
                      fontSize: (12 * mapWidth) / width,
                      paintOrder: 'stroke',
                      stroke: 'var(--background)',
                      strokeWidth: (3 * mapWidth) / width,
                    }}
                  >
                    {p.seats}
                  </text>
                );
              })}
            </svg>
          )}
        </div>
        <div className="grid gap-1">{legend}</div>
      </Cell>
      <Cell span={5}>
        {chosen ? (
          <div className="grid content-start gap-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <Label>
                  {year} · {chosen.seats} {chosen.seats === 1 ? 'escaño' : 'escaños'}
                </Label>
                <h3 className="m-0 font-heading text-[28px] leading-tight font-normal">
                  {chosen.name}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Volver al resumen"
                onClick={() => setSelected(null)}
              >
                <span className="rotate-45">
                  <Icon name="mas" size={18} />
                </span>
              </Button>
            </div>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
              {chosen.rows.map(([n, c, share, s]) => (
                <li
                  key={n}
                  className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_3.5rem_1.5rem] items-center gap-2"
                >
                  <span className="font-medium break-words">{n}</span>
                  <span className="h-2.5">
                    <i
                      className="block h-full rounded-xs"
                      style={{
                        width: `${(share / (chosen.rows[0]?.[2] || 1)) * 100}%`,
                        background: c,
                      }}
                    />
                  </span>
                  <span className="text-right font-mono text-muted-foreground tabular-nums">
                    {percent(share)}
                  </span>
                  <b className="text-right font-mono font-medium tabular-nums">{s || ''}</b>
                </li>
              ))}
            </ul>
            <p className="m-0 text-sm text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
              Participación {percent(chosen.turnout)} · {thousands(chosen.price)} votos por escaño.
              {chosen.last && (
                <>
                  {' '}
                  Último escaño para <b>{chosen.last.from}</b>; a {chosen.last.to} le faltaron{' '}
                  {thousands(chosen.last.missing)} votos.
                </>
              )}
            </p>
            <div className="grid gap-2">
              <Label>
                Quién ganó, de {years[0]} a {years.at(-1)}
              </Label>
              <ol className="m-0 grid list-none grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 p-0">
                {chosen.history.map((b, j) => (
                  <li
                    key={years[j]}
                    title={`${years[j]}: ${b ?? '—'}`}
                    className={cn(
                      'h-5 rounded-xs',
                      years[j] === year && 'outline-2 outline-offset-1 outline-foreground',
                    )}
                    style={{ background: b ? brandColor[b] : 'var(--muted)' }}
                  />
                ))}
              </ol>
            </div>
            <Link
              href={chosen.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'justify-self-start',
              )}
            >
              La ficha de {chosen.name} <Icon name="derecha" size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid content-start gap-6">{summary}</div>
        )}
      </Cell>
    </>
  );
}
