'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { Tips } from './tips';
import { useWidth } from './use-width';
import { decimal, longDate, toDay } from '../../lib/elecciones/format';

export type ChartParty = {
  id: string;
  name: string;
  color: string;
  // La media y su dispersión, un valor por día de `days`.
  m: (number | null)[];
  s: (number | null)[];
  result: number | null;
};
type Range = 'all' | 'year' | 'quarter';

const ranges: [Range, string, number][] = [
  ['all', 'Desde 2023', Infinity],
  ['year', 'Último año', 365],
  ['quarter', '90 días', 90],
];
const isRange = (v: unknown): v is Range => ranges.some(([r]) => r === v);
const month = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  month: 'short',
  year: '2-digit',
});
const percent = (n: number) => `${decimal(n)} %`;
const H = 380;

// «La media, día a día»: la media de cada partido con su sombra (± la dispersión), cada encuesta
// como un punto y, desde 2023, el resultado de entonces. El eje llega hasta el 29N.
export function PollChart({
  days,
  parties,
  polls,
  resultDate,
  dissolution,
  election,
}: {
  days: string[];
  parties: ChartParty[];
  polls: { fin: string; v: Record<string, number> }[];
  resultDate: string;
  dissolution: string;
  election: string;
}) {
  const [range, setRange] = useState<Range>('all');
  const [on, setOn] = useState(() => new Set(parties.map((p) => p.id)));
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 900);
  // Todo lo que no depende del puntero, calculado y pintado una vez por tamaño, rango y partidos:
  // al pasar por el gráfico solo se vuelve a pintar la marca del día.
  const { m, y, dayX, visible, ends, below, above } = useMemo(() => {
    const narrow = W < 640;
    const m = { l: 36, r: narrow ? 92 : 120, t: 24, b: 28 };

    const lastDay = days.length - 1;
    const span = ranges.find(([r]) => r === range)?.[2] ?? Infinity;
    const from = Math.max(0, lastDay - span);
    const t0 = toDay(range === 'all' ? resultDate : (days[from] ?? days[0] ?? election));
    const t1 = toDay(election);
    const x = (t: number) => m.l + ((t - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
    const visible = parties.filter((p) => on.has(p.id));
    const idx = Array.from({ length: lastDay - from + 1 }, (_, i) => from + i);
    let top = 5;
    for (const p of visible)
      for (const i of idx) top = Math.max(top, (p.m[i] ?? 0) + (p.s[i] ?? 0));
    top = Math.ceil((top + 2) / 5) * 5;
    const y = (v: number) => m.t + (1 - v / top) * (H - m.t - m.b);
    const step = top > 30 ? 10 : 5;
    const dayX = (i: number) => x(toDay(days[i] ?? election));

    // Las líneas (cortadas donde no hay media) y la sombra.
    const line = (p: ChartParty) =>
      idx
        .map((i, j) => {
          const v = p.m[i];
          if (v === null || v === undefined) return '';
          const prev = j ? p.m[i - 1] : null;
          return `${prev === null || prev === undefined ? 'M' : 'L'}${dayX(i).toFixed(1)} ${y(v).toFixed(1)}`;
        })
        .join('');
    const band = (p: ChartParty) => {
      const pts = idx.filter((i) => p.m[i] !== null && p.s[i] !== null);
      if (!pts.length) return '';
      const up = pts.map(
        (i) => `${dayX(i).toFixed(1)} ${y((p.m[i] ?? 0) + (p.s[i] ?? 0)).toFixed(1)}`,
      );
      const down = pts
        .reverse()
        .map(
          (i) =>
            `${dayX(i).toFixed(1)} ${y(Math.max(0, (p.m[i] ?? 0) - (p.s[i] ?? 0))).toFixed(1)}`,
        );
      return `M${up.join('L')}L${down.join('L')}Z`;
    };
    // Los rótulos del final, sin pisarse.
    const ends = visible
      .flatMap((p) => {
        let i = lastDay;
        while (i > 0 && p.m[i] === null) i--;
        const v = p.m[i];
        return v === null || v === undefined ? [] : [{ p, v, y: y(v) + 4 }];
      })
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 15);
    for (let i = ends.length - 2; i >= 0; i--)
      ends[i]!.y = Math.min(ends[i]!.y, ends[i + 1]!.y - 15);
    // Los meses del eje.
    const every = range === 'all' ? 6 : range === 'year' ? 2 : 1;
    const ticks: number[] = [];
    const start = new Date(t0 * 864e5);
    for (
      let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      d.getTime() / 864e5 <= t1;
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + every, 1))
    )
      ticks.push(d.getTime() / 864e5);
    const today = dayX(lastDay);
    const below = (
      <>
        <g className="fill-muted-foreground font-mono text-xs">
          {Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="stroke-border" />
              <text x={m.l - 6} y={y(v) + 4} textAnchor="end">
                {v} %
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={H - 6} textAnchor="middle">
              {month.format(new Date(t * 864e5))}
            </text>
          ))}
        </g>
        {[
          [dissolution, 'Disolución'],
          [election, '29N'],
        ].map(([d = '', text]) => (
          <g key={text} className="text-muted-foreground">
            <line
              x1={x(toDay(d))}
              x2={x(toDay(d))}
              y1={m.t - 10}
              y2={H - m.b}
              stroke="currentColor"
              strokeDasharray="3 3"
            />
            <text
              x={x(toDay(d)) - 4}
              y={m.t - 12}
              textAnchor="end"
              className="fill-foreground text-xs"
            >
              {text}
            </text>
          </g>
        ))}
        {visible.map((p) => (
          <path key={`b-${p.id}`} d={band(p)} fill={p.color} opacity={0.14} />
        ))}
        {visible.map((p) => (
          <g key={`d-${p.id}`} fill={p.color} opacity={0.32}>
            {polls.map((poll, i) => {
              const v = poll.v[p.id];
              const t = toDay(poll.fin);
              if (v === undefined || t < t0) return null;
              return <circle key={i} cx={x(t)} cy={y(v)} r={2.2} />;
            })}
          </g>
        ))}
        {range === 'all' &&
          visible.map((p) =>
            p.result === null ? null : (
              <rect
                key={`r-${p.id}`}
                x={x(toDay(resultDate)) - 4}
                y={y(p.result) - 4}
                width={8}
                height={8}
                fill={p.color}
                transform={`rotate(45 ${x(toDay(resultDate))} ${y(p.result)})`}
              />
            ),
          )}
        {visible.map((p) => (
          <path
            key={`l-${p.id}`}
            d={line(p)}
            fill="none"
            stroke={p.color}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        ))}
      </>
    );
    const above = (
      <>
        <g className="font-mono text-xs font-medium">
          {ends.map(({ p, v, y: ly }) => (
            <text key={p.id} x={today + 8} y={ly} fill={p.color}>
              {p.name} {percent(v)}
            </text>
          ))}
        </g>
        {/* Una franja por día para pasar por encima. */}
        {idx.map((i) => (
          <rect
            key={i}
            x={dayX(i) - (dayX(i) - dayX(Math.max(from, i - 1))) / 2}
            y={m.t}
            width={Math.max(1, (dayX(Math.min(lastDay, i + 1)) - dayX(Math.max(from, i - 1))) / 2)}
            height={H - m.t - m.b}
            fill="transparent"
            data-tip={longDate(days[i] ?? election)}
            data-tip-text={visible
              .flatMap((p) => {
                const v = p.m[i];
                return v === null || v === undefined ? [] : [[p.name, v] as const];
              })
              .sort((a, b) => b[1] - a[1])
              .map(([n, v]) => `${n} ${percent(v)}`)
              .join(' · ')}
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </>
    );
    return { m, y, dayX, visible, ends, below, above };
  }, [W, days, parties, polls, on, range, resultDate, dissolution, election]);
  const toggle = (id: string) =>
    setOn((s) => {
      const next = new Set(s);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={range} onValueChange={(v) => isRange(v) && setRange(v)}>
          <TabsList aria-label="Desde cuándo">
            {ranges.map(([r, text]) => (
              <TabsTrigger key={r} value={r} className="px-3">
                {text}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Partidos">
          {parties.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={on.has(p.id) ? 'outline' : 'ghost'}
              aria-pressed={on.has(p.id)}
              onClick={() => toggle(p.id)}
              className={on.has(p.id) ? '' : 'text-muted-foreground'}
            >
              <i
                className="block size-2 rounded-full"
                style={{ background: on.has(p.id) ? p.color : 'var(--muted-foreground)' }}
              />
              {p.name}
            </Button>
          ))}
        </div>
      </div>
      <div ref={box}>
        <Tips>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Media de las encuestas: ${ends.map((e) => `${e.p.name} ${percent(e.v)}`).join(', ')}`}
            className="block h-auto w-full overflow-visible"
            onPointerLeave={() => setHover(null)}
          >
            {below}
            {hover !== null && (
              <g>
                <line
                  x1={dayX(hover)}
                  x2={dayX(hover)}
                  y1={m.t}
                  y2={H - m.b}
                  className="stroke-foreground"
                  strokeDasharray="2 3"
                />
                {visible.map((p) => {
                  const v = p.m[hover];
                  return v === null || v === undefined ? null : (
                    <circle key={p.id} cx={dayX(hover)} cy={y(v)} r={3.5} fill={p.color} />
                  );
                })}
              </g>
            )}
            {above}
          </svg>
        </Tips>
      </div>
    </div>
  );
}
