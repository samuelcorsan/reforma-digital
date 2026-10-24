'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { useFirstSight } from './first-sight';
import { Tips } from './tips';
import { useScale } from './use-width';
import { shortDate, thousands } from '../../lib/elecciones/format';

type Day = [votes: number, laws: number, decrees: number, questions: number];
type Vote = [id: string, date: string, title: string, yes: number, no: number];

const longDate = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const monthNames = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
];
// Un color de datos sobre el fondo apagado: t = 0, apenas se ve; t = 1, el color entero.
const ramp = (hex: string, t: number) =>
  `color-mix(in oklab, ${hex} ${Math.round(32 + 68 * Math.max(0, Math.min(1, t)))}%, var(--muted))`;
const colors = { votes: '#4F7AA6', law: '#2E7D5B', decree: '#7152A8', questions: '#C9873E' };

export function Figures({
  from,
  to,
  days,
  votes,
  plenaries,
  unanswered,
  voteHref,
  intro,
}: {
  from: string;
  to: string;
  days: Record<string, Day>;
  votes: Vote[];
  plenaries: number;
  unanswered: number;
  voteHref: string;
  intro: { calendar: ReactNode; margins: ReactNode };
}) {
  return (
    <>
      <section className="grid gap-6">
        {intro.calendar}
        <Calendar
          from={from}
          to={to}
          days={days}
          votes={votes}
          plenaries={plenaries}
          unanswered={unanswered}
          voteHref={voteHref}
        />
      </section>
      <section className="grid gap-6 border-t border-border pt-8">
        {intro.margins}
        <Margins votes={votes} voteHref={voteHref} />
      </section>
    </>
  );
}

/* ---------- La legislatura, día a día ---------- */

const modes = ['votes', 'laws', 'questions'] as const;
type Mode = (typeof modes)[number];
const isMode = (value: unknown): value is Mode => modes.some((m) => m === value);
const W = 1000;
const left = 40;
const cell = (W - left) / 54;

