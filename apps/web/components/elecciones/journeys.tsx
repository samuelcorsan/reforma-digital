'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { shortDate, thousands, toDay } from '../../lib/elecciones/format';
import { stages } from '../../lib/elecciones/laws';
import { useFirstSight } from './first-sight';
import { Tips } from './tips';
import { useScale } from './use-width';

// El viaje de cada ley de la legislatura (de `elecciones/viajes.json`), preparado en el servidor.
export type Journey = {
  exp: string;
  title: string;
  href: string;
  presenter: string;
  presenterName: string;
  color: string;
  presented: string;
  dates: string[];
  stage: number;
  destination: Destination;
  end: string;
  extensions: number;
};
type Destination = 'caduca' | 'rechazada' | 'fuera' | 'pendiente' | 'aprobada';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function Journeys({
  laws,
  start,
  dissolution,
  presenters,
  intro,
}: {
  laws: Journey[];
  start: string;
  dissolution: string;
  presenters: { id: string; name: string; color: string }[];
  intro: { path: ReactNode; flows: ReactNode };
}) {
  const [filter, setFilter] = useState<((l: Journey) => boolean) | null>(null);
  return (
    <>
      <section className="grid gap-6">
        {intro.path}
        <Path laws={laws} start={start} dissolution={dissolution} filter={filter} />
      </section>
      <section className="grid gap-6 border-t border-border pt-8">
        {intro.flows}
        <Flows laws={laws} presenters={presenters} onSelect={(f) => setFilter(() => f)} />
      </section>
    </>
  );
}

/* ---------- El camino de cada ley ---------- */

// Columnas: las seis etapas y, aparte, las que salieron del camino (rechazadas, retiradas…).
const pathColumns = [
  'Presentadas',
  'Admitidas',
  'Informe',
  'Congreso',
  'Senado',
  'Leyes',
  'Descartadas',
];
const W = 1000;
const gap = 12;
const colW = (W - gap * 6) / 7;
const dot = 9;
const perRow = Math.floor(colW / dot);
const head = 40;
const colX = (c: number) => c * (colW + gap);

type Place = { col: number; falls?: boolean } | null;
function placeAt(
  l: Journey & { d0: number; ds: number[]; dEnd: number },
  t: number,
  end: number,
): Place {
  if (t < l.d0) return null;
  let col = 0;
  l.ds.forEach((d, j) => {
    if (d <= t) col = j + 1;
  });
  if (l.destination === 'caduca') return t >= end ? { col, falls: true } : { col };
  if (l.destination !== 'aprobada' && l.destination !== 'pendiente' && t >= l.dEnd)
    return { col: 6 };
  return { col };
}

