'use client';

import { useMemo, useRef, useState } from 'react';
import { Tips } from './tips';
import { useWidth } from './use-width';
import { longDate, toDay } from '../../lib/elecciones/format';

const month = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'short' });
const H = 260;

// La probabilidad de cada opción día a día (0-100 %), con la disolución marcada.
export function OddsChart({
  series,
  dissolution,
}: {
  series: { name: string; color: string; history: [string, number][] }[];
  dissolution: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 600);
  const [hover, setHover] = useState<string | null>(null);
  // Todo lo que no depende del puntero, calculado y pintado una vez por tamaño: al pasar por el
  // gráfico solo se vuelve a pintar la marca del día.
  const { m, x, y, ends, near, below, above } = useMemo(() => {
    const m = { l: 40, r: 110, t: 20, b: 26 };
    const dates = [...new Set(series.flatMap((s) => s.history.map(([d]) => d)))].sort();
    const t0 = toDay(dates[0] ?? dissolution);
    const t1 = Math.max(toDay(dates.at(-1) ?? dissolution), t0 + 1);
    const x = (iso: string) => m.l + ((toDay(iso) - t0) / (t1 - t0)) * (W - m.l - m.r);
    const y = (p: number) => m.t + (1 - p) * (H - m.t - m.b);
    const short = (n: string) => (n.length > 14 ? (n.split(' ').at(-1) ?? n) : n);
    const ends = series
      .map((s) => {
        const p = s.history.at(-1)?.[1] ?? 0;
        return { s, p, y: y(p) + 4 };
      })
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 15);
    // Los meses: como mucho seis rótulos.
    const months: string[] = [];
    const [y0 = 0, m0 = 1] = (dates[0] ?? dissolution).split('-').map(Number);
    for (
      let d = new Date(Date.UTC(y0, m0, 1));
      d.toISOString().slice(0, 10) <= (dates.at(-1) ?? '');
      d.setUTCMonth(d.getUTCMonth() + 1)
    )
      months.push(d.toISOString().slice(0, 10));
    const every = Math.ceil(months.length / 6);
    // El valor de cada serie el día más cercano.
    const near = (s: (typeof series)[number], iso: string) =>
      s.history.reduce((best, p) =>
        Math.abs(toDay(p[0]) - toDay(iso)) < Math.abs(toDay(best[0]) - toDay(iso)) ? p : best,
      );

    const below = (
      <>
        <g className="fill-muted-foreground font-mono text-xs">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={m.l} x2={W - m.r} y1={y(p)} y2={y(p)} className="stroke-border" />
              <text x={m.l - 6} y={y(p) + 4} textAnchor="end">
                {p * 100} %
              </text>
            </g>
          ))}
          {months
            .filter((_, i) => i % every === 0)
            .map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle">
                {month.format(new Date(`${d}T00:00:00Z`))}
              </text>
            ))}
        </g>
        {dissolution > (dates[0] ?? '') && dissolution <= (dates.at(-1) ?? '') && (
          <g className="text-muted-foreground">
            <line
              x1={x(dissolution)}
              x2={x(dissolution)}
              y1={m.t}
              y2={H - m.b}
              stroke="currentColor"
              strokeDasharray="3 3"
            />
            <text
              x={x(dissolution) - 4}
              y={m.t + 12}
              textAnchor="end"
              className="fill-foreground text-xs"
            >
              Disolución
            </text>
          </g>
        )}
        {series.map((s) => (
          <path
            key={s.name}
            d={s.history
              .map(([d, p], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(p).toFixed(1)}`)
              .join('')}
            fill="none"
            stroke={s.color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        ))}
      </>
    );
    const above = (
      <>
        <g className="font-mono text-xs font-medium">
          {ends.map(({ s, p, y: ly }) => (
            <text key={s.name} x={W - m.r + 8} y={ly} fill={s.color}>
              {short(s.name)} {Math.round(p * 100)} %
            </text>
          ))}
        </g>
        {dates.map((d, i) => {
          const left = i ? (x(dates[i - 1] ?? d) + x(d)) / 2 : m.l;
          const right = i < dates.length - 1 ? (x(d) + x(dates[i + 1] ?? d)) / 2 : W - m.r;
          return (
            <rect
              key={d}
              x={left}
              y={m.t}
              width={Math.max(1, right - left)}
              height={H - m.t - m.b}
              fill="transparent"
              data-tip={longDate(d)}
              data-tip-text={series
                .map((s) => {
                  const p = s.history.find(([day]) => day === d)?.[1] ?? near(s, d)[1];
                  return `${s.name} ${Math.round(p * 100)} %`;
                })
                .join(' · ')}
              onPointerEnter={() => setHover(d)}
            />
          );
        })}
      </>
    );
    return { m, x, y, ends, near, below, above };
  }, [W, series, dissolution]);
  if (!series.length)
    return <p className="m-0 text-sm text-muted-foreground">Aún no hay historia.</p>;

  return (
    <div ref={box}>
      <Tips>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Probabilidad de cada opción, día a día: ${ends.map((e) => `${e.s.name} ${Math.round(e.p * 100)} %`).join(', ')}`}
          className="block h-auto w-full overflow-visible"
          onPointerLeave={() => setHover(null)}
        >
          {below}
          {hover && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={m.t}
                y2={H - m.b}
                className="stroke-foreground"
                strokeDasharray="2 3"
              />
              {series.map((s) => {
                const [d, p] = near(s, hover);
                return <circle key={s.name} cx={x(d)} cy={y(p)} r={3.5} fill={s.color} />;
              })}
            </g>
          )}
          {above}
        </svg>
      </Tips>
    </div>
  );
}
