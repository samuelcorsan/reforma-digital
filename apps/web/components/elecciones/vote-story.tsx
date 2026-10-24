'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import {
  mapSchema,
  municipalitiesSchema,
  municipalityVotesSchema,
} from '../../lib/congreso/schema';
import { percent, thousands } from '../../lib/elecciones/format';
import {
  axes,
  municipalities,
  rentCuts,
  spains,
  type Axis,
  type Municipality,
} from '../../lib/elecciones/geography';
import { Label, Legend } from './report';
import { Icon } from '../brand/icon';
import { load } from './load';
import { useWidth } from './use-width';

export type Step = { id: string; short: string; kicker: string; title: string; body: ReactNode };
type GeoMap = z.infer<typeof mapSchema>;
type Loaded = {
  dots: Municipality[];
  map: GeoMap;
  since: number;
  buckets: ReturnType<typeof axes>;
  // El grupo de cada municipio en cada eje (−1 si no tiene dato) y si está en cada España.
  bucketOf: Record<Axis, number[]>;
  inSpain: Record<string, boolean[]>;
};

const grey = '#8A8F98';
const axisOf: Record<string, Axis> = {
  ciudad: 'ciudad',
  vacia: 'vacia',
  edad: 'edad',
  generaciones: 'edad',
  dinero: 'dinero',
};
const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// El radio de un municipio según su gente, en el mapa a 600 px de ancho.
const byPeople = (pob: number) => Math.max(0.5, Math.sqrt(pob) * 0.025);