function Path({
  laws,
  start,
  dissolution,
  filter,
}: {
  laws: Journey[];
  start: string;
  dissolution: string;
  filter: ((l: Journey) => boolean) | null;
}) {
  const router = useRouter();
  const t0 = toDay(start);
  const tEnd = toDay(dissolution);
  const prepared = useMemo(
    () =>
      laws.map((l) => ({
        ...l,
        d0: toDay(l.presented),
        ds: l.dates.map((d) => (d ? toDay(d) : Infinity)),
        dEnd: l.end ? toDay(l.end) : Infinity,
      })),
    [laws],
  );
  // El alto del dibujo: lo más llena que llega a estar cada caja a lo largo de la legislatura.
  const { yFall, height } = useMemo(() => {
    let top = 0;
    for (let t = t0; t <= tEnd + 15; t += 15) {
      const counts = Array<number>(7).fill(0);
      for (const l of prepared) {
        const p = placeAt(l, Math.min(t, tEnd), tEnd + 1);
        if (p) counts[p.col] = (counts[p.col] ?? 0) + 1;
      }
      top = Math.max(top, ...counts);
    }
    const falling = Array<number>(7).fill(0);
    for (const l of prepared) {
      const p = placeAt(l, tEnd, tEnd);
      if (p?.falls) falling[p.col] = (falling[p.col] ?? 0) + 1;
    }
    const y = head + Math.ceil(top / perRow) * dot + 34;
    return { yFall: y, height: y + 22 + Math.ceil(Math.max(...falling) / perRow) * dot + 8 };
  }, [prepared, t0, tEnd]);

  const [t, setT] = useState(tEnd);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState(false);
  const [card, setCard] = useState<{ law: Journey; x: number; y: number } | null>(null);
  const time = useRef(tEnd);

  // Dónde va cada punto el día t.
  const { spots, counts } = useMemo(() => {
    const top: (typeof prepared)[] = Array.from({ length: 7 }, () => []);
    const bottom: (typeof prepared)[] = Array.from({ length: 7 }, () => []);
    const where = new Map<string, Place>();
    for (const l of prepared) {
      const p = placeAt(l, t, tEnd);
      where.set(l.exp, p);
      if (p) (p.falls ? bottom : top)[p.col]?.push(l);
    }
    const spots = new Map<string, { x: number; y: number; o: number }>();
    const lay = (list: typeof prepared, c: number, y0: number) =>
      list
        .sort((a, b) => a.d0 - b.d0)
        .forEach((l, k) =>
          spots.set(l.exp, {
            x: colX(c) + (k % perRow) * dot + dot / 2,
            y: y0 + Math.floor(k / perRow) * dot + dot / 2,
            o: c === 6 ? 0.45 : 1,
          }),
        );
    top.forEach((list, c) => lay(list, c, head));
    bottom.forEach((list, c) => lay(list, c, yFall + 16));
    for (const l of prepared)
      if (!where.get(l.exp)) spots.set(l.exp, { x: colX(0) + dot, y: head - 8, o: 0 });
    return { spots, counts: top.map((list, c) => list.length + (bottom[c]?.length ?? 0)) };
  }, [prepared, t, tEnd, yFall]);

  // Reproducir: la legislatura entera en unos 14 segundos. El estado se actualiza cada 50 ms y
  // las transiciones CSS suavizan el movimiento entre medias.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let before = performance.now();
    let shown = before;
    const step = (now: number) => {
      time.current = Math.min(
        tEnd,
        time.current + (Math.min(64, now - before) * (tEnd - t0)) / 14000,
      );
      before = now;
      if (time.current >= tEnd) {
        setT(tEnd);
        setPlaying(false);
        setNotice(true);
        return;
      }
      if (now - shown > 50) {
        shown = now;
        setT(time.current);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, t0, tEnd]);
  // La ficha sigue al punto: al desplazarse, se cierra.
  useEffect(() => {
    if (!card) return;
    const hide = () => setCard(null);
    addEventListener('scroll', hide, { passive: true, once: true });
    return () => removeEventListener('scroll', hide);
  }, [card]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const play = () => {
    if (playing) return setPlaying(false);
    if (time.current >= tEnd) time.current = t0;
    setNotice(false);
    setPlaying(true);
  };
  // La primera vez que se ve entero, se reproduce solo (salvo con movimiento reducido).
  const chart = useRef<HTMLDivElement>(null);
  const k = useScale(chart, W);
  const box = useFirstSight(() => {
    if (!reducedMotion() && time.current >= tEnd) setTimeout(play, 500);
  }, 0.55);

  const fell = t >= tEnd;
  const label = playing ? 'Pausa' : fell ? 'Reproducir la legislatura' : 'Seguir';
  return (
    <div ref={box} className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="sunset" onClick={play}>
          {label}
        </Button>
        <input
          type="range"
          min={t0}
          max={tEnd}
          step={1}
          value={Math.round(t)}
          aria-label="Fecha"
          className="-my-3.5 h-11 min-w-40 flex-1 accent-foreground"
          onChange={(event) => {
            setPlaying(false);
            setNotice(false);
            time.current = Number(event.target.value);
            setT(time.current);
          }}
        />
        <span className="min-w-[11ch] font-mono text-sm font-medium tabular-nums">
          {shortDate(new Date(Math.round(t) * 864e5).toISOString().slice(0, 10))}
        </span>
      </div>
      <div className="relative overflow-x-auto">
        <div ref={chart} className="min-w-[640px]">
          <svg
            viewBox={`0 0 ${W} ${height}`}
            role="img"
            aria-label="Cada ley de la legislatura, según la etapa a la que había llegado en la fecha elegida"
            className="block h-auto w-full"
            onMouseLeave={() => setCard(null)}
          >
            <g
              className="transition-opacity duration-500"
              style={{ opacity: fell ? 1 : 0 }}
              aria-hidden="true"
            >
              <rect
                x={0}
                y={yFall - 6}
                width={W}
                height={height - yFall + 6}
                rx={8}
                className="fill-brand/10"
              />
              <text
                x={6}
                y={yFall + 8}
                className="fill-brand font-mono font-medium tracking-[0.06em]"
                style={{ fontSize: 12 * k }}
              >
                CADUCAN CON LA DISOLUCIÓN
              </text>
            </g>
            {pathColumns.map((name, c) => (
              <g key={name}>
                <text
                  x={colX(c)}
                  y={14}
                  className="fill-foreground font-mono font-medium"
                  style={{ fontSize: 15 * k }}
                >
                  {thousands(counts[c] ?? 0)}
                </text>
                <text
                  x={colX(c)}
                  y={30}
                  className="fill-muted-foreground font-medium"
                  style={{ fontSize: 12 * k }}
                >
                  {name}
                </text>
              </g>
            ))}
            {prepared.map((l) => {
              const s = spots.get(l.exp);
              if (!s) return null;
              const dim = filter && !filter(l);
              return (
                <circle
                  key={l.exp}
                  r={dot * 0.42}
                  fill={l.color}
                  className="cursor-pointer transition-[transform,opacity] duration-500 ease-(--ease-brand) motion-reduce:transition-none"
                  style={{
                    transform: `translate(${s.x}px, ${s.y}px)`,
                    opacity: s.o * (dim ? 0.12 : 1),
                  }}
                  onMouseEnter={(event) => setCard({ law: l, x: event.clientX, y: event.clientY })}
                  onMouseLeave={() => setCard(null)}
                  onClick={() => router.push(l.href)}
                />
              );
            })}
          </svg>
        </div>
        <div
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute top-[38%] left-1/2 w-max max-w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background px-5 py-3 text-center ring-1 ring-brand transition-opacity duration-400',
            notice ? 'opacity-100' : 'opacity-0',
          )}
        >
          <b className="block text-lg font-medium">{shortDate(dissolution)}</b>
          <small className="text-sm text-muted-foreground">
            Se disuelven las Cortes: caduca todo lo que no había terminado
          </small>
        </div>
      </div>
      {card && <LawCard {...card} />}
    </div>
  );
}

