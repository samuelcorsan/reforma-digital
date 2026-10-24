'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button, buttonVariants } from '@reforma-digital/design/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { Icon } from '../brand/icon';
import { Cell, Label } from './report';
import { Tips } from './tips';
import { useWidth } from './use-width';
import { decimal, longDate, toDay } from '../../lib/elecciones/format';

// «Prueba una suma de escaños»: se eligen partidos y se ve si llegan a 176. Una suma no es un
// acuerdo.
export function SeatSum({
  parties,
}: {
  parties: { id: string; name: string; color: string; seats: number }[];
}) {
  const [on, setOn] = useState<string[]>([]);
  const total = parties.filter((p) => on.includes(p.id)).reduce((t, p) => t + p.seats, 0);
  return (
    <Cell>
      <div className="grid gap-1">
        <h3 className="m-0 text-base font-medium">Prueba una suma de escaños</h3>
        <p className="m-0 text-sm text-muted-foreground">
          Elige partidos. Que los números sumen no quiere decir que haya un acuerdo.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Partidos">
        {parties.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={on.includes(p.id) ? 'default' : 'outline'}
            aria-pressed={on.includes(p.id)}
            onClick={() =>
              setOn((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
            }
          >
            <i className="block size-2 rounded-full" style={{ background: p.color }} />
            {p.name} {p.seats}
          </Button>
        ))}
      </div>
      <div className="relative flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {parties
          .filter((p) => on.includes(p.id))
          .map((p) => (
            <i
              key={p.id}
              className="block h-full"
              style={{ width: `${(p.seats / 350) * 100}%`, background: p.color }}
            />
          ))}
        <i
          className="absolute -inset-y-1 block w-px border-l border-dashed border-foreground"
          style={{ left: `${(176 / 350) * 100}%` }}
        />
      </div>
      <p className="m-0" aria-live="polite">
        <b className="font-medium">
          {total} {total === 1 ? 'escaño' : 'escaños'}
        </b>{' '}
        ·{' '}
        {total >= 176
          ? 'superan la mayoría absoluta de 176'
          : `faltan ${176 - total} para la mayoría absoluta`}
      </p>
    </Cell>
  );
}