// La historia: los pasos a la izquierda y, quieto a la derecha, el mapa de puntos de los
// municipios, que cambia con cada paso. Los pasos llegan del servidor; aquí se marca el elegido,
// se iluminan los grupos al pasar por ellos y se dibuja el mapa.
export function VoteStory({
  count,
  steps,
  winners,
  order,
  colors,
  regions,
  tones,
  swingColors,
}: {
  count: number;
  steps: Step[];
  winners: { label: string; color: string }[];
  order: string[];
  colors: Record<string, string>;
  regions: Record<string, string>;
  tones: Record<Axis, string>;
  swingColors: { right: string; left: string };
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [bucket, setBucket] = useState<string | null>(null);
  const [spain, setSpain] = useState('laponia');
  const [size, setSize] = useState<'mun' | 'pob'>('mun');
  const [presenting, setPresenting] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      load('geografia/municipios.json', municipalitiesSchema),
      load('elecciones/municipios-202307.json', municipalityVotesSchema),
      load('elecciones/municipios-201911.json', municipalityVotesSchema),
      load('elecciones/geo-provincias.json', mapSchema),
    ])
      .then(([M, v23, v19, map]) => {
        if (!live) return;
        // De más a menos gente: los pequeños se pintan encima.
        const dots = municipalities(M.m, v23, v19).sort((a, b) => b.pob - a.pob);
        const buckets = axes(rentCuts(dots));
        const bucketOf = {
          ciudad: dots.map((d) => buckets.ciudad.findIndex((b) => b.test(d))),
          vacia: dots.map((d) => buckets.vacia.findIndex((b) => b.test(d))),
          edad: dots.map((d) => buckets.edad.findIndex((b) => b.test(d))),
          dinero: dots.map((d) => buckets.dinero.findIndex((b) => b.test(d))),
        };
        const inSpain = Object.fromEntries(
          spains((p) => regions[p]).map((s) => [s.key, dots.map((d) => s.test(d))]),
        );
        setData({ dots, map, since: M.anio0, buckets, bucketOf, inSpain });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [regions]);

  // El paso que está a media pantalla.
  useEffect(() => {
    const sections = root.current?.querySelectorAll<HTMLElement>('[data-step]') ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(Number(e.target.getAttribute('data-step')));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Los botones y grupos llegan del servidor: aquí se marca cuál está elegido.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    for (const b of el.querySelectorAll('[data-size]'))
      b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === size));
    for (const b of el.querySelectorAll('[data-spain]'))
      b.setAttribute('aria-pressed', String(b.getAttribute('data-spain') === spain));
    for (const d of el.querySelectorAll<HTMLElement>('[data-spain-detail]'))
      d.hidden = d.getAttribute('data-spain-detail') !== spain;
    for (const b of el.querySelectorAll('[data-bucket]'))
      b.toggleAttribute('data-on', b.getAttribute('data-bucket') === bucket);
  });

  // En «Presentar», las flechas, la barra espaciadora y Esc.
  useEffect(() => {
    if (!presenting) return;
    const key = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        setActive((a) => Math.min(steps.length - 1, a + 1));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (event.key === 'Escape') setPresenting(false);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [presenting, steps.length]);

  const pick = (target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    const size = el?.closest('[data-size]')?.getAttribute('data-size');
    if (size === 'mun' || size === 'pob') setSize(size);
    const spain = el?.closest('[data-spain]')?.getAttribute('data-spain');
    if (spain) setSpain(spain);
    const b = el?.closest('[data-bucket]')?.getAttribute('data-bucket');
    if (b) setBucket((now) => (now === b ? null : b));
  };
  const go = (i: number) =>
    root.current
      ?.querySelector(`[data-step="${i}"]`)
      ?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });

  const step = steps[active];
  const axis = step ? axisOf[step.id] : undefined;
  const map = data ? (
    <DotMap
      data={data}
      step={step?.id ?? ''}
      bucket={bucket}
      spain={spain}
      size={size}
      order={order}
      colors={colors}
      tones={tones}
      swingColors={swingColors}
    />
  ) : (
    <p className="m-0 grid min-h-80 place-items-center text-muted-foreground" aria-live="polite">
      {failed
        ? 'No se han podido cargar los municipios.'
        : `Cargando los ${thousands(count)} municipios…`}
    </p>
  );
  const legend =
    step?.id === 'giro' ? (
      <Legend
        small
        items={[
          { label: '→ hacia PP, Vox y Cs', color: swingColors.right },
          { label: '← hacia PSOE y Sumar', color: swingColors.left },
        ]}
      />
    ) : axis && data ? (
      <Legend
        small
        items={[
          ...data.buckets[axis].map((b) => ({
            label: b.title,
            color: toneColor(tones, axis, b.tone),
          })),
          { label: 'Sin dato', color: grey },
        ]}
      />
    ) : (
      <Legend small items={[...winners, { label: '· más votado el 23J', color: 'transparent' }]} />
    );
  const card = (s: Step) => (
    <>
      <Label>{s.kicker}</Label>
      <h3 className="m-0 font-heading text-[28px] leading-tight font-normal">{s.title}</h3>
      <div className="grid gap-4 [&_p]:m-0">{s.body}</div>
    </>
  );

  return (
    <div
      ref={root}
      onClick={(event) => pick(event.target)}
      onFocus={(event) => {
        const b = event.target.closest('[data-bucket]')?.getAttribute('data-bucket');
        if (b) setBucket(b);
      }}
      onPointerOver={(event) => {
        const el = event.target instanceof Element ? event.target : null;
        if (!el?.closest('[data-step]')) return;
        setBucket(el.closest('[data-bucket]')?.getAttribute('data-bucket') ?? null);
      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 max-w-[70ch] text-muted-foreground">
          Un mapa de los {thousands(count)} municipios que se queda quieto mientras bajas. Pasa el
          cursor por los gráficos para iluminar cada grupo, o pulsa Presentar para recorrerlo en
          directo.
        </p>
        <Button variant="sunset" onClick={() => setPresenting(true)}>
          Presentar
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="order-2 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[40vh] pb-[30vh] lg:order-1">
          {steps.map((s, i) => (
            <section key={s.id} data-step={i} className="scroll-mt-28">
              <Card
                className={cn(
                  'gap-4 p-6 text-base transition-shadow lg:p-8',
                  i === active && 'ring-foreground/30',
                )}
              >
                {card(s)}
              </Card>
            </section>
          ))}
        </div>
        <div className="sticky top-20 z-10 order-1 grid h-fit min-w-0 gap-3 bg-background py-2 lg:top-24 lg:order-2">
          <nav className="flex flex-wrap gap-1" aria-label="Ejes de la historia">
            {steps.map((s, i) => (
              <Button
                key={s.id}
                size="sm"
                variant={i === active ? 'default' : 'ghost'}
                aria-current={i === active ? 'step' : undefined}
                onClick={() => go(i)}
              >
                {s.short}
              </Button>
            ))}
          </nav>
          {!presenting && map}
          {legend}
        </div>
      </div>
      {presenting && step && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Presentación de la geografía del voto"
          className="fixed inset-0 z-50 grid gap-6 overflow-y-auto bg-background p-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:p-10"
        >
          <div className="grid content-start gap-4" aria-live="polite">
            {card(step)}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Anterior"
                disabled={active === 0}
                onClick={() => setActive(active - 1)}
              >
                <Icon name="izquierda" size={16} />
              </Button>
              <span className="font-mono text-sm tabular-nums">
                {active + 1} / {steps.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Siguiente"
                disabled={active === steps.length - 1}
                onClick={() => setActive(active + 1)}
              >
                <Icon name="derecha" size={16} />
              </Button>
              <Button variant="ghost" onClick={() => setPresenting(false)}>
                Salir
              </Button>
            </div>
          </div>
          <div className="grid content-center gap-3">
            {map}
            {legend}
          </div>
        </div>
      )}
    </div>
  );
}

const toneColor = (tones: Record<Axis, string>, axis: Axis, t: number) =>
  axis === 'vacia'
    ? `color-mix(in oklab, ${t < 0 ? tones.vacia : '#3D7CB0'} ${Math.round(Math.abs(t) ** 0.8 * 90 + 10)}%, var(--muted))`
    : `color-mix(in oklab, ${tones[axis]} ${Math.round(10 + 90 * t)}%, var(--muted))`;

// `arrow`: la flecha del giro (solo en ese paso).
type Look = { r: number; c: [number, number, number]; a: number; arrow?: boolean };

// El mapa de puntos en un lienzo: cada municipio pasa de su aspecto de antes al del paso nuevo.
function DotMap({
  data,
  step,
  bucket,
  spain,
  size,
  order,
  colors,
  tones,
  swingColors,
}: {
  data: Loaded;
  step: string;
  bucket: string | null;
  spain: string;
  size: 'mun' | 'pob';
  order: string[];
  colors: Record<string, string>;
  tones: Record<Axis, string>;
  swingColors: { right: string; left: string };
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(box, 600);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const { dots, map } = data;
  const height = (width * map.alto) / map.ancho;
  const k = width / map.ancho;
  const scale = width / 600;

  // El aspecto de cada punto en este paso.
  const target = useMemo<Look[]>(() => {
    const axis = axisOf[step];
    const [bAxis, bKey] = bucket?.split(':') ?? [];
    const lit = axis && bAxis === axis ? data.buckets[axis].findIndex((b) => b.key === bKey) : -1;
    const winner = (d: Municipality) => rgb(colors[order[d.winner ?? -1] ?? ''] ?? grey);
    return dots.map((d, i) => {
      const people = byPeople(d.pob);
      if (step === 'engana')
        return size === 'mun'
          ? { r: 1.8, c: winner(d), a: 0.85 }
          : { r: people, c: winner(d), a: 0.65 };
      if (axis) {
        const b = data.bucketOf[axis][i] ?? -1;
        const tone = data.buckets[axis][b]?.tone ?? 0;
        const hex = axis === 'vacia' ? (tone < 0 ? tones.vacia : '#3D7CB0') : tones[axis];
        if (lit >= 0)
          return b === lit
            ? { r: Math.max(1.9, people), c: rgb(hex), a: 0.95 }
            : { r: 1.1, c: rgb(grey), a: 0.12 };
        return b < 0
          ? { r: Math.max(1.5, people), c: rgb(grey), a: 0.25 }
          : {
              r: Math.max(1.5, people),
              c: rgb(hex),
              a: 0.25 + 0.6 * Math.abs(tone) ** 0.8,
            };
      }
      if (step === 'espanas')
        return data.inSpain[spain]?.[i]
          ? { r: Math.max(1.3, people), c: winner(d), a: 0.8 }
          : { r: 1.1, c: rgb(grey), a: 0.1 };
      if (step === 'giro') return { r: 1.1, c: rgb(grey), a: 0.14, arrow: true };
      return { r: people, c: winner(d), a: 0.7 };
    });
  }, [dots, data, step, bucket, spain, size, order, colors, tones]);

  // Las provincias, como fondo.
  const outlines = useMemo(() => Object.values(map.provincias).map((p) => new Path2D(p.d)), [map]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = devicePixelRatio || 1;
    el.width = Math.round(width * dpr);
    el.height = Math.round(height * dpr);
    const line = getComputedStyle(el).color;
    const right = rgb(swingColors.right);
    const left = rgb(swingColors.left);
    // Cada paso se dibuja tal cual: sin animar tamaños ni colores (DESIGN.md, §8.4).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(k, k);
    ctx.strokeStyle = line;
    ctx.lineWidth = 0.6 / k;
    for (const p of outlines) ctx.stroke(p);
    ctx.stroke(new Path2D(map.canarias));
    ctx.restore();
    target.forEach((l, i) => {
      const d = dots[i];
      if (!d) return;
      const x = d.x * k;
      const y = d.y * k;
      ctx.globalAlpha = l.a;
      ctx.fillStyle = `rgb(${l.c[0]} ${l.c[1]} ${l.c[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, l.r * scale), 0, Math.PI * 2);
      ctx.fill();
      if (l.arrow && d.swing !== null && d.vote) {
        const len = Math.max(-26, Math.min(26, d.swing * 0.9)) * scale;
        if (Math.abs(len) < 0.5) return;
        const c = len > 0 ? right : left;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = ctx.fillStyle = `rgb(${c[0]} ${c[1]} ${c[2]})`;
        ctx.lineWidth = Math.min(4, 0.35 + Math.sqrt(d.vote.voters) / 110) * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
        const head = Math.min(4, Math.abs(len) / 2) * Math.sign(len);
        ctx.beginPath();
        ctx.moveTo(x + len, y);
        ctx.lineTo(x + len - head, y - Math.abs(head) * 0.6);
        ctx.lineTo(x + len - head, y + Math.abs(head) * 0.6);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }, [target, width, height, k, scale, dots, outlines, map, swingColors]);

  // El municipio más cercano al puntero, para el detalle.
  const near = (clientX: number, clientY: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = -1;
    let dist = 12;
    dots.forEach((d, i) => {
      const look = target[i];
      if (!look || look.a < 0.2) return;
      const dd = Math.hypot(d.x * k - x, d.y * k - y) - look.r * scale;
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    return best < 0 ? null : { x: clientX, y: clientY, i: best };
  };
  const d = tip ? dots[tip.i] : undefined;
  const growth = d && d.pob0 ? d.pob / d.pob0 - 1 : null;
  const share = (key: 'PP' | 'PSOE' | 'VOX' | 'IZQ') =>
    d?.vote && d.vote.valid ? percent(d.vote[key] / d.vote.valid, 0) : '–';

  return (
    <div ref={box} className="relative">
      <canvas
        ref={canvas}
        role="img"
        aria-label="Mapa de los municipios de España"
        className="block w-full text-border"
        style={{ aspectRatio: `${map.ancho} / ${map.alto}` }}
        onPointerMove={(event) => setTip(near(event.clientX, event.clientY))}
        onPointerLeave={() => setTip(null)}
      />
      {tip && d && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 w-max max-w-72 -translate-x-1/2 -translate-y-full rounded-xl bg-popover px-4 py-3 text-sm leading-snug text-popover-foreground shadow-md ring-1 ring-foreground/10"
          style={{ left: tip.x, top: tip.y - 14 }}
        >
          <p className="m-0 font-medium">
            {d.name} · {data.map.provincias[d.code.slice(0, 2)]?.corto}
          </p>
          <p className="m-0 text-muted-foreground">
            {thousands(d.pob)} habitantes
            {growth !== null &&
              ` (${growth >= 0 ? '+' : '−'}${percent(Math.abs(growth), 0)} desde ${data.since})`}
            {d.may65 !== null && ` · ${d.may65.toLocaleString('es-ES')} % con 65 años o más`}
            {d.renta !== null && ` · ${thousands(d.renta)} € por persona`}
          </p>
          <p className="m-0 text-muted-foreground">
            23J: PP {share('PP')} · PSOE {share('PSOE')} · Vox {share('VOX')} · Sumar {share('IZQ')}
          </p>
          {step === 'giro' && d.swing !== null && (
            <p className="m-0 text-muted-foreground">
              Giro 2019→2023:{' '}
              {Math.abs(d.swing).toLocaleString('es-ES', { maximumFractionDigits: 1 })} puntos hacia{' '}
              {d.swing > 0 ? 'PP, Vox y Cs' : 'PSOE y Sumar'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
