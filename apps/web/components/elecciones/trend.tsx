'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decimal, thousands } from '../../lib/elecciones/format';
import { Tips } from './tips';
import { useWidth } from './use-width';

export type TrendPoint = { id: string; href: string; year: string; long: string; time: number };
export type Unit = 'percent' | 'decimal' | 'millions' | 'seats';

const formats: Record<Unit, (v: number) => string> = {
  percent: (v) => `${decimal(v * 100, 1)}\u00a0%`,
  decimal: (v) => decimal(v, 1),
  millions: (v) => `${decimal(v / 1e6, 2)}\u00a0M`,
  seats: (v) => thousands(v),
};
const axis: Record<Unit, (v: number) => string> = {
  percent: (v) => `${Math.round(v * 100)}\u00a0%`,
  decimal: (v) => decimal(v, 1),
  millions: (v) => `${decimal(v / 1e6, 1)}\u00a0M`,
  seats: (v) => thousands(v),
};
const H = 200;

// Una métrica elección a elección: líneas (una o dos series) o, con `bars`, una barra por elección
// del color que se le dé. Pasar por encima enseña el valor; pulsar abre la ficha de la elección.
export function Trend({
  points,
  series,
  unit,
  ticks,
  bars,
  mark,
}: {
  points: TrendPoint[];
  series: { name: string; color: string; values: (number | null)[] }[];
  unit: Unit;
  ticks: number[];
  bars?: string[];
  mark?: number;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 360);
  const [hover, setHover] = useState<number | null>(null);
  const two = series.length > 1;
  const m = { l: 40, r: two ? 116 : 60, t: 18, b: 22 };
  const low = Math.min(...ticks);
  const high = Math.max(...ticks);
  const t0 = points[0]?.time ?? 0;
  const t1 = points.at(-1)?.time ?? 1;
  const slot = (W - m.l - m.r) / Math.max(1, points.length);
  const x = (j: number) =>
    bars
      ? m.l + slot * (j + 0.5)
      : m.l + (((points[j]?.time ?? 0) - t0) / (t1 - t0 || 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - low) / (high - low || 1)) * (H - m.t - m.b);
  const show = formats[unit];
  const last = points.length - 1;
  // Los años de abajo: los que caben sin pisarse, y siempre el último.
  const years: number[] = [];
  points.forEach((_, j) => {
    const prev = years.at(-1);
    if (prev === undefined || x(j) - x(prev) >= (bars ? 30 : 46)) years.push(j);
  });
  if (years.at(-1) !== last) {
    if (x(last) - x(years.at(-1) ?? 0) < (bars ? 30 : 46)) years.pop();
    years.push(last);
  }
  // Los valores que se rotulan: el máximo y el mínimo de la primera serie y el último de cada una
  // (a la derecha, separados para que no se pisen).
  const first = series[0]?.values ?? [];
  const known = first.flatMap((v, j) => (v === null ? [] : [[j, v] as const]));
  const max = known.reduce((a, b) => (b[1] > a[1] ? b : a), known[0] ?? [0, 0]);
  const min = known.reduce((a, b) => (b[1] < a[1] ? b : a), known[0] ?? [0, 0]);
  const ends = series
    .map((s) => ({ s, v: s.values[last] ?? null }))
    .flatMap(({ s, v }) => (v === null ? [] : [{ s, v, y: y(v) + 4 }]))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 15);
  const tip = (j: number) =>
    series
      .flatMap((s) => {
        const v = s.values[j];
        return v === null || v === undefined ? [] : [`${two ? `${s.name} ` : ''}${show(v)}`];
      })
      .join(' · ');

  return (
    <div ref={box}>
      <Tips>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${series.map((s) => s.name).join(' y ')}, de ${points[0]?.year} a ${points.at(-1)?.year}`}
          className="block h-auto w-full overflow-visible"
          onPointerLeave={() => setHover(null)}
        >
          <g className="fill-muted-foreground font-mono text-xs">
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={m.l}
                  x2={W - m.r + (two ? 0 : 8)}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-border"
                />
                <text x={m.l - 6} y={y(v) + 4} textAnchor="end">
                  {axis[unit](v)}
                </text>
              </g>
            ))}
            {years.map((j) => (
              <text key={j} x={x(j)} y={H - 4} textAnchor="middle">
                {bars ? `’${points[j]?.year.slice(2, 4)}` : points[j]?.year.slice(0, 4)}
              </text>
            ))}
          </g>
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={m.t}
              y2={H - m.b}
              className="stroke-muted-foreground"
              strokeDasharray="2 3"
            />
          )}
          {bars
            ? first.map((v, j) =>
                v === null ? null : (
                  <rect
                    key={points[j]?.id}
                    x={x(j) - slot * 0.35}
                    width={slot * 0.7}
                    y={y(v)}
                    height={Math.max(0, y(low) - y(v))}
                    rx={2}
                    fill={bars[j]}
                    opacity={hover === null || hover === j ? 1 : 0.6}
                  />
                ),
              )
            : series.map((s) => (
                <g key={s.name} style={{ color: s.color }}>
                  <path
                    d={s.values
                      .map((v, j) =>
                        v === null
                          ? ''
                          : `${j && s.values[j - 1] !== null ? 'L' : 'M'}${x(j)} ${y(v)}`,
                      )
                      .join('')}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                  />
                  {hover !== null && s.values[hover] !== null && s.values[hover] !== undefined && (
                    <circle cx={x(hover)} cy={y(s.values[hover]!)} r={3.5} fill="currentColor" />
                  )}
                </g>
              ))}
          {mark !== undefined && (
            <g className="text-foreground">
              <line
                x1={m.l}
                x2={W - m.r + 8}
                y1={y(mark)}
                y2={y(mark)}
                stroke="currentColor"
                strokeDasharray="4 3"
              />
            </g>
          )}
          {!bars && (
            <g className="fill-foreground font-mono text-xs">
              {known.length > 1 && (
                <>
                  <text x={x(max[0])} y={y(max[1]) - 7} textAnchor="middle">
                    {show(max[1])}
                  </text>
                  {/* El mínimo, si no está pegado al último; encima del punto si abajo no cabe. */}
                  {x(last) - x(min[0]) >= 48 && (
                    <text
                      x={x(min[0])}
                      y={y(min[1]) + 15 > H - m.b - 2 ? y(min[1]) - 7 : y(min[1]) + 15}
                      textAnchor="middle"
                    >
                      {show(min[1])}
                    </text>
                  )}
                </>
              )}
              {ends.map(({ s, v, y: ly }) => (
                <g key={s.name}>
                  <circle cx={x(last)} cy={y(v)} r={3.5} fill={s.color} />
                  <text x={x(last) + 8} y={ly} className="font-medium">
                    {two ? `${s.name} ` : ''}
                    {show(v)}
                  </text>
                </g>
              ))}
            </g>
          )}
          {/* Una franja por elección para pasar por encima y pulsar. */}
          {points.map((p, j) => {
            const left = j ? (x(j - 1) + x(j)) / 2 : m.l;
            const right = j < last ? (x(j) + x(j + 1)) / 2 : W - m.r;
            return (
              <rect
                key={p.id}
                x={left}
                y={m.t}
                width={Math.max(0, right - left)}
                height={H - m.t - m.b}
                fill="transparent"
                className="cursor-pointer"
                data-tip={p.long}
                data-tip-text={`${tip(j)}. Pulsa para abrir su ficha.`}
                onPointerEnter={() => setHover(j)}
                onClick={() => router.push(p.href)}
              />
            );
          })}
        </svg>
      </Tips>
    </div>
  );
}