// «¿Llegan a 176?»: cuántas simulaciones acaban con cada número de escaños del bloque elegido.
export function Majority({
  blocs,
}: {
  blocs: { name: string; parties: string; color: string; hist: number[]; p176: number }[];
}) {
  const [chosen, setChosen] = useState(blocs[0]?.name ?? '');
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 900);
  const H = 240;
  const m = { l: 40, r: 12, t: 28, b: 26 };
  const b = blocs.find((x) => x.name === chosen) ?? blocs[0];
  if (!b) return null;
  const used = b.hist.flatMap((v, i) => (v > 0.0005 ? [i] : []));
  const lo = Math.max(0, Math.min(176, ...used) - 8);
  const hi = Math.min(350, Math.max(176, ...used) + 8);
  const top = Math.max(...b.hist, 0.01);
  const slot = (W - m.l - m.r) / (hi - lo + 1);
  const x = (n: number) => m.l + (n - lo) * slot;
  const y = (v: number) => m.t + (1 - v / top) * (H - m.t - m.b);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((n) => n % 10 === 0);
  return (
    <div className="grid gap-4">
      <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tabs value={chosen} onValueChange={(v) => typeof v === 'string' && setChosen(v)}>
          <TabsList aria-label="Bloque">
            {blocs.map((x) => (
              <TabsTrigger key={x.name} value={x.name} className="px-3">
                {x.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{b.parties}.</p>
      <div ref={box}>
        <Tips>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${b.name}: mayoría absoluta en el ${Math.round(b.p176 * 100)} % de las simulaciones`}
            className="block h-auto w-full overflow-visible"
          >
            <g className="fill-muted-foreground font-mono text-xs">
              {ticks.map((n) => (
                <text key={n} x={x(n) + slot / 2} y={H - 6} textAnchor="middle">
                  {n}
                </text>
              ))}
            </g>
            {b.hist.map((v, n) =>
              n < lo || n > hi || v <= 0 ? null : (
                <rect
                  key={n}
                  x={x(n) + slot * 0.1}
                  width={Math.max(1, slot * 0.8)}
                  y={y(v)}
                  height={y(0) - y(v)}
                  fill={b.color}
                  opacity={n >= 176 ? 1 : 0.45}
                  data-tip={`${n} escaños`}
                  data-tip-text={`En el ${decimal(v * 100)} % de las simulaciones.`}
                  data-tip-color={b.color}
                />
              ),
            )}
            <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} className="stroke-border" />
            <g className="text-foreground">
              <line
                x1={x(176)}
                x2={x(176)}
                y1={m.t - 12}
                y2={H - m.b}
                stroke="currentColor"
                strokeDasharray="4 3"
              />
              <text
                x={x(176) + 6}
                y={m.t - 4}
                className="fill-foreground font-mono text-sm font-medium"
              >
                176 · mayoría:{' '}
                {b.p176 >= 0.995 ? '> 99' : b.p176 <= 0.005 ? '< 1' : Math.round(b.p176 * 100)} %
              </text>
            </g>
          </svg>
        </Tips>
      </div>
    </div>
  );
}

// «Semana a semana»: la proyección más probable con la media de cada semana desde 2023.
export function SeatSeries({
  weeks,
  lines,
  election,
}: {
  weeks: [string, Record<string, number>][];
  lines: { id: string; name: string; color: string }[];
  election: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 900);
  const [hover, setHover] = useState<number | null>(null);
  const narrow = W < 640;
  const H = 320;
  const m = { l: 40, r: narrow ? 92 : 120, t: 16, b: 26 };
  const t0 = toDay(weeks[0]?.[0] ?? election);
  const t1 = toDay(election);
  const x = (iso: string) => m.l + ((toDay(iso) - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - v / 240) * (H - m.t - m.b);
  const all = [...lines, { id: 'PP+VOX', name: 'PP + Vox', color: 'var(--foreground)' }];
  const value = (w: Record<string, number>, id: string) =>
    id === 'PP+VOX' ? (w.PP ?? 0) + (w.VOX ?? 0) : (w[id] ?? 0);
  const last = weeks.at(-1);
  const ends = all
    .map((l) => ({ l, y: y(last ? value(last[1], l.id) : 0) + 4 }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 15);
  const years: string[] = [];
  for (let yr = Number(weeks[0]?.[0].slice(0, 4)) + 1; `${yr}-01-01` <= election; yr++)
    years.push(`${yr}-01-01`);
  return (
    <div ref={box}>
      <Tips>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Escaños proyectados semana a semana: ${ends.map(({ l }) => `${l.name} ${last ? value(last[1], l.id) : 0}`).join(', ')}`}
          className="block h-auto w-full overflow-visible"
          onPointerLeave={() => setHover(null)}
        >
          <g className="fill-muted-foreground font-mono text-xs">
            {[0, 50, 100, 150, 200].map((v) => (
              <g key={v}>
                <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="stroke-border" />
                <text x={m.l - 6} y={y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {years.map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle">
                {d.slice(0, 4)}
              </text>
            ))}
          </g>
          <g className="text-foreground">
            <line
              x1={m.l}
              x2={W - m.r}
              y1={y(176)}
              y2={y(176)}
              stroke="currentColor"
              strokeDasharray="4 3"
            />
            <text
              x={m.l - 6}
              y={y(176) + 4}
              textAnchor="end"
              className="fill-foreground font-mono text-xs"
            >
              176
            </text>
          </g>
          {all.map((l) => (
            <path
              key={l.id}
              d={weeks
                .map(
                  ([d, w], i) =>
                    `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(value(w, l.id)).toFixed(1)}`,
                )
                .join('')}
              fill="none"
              stroke={l.color}
              strokeWidth={l.id === 'PP+VOX' ? 1.5 : 2.2}
              strokeDasharray={l.id === 'PP+VOX' ? '5 4' : undefined}
              strokeLinejoin="round"
            />
          ))}
          {hover !== null && weeks[hover] && (
            <line
              x1={x(weeks[hover][0])}
              x2={x(weeks[hover][0])}
              y1={m.t}
              y2={H - m.b}
              className="stroke-foreground"
              strokeDasharray="2 3"
            />
          )}
          {last &&
            ends.map(({ l, y: ly }) => (
              <text
                key={l.id}
                x={x(last[0]) + 8}
                y={ly}
                fill={l.color}
                className="font-mono text-xs font-medium"
              >
                {l.name} {value(last[1], l.id)}
              </text>
            ))}
          {weeks.map(([d, w], i) => {
            const left = i ? (x(weeks[i - 1]?.[0] ?? d) + x(d)) / 2 : m.l;
            const right = i < weeks.length - 1 ? (x(d) + x(weeks[i + 1]?.[0] ?? d)) / 2 : x(d) + 4;
            return (
              <rect
                key={d}
                x={left}
                y={m.t}
                width={Math.max(1, right - left)}
                height={H - m.t - m.b}
                fill="transparent"
                data-tip={`Semana del ${longDate(d)}`}
                data-tip-text={all.map((l) => `${l.name} ${value(w, l.id)}`).join(' · ')}
                onPointerEnter={() => setHover(i)}
              />
            );
          })}
        </svg>
      </Tips>
    </div>
  );
}

type ProjectedProvince = {
  code: string;
  name: string;
  href: string;
  seats: [string, number][];
  votes: [string, number][];
  last: { gana: string; segundo: string; falta: number } | null;
};

// «Provincia a provincia»: el mapa llega pintado del servidor; aquí se elige una provincia y se
// cuenta su reparto; si no hay ninguna, los escaños que están en el aire.
export function ProjectionMap({
  provinces,
  parties,
  map,
}: {
  provinces: ProjectedProvince[];
  parties: Record<string, { name: string; color: string }>;
  map: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const name = (id: string) => parties[id]?.name ?? id;
  const color = (id: string) => parties[id]?.color ?? '#8A8F98';
  const chosen = provinces.find((p) => p.code === selected);
  const close = provinces
    .filter((p) => p.last && p.last.falta < 0.5)
    .sort((a, b) => (a.last?.falta ?? 0) - (b.last?.falta ?? 0));
  useEffect(() => {
    for (const path of box.current?.querySelectorAll('[data-province]') ?? [])
      path.toggleAttribute('data-selected', path.getAttribute('data-province') === selected);
  }, [selected]);
  const pick = (code: string | null) => setSelected(code === selected ? null : code);
  return (
    <>
      <Cell span={7}>
        <div
          ref={box}
          className="[&_[data-selected]]:stroke-brand [&_[data-selected]]:[stroke-dasharray:none] [&_[data-selected]]:[stroke-width:2.5]"
          onClick={(event) =>
            event.target instanceof Element &&
            pick(event.target.closest('[data-province]')?.getAttribute('data-province') ?? null)
          }
        >
          <Tips>{map}</Tips>
        </div>
      </Cell>
      <Cell span={5} className="content-start">
        {chosen ? (
          <div className="grid gap-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <Label>{chosen.seats.reduce((t, [, n]) => t + n, 0)} escaños · proyección</Label>
                <h3 className="m-0 font-heading text-[28px] leading-tight font-normal">
                  {chosen.name}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Volver a los escaños en el aire"
                onClick={() => setSelected(null)}
              >
                <span className="rotate-45">
                  <Icon name="mas" size={18} />
                </span>
              </Button>
            </div>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
              {chosen.votes.map(([id, v]) => {
                const n = chosen.seats.find(([p]) => p === id)?.[1] ?? 0;
                return (
                  <li
                    key={id}
                    className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_3.5rem] items-center gap-2"
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <i
                        className="block size-2.5 shrink-0 rounded-full"
                        style={{ background: color(id) }}
                      />
                      {name(id)}
                    </span>
                    <span className="flex flex-wrap gap-0.5">
                      {Array.from({ length: n }, (_, i) => (
                        <i
                          key={i}
                          className="block size-3 rounded-xs"
                          style={{ background: color(id) }}
                        />
                      ))}
                      {!n && <span className="text-muted-foreground">sin escaño</span>}
                    </span>
                    <span className="text-right font-mono text-muted-foreground tabular-nums">
                      {decimal(v)} %
                    </span>
                  </li>
                );
              })}
            </ul>
            {chosen.last && (
              <p className="m-0 text-sm text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
                El último escaño sería para <b>{name(chosen.last.gana)}</b>; a{' '}
                {name(chosen.last.segundo)} le faltarían {decimal(chosen.last.falta)} puntos.
              </p>
            )}
            <Link
              href={chosen.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'justify-self-start',
              )}
            >
              Su historia <Icon name="derecha" size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Escaños en el aire</Label>
            <p className="m-0 text-sm text-muted-foreground">
              Donde al segundo le falta menos de medio punto para quitarle el último escaño al
              primero.
            </p>
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {close.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    onClick={() => pick(p.code)}
                    className="flex min-h-9 w-full flex-wrap items-center justify-between gap-x-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <b className="font-medium">{p.name}</b>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-mono tabular-nums">
                        {decimal(p.last?.falta ?? 0)} pt
                      </span>
                      ·
                      <i
                        className="block size-2 rounded-full"
                        style={{ background: color(p.last?.gana ?? '') }}
                      />
                      {name(p.last?.gana ?? '')} →
                      <i
                        className="block size-2 rounded-full"
                        style={{ background: color(p.last?.segundo ?? '') }}
                      />
                      {name(p.last?.segundo ?? '')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Cell>
    </>
  );
}