const ends: Record<Destination, string> = {
  caduca: 'Caducó con la disolución',
  rechazada: 'Rechazada',
  fuera: 'Retirada, decaída o subsumida',
  pendiente: 'Aprobada por las Cortes, pendiente del BOE',
  aprobada: '',
};
const stepNames = [
  'Presentada',
  'Admitida a debate',
  'Informe de la comisión',
  'Aprobada en el Congreso',
  'Pasó por el Senado',
  'Ley',
];

// La ficha de una ley al pasar por su punto: su recorrido con fechas y cómo acabó.
function LawCard({ law, x, y }: { law: Journey; x: number; y: number }) {
  const left = Math.min(x + 14, innerWidth - 340);
  const top = Math.min(y + 14, innerHeight - 260);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 grid w-80 gap-2 rounded-xl bg-popover p-4 text-sm leading-snug text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      <p className="m-0 font-medium">{law.title}</p>
      <p className="m-0 text-sm text-muted-foreground">
        {law.presenterName} · {law.exp}
      </p>
      <ol className="m-0 grid list-none gap-1 border-l-2 border-border py-0 pl-3">
        {[law.presented, ...law.dates].map((date, j) =>
          date ? (
            <li key={stepNames[j]}>
              {stepNames[j]}{' '}
              <span className="font-mono text-sm text-muted-foreground">{shortDate(date)}</span>
            </li>
          ) : null,
        )}
        {ends[law.destination] && (
          <li className="font-medium">
            {ends[law.destination]}
            {law.end && law.destination !== 'pendiente' && (
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {' '}
                {shortDate(law.end)}
              </span>
            )}
          </li>
        )}
      </ol>
      {law.extensions > 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          Plazo de enmiendas ampliado {law.extensions} {law.extensions === 1 ? 'vez' : 'veces'}.
        </p>
      )}
    </div>
  );
}

