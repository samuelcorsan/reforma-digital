'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { thousands } from '../../lib/elecciones/format';
import { useFirstSight } from './first-sight';
import { Cell, Heading, Label, Stat } from './report';
import { Tips } from './tips';
import { useWidth } from './use-width';

export type LastSeat = {
  code: string;
  name: string;
  missing: number;
  from: { party: string; family: string };
  to: { party: string; family: string };
};
type Family = { id: string; name: string; color: string; seats: number };

// Para contar quién pierde y quién gana, los nacionalistas y regionalistas van juntos; el
// hemiciclo sigue pintando cada familia con su color.
const nationalists = new Set(['BILDU', 'ERC', 'BNG', 'PNV', 'CIU', 'CC']);
const short: Record<string, string> = {
  IZQ: 'IU-Podemos-Sumar',
  NAC: 'Nacionalistas',
  UCD: 'UCD-CDS',
  CS: 'Cs',
  PP: 'PP',
  VOX: 'Vox',
  OTROS: 'Otros',
};
const groupOf = (family: string) => (nationalists.has(family) ? 'NAC' : family);
// De izquierda a derecha, como se sientan.
const seating = ['IZQ', 'PSOE', 'NAC', 'UCD', 'CS', 'PP', 'VOX', 'OTROS'];

const m = { l: 30, r: 12, t: 36, b: 34 };
const presets = [
  [3, '1.000'],
  [Math.log10(5000), '5.000'],
  [4, '10.000'],
] as const;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rounded = (v: number) => {
  const r = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / r) * r;
};

