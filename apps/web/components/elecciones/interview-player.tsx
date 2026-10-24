'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
// Los iconos miden 28 px: la línea empieza y acaba a media anchura de icono de cada borde.
const edge = 14;
// Distancia mínima entre dos iconos de la misma fila, y entre filas.
const gap = 30;
const at = (share: number) => `calc(${edge}px + (100% - ${2 * edge}px) * ${share})`;
// Los temas, en una escala de grises; el que suena va en tinta.
const greys = ['#5d5953', '#8f8a83', '#b3aea6', '#3b3935', '#d3cfc8', '#6d6963'];

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
  return { placed, height: 36 + Math.max(ends.length - 1, 0) * gap };
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
  const [inView, setInView] = useState(false);
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

  // La lista entera solo se vuelve a pintar cuando cambia el tramo que se está diciendo.
  const transcript = useMemo(
    () =>
      segments.map((s, i) => (
        <li key={`${s.inicio}-${i}`} ref={i === active ? follow : undefined}>
          <button
            type="button"
            onClick={() => seek(s.inicio)}
            aria-current={i === active || undefined}
            className="grid w-full gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted aria-[current=true]:bg-muted"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {minute(s.inicio)} · {speakers[s.hablante]}
            </span>
            <span
              className={cn(
                s.hablante === 'candidato' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.texto}
            </span>
          </button>
        </li>
      )),
    [segments, speakers, active, seek, follow],
  );

  // La ventana que se ve: la entrevista entera o unos minutos alrededor de lo que suena.
  const span = Math.min(zoom ?? duration, duration);
  const from = Math.min(Math.max(0, time - span / 2), Math.max(0, duration - span));
  const to = from + span;
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
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((x) => from + x * (to - from));

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
        <TabsList variant="line" className="h-auto w-full justify-start gap-4">
          <TabsTrigger value="transcripcion" className="min-h-11 flex-none px-1">
            Transcripción
          </TabsTrigger>
          <TabsTrigger value="momentos" className="min-h-11 flex-none px-1">
            Momentos ({marks.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="transcripcion">
          <ol className="relative m-0 grid max-h-[520px] list-none gap-1 overflow-y-auto p-0">
            {transcript}
          </ol>
        </TabsContent>
        <TabsContent value="momentos">
          <ol className="m-0 grid max-h-[520px] list-none gap-1 overflow-y-auto p-0">
            {marks.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="grid w-full gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted"
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
          <div role="group" aria-label="Zoom" className="flex gap-1 rounded-full bg-muted p-1">
            {zooms.map(([value, name]) => (
              <button
                key={name}
                type="button"
                aria-pressed={zoom === value}
                onClick={() => setZoom(value)}
                className="min-h-9 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background motion-reduce:transition-none"
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Las filas comparten la columna de la izquierda, así la línea vertical del tiempo las cruza todas. */}
        <div className="relative grid gap-1 [--label:6rem] sm:[--label:10rem]">
          {[
            {
              name: 'Intensidad',
              height: 36,
              content: (
                <svg
                  key="intensidad"
                  viewBox="0 0 1000 32"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-0 size-full"
                >
                  <path
                    d={`M${share(0) * 1000},32 ${minutes
                      .map((m) => `L${share(m.start + 30) * 1000},${32 - m.intensity * 28}`)
                      .join(' ')} L${share(duration) * 1000},32 Z`}
                    fill="color-mix(in oklab, var(--foreground) 12%, transparent)"
                    stroke="var(--foreground)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ),
            },
            {
              name: 'Tiene la palabra',
              height: 48,
              content: minutes
                .filter((m) => visible(m.start) || visible(m.start + 60))
                .map((m) => (
                  <span
                    key={m.start}
                    className="absolute top-1/2 h-0"
                    style={{
                      left: `${share(m.start) * 100}%`,
                      width: `calc(${(share(m.start + 60) - share(m.start)) * 100}% - 1px)`,
                    }}
                  >
                    <i
                      className="absolute bottom-0 left-0 w-full rounded-t-[2px]"
                      style={{ height: (m.candidate / 60) * 20, background: color }}
                    />
                    <i
                      className="absolute top-0 left-0 w-full rounded-b-[2px] bg-muted-foreground/40"
                      style={{ height: (m.interviewer / 60) * 20 }}
                    />
                  </span>
                )),
            },
            {
              name: 'Temas',
              height: 28,
              content: topics
                .filter((t) => t.fin >= from && t.inicio <= to)
                .map((t, i) => (
                  <span
                    key={`${t.tema}-${t.inicio}-${i}`}
                    title={t.tema}
                    className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[3px] border-x border-background"
                    style={{
                      left: `${share(t.inicio) * 100}%`,
                      width: `${(share(t.fin) - share(t.inicio)) * 100}%`,
                      background:
                        t.tema === topic
                          ? 'var(--foreground)'
                          : greys[topicNames.indexOf(t.tema) % greys.length],
                    }}
                  />
                )),
            },
          ].map(({ name, height, content }) => (
            <div
              key={name}
              className="grid grid-cols-[var(--label)_minmax(0,1fr)] items-center gap-3"
            >
              <span className="text-sm leading-tight text-muted-foreground">{name}</span>
              <div className="relative cursor-pointer" style={{ height }} onClick={seekAt}>
                {/* Recortado a los mismos márgenes que los carriles de iconos. */}
                <div className="absolute inset-y-0 inset-x-3.5 overflow-hidden">{content}</div>
              </div>
            </div>
          ))}

          {Object.entries(lanes).map(([id, name], i) => {
            const lane = stack(
              marks.filter((m) => m.lane === id && visible(m.second)),
              (width - 2 * edge) / (to - from),
            );
            return (
              <div
                key={id}
                className={cn(
                  'grid grid-cols-[var(--label)_minmax(0,1fr)] items-start gap-3',
                  i === 0 && 'mt-2 border-t border-border pt-3',
                )}
              >
                <span className="pt-2 text-sm leading-tight text-muted-foreground">{name}</span>
                {/* Clic en la línea: salta a ese punto. Clic en un icono: salta a la marca y la explica. */}
                <div
                  ref={i === 0 ? track : undefined}
                  className="relative cursor-pointer"
                  style={{ height: lane.height }}
                  onClick={seekAt}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3.5 top-[18px] h-px bg-border"
                  />
                  {lane.placed.map(({ mark: m, row }) => (
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
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform hover:z-10 hover:scale-115 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:z-10 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:transition-none"
                      style={{ left: at(share(m.second)), top: 18 + row * gap }}
                    >
                      <MarkIcon kind={m.kind} color={m.color} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* La línea del tiempo: una sola, de arriba abajo. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 left-[calc(var(--label)+12px)]"
          >
            <i
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand"
              style={{ left: at(share(time)) }}
            >
              <b className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand" />
            </i>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="grid grid-cols-[var(--label)_minmax(0,1fr)] gap-3 [--label:6rem] sm:[--label:10rem]"
        >
          <span />
          <div className="relative h-4 font-mono text-xs text-muted-foreground tabular-nums">
            {ticks.map((second, i) => (
              <span
                key={i}
                className={cn(
                  'absolute',
                  i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
                  // En móvil solo caben el principio, la mitad y el final.
                  i % 2 === 1 && 'max-sm:hidden',
                )}
                style={{ left: at(i / (ticks.length - 1)) }}
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