/* ---------- De dónde vinieron y dónde acabaron ---------- */

const exits = [
  ['caduca', 'Caducan', 'var(--brand)'],
  ['rechazada', 'Rechazadas', '#C9873E'],
  ['fuera', 'Retiradas o decaídas', '#8A8F98'],
  ['pendiente', 'Aprobadas, pendientes del BOE', '#7FB69A'],
] as const;
const shortStages = pathColumns.slice(0, 6);
const SW = 1000;
const SH = 560;
const nodeW = 10;
const sTop = 44;
const sx = (col: number) => (col * (SW - nodeW - 180)) / 6;

type FlowNode = {
  id: string;
  col: number;
  n: number;
  name: string;
  color: string;
  y: number;
  label: string;
  trunk?: boolean;
  has: (l: Journey) => boolean;
};

function Flows({
  laws,
  presenters,
  onSelect,
}: {
  laws: Journey[];
  presenters: { id: string; name: string; color: string }[];
  onSelect: (filter: ((l: Journey) => boolean) | null) => void;
}) {
  const total = laws.length;
  const pct = (n: number) =>
    `${((n / total) * 100).toLocaleString('es-ES', { maximumFractionDigits: n / total < 0.01 ? 1 : 0 })} %`;
  const { nodes, links, scale } = useMemo(() => {
    const scale = (SH - sTop - 10 - 6 * (presenters.length - 1)) / total;
    const nodes: FlowNode[] = [];
    const place = (node: Omit<FlowNode, 'y'>) => {
      const above = nodes.filter((n) => n.col === node.col).at(-1);
      const placed = { ...node, y: above ? above.y + above.n * scale + (node.col ? 14 : 6) : sTop };
      nodes.push(placed);
      return placed;
    };
    const origins = presenters.map((p) =>
      place({
        id: p.id,
        col: 0,
        n: laws.filter((l) => l.presenter === p.id).length,
        name: p.name,
        color: p.color,
        label: `Presentadas por: ${p.name}`,
        has: (l) => l.presenter === p.id,
      }),
    );
    const trunk: FlowNode[] = [];
    const out: (FlowNode & { from: number })[] = [];
    stages.forEach((name, k) => {
      trunk.push(
        place({
          id: `e${k}`,
          col: k + 1,
          n: laws.filter((l) => l.stage >= k).length,
          name: shortStages[k] ?? name,
          color: k === 5 ? '#2E7D5B' : '#7C8089',
          label: name,
          trunk: true,
          has: (l) => l.stage >= k,
        }),
      );
      if (k === 0) return;
      for (const [id, exitName, color] of exits) {
        const has = (l: Journey) => l.stage === k - 1 && l.destination === id;
        const n = laws.filter(has).length;
        if (n)
          out.push({
            ...place({
              id: `${id}${k}`,
              col: k + 1,
              n,
              name: exitName,
              color,
              label: `${exitName} · se quedaron en «${stages[k - 1]}»`,
              has,
            }),
            from: k - 1,
          });
      }
    });
    const pairs = [
      ...origins.flatMap((o) =>
        trunk[0] ? [{ a: o, b: trunk[0], color: o.color, has: o.has, pick: o }] : [],
      ),
      ...trunk.slice(0, -1).flatMap((t, e) => {
        const next = trunk[e + 1];
        return [
          ...(next ? [{ a: t, b: next, color: '#7C8089', has: next.has, pick: next }] : []),
          ...out
            .filter((s) => s.from === e)
            .map((s) => ({ a: t, b: s, color: s.color, has: s.has, pick: s })),
        ];
      }),
    ];
    const used = new Map<string, number>();
    const into = new Map<string, number>();
    const links = pairs.map((p) => {
      const n = laws.filter(p.has).length;
      const y1 = p.a.y + (used.get(p.a.id) ?? 0);
      const y2 = p.b.y + (into.get(p.b.id) ?? 0);
      used.set(p.a.id, (used.get(p.a.id) ?? 0) + n * scale);
      into.set(p.b.id, (into.get(p.b.id) ?? 0) + n * scale);
      const x1 = sx(p.a.col) + nodeW;
      const x2 = sx(p.b.col);
      const xm = (x1 + x2) / 2;
      // Una banda de alto h que empieza `o` más abajo dentro del enlace.
      const band = (o: number, h: number) =>
        `M${x1} ${y1 + o}C${xm} ${y1 + o} ${xm} ${y2 + o} ${x2} ${y2 + o}L${x2} ${y2 + o + h}C${xm} ${y2 + o + h} ${xm} ${y1 + o + h} ${x1} ${y1 + o + h}Z`;
      return { ...p, n, d: band(0, n * scale), band };
    });
    return { nodes, links, scale };
  }, [laws, presenters, total]);

  // Rótulos de orígenes y salidas, a la derecha y empujados hacia abajo si se pisan.
  const side = useMemo(() => {
    const list = nodes
      .filter((n) => !n.trunk)
      .map((n) => ({ n, y: n.y + (n.n * scale) / 2 + 4 }))
      .sort((a, b) => a.n.col - b.n.col || a.y - b.y);
    list.forEach((label, i) => {
      const prev = list[i - 1];
      if (prev && prev.n.col === label.n.col && label.y < prev.y + 13) label.y = prev.y + 13;
    });
    return list;
  }, [nodes, scale]);

  const [picked, setPicked] = useState<FlowNode | null>(null);
  const selected = useMemo(() => (picked ? laws.filter(picked.has) : null), [laws, picked]);
  const count = (n: FlowNode) => (selected ? selected.filter(n.has).length : null);
  const pick = (node: FlowNode) => {
    const next = picked?.id === node.id ? null : node;
    setPicked(next);
    onSelect(next ? next.has : null);
  };

  // Al verse por primera vez, el diagrama se dibuja de izquierda a derecha; también el rastro de
  // cada selección.
  const [drawn, setDrawn] = useState(false);
  const chart = useRef<HTMLDivElement>(null);
  const k = useScale(chart, SW);
  const box = useFirstSight(() => setDrawn(true), 0.35);
  useEffect(() => {
    if (reducedMotion()) setDrawn(true);
  }, []);
  const tip = (title: string, n: number, extra = '') => ({
    'data-tip': title,
    'data-tip-text': `${thousands(n)} ${n === 1 ? 'ley' : 'leyes'} · ${pct(n)} de las presentadas${extra}`,
  });

  return (
    <div ref={box} className="grid gap-4">
      <div className="overflow-x-auto">
        <Tips className="min-w-[760px]">
          <div ref={chart}>
            <svg
              viewBox={`0 0 ${SW} ${SH}`}
              role="img"
              aria-label={`De las ${total} leyes presentadas en la legislatura, ${nodes.find((n) => n.id === 'e5')?.n ?? 0} acabaron en ley`}
              className="block h-auto w-full"
            >
              <defs>
                <clipPath id="flows-reveal">
                  <rect
                    x={-2}
                    y={0}
                    width={SW + 4}
                    height={SH}
                    className="origin-left transition-transform duration-[2200ms] ease-in-out motion-reduce:transition-none"
                    style={{ transform: drawn ? 'scaleX(1)' : 'scaleX(0)' }}
                  />
                </clipPath>
                <clipPath id="flows-trail">
                  <rect
                    key={picked?.id ?? 'none'}
                    x={-2}
                    y={0}
                    width={SW + 4}
                    height={SH}
                    className="origin-left motion-safe:animate-[flows-sweep_1.7s_ease-in-out]"
                  />
                </clipPath>
              </defs>
              <style>
                {'@keyframes flows-sweep{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}
              </style>
              <g clipPath="url(#flows-reveal)">
                {links.map((link) => (
                  <path
                    key={`${link.a.id}-${link.b.id}`}
                    d={link.d}
                    fill={link.color}
                    className="cursor-pointer transition-[fill-opacity] duration-200 hover:[fill-opacity:0.55]"
                    fillOpacity={picked ? 0.09 : 0.32}
                    onClick={() => pick(link.pick)}
                    {...tip(`${link.a.name} → ${link.b.name}`, link.n)}
                  />
                ))}
              </g>
              {selected && picked && (
                <g clipPath="url(#flows-trail)">
                  {links.map((link) => {
                    const m = selected.filter(link.has).length;
                    return m ? (
                      <path
                        key={`${link.a.id}-${link.b.id}`}
                        d={link.band(0, m * scale)}
                        fill={picked.color}
                        fillOpacity={0.78}
                        className="cursor-pointer"
                        onClick={() => pick(picked)}
                        data-tip={`${link.a.name} → ${link.b.name}`}
                        data-tip-text={`${thousands(m)} de las ${thousands(link.n)} leyes de este tramo`}
                        data-tip-color={picked.color}
                      />
                    ) : null;
                  })}
                </g>
              )}
              {nodes.map((n) => {
                const m = count(n);
                return (
                  <rect
                    key={n.id}
                    x={sx(n.col)}
                    y={n.y}
                    width={nodeW}
                    height={Math.max(1.5, n.n * scale)}
                    rx={2}
                    fill={n.color}
                    className={cn(
                      'cursor-pointer transition-opacity duration-500',
                      m === 0 && 'opacity-30',
                    )}
                    style={{
                      opacity: drawn ? undefined : 0,
                      transitionDelay: drawn ? `${(sx(n.col) / SW) * 2200}ms` : undefined,
                    }}
                    onClick={() => pick(n)}
                    {...tip(n.label, n.n, '. Pulsa para verlas')}
                    data-tip-color={n.color}
                  />
                );
              })}
              <g
                className="pointer-events-none fill-foreground transition-opacity duration-500"
                style={{
                  fontSize: 12 * k,
                  opacity: drawn ? 1 : 0,
                  transitionDelay: drawn ? '1200ms' : undefined,
                }}
              >
                {nodes
                  .filter((n) => n.trunk)
                  .map((n) => {
                    const m = count(n);
                    return (
                      <text
                        key={n.id}
                        x={sx(n.col)}
                        y={n.y - 20}
                        className={cn(m === 0 && 'opacity-45')}
                      >
                        <tspan className="font-medium">{n.name}</tspan>
                        <tspan x={sx(n.col)} dy={14} className="fill-muted-foreground font-mono">
                          {m === null
                            ? `${thousands(n.n)} · ${pct(n.n)}`
                            : `${thousands(m)} de ${thousands(n.n)}`}
                        </tspan>
                      </text>
                    );
                  })}
                {side.map(({ n, y }) => {
                  const m = count(n);
                  return (
                    <text
                      key={n.id}
                      x={sx(n.col) + nodeW + 6}
                      y={y}
                      className={cn(m === 0 && 'opacity-45')}
                    >
                      {n.name}
                      <tspan className="fill-muted-foreground font-mono">
                        {' '}
                        {m === null ? thousands(n.n) : `${thousands(m)} de ${thousands(n.n)}`}
                      </tspan>
                    </text>
                  );
                })}
              </g>
            </svg>
          </div>
        </Tips>
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        Pulsa un nodo o un flujo para seguir esas leyes aquí y en «El camino de cada ley»; pulsa
        otra vez para quitarlo.
      </p>
      {selected && picked && (
        <div className="grid gap-2 border-t border-border pt-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-base font-medium">
              {thousands(selected.length)} {selected.length === 1 ? 'ley' : 'leyes'} ·{' '}
              {picked.label}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => pick(picked)}>
              Quitar selección
            </Button>
          </div>
          <ul className="m-0 grid max-h-80 list-none gap-0.5 overflow-auto p-0">
            {selected.map((l) => (
              <li key={l.exp}>
                <Link
                  href={l.href}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md px-2 py-1.5 text-sm no-underline hover:bg-muted"
                >
                  <span>{l.title}</span>
                  <span className="font-mono text-sm text-muted-foreground">{l.exp}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
