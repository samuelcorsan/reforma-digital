'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { minute } from '../../lib/elecciones/format';
import type { Interview, lanes as laneNames, Mark } from '../../lib/elecciones/interviews';
import { Label } from './report';

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

export function InterviewPlayer({
  youtubeId,
  duration,
  segments,
  speakers,
  marks,
  lanes,
}: {
  youtubeId: string | null;
  duration: number;
  segments: Interview['segmentos'];
  speakers: Record<Interview['segmentos'][number]['hablante'], string>;
  marks: Mark[];
  lanes: typeof laneNames;
}) {
  const { time, loaded, load, box, seek } = useVideo(youtubeId);
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
                Esta entrevista no tiene vídeo. Recórrela con la transcripción y la línea de tiempo.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <Label>Línea de tiempo</Label>
            <span className="font-mono text-sm tabular-nums">
              {minute(time)} <span className="text-muted-foreground">/ {minute(duration)}</span>
            </span>
          </div>
          {/* Un resumen visual para el ratón: la misma información, con teclado, está en «Momentos». */}
          <div aria-hidden="true" className="grid gap-2">
            {Object.entries(lanes).map(([id, name]) => (
              <div
                key={id}
                className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1"
              >
                <span className="text-sm text-muted-foreground">{name}</span>
                <div
                  className="relative h-6 cursor-pointer rounded-full bg-muted"
                  onClick={(event) => {
                    const r = event.currentTarget.getBoundingClientRect();
                    seek(((event.clientX - r.left) / r.width) * duration);
                  }}
                >
                  {marks
                    .filter((m) => m.lane === id)
                    .map((m) => (
                      <i
                        key={m.id}
                        title={`${minute(m.second)} · ${m.label}: ${m.text}`}
                        className="absolute inset-y-1 w-1 -translate-x-1/2 rounded-full"
                        style={{
                          left: `${(m.second / duration) * 100}%`,
                          background: m.color ?? 'var(--foreground)',
                        }}
                      />
                    ))}
                  <i
                    className="pointer-events-none absolute -inset-y-1 w-0.5 bg-brand"
                    style={{ left: `${(time / duration) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
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
          <ol className="relative m-0 grid max-h-[560px] list-none gap-1 overflow-y-auto p-0">
            {transcript}
          </ol>
        </TabsContent>
        <TabsContent value="momentos">
          <ol className="m-0 grid max-h-[560px] list-none gap-1 overflow-y-auto p-0">
            {marks.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => seek(m.second)}
                  className="grid w-full gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <i
                      aria-hidden="true"
                      className="block size-2 rounded-full"
                      style={{ background: m.color ?? 'var(--foreground)' }}
                    />
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
    </div>
  );
}