function Calendar({
  from,
  to,
  days,
  votes,
  plenaries,
  unanswered,
  voteHref,
}: {
  from: string;
  to: string;
  days: Record<string, Day>;
  votes: Vote[];
  plenaries: number;
  unanswered: number;
  voteHref: string;
}) {
  const router = useRouter();
  const { list, years, totals, firstVote, maxVotes, maxQuestions, months } = useMemo(() => {
    const list: string[] = [];
    for (let d = asDate(from); d <= asDate(to); d.setUTCDate(d.getUTCDate() + 1))
      list.push(d.toISOString().slice(0, 10));
    const years = [...new Set(list.map((iso) => Number(iso.slice(0, 4))))];
    // Lo acumulado hasta cada día, para los contadores al reproducir.
    let sum: Day = [0, 0, 0, 0];
    const totals = list.map((iso) => {
      const v = days[iso] ?? [0, 0, 0, 0];
      sum = [sum[0] + v[0], sum[1] + v[1], sum[2] + v[2], sum[3] + v[3]];
      return sum;
    });
    const firstVote = new Map<string, string>();
    for (const [id, date] of [...votes].sort(
      (a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], undefined, { numeric: true }),
    ))
      if (!firstVote.has(date)) firstVote.set(date, id);
    const values = Object.values(days);
    const months = years.flatMap((year) =>
      monthNames.flatMap((name, m) => {
        const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
        if (first.slice(0, 7) < from.slice(0, 7) || first > to) return [];
        return [{ year, name, at: first < from ? from : first }];
      }),
    );
    return {
      list,
      years,
      totals,
      firstVote,
      maxVotes: Math.max(1, ...values.map((v) => v[0])),
      maxQuestions: Math.max(1, ...values.map((v) => v[3])),
      months,
    };
  }, [from, to, days, votes]);

  const blockH = 7 * cell + 24;
  const place = (iso: string) => {
    const d = asDate(iso);
    const year = d.getUTCFullYear();
    const jan1 = Date.UTC(year, 0, 1);
    const offset = (new Date(jan1).getUTCDay() + 6) % 7;
    const n = Math.round((d.getTime() - jan1) / 864e5);
    return {
      x: left + Math.floor((n + offset) / 7) * cell,
      y: years.indexOf(year) * blockH + 20 + ((d.getUTCDay() + 6) % 7) * cell,
    };
  };

  const [mode, setMode] = useState<Mode>('votes');
  const [cursor, setCursor] = useState(list.length - 1);
  const [playing, setPlaying] = useState(false);
  const position = useRef(list.length - 1);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let before = performance.now();
    const step = (now: number) => {
      // La legislatura entera en unos 11 segundos.
      position.current = Math.min(
        list.length - 1,
        position.current + ((now - before) * list.length) / 11000,
      );
      before = now;
      setCursor(Math.floor(position.current));
      if (position.current >= list.length - 1) return setPlaying(false);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, list.length]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (position.current >= list.length - 1) position.current = 0;
    setPlaying(true);
  };
  const box = useFirstSight(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(play, 300);
  }, 0.3);

  const fill = (iso: string) => {
    const [v, l, d, q] = days[iso] ?? [0, 0, 0, 0];
    if (mode === 'votes') return v ? ramp(colors.votes, Math.sqrt(v / maxVotes)) : null;
    if (mode === 'laws') return l ? colors.law : d ? colors.decree : null;
    return q ? ramp(colors.questions, Math.log1p(q) / Math.log1p(maxQuestions)) : null;
  };
  const now = totals[cursor] ?? [0, 0, 0, 0];
  const counters: [number, string, boolean?][] = [
    [now[0], 'votaciones en el Pleno'],
    [now[1], 'leyes publicadas'],
    [now[2], 'reales decretos-leyes'],
    [now[3], 'preguntas registradas'],
    [plenaries, 'días de Pleno con votaciones'],
    [unanswered, 'preguntas sin respuesta', true],
  ];
  const height = years.length * blockH;
  const chart = useRef<HTMLDivElement>(null);
  const k = useScale(chart, W);

  return (
    <div ref={box} className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-6 gap-y-4 border-y border-border py-5">
        {counters.map(([value, label, alert]) => (
          <div key={label} className="flex flex-col-reverse justify-end gap-1">
            <dt className="text-sm leading-snug text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                'm-0 font-heading text-[40px] leading-none tabular-nums',
                alert && 'text-brand',
              )}
            >
              {thousands(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="sunset" onClick={play}>
          {playing ? 'Pausa' : cursor >= list.length - 1 ? 'Reproducir la legislatura' : 'Seguir'}
        </Button>
        <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tabs value={mode} onValueChange={(value) => isMode(value) && setMode(value)}>
            <TabsList aria-label="Qué se pinta">
              <TabsTrigger value="votes" className="px-3">
                Votaciones
              </TabsTrigger>
              <TabsTrigger value="laws" className="px-3">
                Leyes y decretos-leyes
              </TabsTrigger>
              <TabsTrigger value="questions" className="px-3">
                Preguntas registradas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <span className="font-mono text-sm font-medium text-muted-foreground tabular-nums">
          {shortDate(list[cursor] ?? to)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Tips className="min-w-[640px]">
          <div ref={chart}>
            <svg
              viewBox={`0 0 ${W} ${height}`}
              role="img"
              aria-label="Cada día de la legislatura, pintado según lo que se ha elegido"
              className="block h-auto w-full"
            >
              {years.map((year, i) => (
                <text
                  key={year}
                  x={0}
                  y={i * blockH + 20 + 4 * cell}
                  className="fill-foreground font-mono font-medium"
                  style={{ fontSize: 12 * k }}
                >
                  {year}
                </text>
              ))}
              {months.map((m) => (
                <text
                  key={`${m.year}-${m.name}`}
                  x={place(m.at).x}
                  y={years.indexOf(m.year) * blockH + 12}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 12 * k }}
                >
                  {m.name}
                </text>
              ))}
              {list.map((iso, i) => {
                const p = place(iso);
                const color = fill(iso);
                const [v, l, d, q] = days[iso] ?? [0, 0, 0, 0];
                const parts = [
                  v && `${v} ${v === 1 ? 'votación' : 'votaciones'}`,
                  l && `${l} ${l === 1 ? 'ley publicada' : 'leyes publicadas'}`,
                  d && `${d} ${d === 1 ? 'decreto-ley' : 'decretos-leyes'}`,
                  q &&
                    `${thousands(q)} ${q === 1 ? 'pregunta registrada' : 'preguntas registradas'}`,
                ].filter(Boolean);
                const first = firstVote.get(iso);
                return (
                  <rect
                    key={iso}
                    x={p.x}
                    y={p.y}
                    width={cell - 2}
                    height={cell - 2}
                    rx={2}
                    fill={color ?? 'var(--muted)'}
                    className={cn(
                      'transition-opacity duration-150 hover:stroke-foreground hover:[stroke-width:1.5]',
                      first && 'cursor-pointer',
                    )}
                    style={{ opacity: i > cursor ? 0.12 : color ? 1 : 0.55 }}
                    data-tip={longDate.format(asDate(iso))}
                    data-tip-text={`${parts.length ? parts.join(' · ') : 'Sin actividad registrada'}${first ? '. Pulsa para ver sus votaciones' : ''}`}
                    onClick={() => first && router.push(`${voteHref}/${first}`)}
                  />
                );
              })}
            </svg>
          </div>
        </Tips>
      </div>
      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {mode === 'laws' ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <i className="block size-2.5 rounded-xs" style={{ background: colors.law }} />
              Se publica una ley
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="block size-2.5 rounded-xs" style={{ background: colors.decree }} />
              Se publica un decreto-ley
            </span>
          </>
        ) : (
          <>
            Menos
            <span
              className="block h-2.5 w-28 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${ramp(mode === 'votes' ? colors.votes : colors.questions, 0)}, ${ramp(mode === 'votes' ? colors.votes : colors.questions, 1)})`,
              }}
            />
            {mode === 'votes'
              ? `Más votaciones (hasta ${maxVotes} en un día)`
              : `Más preguntas (hasta ${thousands(maxQuestions)} en un día)`}
          </>
        )}
      </p>
    </div>
  );
}

