'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { minute } from '../../lib/elecciones/format';
import type { Interview, lanes as laneNames, Mark } from '../../lib/elecciones/interviews';
import { Icon } from '../brand/icon';
import { MarkIcon } from './mark-icon';
import { Label } from './report';
import { useWidth } from './use-width';

type Player = {
  playVideo(): void;
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
      events: { onReady: () => void };
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

// El vídeo de YouTube solo se carga si la persona lo pide: hasta entonces, el navegador no se
// conecta con Google. La transcripción y la línea de tiempo funcionan sin él.
function useVideo(youtubeId: string | null) {
  const [time, setTime] = useState(0);
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

  const seek = useCallback((second: number) => {
    setTime(second);
    start.current = second;
    if (player.current && ready.current) {
      player.current.seekTo(second, true);
      player.current.playVideo();
    }
  }, []);

  return { time, loaded, load: () => setLoaded(true), box, seek };
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
// Los iconos miden 28 px: la línea empieza y acaba a media anchura de icono de cada borde.
const edge = 14;
// Distancia mínima entre dos iconos de la misma fila, y entre filas.
const gap = 30;
const at = (share: number) => `calc(${edge}px + (100% - ${2 * edge}px) * ${share})`;

// Las marcas que se pisarían bajan a otra fila de su carril: así se ven todas sin zoom.
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
}) {
  const { time, loaded, load, box, seek } = useVideo(youtubeId);
  const [selected, setSelected] = useState<Mark | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const width = useWidth(track, 600);
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

  return (
    <div className="grid grid-cols-12 gap-4">
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
                    . Aquí, recórrela con la transcripción y la línea de tiempo.
                  </>
                ) : (
                  'Esta entrevista no tiene vídeo. Recórrela con la transcripción y la línea de tiempo.'
                )}
              </p>
            )}
          </div>
        )}
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
          <ol className="relative m-0 grid max-h-[420px] list-none gap-1 overflow-y-auto p-0">
            {transcript}
          </ol>
        </TabsContent>
        <TabsContent value="momentos">
          <ol className="m-0 grid max-h-[420px] list-none gap-1 overflow-y-auto p-0">
            {marks.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => seek(m.second)}
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

      <div className="col-span-12 grid gap-3 rounded-xl p-6 ring-1 ring-foreground/10 lg:p-8 max-sm:p-5">
        <div className="flex items-baseline justify-between gap-4">
          <Label>Línea de tiempo</Label>
          <span className="font-mono text-sm tabular-nums">
            {minute(time)} <span className="text-muted-foreground">/ {minute(duration)}</span>
          </span>
        </div>
        {Object.entries(lanes).map(([id, name]) => {
          const lane = stack(
            marks.filter((m) => m.lane === id),
            (width - 2 * edge) / duration,
          );
          return (
            <div
              key={id}
              className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-0"
            >
              <span className="text-sm text-muted-foreground">{name}</span>
              {/* Clic en la línea: salta a ese punto. Clic en un icono: salta a la marca y la explica. */}
              <div
                ref={id === 'momentos' ? track : undefined}
                className="relative cursor-pointer"
                style={{ height: lane.height }}
                onClick={(event) => {
                  const r = event.currentTarget.getBoundingClientRect();
                  const at = (event.clientX - r.left - edge) / (r.width - 2 * edge);
                  seek(Math.min(1, Math.max(0, at)) * duration);
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3.5 top-[18px] h-px bg-border"
                />
                <i
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand"
                  style={{ left: at(time / duration) }}
                />
                {lane.placed.map(({ mark: m, row }) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-label={`${minute(m.second)} · ${m.label}: ${m.text}`}
                    aria-pressed={selected?.id === m.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(m);
                      seek(m.second);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform hover:z-10 hover:scale-115 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:z-10 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:transition-none"
                    style={{ left: at(m.second / duration), top: 18 + row * gap }}
                  >
                    <MarkIcon kind={m.kind} color={m.color} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div
          aria-hidden="true"
          className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1"
        >
          <span className="max-sm:hidden" />
          <div className="relative h-4 font-mono text-xs text-muted-foreground tabular-nums">
            {[0, 0.25, 0.5, 0.75, 1].map((share) => (
              <span key={share} className="absolute -translate-x-1/2" style={{ left: at(share) }}>
                {minute(share * duration)}
              </span>
            ))}
          </div>
        </div>

        {selected && (
          <div aria-live="polite" className="grid gap-1 rounded-lg bg-muted p-4">
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <MarkIcon kind={selected.kind} color={selected.color} className="size-6" />
              {minute(selected.second)} · {selected.label}
            </span>
            <span>{selected.text}</span>
            {selected.detail && (
              <span className="text-sm text-muted-foreground">{selected.detail}</span>
            )}
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 text-sm font-medium">
            Qué significa cada icono
            <span aria-hidden="true" className="flex group-data-open:rotate-180">
              <Icon name="abajo" size={16} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-2 p-0 pt-2 text-sm">
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
    </div>
  );
}
