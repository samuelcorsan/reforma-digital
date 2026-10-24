'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { minute } from '../../lib/elecciones/format';
import type { Interview, lanes as laneNames, Mark, Minute } from '../../lib/elecciones/interviews';
import { Icon } from '../brand/icon';
import { MarkIcon } from './mark-icon';
import { Label } from './report';
import { useWidth } from './use-width';

type Player = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(second: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
};
type YouTube = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host: string;
      playerVars: Record<string, number>;
      events: { onReady: () => void; onStateChange: (event: { data: number }) => void };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YouTube;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<YouTube> | undefined;
const loadYouTube = () =>
  (api ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  }));

// El reloj de la entrevista. Con YouTube, el vídeo manda, y solo se carga si la persona lo pide:
// hasta entonces, el navegador no se conecta con Google. Sin vídeo que incrustar, un reloj propio
// recorre la transcripción y la línea de tiempo.
function useClock(youtubeId: string | null, duration: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const ready = useRef(false);
  const start = useRef(0);

  useEffect(() => {
    if (!loaded || !youtubeId) return;
    let alive = true;
    let poll = 0;
    void loadYouTube().then((YT) => {
      if (!alive || !box.current) return;
      const target = document.createElement('div');
      box.current.replaceChildren(target);
      player.current = new YT.Player(target, {
        videoId: youtubeId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(start.current) },
        events: {
          onReady: () => {
            ready.current = true;
          },
          onStateChange: (event) => setPlaying(event.data === 1),
        },
      });
      poll = window.setInterval(() => {
        if (ready.current && player.current) setTime(player.current.getCurrentTime());
      }, 250);
    });
    return () => {
      alive = false;
      window.clearInterval(poll);
      player.current?.destroy();
      player.current = null;
      ready.current = false;
    };
  }, [loaded, youtubeId]);

  // Reloj propio, sin vídeo. Con un temporizador y no con requestAnimationFrame: sigue en marcha
  // aunque la pestaña pase a segundo plano.
  useEffect(() => {
    if (youtubeId || !playing) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      setTime((t) => Math.min(duration, t + elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [youtubeId, playing, duration]);
  // Sin vídeo, al llegar al final se para.
  useEffect(() => {
    if (!youtubeId && playing && time >= duration) setPlaying(false);
  }, [youtubeId, playing, time, duration]);

  const seek = useCallback(
    (second: number) => {
      const to = Math.min(duration, Math.max(0, second));
      setTime(to);
      start.current = to;
      if (player.current && ready.current) {
        player.current.seekTo(to, true);
        player.current.playVideo();
      }
    },
    [duration],
  );

  const toggle = () => {
    if (!youtubeId) {
      if (!playing && time >= duration) setTime(0);
      setPlaying(!playing);
    } else if (!loaded) setLoaded(true);
    else if (player.current && ready.current) {
      if (playing) player.current.pauseVideo();
      else player.current.playVideo();
    }
  };

  return { time, playing, loaded, load: () => setLoaded(true), box, seek, toggle };
}

const legend: [Mark['kind'], string][] = [
  ['momento', 'Momento clave'],
  ['completa', 'Propuesta completa'],
  ['casi', 'Propuesta casi completa'],
  ['legal', 'Cierto'],
  ['amarilla', 'Con matices'],
  ['fuera', 'Engañoso'],
  ['roja', 'Falso'],
  ['repregunta', 'Repregunta'],
  ['evasiva', 'Evasiva o cambio de tema'],
  ['critica', 'Crítica política'],
  ['ataque', 'Ataque personal'],
  ['interrumpe', 'Interrumpe'],
  ['interrumpido', 'Le interrumpen'],
];
// El recuento bajo el vídeo: lo que ha pasado hasta el segundo que suena.
const tally: [Mark['kind'], string][] = [
  ['completa', 'Propuestas completas'],
  ['casi', 'Casi completas'],
  ['legal', 'Cierto'],
  ['amarilla', 'Con matices'],
  ['fuera', 'Engañoso'],
  ['roja', 'Falso'],
  ['evasiva', 'Evasivas'],
  ['interrumpe', 'Interrumpe'],
];
const zooms = [
  [null, 'Entera'],
  [720, '12 min'],
  [180, '3 min'],
] as const;
// Los iconos de la línea de tiempo miden 24 px: las pistas empiezan y acaban a media anchura de
// icono de cada borde.
const edge = 12;
// Distancia mínima entre dos iconos de la misma fila, y entre filas; y el centro de la primera fila.
const gap = 26;
const half = 17;
const at = (share: number) => `calc(${edge}px + (100% - ${2 * edge}px) * ${share})`;
// Los temas, en una escala de grises; el que suena va en tinta.
const greys = ['#8f8a83', '#b3aea6', '#a29c94', '#c9c5be', '#7d7871', '#d3cfc8'];

// Las marcas que se pisarían bajan a otra fila de su carril: así se ven todas.
function stack(list: Mark[], pixelsPerSecond: number) {
  const ends: number[] = [];
  const placed = list.map((mark) => {
    const x = mark.second * pixelsPerSecond;
    let row = ends.findIndex((end) => x - end >= gap);
    if (row === -1) row = ends.push(x) - 1;
    else ends[row] = x;
    return { mark, row };
  });
  return { placed, height: 2 * half + Math.max(ends.length - 1, 0) * gap };
}

export function InterviewPlayer({
  youtubeId,
  source,
  outlet,
  duration,
  segments,
  speakers,
  marks,
  lanes,
  minutes,
  topics,
  color,
}: {
  youtubeId: string | null;
  // El vídeo en la web del medio, si no está en YouTube.
  source: string | null;
  outlet: string;
  duration: number;
  segments: Interview['segmentos'];
  speakers: Record<Interview['segmentos'][number]['hablante'], string>;
  marks: Mark[];
  lanes: typeof laneNames;
  minutes: Minute[];
  topics: Interview['temas'];
  // El color de su partido, para su tiempo de palabra.
  color: string;
}) {
  const { time, playing, loaded, load, box, seek, toggle } = useClock(youtubeId, duration);
  const [selected, setSelected] = useState<Mark | null>(null);
  const [hovered, setHovered] = useState<Mark | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  // Con zoom, dónde empieza la ventana si la has movido tú; sin valor, sigue a lo que suena.
  const [pan, setPan] = useState<number | null>(null);
  const dragging = useRef(false);
  const [inView, setInView] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // Sin «:» ni «»», que rompen `url(#…)`.
  const gradient = `intensidad-${useId().replace(/[^\w-]/g, '')}`;
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const width = useWidth(track, 600);

  // La barra flotante solo se ve mientras el visor está en pantalla.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // El último tramo que ya ha empezado.
  const next = segments.findIndex((s) => s.inicio > time);
  const active = (next === -1 ? segments.length : next) - 1;
  // El tramo que se está diciendo se queda a la vista dentro de su panel, sin mover la página:
  // al sonar, al saltar a un momento y al volver a la pestaña.
  const follow = useCallback((item: HTMLLIElement | null) => {
    const list = item?.parentElement;
    if (item && list) list.scrollTop = item.offsetTop - 16;
  }, []);

  // Las marcas que caen en cada tramo, para enseñarlas junto a quien habla.
  const marksBySegment = useMemo(
    () =>
      segments.map((s, i) => {
        // En segundos enteros: las marcas van al segundo y los tramos traen decimales.
        const end = Math.floor(segments[i + 1]?.inicio ?? Infinity);
        return marks.filter((m) => m.second >= Math.floor(s.inicio) && m.second < end);
      }),
    [segments, marks],
  );

  // La lista entera solo se vuelve a pintar cuando cambia el tramo que se está diciendo.
  const transcript = useMemo(
    () =>
      segments.map((s, i) => (
        <li key={`${s.inicio}-${i}`} ref={i === active ? follow : undefined}>
          <button
            type="button"
            onClick={() => seek(s.inicio)}
            aria-current={i === active || undefined}
            className="grid w-full gap-1.5 rounded-lg p-3 text-left transition-colors hover:bg-background/60 aria-[current=true]:bg-background aria-[current=true]:shadow-sm motion-reduce:transition-none"
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <i
                aria-hidden="true"
                className="block size-2 rounded-full"
                style={{
                  background: s.hablante === 'candidato' ? color : 'var(--muted-foreground)',
                }}
              />
              <span className={cn(s.hablante === 'candidato' && 'font-medium')}>
                {speakers[s.hablante]}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {minute(s.inicio)}
              </span>
              {!!marksBySegment[i]?.length && (
                <span className="ml-auto flex flex-wrap gap-1">
                  {marksBySegment[i]?.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-full bg-background py-0.5 pr-2.5 pl-0.5 text-xs ring-1 ring-border"
                    >
                      <MarkIcon kind={m.kind} color={m.color} className="size-5" />
                      {m.label}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span
              className={cn(
                'leading-relaxed',
                s.hablante === 'candidato' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.texto}
            </span>
          </button>
        </li>
      )),
    [segments, speakers, color, marksBySegment, active, seek, follow],
  );

  // La ventana que se ve: la entrevista entera o unos minutos alrededor de lo que suena.
  const span = Math.min(zoom ?? duration, duration);
  const clampStart = (start: number) => Math.min(Math.max(0, start), Math.max(0, duration - span));
  const from = clampStart(pan ?? time - span / 2);
  const to = from + span;
  // Si lo que suena sale de la ventana que habías movido, vuelve a seguirlo.
  useEffect(() => {
    if (playing && pan != null && !dragging.current && (time < pan || time > pan + span))
      setPan(null);
  }, [playing, pan, time, span]);
  // El minimapa: la ventana se centra donde pulsas y se arrastra.
  const panTo = (event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - r.left) / r.width));
    setPan(clampStart(x * duration - span / 2));
  };
  const share = (second: number) => (second - from) / (to - from);
  const visible = (second: number) => second >= from && second <= to;
  const seekAt = (event: MouseEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - r.left - edge) / (r.width - 2 * edge);
    seek(from + Math.min(1, Math.max(0, x)) * (to - from));
  };

  const topicNames = [...new Set(topics.map((t) => t.tema))];
  const topic = topics.find((t) => t.inicio <= time && time < t.fin)?.tema;
  // Lo que se explica debajo: lo que señalas, lo que has elegido o, sonando, lo último que pasó.
  const passed = marks.filter((m) => m.second <= time).at(-1);
  const shown =
    hovered ?? selected ?? (playing && passed && time - passed.second < 25 ? passed : null);
  const pick = (m: Mark) => {
    setSelected(m);
    seek(m.second);
  };
  // Marcas del eje cada 30 s, 1, 2, 5, 10, 15, 20 o 30 minutos: las que quepan.
  const step =
    [30, 60, 120, 300, 600, 900, 1200, 1800].find(
      (s) => (to - from) / s <= Math.max(2, Math.floor(width / 110)),
    ) ?? 3600;
  const ticks = Array.from(
    { length: Math.floor(to / step) - Math.ceil(from / step) + 1 },
    (_, i) => (Math.ceil(from / step) + i) * step,
  );
  // La intensidad como una curva suave: de cada punto, a medio camino del siguiente.
  const points = minutes.map((m) => [share(m.start + 30) * 1000, 38 - m.intensity * 34] as const);
  const curve =
    points.reduce((d, [x, y], i) => {
      const prev = points[i - 1];
      return prev
        ? `${d} Q${prev[0]},${prev[1]} ${(prev[0] + x) / 2},${(prev[1] + y) / 2}`
        : `M${x},${y}`;
    }, '') + (points.length ? ` L${points.at(-1)?.join(',')}` : '');
  // El segundo bajo el ratón, o nada si está fuera de las pistas.
  const timeAt = (event: MouseEvent<HTMLElement>) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return null;
    const x = (event.clientX - r.left - edge) / (r.width - 2 * edge);
    return x < 0 || x > 1 ? null : from + x * (to - from);
  };
  const row = (label: ReactNode, height: number, content: ReactNode) => (
    <div className="grid grid-cols-[var(--label)_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm leading-tight text-muted-foreground">{label}</span>
      <div className="relative" style={{ height }}>
        {/* Recortado a los mismos márgenes que los carriles de iconos. */}
        <div className="absolute inset-y-0 inset-x-3 overflow-hidden">{content}</div>
      </div>
    </div>
  );

  return (
    <div ref={root} className="grid grid-cols-12 gap-4">
      <div className="col-span-12 grid content-start gap-6 rounded-xl p-6 ring-1 ring-foreground/10 lg:col-span-7 lg:p-8 max-sm:p-5">
        {youtubeId && loaded ? (
          <div
            ref={box}
            className="aspect-video overflow-hidden rounded-lg bg-muted [&_iframe]:size-full"
          />
        ) : (
          <div className="grid aspect-video place-content-center justify-items-center gap-4 rounded-lg bg-muted p-6 text-center">
            {youtubeId ? (
              <>
                <Button variant="sunset" size="xl" onClick={load}>
                  Cargar el vídeo{time ? ` en el minuto ${minute(time)}` : ''}
                </Button>
                <p className="m-0 max-w-[44ch] text-sm text-muted-foreground">
                  Se carga desde YouTube: al pulsar, Google recibe tu visita.{' '}
                  <Link href="/privacy" className="underline underline-offset-4">
                    Privacidad
                  </Link>
                </p>
              </>
            ) : (
              <p className="m-0 max-w-[44ch] text-muted-foreground">
                {source ? (
                  <>
                    El vídeo está en la web de {outlet || 'su medio'}:{' '}
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline underline-offset-4"
                    >
                      verlo allí<span aria-hidden="true"> ↗</span>
                      <span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                    .{' '}
                  </>
                ) : (
                  'Esta entrevista no tiene vídeo. '
                )}
                Dale al play para recorrerla con la transcripción y la línea de tiempo.
              </p>
            )}
          </div>
        )}
        <div className="grid gap-3">
          <Label>Recuento hasta el {minute(time)}</Label>
          <dl className="m-0 grid grid-cols-4 gap-x-3 gap-y-4 max-sm:grid-cols-2">
            {tally.map(([kind, name]) => (
              <div key={kind} className="grid content-start justify-items-start gap-1">
                <dt className="order-last text-sm leading-tight text-muted-foreground">{name}</dt>
                <dd className="m-0 flex items-center gap-2 font-heading text-2xl tabular-nums">
                  <MarkIcon kind={kind} color={marks.find((m) => m.kind === kind)?.color} />
                  {marks.filter((m) => m.kind === kind && m.second <= time).length}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <Tabs
        defaultValue="transcripcion"
        className="col-span-12 gap-4 rounded-xl p-6 ring-1 ring-foreground/10 lg:col-span-5 lg:p-8 max-sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList aria-label="Qué ver">
            <TabsTrigger value="transcripcion" className="px-3">
              Transcripción
            </TabsTrigger>
            <TabsTrigger value="momentos" className="px-3">
              Momentos ({marks.length})
            </TabsTrigger>
          </TabsList>
          <span className="text-sm text-muted-foreground">Pulsa para ir a ese momento</span>
        </div>
        <TabsContent value="transcripcion">
          <ol className="relative m-0 grid max-h-[520px] list-none gap-1 overflow-y-auto rounded-xl bg-muted p-2">
            {transcript}
          </ol>
        </TabsContent>
        <TabsContent value="momentos">
          <ol className="m-0 grid max-h-[520px] list-none gap-1 overflow-y-auto rounded-xl bg-muted p-2">
            {marks.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="grid w-full gap-1 rounded-lg p-3 text-left transition-colors hover:bg-background motion-reduce:transition-none"
                >
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <MarkIcon kind={m.kind} color={m.color} className="size-6" />
                    {minute(m.second)} · {m.label}
                  </span>
                  <span>{m.text}</span>
                  {m.detail && <span className="text-sm text-muted-foreground">{m.detail}</span>}
                </button>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>

      <div className="col-span-12 grid gap-4 rounded-xl p-6 ring-1 ring-foreground/10 lg:p-8 max-sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <Label>Línea de tiempo</Label>
            <span className="font-mono text-sm tabular-nums">
              {minute(time)} <span className="text-muted-foreground">/ {minute(duration)}</span>
              {topic && <span className="text-muted-foreground"> · {topic}</span>}
            </span>
          </div>
          <Tabs
            value={String(zoom)}
            onValueChange={(value) => {
              setZoom(zooms.find(([z]) => String(z) === value)?.[0] ?? null);
              setPan(null);
            }}
          >
            <TabsList aria-label="Zoom">
              {zooms.map(([value, name]) => (
                <TabsTrigger key={name} value={String(value)} className="px-3">
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {zoom != null && (
          <div className="grid grid-cols-[var(--label)_minmax(0,1fr)] items-center gap-3 [--label:6rem] sm:[--label:10rem]">
            <span className="text-sm leading-tight text-muted-foreground">Toda la entrevista</span>
            {/* Arrastra la ventana (o pulsa en un punto) para moverte por la entrevista con zoom. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Parte de la entrevista que se ve"
              aria-valuemin={0}
              aria-valuemax={Math.round(Math.max(0, duration - span))}
              aria-valuenow={Math.round(from)}
              aria-valuetext={`De ${minute(from)} a ${minute(to)}`}
              className="relative h-7 cursor-grab touch-none rounded-md outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
              onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                panTo(event);
              }}
              onPointerMove={(event) => dragging.current && panTo(event)}
              onPointerUp={() => {
                dragging.current = false;
              }}
              onKeyDown={(event) => {
                const moves: Record<string, number> = {
                  ArrowLeft: from - span / 4,
                  ArrowRight: from + span / 4,
                  Home: 0,
                  End: duration,
                };
                const start = moves[event.key];
                if (start === undefined) return;
                event.preventDefault();
                setPan(clampStart(start));
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-[2px] bg-muted"
              >
                {topics.map((t, i) => (
                  <i
                    key={`${t.tema}-${t.inicio}-${i}`}
                    className="absolute inset-y-0"
                    style={{
                      left: `${(t.inicio / duration) * 100}%`,
                      width: `${((t.fin - t.inicio) / duration) * 100}%`,
                      background: greys[topicNames.indexOf(t.tema) % greys.length],
                    }}
                  />
                ))}
              </span>
              <i
                aria-hidden="true"
                className="absolute inset-y-1 w-px bg-foreground"
                style={{ left: `${(time / duration) * 100}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 rounded-md border border-foreground bg-foreground/5"
                style={{
                  left: `${(from / duration) * 100}%`,
                  width: `${(span / duration) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Las filas comparten la columna de la izquierda, así las líneas del tiempo las cruzan todas. */}
        <div
          className="relative grid pt-7 [--label:6rem] sm:[--label:10rem]"
          onMouseMove={(event) => setHover(timeAt(event))}
          onMouseLeave={() => setHover(null)}
          onClick={(event) => {
            const second = timeAt(event);
            if (second != null) seek(second);
          }}
        >
          {row(
            'Intensidad',
            40,
            <svg
              viewBox="0 0 1000 40"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="absolute inset-0 size-full"
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.32" />
                  <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <path
                d={`${curve} L${share(duration) * 1000},40 L${share(0) * 1000},40 Z`}
                fill={`url(#${gradient})`}
              />
              <path
                d={curve}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>,
          )}
          {row(
            // Los nombres, como etiquetas cortas en mayúsculas (12 px): Sol no deja texto corrido por
            // debajo de 14 px.
            <span className="grid gap-1">
              <span className="font-mono text-xs leading-tight tracking-[0.06em] text-foreground uppercase">
                {speakers.candidato}
              </span>
              <span>Tiene la palabra</span>
              <span className="font-mono text-xs leading-tight tracking-[0.06em] uppercase">
                {speakers.jordi}
              </span>
            </span>,
            60,
            <>
              <i aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {minutes
                .filter((m) => visible(m.start) || visible(m.start + 60))
                .map((m) => (
                  <span
                    key={m.start}
                    className="absolute top-1/2 h-0"
                    style={{
                      left: `calc(${share(m.start) * 100}% + 1px)`,
                      width: `calc(${(share(m.start + 60) - share(m.start)) * 100}% - 2px)`,
                    }}
                  >
                    <i
                      className="absolute bottom-0 left-0 w-full rounded-t-[2px]"
                      style={{
                        height: (m.candidate / 60) * 27,
                        background: `color-mix(in oklab, ${color} 55%, var(--background))`,
                      }}
                    />
                    <i
                      className="absolute top-0 left-0 w-full rounded-b-[2px] bg-muted-foreground/25"
                      style={{ height: (m.interviewer / 60) * 27 }}
                    />
                  </span>
                ))}
            </>,
          )}
          {row(
            'Temas',
            24,
            topics
              .filter((t) => t.fin >= from && t.inicio <= to)
              .map((t, i) => (
                <span
                  key={`${t.tema}-${t.inicio}-${i}`}
                  title={t.tema}
                  className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[2px]"
                  style={{
                    left: `calc(${share(t.inicio) * 100}% + 1px)`,
                    width: `calc(${(share(t.fin) - share(t.inicio)) * 100}% - 2px)`,
                    background:
                      t.tema === topic
                        ? 'var(--foreground)'
                        : greys[topicNames.indexOf(t.tema) % greys.length],
                  }}
                />
              )),
          )}

          {Object.entries(lanes).map(([id, name]) => {
            const lane = stack(
              marks.filter((m) => m.lane === id && visible(m.second)),
              (width - 2 * edge) / (to - from),
            );
            return (
              <div
                key={id}
                className="grid grid-cols-[var(--label)_minmax(0,1fr)] items-start gap-3 border-t border-border"
              >
                <span className="py-2 text-sm leading-tight text-muted-foreground">{name}</span>
                <div className="relative" style={{ height: lane.height }}>
                  {lane.placed.map(({ mark: m, row: level }) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`${minute(m.second)} · ${m.label}: ${m.text}`}
                      aria-pressed={selected?.id === m.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        pick(m);
                      }}
                      onMouseEnter={() => setHovered(m)}
                      onMouseLeave={() => setHovered(null)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:z-10 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:transition-none"
                      style={{ left: at(share(m.second)), top: half + level * gap }}
                    >
                      <MarkIcon
                        kind={m.kind}
                        color={m.color}
                        className={cn(
                          'size-6',
                          !m.color && 'bg-transparent text-muted-foreground ring-0',
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* La columna de las pistas: la línea de lo que suena (continua) y la del ratón (discontinua). */}
          <div
            ref={track}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 left-[calc(var(--label)+12px)]"
          >
            {visible(time) && (
              <i
                className="absolute top-1 bottom-0 w-px -translate-x-1/2 bg-foreground"
                style={{ left: at(share(time)) }}
              >
                <b className="absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground" />
              </i>
            )}
            {hover != null && (
              <i
                className="absolute top-6 bottom-0 -translate-x-1/2 border-l border-dashed border-foreground/40"
                style={{ left: at(share(hover)) }}
              >
                <b className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 font-mono text-xs font-normal whitespace-nowrap text-background">
                  {minute(hover)}
                </b>
              </i>
            )}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="grid grid-cols-[var(--label)_minmax(0,1fr)] gap-3 [--label:6rem] sm:[--label:10rem]"
        >
          <span />
          <div className="relative h-4 font-mono text-xs text-muted-foreground tabular-nums">
            {ticks.map((second) => (
              <span
                key={second}
                className="absolute -translate-x-1/2"
                style={{ left: at(share(second)) }}
              >
                {minute(second)}
              </span>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="grid min-h-24 gap-1 rounded-lg bg-muted p-4">
          {shown ? (
            <>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <MarkIcon kind={shown.kind} color={shown.color} className="size-6" />
                {minute(shown.second)} · {shown.label}
              </span>
              <span>{shown.text}</span>
              {shown.detail && (
                <span className="text-sm text-muted-foreground">{shown.detail}</span>
              )}
            </>
          ) : (
            <span className="self-center text-muted-foreground">
              Pasa el ratón por un icono o dale al play: aquí aparece cada marca según ocurre.
            </span>
          )}
        </div>

        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 text-sm font-medium">
            Cómo se lee
            <span aria-hidden="true" className="flex group-data-open:rotate-180">
              <Icon name="abajo" size={16} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 pt-2 text-sm">
            <p className="m-0 max-w-[70ch] text-muted-foreground">
              Intensidad: ida y vuelta por minuto (cambios de turno, interrupciones y momentos de
              tensión), con la misma escala para los cuatro; no mide emociones. Tiene la palabra:
              arriba, el tiempo del candidato en cada minuto; abajo, el del entrevistador.
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-2 p-0">
              {legend.map(([kind, name]) => (
                <li key={kind} className="flex items-center gap-2">
                  <MarkIcon kind={kind} color={marks.find((m) => m.kind === kind)?.color} />
                  {name}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Mandos siempre a mano mientras el visor está en pantalla. */}
      <div
        className={cn(
          'fixed bottom-4 left-1/2 z-30 flex w-[min(640px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-full bg-background p-2 shadow-(--shadow-overlay) transition-opacity motion-reduce:transition-none',
          inView ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!inView}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => seek(time - 10)}
          aria-label="10 segundos atrás"
          tabIndex={inView ? 0 : -1}
        >
          −10 s
        </Button>
        <Button
          variant="sunset"
          size="icon-lg"
          onClick={() => {
            setSelected(null);
            toggle();
          }}
          aria-label={playing ? 'Pausa' : 'Reproducir'}
          tabIndex={inView ? 0 : -1}
          className="rounded-full"
        >
          <Icon name={playing ? 'pausa' : 'reproducir'} size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => seek(time + 10)}
          aria-label="10 segundos adelante"
          tabIndex={inView ? 0 : -1}
        >
          +10 s
        </Button>
        <span className="min-w-0 flex-1 truncate font-mono text-sm tabular-nums">
          {minute(time)} <span className="text-muted-foreground">/ {minute(duration)}</span>
          {topic && <span className="text-muted-foreground max-sm:hidden"> · {topic}</span>}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full max-sm:hidden"
          tabIndex={inView ? 0 : -1}
          onClick={() => root.current?.scrollIntoView({ block: 'start' })}
        >
          Ver el vídeo <Icon name="arriba" size={14} />
        </Button>
      </div>
    </div>
  );
}