/* ---------- Por cuántos votos ---------- */

// 0: empate; ±1: de 1 a 10 votos de diferencia; ±2: de 11 a 20…
const bin = (margin: number) =>
  margin === 0 ? 0 : Math.sign(margin) * Math.ceil(Math.abs(margin) / 10);
const binLabel = (b: number) =>
  b === 0
    ? 'Empate'
    : `${b > 0 ? 'Aprobadas' : 'Rechazadas'} por ${Math.abs(b) === 1 ? '1 a 10' : `${(Math.abs(b) - 1) * 10 + 1} a ${Math.abs(b) * 10}`} votos`;
const binColor = (b: number) =>
  b === 0
    ? '#E0A410'
    : Math.abs(b) === 1
      ? b > 0
        ? colors.law
        : 'var(--brand)'
      : `color-mix(in oklab, ${b > 0 ? colors.law : 'var(--brand)'} 45%, var(--background))`;

// El rango entre el empate y el tirador: en el centro, los empates; hacia un lado, las que se
// decidieron por esa diferencia o menos.
const rangeLabel = (edge: number) =>
  edge === 0
    ? 'Empates'
    : `${edge > 0 ? 'Aprobadas' : 'Rechazadas'} por ${Math.abs(edge) * 10} votos o menos, y empates`;

