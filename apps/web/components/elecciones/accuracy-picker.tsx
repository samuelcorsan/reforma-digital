'use client';

import { useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Cell, Grid, SectionHeading } from './report';
import { Tips } from './tips';
import { useWidth } from './use-width';
import { decimal, signed } from '../../lib/elecciones/format';

export type AccuracyElection = {
  id: string;
  name: string;
  error: number;
  parties: {
    id: string;
    name: string;
    color: string;
    result: number;
    average: number;
    polls: { firm: string; value: number }[];
  }[];
};

const worst = (e: AccuracyElection) =>
  [...e.parties].sort((a, b) => Math.abs(b.average - b.result) - Math.abs(a.average - a.result))[0];

// Las cinco elecciones, a elegir; para la elegida, cada partido con la media de las encuestas
// (círculo hueco), lo que votó la gente (lleno) y la última encuesta de cada empresa (puntos).
export function AccuracyPicker({ elections }: { elections: AccuracyElection[] }) {
  const [chosen, setChosen] = useState(elections[0]?.id ?? '');
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 900);
  const e = elections.find((x) => x.id === chosen) ?? elections[0];
  if (!e) return null;
  const miss = worst(e);
  const d = miss ? miss.average - miss.result : 0;
  const top =
    Math.ceil(
      Math.max(...e.parties.flatMap((p) => [p.result, p.average, ...p.polls.map((x) => x.value)])) /
        5,
    ) * 5;
  const m = { l: 130, r: 64, t: 10, b: 28 };
  const row = 42;
  const H = m.t + m.b + row * e.parties.length;
  const x = (v: number) => m.l + (v / top) * (W - m.l - m.r);
  // Cada empresa, en una altura fija dentro de la fila, para que los puntos no se tapen.
  const jitter = (firm: string) =>
    (([...firm].reduce((t, c) => t + c.charCodeAt(0), 0) % 9) - 4) * 2;

  return (
    <>
      <Grid>
        {elections.map((x) => {
          const w = worst(x);
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === e.id}
              onClick={() => setChosen(x.id)}
              className={cn(
                'col-span-6 grid gap-1 rounded-xl p-4 text-left ring-1 ring-border transition-colors hover:bg-muted md:col-span-4 lg:col-span-2',
                'aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:ring-foreground',
              )}
            >
              <span className="font-mono text-xs font-medium tracking-[0.08em] uppercase opacity-70">
                {x.name}
              </span>
              <b className="font-heading text-3xl leading-none font-normal tabular-nums">
                {decimal(x.error)} pt
              </b>
              {w && (
                <span className="text-sm opacity-80">
                  el mayor, {w.name} {signed(w.average - w.result)}
                </span>
              )}
            </button>
          );
        })}
      </Grid>
      <section className="mt-10 grid gap-6">
        <SectionHeading
          title={
            miss
              ? `${e.name}: ${miss.name}, ${d > 0 ? 'sobrestimado' : 'infravalorado'} en ${decimal(Math.abs(d))} puntos`
              : e.name
          }
        >
          Cada fila, un partido: el círculo hueco es la media de las encuestas; el lleno, lo que
          votó la gente; los puntos claros, la última encuesta de cada empresa.
        </SectionHeading>
        <Grid>
          <Cell>
            <div ref={box}>
              <Tips>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  aria-label={e.parties
                    .map(
                      (p) =>
                        `${p.name}: media ${decimal(p.average)} %, resultado ${decimal(p.result)} %`,
                    )
                    .join('; ')}
                  className="block h-auto w-full overflow-visible"
                >
                  <g className="fill-muted-foreground font-mono text-xs">
                    {Array.from({ length: top / 5 + 1 }, (_, i) => i * 5)
                      .filter((v) => top <= 30 || v % 10 === 0)
                      .map((v) => (
                        <g key={v}>
                          <line
                            x1={x(v)}
                            x2={x(v)}
                            y1={m.t}
                            y2={H - m.b}
                            className="stroke-border"
                          />
                          <text x={x(v)} y={H - 6} textAnchor="middle">
                            {v} %
                          </text>
                        </g>
                      ))}
                  </g>
                  {e.parties.map((p, i) => {
                    const cy = m.t + row * i + row / 2;
                    const diff = p.average - p.result;
                    return (
                      <g
                        key={p.id}
                        data-tip={p.name}
                        data-tip-text={`Media de las encuestas ${decimal(p.average)} %; votó ${decimal(p.result)} %: ${diff > 0 ? 'sobrestimado' : 'infravalorado'} en ${decimal(Math.abs(diff))} puntos.`}
                        data-tip-color={p.color}
                      >
                        <rect x={0} y={cy - row / 2} width={W} height={row} fill="transparent" />
                        <text
                          x={m.l - 12}
                          y={cy + 5}
                          textAnchor="end"
                          className="fill-foreground text-sm font-medium"
                        >
                          {p.name}
                        </text>
                        {p.polls.map((poll, j) => (
                          <circle
                            key={j}
                            cx={x(poll.value)}
                            cy={cy + jitter(poll.firm)}
                            r={3}
                            fill={p.color}
                            opacity={0.3}
                          />
                        ))}
                        <line
                          x1={x(p.average)}
                          x2={x(p.result)}
                          y1={cy}
                          y2={cy}
                          stroke={p.color}
                          strokeWidth={2.5}
                        />
                        <circle cx={x(p.result)} cy={cy} r={6} fill={p.color} />
                        <circle
                          cx={x(p.average)}
                          cy={cy}
                          r={6}
                          fill="var(--card)"
                          stroke={p.color}
                          strokeWidth={2.5}
                        />
                        <text
                          x={W - m.r + 12}
                          y={cy + 5}
                          className={cn(
                            'font-mono text-sm font-medium',
                            Math.abs(diff) >= 2 ? 'fill-brand' : 'fill-muted-foreground',
                          )}
                        >
                          {signed(diff)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </Tips>
            </div>
          </Cell>
        </Grid>
      </section>
    </>
  );
}