// «El Congreso que pudo ser»: en cada provincia, el último escaño se decidió por unos pocos votos.
// Si todos los que se decidieron por menos de una cifra hubieran caído del otro lado…
export function CouldBe({
  seats,
  families,
  hemicycle,
  voters,
}: {
  seats: LastSeat[];
  families: Family[];
  hemicycle: {
    box: string;
    points: [number, number][];
    label: { x: number; y: number; size: number };
  };
  voters: number;
}) {
  const N = seats.length;
  const maxLog = Math.log10(Math.max(1000, seats.at(-1)?.missing ?? 1000));
  const end = maxLog + (maxLog - 2) * 0.02;
  const [level, setLevel] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const current = useRef(level);
  current.current = level;
  const frame = useRef(0);
  const dragging = useRef(false);
  const area = useId();

  const stop = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    setPlaying(false);
  };
  // Lleva la línea hasta `to` (en log10 de votos) en `ms` milisegundos.
  const go = (to: number, ms: number, from = current.current) => {
    stop();
    if (reducedMotion()) return setLevel(to);
    const start = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setLevel(from + (to - from) * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else stop();
    };
    frame.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // La primera vez que se ve, la escalera se recorre sola hasta los 10.000 votos.
  const chart = useFirstSight(() => {
    if (current.current === 2) go(Math.min(4, maxLog), 3200);
  }, 0.5);
  const W = useWidth(chart, 640);
  const H = W < 520 ? 240 : 280;

  const budget = 10 ** level;
  const flipped = seats.filter((s) => s.missing <= budget);
  const used = flipped.reduce((sum, s) => sum + s.missing, 0);
  const last = flipped.at(-1);

  // Los grupos (con los nacionalistas juntos), en el orden de las familias: de izquierda a derecha.
  const groups: { id: string; name: string; color: string; seats: number }[] = [];
  for (const f of families) {
    const id = groupOf(f.id);
    const found = groups.find((g) => g.id === id);
    if (found) found.seats += f.seats;
    else
      groups.push({
        id,
        name: short[id] ?? f.name,
        color: id === 'NAC' ? '#8F8270' : f.color,
        seats: f.seats,
      });
  }
  groups.sort((a, b) => seating.indexOf(a.id) - seating.indexOf(b.id));
  const group = Object.fromEntries(groups.map((g) => [g.id, g]));
  const from = (s: LastSeat) => groupOf(s.from.family);
  const to = (s: LastSeat) => groupOf(s.to.family);
  const change: Record<string, number> = {};
  const fine: Record<string, number> = {};
  for (const s of flipped) {
    change[from(s)] = (change[from(s)] ?? 0) - 1;
    change[to(s)] = (change[to(s)] ?? 0) + 1;
    fine[s.from.family] = (fine[s.from.family] ?? 0) - 1;
    fine[s.to.family] = (fine[s.to.family] ?? 0) + 1;
  }
  // El hemiciclo: los escaños, de izquierda a derecha, con el color de cada familia en su orden.
  const colors = families.flatMap((f) =>
    Array<string>(Math.max(0, f.seats + (fine[f.id] ?? 0))).fill(f.color),
  );

  const x = (v: number) => m.l + ((Math.log10(Math.max(100, v)) - 2) / (end - 2)) * (W - m.l - m.r);
  const y = (n: number) => H - m.b - (n / N) * (H - m.t - m.b);
  const toLevel = (px: number) =>
    Math.max(2, Math.min(maxLog, 2 + ((px - m.l) / (W - m.l - m.r)) * (end - 2)));
  const steps = seats
    .map(
      (s, i) =>
        `${i ? '' : `M${x(100)} ${y(0)}`}L${x(s.missing)} ${y(i)}L${x(s.missing)} ${y(i + 1)}`,
    )
    .join('');
  const cursor = x(budget);
  const lastColor = last ? (group[to(last)]?.color ?? 'var(--foreground)') : 'var(--foreground)';

  const drag = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setLevel(toLevel(((event.clientX - box.left) / box.width) * W));
  };

  return (
    <Cell>
      <div className="grid gap-2">
        <Label>El último escaño</Label>
        <Heading title="El Congreso que pudo ser">
          En cada provincia, el último escaño se decidió por unos pocos votos. ¿Y si todos los que
          se decidieron por menos de una cifra hubieran caído del otro lado?
        </Heading>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
        <svg
          viewBox={hemicycle.box}
          role="img"
          aria-label="Hemiciclo con los escaños que cambiarían"
          className="block h-auto w-full"
        >
          {hemicycle.points.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={5.3} fill={colors[i] ?? 'var(--muted)'} />
          ))}
          <text
            x={hemicycle.label.x}
            y={hemicycle.label.y}
            textAnchor="middle"
            className="fill-foreground font-heading"
            style={{ fontSize: hemicycle.label.size }}
          >
            {hemicycle.points.length}
          </text>
        </svg>
        <div className="grid gap-5" aria-live="polite">
          <div className="grid grid-cols-2 gap-4">
            <Stat
              value={flipped.length}
              caption={`escaños se decidieron por menos de ${thousands(rounded(budget))} votos`}
            />
            <Stat
              value={thousands(used)}
              caption={`votos, sumándolos todos, bastaban para darles la vuelta${
                flipped.length
                  ? `: el ${((used / voters) * 100).toLocaleString('es-ES', { maximumFractionDigits: used / voters < 0.01 ? 2 : 1 })} % de los que votaron`
                  : ''
              }`}
            />
          </div>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            {groups
              .filter((g) => g.seats || change[g.id])
              .map((g) => {
                const d = change[g.id] ?? 0;
                return (
                  <li
                    key={g.id}
                    className="grid grid-cols-[10px_minmax(0,1fr)_3rem_2.5rem] items-center gap-2"
                  >
                    <i className="block size-2.5 rounded-full" style={{ background: g.color }} />
                    <span>{g.name}</span>
                    <b className="text-right font-mono font-medium tabular-nums">{g.seats + d}</b>
                    <small
                      className={cn(
                        'text-right font-mono text-sm',
                        d > 0 ? 'text-[#2E7D5B]' : 'text-brand',
                      )}
                    >
                      {d ? `${d > 0 ? '+' : '−'}${Math.abs(d)}` : ''}
                    </small>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
      <div className="grid gap-3 border-t border-border pt-6">
        <p className="m-0 text-sm text-muted-foreground">
          Cada punto es un escaño, colocado según los votos que le faltaron al segundo para
          quitárselo al primero. <b className="font-medium text-foreground">Mueve la línea:</b> los
          que quedan a su izquierda cambian de manos.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            variant="sunset"
            size="sm"
            className="mr-1"
            onClick={() => {
              if (playing) return stop();
              // Al final de la escalera, vuelve a empezar desde el principio.
              const start = level >= maxLog - 0.01 ? 2 : level;
              go(maxLog, (7000 * (maxLog - start)) / (maxLog - 2), start);
            }}
          >
            {playing ? 'Pausa' : 'Reproducir'}
          </Button>
          <span className="text-muted-foreground">Por menos de</span>
          {[...presets, [maxLog, 'Todos'] as const].map(([v, text]) => (
            <Button
              key={text}
              size="sm"
              variant={Math.abs(level - Math.min(maxLog, v)) < 0.005 ? 'default' : 'ghost'}
              aria-pressed={Math.abs(level - Math.min(maxLog, v)) < 0.005}
              onClick={() => go(Math.min(maxLog, v), 900)}
            >
              {text}
            </Button>
          ))}
        </div>
        <div ref={chart}>
          <Tips>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              aria-hidden="true"
              className="block h-auto w-full cursor-ew-resize touch-pan-y overflow-visible select-none"
              onPointerDown={(event) => {
                stop();
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag(event);
              }}
              onPointerMove={(event) => dragging.current && drag(event)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
            >
              <defs>
                <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={lastColor} stopOpacity={0.3} />
                  <stop offset="1" stopColor={lastColor} stopOpacity={0.04} />
                </linearGradient>
                <clipPath id={`${area}-clip`}>
                  <rect x={0} y={0} width={cursor} height={H} />
                </clipPath>
              </defs>
              <g className="fill-muted-foreground font-mono text-xs">
                {[10, 20, 30, 40, 50]
                  .filter((n) => n <= N)
                  .map((n) => (
                    <g key={n}>
                      <line
                        x1={m.l}
                        x2={W - m.r}
                        y1={y(n)}
                        y2={y(n)}
                        className="stroke-border"
                        strokeDasharray="2 3"
                      />
                      {Math.abs(y(n) - y(flipped.length)) >= 10 || !flipped.length ? (
                        <text x={m.l - 6} y={y(n) + 3.5} textAnchor="end">
                          {n}
                        </text>
                      ) : null}
                    </g>
                  ))}
                {[1e3, 1e4, 1e5, 1e6]
                  .filter((v) => Math.log10(v) < maxLog - 0.1)
                  .map((v) => (
                    <text key={v} x={x(v)} y={H - m.b + 15} textAnchor="middle">
                      {thousands(v)}
                    </text>
                  ))}
                <text x={W - m.r} y={H - 2} textAnchor="end">
                  votos que le faltaron al segundo →
                </text>
              </g>
              {last && (
                <path
                  d={`${steps}L${x(last.missing)} ${y(0)}Z`}
                  fill={`url(#${area})`}
                  clipPath={`url(#${area}-clip)`}
                />
              )}
              <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} className="stroke-border" />
              <path d={steps} fill="none" className="stroke-muted-foreground/50" />
              {last && (
                <g style={{ color: lastColor }}>
                  <line
                    x1={m.l}
                    x2={x(last.missing)}
                    y1={y(flipped.length)}
                    y2={y(flipped.length)}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={m.l - 6}
                    y={y(flipped.length) + 3.5}
                    textAnchor="end"
                    fill="currentColor"
                    className="font-mono text-xs font-medium"
                  >
                    {flipped.length}
                  </text>
                </g>
              )}
              {seats.map((s, i) => {
                const color = group[to(s)]?.color ?? 'var(--foreground)';
                return (
                  <circle
                    key={s.code}
                    cx={x(s.missing)}
                    cy={y(i + 1)}
                    r={s === last ? 6 : 4.4}
                    fill={s.missing <= budget ? color : 'var(--card)'}
                    stroke={s === last ? 'var(--foreground)' : color}
                    strokeWidth={1.5}
                    data-tip={s.name}
                    data-tip-text={`${s.from.party} → ${s.to.party}: le faltaron ${thousands(s.missing)} votos. ${i ? `El ${i + 1}.º más ajustado de los ${N}` : 'El más ajustado de todos'}.`}
                    data-tip-color={color}
                  />
                );
              })}
              <g className="text-brand">
                <line
                  x1={cursor}
                  x2={cursor}
                  y1={m.t - 12}
                  y2={H - m.b}
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <circle cx={cursor} cy={m.t - 12} r={6} fill="currentColor" />
                <text
                  x={cursor}
                  y={m.t - 22}
                  textAnchor={cursor > W * 0.75 ? 'end' : cursor < W * 0.2 ? 'start' : 'middle'}
                  className="fill-foreground font-mono text-sm"
                >
                  menos de {thousands(rounded(budget))} votos
                </text>
              </g>
            </svg>
          </Tips>
        </div>
        <input
          type="range"
          min={2}
          max={maxLog}
          step={0.01}
          value={level}
          onChange={(event) => {
            stop();
            setLevel(Number(event.target.value));
          }}
          aria-label="Votos que se reparten"
          aria-valuetext={`menos de ${thousands(rounded(budget))} votos: ${flipped.length} escaños cambian`}
          className="-my-3.5 h-11 w-full accent-foreground"
        />
      </div>
      <div className="grid gap-3 border-t border-border pt-6">
        <Label>Quién se los lleva</Label>
        {flipped.length ? (
          <Flows
            seats={flipped}
            groups={groups}
            from={from}
            to={to}
            selected={selected && change[selected] !== undefined ? selected : null}
            onSelect={setSelected}
          />
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            Con tan pocos votos no cambia ningún escaño: el más barato costaba{' '}
            {thousands(seats[0]?.missing ?? 0)}.
          </p>
        )}
      </div>
    </Cell>
  );
}

// Un hilo por escaño, del grupo que lo pierde (izquierda) al que se lo lleva (derecha); debajo, las
// provincias de cada par. Pulsar un grupo deja solo los suyos; pulsar una provincia la lleva al
// simulador (lo recoge `YourVote` por `data-sim-province`).
function Flows({
  seats,
  groups,
  from,
  to,
  selected,
  onSelect,
}: {
  seats: LastSeat[];
  groups: { id: string; name: string; color: string }[];
  from: (s: LastSeat) => string;
  to: (s: LastSeat) => string;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const id = useId();
  const order = groups.map((g) => g.id);
  const group = Object.fromEntries(groups.map((g) => [g.id, g]));
  const box = useRef<HTMLDivElement>(null);
  const W2 = useWidth(box, 640);
  const u = 6;
  const gap = 12;
  const bw = 8;
  const count = (key: (s: LastSeat) => string) => {
    const c: Record<string, number> = {};
    for (const s of seats) c[key(s)] = (c[key(s)] ?? 0) + 1;
    return c;
  };
  const lose = count(from);
  const win = count(to);
  const left = order.filter((g) => lose[g]);
  const right = order.filter((g) => win[g]);
  const height = (list: string[], c: Record<string, number>) =>
    list.reduce((t, g) => t + (c[g] ?? 0) * u, 0) + (list.length - 1) * gap;
  const H2 = Math.max(height(left, lose), height(right, win)) + 8;
  const label = Math.min(
    W2 * 0.36,
    30 + Math.max(...[...left, ...right].map((g) => (group[g]?.name.length ?? 0) + 3)) * 8,
  );
  const nodes = (list: string[], c: Record<string, number>) => {
    let top = 4 + (H2 - 8 - height(list, c)) / 2;
    const out: Record<string, { y: number; h: number; k: number }> = {};
    for (const g of list) {
      out[g] = { y: top, h: (c[g] ?? 0) * u, k: 0 };
      top += (c[g] ?? 0) * u + gap;
    }
    return out;
  };
  const L = nodes(left, lose);
  const R = nodes(right, win);
  const x0 = label + bw;
  const x1 = W2 - label - bw;
  const xm = (x0 + x1) / 2;
  const rank = (g: string) => order.indexOf(g);
  // Cada hilo, en su ranura: a la izquierda, ordenados por destino; a la derecha, por origen.
  const threads = seats.map((s) => ({ s, y0: 0, y1: 0 }));
  for (const t of [...threads].sort(
    (a, b) => rank(from(a.s)) - rank(from(b.s)) || rank(to(a.s)) - rank(to(b.s)),
  )) {
    const n = L[from(t.s)];
    if (n) t.y0 = n.y + n.k++ * u + u / 2;
  }
  for (const t of [...threads].sort(
    (a, b) => rank(to(a.s)) - rank(to(b.s)) || rank(from(a.s)) - rank(from(b.s)),
  )) {
    const n = R[to(t.s)];
    if (n) t.y1 = n.y + n.k++ * u + u / 2;
  }
  const pairs = [...new Set(seats.map((s) => `${from(s)}-${to(s)}`))];
  const touches = (s: LastSeat) => !selected || from(s) === selected || to(s) === selected;
  const names = (list: LastSeat[]) => list.map((s) => s.name).join(', ');
  const listed = new Map<string, LastSeat[]>();
  for (const s of seats.filter(touches)) {
    const key = `${from(s)}>${to(s)}`;
    listed.set(key, [...(listed.get(key) ?? []), s]);
  }
  const node = (g: string, side: 'left' | 'right') => {
    const n = side === 'left' ? L[g] : R[g];
    const c = side === 'left' ? lose[g] : win[g];
    if (!n || !c) return null;
    const lost = seats.filter((s) => from(s) === g);
    const won = seats.filter((s) => to(s) === g);
    return (
      <g
        key={`${side}-${g}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected === g}
        aria-label={`${group[g]?.name}: solo sus escaños`}
        className="cursor-pointer outline-none [&:focus-visible_rect]:stroke-ring [&:focus-visible_rect]:[stroke-width:3]"
        onClick={() => onSelect(selected === g ? null : g)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onSelect(selected === g ? null : g);
        }}
        data-tip={group[g]?.name}
        data-tip-text={[
          lost.length ? `Pierde ${lost.length}: ${names(lost)}.` : '',
          won.length ? `Se lleva ${won.length}: ${names(won)}.` : '',
          'Pulsa para ver solo los suyos.',
        ]
          .filter(Boolean)
          .join(' ')}
        data-tip-color={group[g]?.color}
      >
        <rect
          x={side === 'left' ? label : x1}
          y={n.y}
          width={bw}
          height={n.h}
          rx={2}
          fill={group[g]?.color}
        />
        <text
          x={side === 'left' ? label - 8 : x1 + bw + 8}
          y={n.y + n.h / 2 + 4}
          textAnchor={side === 'left' ? 'end' : 'start'}
          className={cn('fill-foreground text-sm', selected === g && 'font-semibold')}
        >
          {side === 'right' && <tspan className="fill-[#2E7D5B]">+{c} </tspan>}
          {group[g]?.name}
          {side === 'left' && <tspan className="fill-brand"> −{c}</tspan>}
        </text>
      </g>
    );
  };

  return (
    <div ref={box} className="grid gap-3">
      <p
        className="m-0 flex justify-between font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase"
        aria-hidden="true"
      >
        <span>Los pierde</span>
        <span>Se los lleva</span>
      </p>
      <Tips>
        <svg
          viewBox={`0 0 ${W2} ${H2}`}
          role="img"
          aria-label="De qué grupo a qué grupo pasan los escaños"
          className="block h-auto w-full overflow-visible"
        >
          <defs>
            {pairs.map((k) => {
              const [a = '', b = ''] = k.split('-');
              return (
                <linearGradient
                  key={k}
                  id={`${id}-${k}`}
                  gradientUnits="userSpaceOnUse"
                  x1={x0}
                  x2={x1}
                  y1={0}
                  y2={0}
                >
                  <stop offset="0" stopColor={group[a]?.color} />
                  <stop offset="1" stopColor={group[b]?.color} />
                </linearGradient>
              );
            })}
          </defs>
          {threads.map(({ s, y0, y1 }) => (
            <path
              key={s.code}
              d={`M${x0} ${y0}C${xm} ${y0} ${xm} ${y1} ${x1} ${y1}`}
              fill="none"
              stroke={`url(#${id}-${from(s)}-${to(s)})`}
              strokeWidth={u - 1.2}
              className={cn(
                'cursor-pointer transition-opacity hover:opacity-100',
                touches(s) ? 'opacity-75' : 'opacity-10',
              )}
              data-sim-province={s.code}
              data-tip={s.name}
              data-tip-text={`${s.from.party} → ${s.to.party} con ${thousands(s.missing)} votos más. Pulsa para probarlo en el simulador.`}
              data-tip-color={group[to(s)]?.color}
            />
          ))}
          {left.map((g) => node(g, 'left'))}
          {right.map((g) => node(g, 'right'))}
        </svg>
      </Tips>
      {selected ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
          Solo{' '}
          <b className="inline-flex items-center gap-1.5 font-medium">
            <i
              className="block size-2.5 rounded-full"
              style={{ background: group[selected]?.color }}
            />
            {group[selected]?.name}
          </b>
          : pierde {lose[selected] ?? 0}, se lleva {win[selected] ?? 0}
          <Button variant="outline" size="sm" onClick={() => onSelect(null)}>
            Ver todos
          </Button>
        </p>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          Pulsa un grupo para ver solo los suyos; pulsa una provincia para probarla en el simulador.
        </p>
      )}
      <ul className="m-0 grid list-none gap-0 p-0">
        {[...listed]
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([key, list]) => {
            const [a = '', b = ''] = key.split('>');
            return (
              <li
                key={key}
                className="grid items-center gap-2 border-t border-border py-2 text-sm sm:grid-cols-[17rem_minmax(0,1fr)] sm:gap-4"
              >
                <span className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 font-medium">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <i
                      className="block size-2.5 rounded-full"
                      style={{ background: group[a]?.color }}
                    />
                    {group[a]?.name}
                    <span className="text-muted-foreground">→</span>
                    <i
                      className="block size-2.5 rounded-full"
                      style={{ background: group[b]?.color }}
                    />
                    {group[b]?.name}
                  </span>
                  <b className="text-right font-mono">{list.length}</b>
                </span>
                <span className="flex flex-wrap gap-1">
                  {list.map((s) => (
                    <Button
                      key={s.code}
                      variant="outline"
                      size="sm"
                      data-sim-province={s.code}
                      title={`${s.from.party} → ${s.to.party}: le faltaron ${thousands(s.missing)} votos`}
                    >
                      {s.name}
                    </Button>
                  ))}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