function Margins({ votes, voteHref }: { votes: Vote[]; voteHref: string }) {
  const { byBin, low, high, top, close } = useMemo(() => {
    const byBin = new Map<number, Vote[]>();
    for (const v of votes) {
      const b = bin(v[3] - v[4]);
      byBin.set(b, [...(byBin.get(b) ?? []), v]);
    }
    const keys = [...byBin.keys()];
    return {
      byBin,
      low: Math.min(...keys),
      high: Math.max(...keys),
      top: Math.max(...[...byBin.values()].map((list) => list.length)),
      close: votes.filter((v) => Math.abs(v[3] - v[4]) <= 10).length,
    };
  }, [votes]);
  const [edge, setEdge] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const chart = useRef<HTMLDivElement>(null);
  const k = useScale(chart, W);

  const H = 260;
  const m = { l: 40, r: 8, t: 30, b: 30 };
  const bw = (W - m.l - m.r) / (high - low + 1);
  const x = (b: number) => m.l + (b - low) * bw;
  const y = (n: number) => m.t + (1 - n / top) * (H - m.t - m.b);
  const ticks = [low, -10, -5, 0, 5, 10, 20, high].filter(
    (t, i, all) => t >= low && t <= high && all.indexOf(t) === i,
  );
  const ties = byBin.get(0)?.length ?? 0;
  const from = Math.min(0, edge);
  const to = Math.max(0, edge);
  const inside = (b: number) => b >= from && b <= to;
  // Las más ajustadas primero y, entre iguales, las más recientes.
  const shown = votes
    .filter((v) => inside(bin(v[3] - v[4])))
    .sort((a, b) => Math.abs(a[3] - a[4]) - Math.abs(b[3] - b[4]) || b[1].localeCompare(a[1]));

  // De la posición del puntero a la barra que tiene debajo.
  const moveTo = (clientX: number) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const px = (clientX - matrix.e) / matrix.a;
    setEdge(Math.max(low, Math.min(high, Math.floor((px - m.l) / bw) + low)));
  };
  const handleX = x(edge) + bw / 2;

  return (
    <div className="grid gap-4">
      <p className="m-0 max-w-[75ch] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
        De {thousands(votes.length)} votaciones con voto nominal, <b>{thousands(close)}</b> se
        decidieron por 10 votos o menos y <b>{ties}</b> acabaron en empate (en el Congreso, un
        empate repetido tres veces tumba la propuesta). Arrastra la raya hacia un lado para ver las
        que se decidieron por esa diferencia o menos.
      </p>
      <div className="overflow-x-auto">
        <Tips className="min-w-[640px]">
          <div ref={chart}>
            <svg
              ref={svg}
              viewBox={`0 0 ${W} ${H}`}
              role="group"
              aria-label="Votaciones según la diferencia entre votos a favor y en contra"
              className="block h-auto w-full touch-none overflow-visible select-none"
              onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                moveTo(event.clientX);
              }}
              onPointerMove={(event) => dragging.current && moveTo(event.clientX)}
              onPointerUp={() => {
                dragging.current = false;
              }}
            >
              <g className="fill-muted-foreground font-mono" style={{ fontSize: 12 * k }}>
                {[0, 0.5, 1].map((f) => (
                  <text key={f} x={m.l - 6} y={y(top * f) + 4} textAnchor="end">
                    {thousands(Math.round(top * f))}
                  </text>
                ))}
                {ticks.map((t) => (
                  <text key={t} x={x(t) + bw / 2} y={H - 12} textAnchor="middle">
                    {t === 0 ? '0' : `${t > 0 ? '+' : '−'}${Math.abs(t * 10)}`}
                  </text>
                ))}
                <text x={W - m.r} y={H} textAnchor="end">
                  diferencia de votos (sí − no)
                </text>
              </g>
              <rect
                x={x(from)}
                y={m.t - 6}
                width={x(to) + bw - x(from)}
                height={H - m.b - m.t + 6}
                className="fill-foreground/5"
              />
              {[...byBin].map(([b, list]) => (
                <rect
                  key={b}
                  x={x(b) + 0.5}
                  y={y(list.length)}
                  width={Math.max(1, bw - 1)}
                  height={H - m.b - y(list.length)}
                  rx={1.5}
                  fill={binColor(b)}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: inside(b) ? 1 : 0.35 }}
                  data-tip={binLabel(b)}
                  data-tip-text={`${thousands(list.length)} ${list.length === 1 ? 'votación' : 'votaciones'}`}
                  data-tip-color={binColor(b)}
                />
              ))}
              <line
                x1={x(0) + bw / 2}
                x2={x(0) + bw / 2}
                y1={m.t - 6}
                y2={H - m.b}
                className="stroke-border"
              />
              <g className="fill-muted-foreground font-medium" style={{ fontSize: 12 * k }}>
                <text x={x(0) + bw / 2 - 6} y={m.t - 18} textAnchor="end">
                  ← rechazadas
                </text>
                <text x={x(0) + bw / 2 + 6} y={m.t - 18}>
                  aprobadas →
                </text>
              </g>
              {/* El tirador: se arrastra con el ratón o el dedo y se mueve con las flechas. */}
              <g
                role="slider"
                tabIndex={0}
                aria-label="Diferencia de votos"
                aria-valuemin={low * 10}
                aria-valuemax={high * 10}
                aria-valuenow={edge * 10}
                aria-valuetext={`${rangeLabel(edge)}: ${shown.length} votaciones`}
                className="cursor-ew-resize outline-none [&:focus-visible_rect]:stroke-ring [&:focus-visible_rect]:[stroke-width:3]"
                onKeyDown={(event) => {
                  const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[
                    event.key
                  ];
                  if (step === undefined && event.key !== 'Home') return;
                  event.preventDefault();
                  setEdge((current) =>
                    event.key === 'Home' ? 0 : Math.max(low, Math.min(high, current + (step ?? 0))),
                  );
                }}
              >
                <line
                  x1={handleX}
                  x2={handleX}
                  y1={m.t - 6}
                  y2={H - m.b}
                  className="stroke-foreground"
                  strokeWidth={2}
                />
                <rect
                  x={handleX - 7}
                  y={(m.t + H - m.b) / 2 - 14}
                  width={14}
                  height={28}
                  rx={7}
                  className="fill-background stroke-foreground"
                  strokeWidth={1.5}
                />
                <path
                  d={`M${handleX - 2} ${(m.t + H - m.b) / 2 - 6}v12M${handleX + 2} ${(m.t + H - m.b) / 2 - 6}v12`}
                  className="stroke-foreground"
                  strokeWidth={1}
                />
              </g>
            </svg>
          </div>
        </Tips>
      </div>
      <div className="grid gap-2 border-t border-border pt-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-base font-medium">
            {rangeLabel(edge)} · {thousands(shown.length)}
          </h3>
          {edge !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setEdge(0)}>
              Volver a los empates
            </Button>
          )}
        </div>
        <ul className="m-0 grid max-h-96 list-none overflow-auto p-0">
          {shown.slice(0, 200).map(([id, date, title, yes, no]) => (
            <li key={id} className="border-t border-border first:border-t-0">
              <Link
                href={`${voteHref}/${id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-md px-2 py-2 text-sm no-underline hover:bg-muted"
              >
                <span className="leading-snug">{title}</span>
                <span className="font-mono text-sm whitespace-nowrap text-muted-foreground">
                  <b className="font-medium text-foreground">
                    {yes}–{no}
                  </b>{' '}
                  · {shortDate(date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {shown.length > 200 && (
          <p className="m-0 text-sm text-muted-foreground">
            Se muestran las 200 más ajustadas de {thousands(shown.length)}.
          </p>
        )}
      </div>
    </div>
  );
}
