'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@reforma-digital/design/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { decimal, ink, time } from '../../lib/elecciones/format';
import { useFirstSight } from './first-sight';
import { Legend } from './report';
import { Tips } from './tips';
import { useWidth } from './use-width';

export type RiverElection = {
  id: string;
  href: string;
  short: string;
  long: string;
  start: string;
  end: string;
  valid: number;
  // Votos y escaños de cada familia; `names`, su candidatura más votada en esa elección.
  fam: Record<string, [number, number]>;
  names: Record<string, string>;
};

// «Los 350 escaños, legislatura a legislatura»: cada legislatura, una columna tan ancha como duró,
// con las familias apiladas (escaños o votos). Pulsar una la elige para toda la página.
export function River({
  elections: E,
  families,
  selected,
  milestones,
}: {
  elections: RiverElection[];
  families: { id: string; color: string }[];
  selected: number;
  milestones: { index: number; text: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'seats' | 'votes'>('seats');
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 900);
  const narrow = W < 640;
  const H = narrow ? 290 : 350;
  const m = { l: 34, r: narrow ? 90 : 140, t: narrow ? 30 : 58, b: 24 };
  const seen = useFirstSight(() => setDrawn(true), 0.3);

  const t0 = time(E[0]?.start ?? '1977-06-15');
  const t1 = time(E.at(-1)?.end ?? '2026-10-06');
  const xs = [...E.map((e) => e.start), E.at(-1)?.end ?? ''].map(
    (t) => m.l + ((time(t) - t0) / (t1 - t0)) * (W - m.l - m.r),
  );
  const top = mode === 'seats' ? 350 : 100;
  const y = (v: number) => m.t + (1 - v / top) * (H - m.t - m.b);
  const value = (j: number, f: string) => {
    const x = E[j]?.fam[f];
    if (!x) return 0;
    return mode === 'seats' ? x[1] : (x[0] / (E[j]?.valid || 1)) * 100;
  };
  const show = (v: number) => (mode === 'seats' ? String(v) : `${decimal(v)} %`);
  // La geometría de cada rectángulo: de abajo arriba, en el orden de las familias.
  const geo: Record<string, { y: number; h: number }> = {};
  E.forEach((_, j) => {
    let base = 0;
    for (const f of families) {
      const v = value(j, f.id);
      geo[`${j}|${f.id}`] = { y: y(base + v), h: y(base) - y(base + v) };
      base += v;
    }
  });
  const color = Object.fromEntries(families.map((f) => [f.id, f.color]));

  // Dentro de las bandas, cada tramo de una misma candidatura rotulado en su hueco más holgado (una
  // legislatura o hasta tres seguidas a la misma altura)… si cabe.
  const inside: { x: number; y: number; text: string; color: string }[] = [];
  for (const f of families) {
    let j = 0;
    while (j < E.length) {
      const text = E[j]?.names[f.id] ?? '';
      let end = j;
      while (end + 1 < E.length && E[end + 1]?.names[f.id] === text && value(end + 1, f.id) > 0)
        end++;
      if (value(j, f.id) > 0) {
        const need = text.length * 7.4 + 10;
        let best: { x: number; y: number; score: number } | null = null;
        for (let q = j; q <= end; q++)
          for (let L = 1; L <= 3 && q + L - 1 <= end; L++) {
            const gs = Array.from({ length: L }, (_, i) => geo[`${q + i}|${f.id}`]!);
            const w = (xs[q + L] ?? 0) - (xs[q] ?? 0);
            const hMin = Math.min(...gs.map((g) => g.h));
            const cy = gs.reduce((t, g) => t + g.y + g.h / 2, 0) / L;
            const level = gs.every((g) => Math.abs(g.y + g.h / 2 - cy) < g.h / 2 - 7);
            const score = hMin * Math.min(w, 120);
            if (hMin >= 18 && w >= need && level && (!best || score > best.score))
              best = { x: ((xs[q] ?? 0) + (xs[q + L] ?? 0)) / 2, y: cy, score };
          }
        if (best) inside.push({ x: best.x, y: best.y, text, color: color[f.id] ?? '#8A8F98' });
      }
      j = end + 1;
    }
  }
  // A la derecha, la última legislatura: nombre y valor de cada familia, sin pisarse.
  const last = E.length - 1;
  const right = families
    .filter((f) => value(last, f.id) > 0 && (mode === 'seats' || value(last, f.id) >= 1))
    .map((f) => ({
      id: f.id,
      y: (geo[`${last}|${f.id}`]?.y ?? 0) + (geo[`${last}|${f.id}`]?.h ?? 0) / 2 + 4,
      text: `${E[last]?.names[f.id]} ${show(value(last, f.id))}`,
      color: f.color,
    }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < right.length; i++) right[i]!.y = Math.max(right[i]!.y, right[i - 1]!.y + 15);
  for (let i = right.length - 2; i >= 0; i--)
    right[i]!.y = Math.min(right[i]!.y, right[i + 1]!.y - 15);
  // Los años de abajo: el primero, el último y los que caben entre medias.
  const years: number[] = [];
  E.forEach((_, j) => {
    const prev = years.at(-1);
    if (j === last || prev === undefined || (xs[j] ?? 0) - (xs[prev] ?? 0) >= 44) years.push(j);
  });
  if (years.length > 1 && (xs[last] ?? 0) - (xs[years.at(-2) ?? 0] ?? 0) < 44)
    years.splice(years.length - 2, 1);
  const centre = (j: number) => ((xs[j] ?? 0) + (xs[j + 1] ?? 0)) / 2;
  const tipText = (j: number) =>
    families
      .filter((f) => value(j, f.id) >= (mode === 'seats' ? 1 : 0.5))
      .sort((a, b) => value(j, b.id) - value(j, a.id))
      .map((f) => `${E[j]?.names[f.id]} ${show(value(j, f.id))}`)
      .join(' · ');
  const legend = new Map<string, string[]>();
  for (const e of E)
    for (const f of families) {
      if (!e.fam[f.id]?.[1]) continue;
      const names = legend.get(f.color) ?? [];
      const n = e.names[f.id] ?? '';
      if (!names.includes(n)) legend.set(f.color, [...names, n]);
    }

  return (
    <div ref={seen} className="grid gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v === 'votes' ? 'votes' : 'seats')}>
        <TabsList aria-label="Qué se apila">
          <TabsTrigger value="seats" className="px-3">
            Escaños
          </TabsTrigger>
          <TabsTrigger value="votes" className="px-3">
            Votos
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div ref={box}>
        <Tips>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${mode === 'seats' ? 'Escaños' : 'Votos'} de cada familia en cada legislatura desde ${E[0]?.short}`}
            className="block h-auto w-full overflow-visible"
            onPointerLeave={() => setHover(null)}
          >
            <g className="fill-muted-foreground font-mono text-xs">
              {(mode === 'seats' ? [0, 100, 250, 350] : [0, 25, 50, 75, 100]).map((v) => (
                <g key={v}>
                  <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="stroke-border" />
                  <text x={m.l - 6} y={y(v) + 4} textAnchor="end">
                    {mode === 'seats' ? v : `${v} %`}
                  </text>
                </g>
              ))}
            </g>
            {milestones.map(({ index, text }, i) => {
              const x = (xs[index] ?? 0) + 1;
              const yy = 12 + (i % (narrow ? 2 : 3)) * 15;
              return (
                <g
                  key={text}
                  className="text-muted-foreground"
                  data-tip={E[index]?.long}
                  data-tip-text={text}
                >
                  <line x1={x} x2={x} y1={yy + 3} y2={m.t} stroke="currentColor" />
                  <circle cx={x} cy={yy} r={3} fill="currentColor" />
                  {!narrow && (
                    <text x={x + 6} y={yy + 4} className="fill-foreground text-xs">
                      {text}
                    </text>
                  )}
                </g>
              );
            })}
            <g
              className="origin-left transition-transform duration-[1400ms] ease-out motion-reduce:transition-none"
              style={{ transform: drawn ? 'scaleX(1)' : 'scaleX(0)' }}
            >
              {E.map((e, j) =>
                families.map((f) => {
                  const g = geo[`${j}|${f.id}`];
                  if (!e.fam[f.id] || !g) return null;
                  return (
                    <rect
                      key={`${j}-${f.id}`}
                      x={xs[j]}
                      width={Math.max(0, (xs[j + 1] ?? 0) - (xs[j] ?? 0))}
                      fill={f.color}
                      className={cn(
                        'transition-opacity duration-500',
                        j !== selected && j !== hover && 'opacity-60',
                      )}
                      style={{ y: g.y, height: Math.max(0, g.h) }}
                    />
                  );
                }),
              )}
              {inside.map((l) => (
                <text
                  key={`${l.text}-${l.x}`}
                  x={l.x}
                  y={l.y + 4}
                  textAnchor="middle"
                  fill={ink(l.color)}
                  className="pointer-events-none text-xs font-medium"
                >
                  {l.text}
                </text>
              ))}
            </g>
            {mode === 'seats' && (
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
            )}
            <rect
              x={xs[selected]}
              y={m.t}
              width={(xs[selected + 1] ?? 0) - (xs[selected] ?? 0)}
              height={H - m.t - m.b}
              rx={2}
              fill="none"
              className="pointer-events-none stroke-foreground"
              strokeWidth={1.5}
            />
            {right.map((r) => (
              <g key={r.id}>
                <circle cx={W - m.r + 10} cy={r.y - 4} r={3.5} fill={r.color} />
                <text x={W - m.r + 18} y={r.y} className="fill-foreground text-xs">
                  {r.text}
                </text>
              </g>
            ))}
            <g className="fill-muted-foreground font-mono text-xs">
              {years
                .filter((j) => Math.abs((xs[j] ?? 0) - centre(selected)) >= 34)
                .map((j) => (
                  <text key={j} x={xs[j]} y={H - 6} textAnchor={j === 0 ? 'start' : 'middle'}>
                    {E[j]?.start.slice(0, 4)}
                  </text>
                ))}
              <text
                x={centre(selected)}
                y={H - 6}
                textAnchor="middle"
                className="fill-foreground font-medium"
              >
                {E[selected]?.short}
              </text>
            </g>
            {/* Una franja por legislatura para pasar por encima y pulsar. */}
            {E.map((e, j) => (
              <rect
                key={e.id}
                x={xs[j]}
                y={m.t}
                width={Math.max(0, (xs[j + 1] ?? 0) - (xs[j] ?? 0))}
                height={H - m.t - m.b}
                fill="transparent"
                className="cursor-pointer"
                data-tip={e.long}
                data-tip-text={`${tipText(j)}. Pulsa para verla en toda la página.`}
                onPointerEnter={() => setHover(j)}
                onClick={() => router.push(e.href, { scroll: false })}
              />
            ))}
          </svg>
        </Tips>
      </div>
      <Legend
        small
        items={[...legend].map(([c, names]) => ({ label: names.join(' · '), color: c }))}
      />
    </div>
  );
}
