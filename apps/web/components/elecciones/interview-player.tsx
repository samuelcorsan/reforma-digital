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
import { Input } from '@reforma-digital/design/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { minute } from '../../lib/elecciones/format';
import type { Interview, Mark, Minute } from '../../lib/elecciones/interviews';
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

  const play = useCallback(() => {
    if (!youtubeId) setPlaying(true);
    else if (!loaded) setLoaded(true);
    else if (player.current && ready.current) player.current.playVideo();
  }, [youtubeId, loaded]);
  const pause = useCallback(() => {
    if (!youtubeId) setPlaying(false);
    else if (player.current && ready.current) player.current.pauseVideo();
  }, [youtubeId]);

  return { time, playing, loaded, load: () => setLoaded(true), box, seek, toggle, play, pause };
}

const legend: [Mark['kind'], string][] = [
  ['momento', 'Momento clave'],
  ['completa', 'Propuesta completa'],
  ['casi', 'Propuesta casi completa'],
  ['incompleta', 'Propuesta incompleta'],
  ['legal', 'Cierto'],
  ['amarilla', 'Con matices'],
  ['fuera', 'Engañoso'],
  ['roja', 'Falso'],
  ['sinfuente', 'Sin fuente'],
  ['repregunta', 'Repregunta'],
  ['evasiva', 'Evasiva o cambio de tema'],
  ['critica', 'Crítica política'],
  ['ataque', 'Ataque personal'],
  ['interrumpe', 'Interrumpe'],
  ['interrumpido', 'Le interrumpen'],
  ['verificador', 'Verificadores en plató'],
  ['rotulo', 'En pantalla'],
  ['documento', 'Lo enseña'],
  ['accion', 'Acción'],
];
// Las del análisis de comunicación, solo si la entrevista lo tiene. Sus preguntas duras sustituyen
// a las repreguntas y evasivas.
const replaced = new Set<Mark['kind']>(['completa', 'casi', 'incompleta', 'repregunta', 'evasiva']);
const communicationLegend: [Mark['kind'], string][] = [
  ['comprobable', 'Compromiso comprobable'],
  ['compromiso', 'Compromiso sin objeto comprobable'],
  ['dura', 'Pregunta dura sin respuesta clara'],
  ['pausa', 'Pausa larga'],
  ['traba', 'Traba'],
  ['comentado', 'Minuto citado por el público'],
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
const communicationTally: [Mark['kind'], string][] = [
  ['comprobable', 'Compromisos comprobables'],
  ...tally.flatMap(([kind, name]): [Mark['kind'], string][] =>
    kind === 'completa' || kind === 'casi'
      ? []
      : [[kind === 'evasiva' ? 'dura' : kind, kind === 'evasiva' ? 'Sin respuesta clara' : name]],
  ),
];
// Los avisos sobre el vídeo: verificaciones, propuestas y momentos clave, unos segundos cada uno.
const alertLanes = new Set<Mark['lane']>(['momentos', 'propuestas', 'verificaciones']);
const alertSeconds = 8;
// Un «ding» corto para cada aviso, generado en el navegador: sin archivos de audio.
let audio: AudioContext | undefined;
function ding() {
  audio ??= new AudioContext();
  void audio.resume();
  const now = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.frequency.value = 880;
  volume.gain.setValueAtTime(0.12, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  tone.connect(volume).connect(audio.destination);
  tone.start(now);
  tone.stop(now + 0.3);
}
// Para buscar sin tildes ni mayúsculas. Conserva la longitud del texto (que llega en NFC), así que
// las posiciones sirven para resaltar en el original.
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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

// Las marcas que se pisarían bajan a otra fila de su carril, hasta tres; si no caben, se
// solapan en la fila que antes queda libre (con zoom se ven por separado).
const maxRows = 3;
function stack(list: Mark[], pixelsPerSecond: number) {
  const ends: number[] = [];
  const placed = list.map((mark) => {
    const x = mark.second * pixelsPerSecond;
    let row = ends.findIndex((end) => x - end >= gap);
    if (row === -1 && ends.length < maxRows) row = ends.push(x) - 1;
    else {
      if (row === -1) row = ends.indexOf(Math.min(...ends));
      ends[row] = x;
    }
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
  voice,
}: {
  youtubeId: string | null;
  // El vídeo en la web del medio, si no está en YouTube.
  source: string | null;
  outlet: string;
  duration: number;
  segments: Interview['segmentos'];
  speakers: Record<Interview['segmentos'][number]['hablante'], string>;
  marks: Mark[];
  lanes: Partial<Record<Mark['lane'], string>>;
  minutes: Minute[];
  topics: Interview['temas'];
  // El color de su partido, para su tiempo de palabra.
  color: string;
  // La intensidad de su voz minuto a minuto, respecto a su propia media (análisis de comunicación).
  voice?: (number | null)[];
}) {
  const { time, playing, loaded, load, box, seek, toggle, play, pause } = useClock(
    youtubeId,
    duration,
  );
  // El resumen: los momentos clave seguidos, de 3 s antes a 35 s después de cada uno.
  const clips = useMemo(
    () =>
      marks
        .filter((m) => m.kind === 'momento')
        .map((m) => ({
          mark: m,
          from: Math.max(0, m.second - 3),
          to: Math.min(duration, m.second + 35),
        })),
    [marks, duration],
  );
  const [summary, setSummary] = useState<number | null>(null);
  const clip = summary == null ? undefined : clips[summary];
  const goToClip = useCallback(
    (i: number) => {
      const next = clips[i];
      if (!next) return;
      setSummary(i);
      seek(next.from);
      play();
    },
    [clips, seek, play],
  );
  // Al acabar un momento, el siguiente; si mueves el vídeo fuera del momento, el resumen acaba.
  useEffect(() => {
    if (!clip || summary == null) return;
    if (time < clip.from - 1 || time > clip.to + 2) setSummary(null);
    else if (time >= clip.to) {
      if (summary + 1 < clips.length) goToClip(summary + 1);
      else {
        setSummary(null);
        pause();
      }
    }
  }, [time, summary, clip, clips.length, goToClip, pause]);
  const [selected, setSelected] = useState<Mark | null>(null);
  // La ficha de la marca que señalas (ratón) o que tiene el foco (teclado o un toque), junto a ella.
  const [tip, setTip] = useState<{ mark: Mark; x: number; top: number; bottom: number } | null>(
    null,
  );
  const board = useRef<HTMLDivElement>(null);
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

  // El mini reproductor: si el hueco del vídeo sale de la pantalla, el vídeo flota en una esquina
  // para verlo junto a la línea de tiempo. Solo cambia el CSS: el iframe es el mismo y no se recarga.
  const slot = useRef<HTMLDivElement>(null);
  const [slotInView, setSlotInView] = useState(true);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setSlotInView(!!entry?.isIntersecting);
      // Al volver a su sitio, la próxima vez vuelve a flotar.
      if (entry?.isIntersecting) setClosed(false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loaded, youtubeId]);
  const docked = !!youtubeId && loaded && !slotInView && !closed;

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

  // Buscar en la transcripción: cada tramo donde se dice, con lo buscado resaltado.
  const [query, setQuery] = useState('');
  const needle = fold(query.trim());
  const found = useMemo(
    () => (needle.length < 2 ? null : segments.filter((s) => fold(s.texto).includes(needle))),
    [segments, needle],
  );
  const marked = (text: string) => {
    const at = fold(text).indexOf(needle);
    return at < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, at)}
        <mark className="rounded-sm bg-foreground px-0.5 text-background">
          {text.slice(at, at + needle.length)}
        </mark>
        {text.slice(at + needle.length)}
      </>
    );
  };

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
  const point = (mark: Mark, element: HTMLElement) => {
    const b = board.current?.getBoundingClientRect();
    const r = element.getBoundingClientRect();
    if (b)
      setTip({
        mark,
        x: r.left + r.width / 2 - b.left,
        top: r.top - b.top,
        bottom: r.bottom - b.top,
      });
  };
  const pick = (m: Mark) => {
    setSelected(m);
    seek(m.second);
  };

  // Los enlaces «▶ minuto» de la página ponen el vídeo en ese segundo sin mover la página: con el
  // mini reproductor se ve desde donde estás.
  useEffect(() => {
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href);
      // Un enlace a este mismo vídeo en YouTube (`watch?v=…&t=…s`) o a esta página con `?t=`.
      const own = url.hostname === 'www.youtube.com' && url.searchParams.get('v') === youtubeId;
      const t = url.searchParams.get('t');
      const second = Number.parseInt(t ?? '', 10);
      if (!(own || url.pathname === window.location.pathname) || !Number.isFinite(second)) return;
      event.preventDefault();
      // Antes que el reproductor flotante: este ya está en la página.
      event.stopPropagation();
      setSelected(null);
      seek(second);
      play();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [seek, play, youtubeId]);
  // Un enlace compartido con `?t=` abre el informe en ese minuto. El vídeo no se carga solo: hasta
  // que la persona lo pide, el navegador no se conecta con Google.
  useEffect(() => {
    const second = Number(new URLSearchParams(window.location.search).get('t'));
    if (!second) return;
    seek(second);
    root.current?.closest('section')?.scrollIntoView({ block: 'start' });
  }, [seek]);
  // Los dos últimos que han pasado hace menos de `alertSeconds`.
  const [alertsOn, setAlertsOn] = useState(true);
  const [sound, setSound] = useState(true);
  const popups = alertsOn
    ? marks
        .filter((m) => alertLanes.has(m.lane) && m.second <= time && time - m.second < alertSeconds)
        .slice(-2)
    : [];
  // Suena al pasar por un aviso mientras se reproduce, no al saltar a él.
  const lastTime = useRef(time);
  useEffect(() => {
    const before = lastTime.current;
    lastTime.current = time;
    if (
      alertsOn &&
      sound &&
      playing &&
      time > before &&
      time - before < 2 &&
      marks.some((m) => alertLanes.has(m.lane) && m.second > before && m.second <= time)
    )
      ding();
  }, [time, alertsOn, sound, playing, marks]);
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
  // La voz: una línea por los minutos con frases suyas, sobre su propia media (la raya del centro).
  const hasCommunication = marks.some((m) => m.kind === 'dura');
  const voiceLine = voice?.reduce(
    (d, z, i) =>
      z === null
        ? d
        : `${d}${voice[i - 1] == null ? ' M' : ' L'}${share(i * 60 + 30) * 1000},${20 - Math.max(-2, Math.min(2, z)) * 9}`,
    '',
  );
  // El segundo bajo el ratón, o nada si está fuera de las pistas.
  const timeAt = (event: MouseEvent<HTMLElement>) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return null;
    const x = (event.clientX - r.left - edge) / (r.width - 2 * edge);
    return x < 0 || x > 1 ? null : from + x * (to - from);
  };
  const row = (label: ReactNode, height: number, content: ReactNode) => (
    <div className="grid grid-cols-[var(--label)_minmax(0,1fr)] items-center gap-3 py-3">
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
          // El hueco guarda el sitio del vídeo mientras flota.
          <div ref={slot} className="aspect-video">
            <div
              className={cn(
                'relative',
                docked &&
                  'fixed right-4 bottom-24 z-30 w-[min(360px,calc(100%-32px))] overflow-hidden rounded-lg shadow-(--shadow-overlay) max-sm:w-56 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4',
              )}
            >
              <div
                ref={box}
                className="aspect-video overflow-hidden rounded-lg bg-muted [&_iframe]:size-full"
              />
              {/* Sin aria-live: el panel bajo la línea de tiempo ya anuncia cada marca. */}
              {!!popups.length && (
                <ul className="pointer-events-none absolute top-3 left-3 m-0 grid max-w-[min(24rem,calc(100%-1.5rem))] list-none gap-2 p-0">
                  {popups.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => pick(m)}
                        className="pointer-events-auto grid gap-1 rounded-lg bg-popover/95 p-3 text-left text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <MarkIcon kind={m.kind} color={m.color} className="size-6" />
                          {m.label}
                          <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
                            {minute(m.second)}
                          </span>
                        </span>
                        <span
                          className={cn('text-sm leading-snug max-sm:hidden', docked && 'hidden')}
                        >
                          {m.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {docked && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Cerrar el mini reproductor"
                  onClick={() => {
                    setClosed(true);
                    pause();
                  }}
                  className="absolute top-2 right-2 rounded-full"
                >
                  <Icon name="nunca" size={14} />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid aspect-video place-content-center justify-items-center gap-4 rounded-lg bg-muted p-6 text-center">
            {youtubeId ? (
              <>
                <Button variant="sunset" size="xl" onClick={load}>
                  Cargar el vídeo{' '}
                  {/* En el móvil no cabe: el minuto ya se ve en la barra de mandos. */}
                  {time > 0 && <span className="max-sm:hidden">en el minuto {minute(time)}</span>}
                </Button>
                <p className="m-0 max-w-[44ch] text-sm text-muted-foreground">
                  El vídeo se carga desde YouTube: al pulsar, Google registra la visita.{' '}
                  <Link href="/privacy" className="underline underline-offset-4">
                    Privacidad
                  </Link>
                </p>
              </>
            ) : (
              <p className="m-0 max-w-[44ch] text-muted-foreground">
                {source ? (
                  <>
                    El vídeo está disponible en la web de {outlet || 'su medio'}:{' '}
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline underline-offset-4"
                    >
                      abrir el vídeo<span aria-hidden="true"> ↗</span>
                      <span className="sr-only"> (se abre en una pestaña nueva)</span>
                    </a>
                    .{' '}
                  </>
                ) : (
                  'Entrevista sin vídeo disponible. '
                )}
                El botón de reproducción recorre la entrevista en la transcripción y en la línea de
                tiempo.
              </p>
            )}
          </div>
        )}
        {clips.length > 0 &&
          (clip && summary != null ? (
            <div className="grid gap-3 rounded-lg bg-muted p-4">
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <MarkIcon kind="momento" className="size-6" />
                  Resumen · {summary + 1} de {clips.length}
                </span>
                <span className="flex gap-1">
                  {summary + 1 < clips.length && (
                    <Button variant="ghost" size="sm" onClick={() => goToClip(summary + 1)}>
                      Siguiente
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSummary(null)}>
                    Salir
                  </Button>
                </span>
              </span>
              <span className="leading-snug">
                {clip.mark.label}: {clip.mark.text}
              </span>
              <span aria-hidden="true" className="relative h-1 rounded-full bg-background">
                <i
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground"
                  style={{
                    width: `${Math.min(1, Math.max(0, (time - clip.from) / (clip.to - clip.from))) * 100}%`,
                  }}
                />
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => goToClip(0)}
              className="flex min-h-14 items-center gap-3 rounded-lg p-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted motion-reduce:transition-none"
            >
              <MarkIcon kind="momento" />
              <span className="grid gap-0.5">
                <b className="font-medium">Ver el resumen</b>
                <span className="text-sm text-muted-foreground">
                  {clips.length} momentos clave consecutivos · unos{' '}
                  {Math.max(1, Math.round(clips.reduce((t, c) => t + c.to - c.from, 0) / 60))} min
                </span>
              </span>
              <span className="ml-auto">
                <Icon name="derecha" size={16} />
              </span>
            </button>
          ))}

        <div className="grid gap-3">
          <Label>Recuento hasta el minuto {minute(time)}</Label>
          <dl className="m-0 grid grid-cols-4 gap-x-3 gap-y-4 max-sm:grid-cols-2">
            {(hasCommunication ? communicationTally : tally).map(([kind, name]) => (
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
        <TabsList aria-label="Qué ver">
          <TabsTrigger value="transcripcion" className="px-3">
            Transcripción
          </TabsTrigger>
          <TabsTrigger value="momentos" className="px-3">
            Momentos ({marks.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="transcripcion" className="grid gap-3">
          <Input
            type="search"
            aria-label="Buscar en la transcripción"
            placeholder="Buscar en la transcripción: vivienda, Puente…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {found && (
            <p aria-live="polite" className="m-0 text-sm text-muted-foreground">
              {found.length
                ? `${found.length} ${found.length === 1 ? 'resultado' : 'resultados'}`
                : 'Sin resultados en la transcripción'}
            </p>
          )}
          <ol className="relative m-0 grid max-h-[520px] list-none gap-1 overflow-y-auto rounded-xl bg-muted p-2">
            {found
              ? found.map((s) => (
                  <li key={s.inicio}>
                    <button
                      type="button"
                      onClick={() => seek(s.inicio)}
                      className="grid w-full gap-1.5 rounded-lg p-3 text-left transition-colors hover:bg-background/60 motion-reduce:transition-none"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <span className={cn(s.hablante === 'candidato' && 'font-medium')}>
                          {speakers[s.hablante]}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {minute(s.inicio)}
                        </span>
                      </span>
                      <span className="leading-relaxed">{marked(s.texto)}</span>
                    </button>
                  </li>
                ))
              : transcript}
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
              aria-label="Intervalo visible de la entrevista"
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
          ref={board}
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
          {voiceLine &&
            row(
              'Voz',
              40,
              <svg
                viewBox="0 0 1000 40"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute inset-0 size-full"
              >
                <line
                  x1="0"
                  x2="1000"
                  y1="20"
                  y2="20"
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={voiceLine}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>,
            )}
          {row(
            // Los nombres, más pequeños que la etiqueta de la fila (12 px; lo pidió la persona que
            // lo diseña, aunque Sol reserva ese tamaño para las etiquetas en mayúsculas).
            <span className="grid gap-0.5">
              <span className="text-xs leading-tight text-foreground">{speakers.candidato}</span>
              <span>Tiene la palabra</span>
              <span className="text-xs leading-tight">{speakers.jordi}</span>
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
                {marks.some((m) => m.lane === id) ? (
                  <div className="relative" style={{ height: lane.height }}>
                    {lane.placed.map(({ mark: m, row: level }) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-label={`${minute(m.second)} · ${m.label}: ${m.text}`}
                        aria-pressed={selected?.id === m.id}
                        aria-describedby={tip?.mark.id === m.id ? `${gradient}-ficha` : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          pick(m);
                        }}
                        onMouseEnter={(event) => point(m, event.currentTarget)}
                        onFocus={(event) => point(m, event.currentTarget)}
                        // Con el foco (tras pulsarla o tocarla), la ficha se queda hasta salir de ella.
                        onMouseLeave={(event) => {
                          if (event.currentTarget !== document.activeElement) setTip(null);
                        }}
                        onBlur={() => setTip(null)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:z-10 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:transition-none"
                        style={{ left: at(share(m.second)), top: half + level * gap }}
                      >
                        <MarkIcon
                          kind={m.kind}
                          color={m.color}
                          className={cn(
                            'size-6',
                            !m.color && 'bg-transparent text-muted-foreground ring-0',
                            // Sin revisar: atenuado. La etiqueta lo dice con palabras.
                            m.provisional && 'opacity-50',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="py-2 text-sm leading-tight text-muted-foreground">
                    Sin marcas en esta entrevista
                  </span>
                )}
              </div>
            );
          })}

          {/* La ficha de la marca, encima de ella (o debajo, si no cabe), sin tener que bajar. */}
          {tip && (
            <div
              id={`${gradient}-ficha`}
              role="tooltip"
              className="pointer-events-none absolute z-30 grid w-80 max-w-[calc(100%-1rem)] gap-1 rounded-xl bg-background p-3 text-sm shadow-(--shadow-overlay) ring-1 ring-foreground/10"
              style={{
                left: `clamp(10.5rem, ${tip.x}px, calc(100% - 10.5rem))`,
                top: tip.top > 200 ? tip.top - 8 : tip.bottom + 8,
                transform: `translate(-50%, ${tip.top > 200 ? '-100%' : '0'})`,
              }}
            >
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <MarkIcon kind={tip.mark.kind} color={tip.mark.color} className="size-6" />
                {minute(tip.mark.second)} · {tip.mark.label}
              </span>
              <span className="line-clamp-4 text-base leading-snug">{tip.mark.text}</span>
              {tip.mark.detail && (
                <span className="line-clamp-3 text-muted-foreground">{tip.mark.detail}</span>
              )}
            </div>
          )}

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

        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 text-sm font-medium">
            Leyenda
            <span aria-hidden="true" className="flex group-data-open:rotate-180">
              <Icon name="abajo" size={16} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 pt-2 text-sm">
            <p className="m-0 max-w-[70ch] text-muted-foreground">
              Intensidad: grado de intercambio en cada minuto (cambios de turno, interrupciones y
              momentos de tensión), con la misma escala para todas las entrevistas. No mide
              emociones. Tiene la palabra: arriba, tiempo de palabra del candidato en cada minuto;
              abajo, el del entrevistador.
              {voiceLine &&
                ' Voz: intensidad vocal en cada minuto respecto a la media de la propia persona (línea discontinua). Como las pausas y las trabas, no permite determinar si alguien dice la verdad.'}
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-2 p-0">
              {[
                ...legend.filter(([kind]) => !(hasCommunication && replaced.has(kind))),
                ...communicationLegend.filter(([kind]) => marks.some((m) => m.kind === kind)),
              ].map(([kind, name]) => (
                <li key={kind} className="flex items-center gap-2">
                  <MarkIcon kind={kind} color={marks.find((m) => m.kind === kind)?.color} />
                  {name}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <MarkIcon kind="momento" className="opacity-50" />
                Atenuado: pendiente de la segunda revisión de IA
              </li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Mandos siempre a mano mientras el visor está en pantalla. */}
      <div
        className={cn(
          'fixed bottom-4 left-1/2 z-30 w-[min(720px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-3xl bg-background shadow-(--shadow-overlay) transition-opacity motion-reduce:transition-none',
          inView ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!inView}
      >
        {/* Lo que va de entrevista. Decorativa: el tiempo de al lado da la cifra. */}
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-muted">
          <i
            className="block h-full bg-foreground"
            style={{ width: `${duration ? Math.min(1, time / duration) * 100 : 0}%` }}
          />
        </span>
        <div className="flex items-center gap-1 p-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => seek(time - 10)}
            aria-label="10 segundos atrás"
            tabIndex={inView ? 0 : -1}
            className="max-sm:px-1.5"
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
            className="shrink-0 rounded-full"
          >
            <Icon name={playing ? 'pausa' : 'reproducir'} size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => seek(time + 10)}
            aria-label="10 segundos adelante"
            tabIndex={inView ? 0 : -1}
            className="max-sm:px-1.5"
          >
            +10 s
          </Button>
          {/* El tema entero, debajo del tiempo: los capítulos de YouTube son largos. */}
          <span className="grid min-w-0 flex-1 gap-0.5 px-1">
            <span className="font-mono text-sm tabular-nums">
              {minute(time)}{' '}
              <span className="text-muted-foreground max-sm:hidden">/ {minute(duration)}</span>
            </span>
            {topic && (
              <span className="text-sm leading-tight text-muted-foreground max-sm:hidden">
                {topic}
              </span>
            )}
          </span>
          {youtubeId && (
            <span className="flex shrink-0">
              {(
                [
                  [
                    'campana',
                    'Avisos sobre el vídeo',
                    alertsOn,
                    false,
                    () => setAlertsOn(!alertsOn),
                  ],
                  [
                    'volumen',
                    'Sonido de los avisos',
                    alertsOn && sound,
                    !alertsOn,
                    () => setSound(!sound),
                  ],
                ] as const
              ).map(([icon, name, on, off, flip]) => (
                <Button
                  key={icon}
                  variant="ghost"
                  size="icon"
                  aria-label={name}
                  aria-pressed={on}
                  title={`${name}: ${on ? 'activado' : 'desactivado'}`}
                  disabled={off}
                  tabIndex={inView ? 0 : -1}
                  onClick={flip}
                  className={cn(
                    'relative rounded-full',
                    // Apagado: el icono tachado.
                    on
                      ? 'bg-muted text-foreground'
                      : "text-muted-foreground after:absolute after:h-0.5 after:w-5 after:rotate-45 after:rounded-full after:bg-current after:content-['']",
                  )}
                >
                  <Icon name={icon} size={16} />
                </Button>
              ))}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full max-sm:hidden"
            tabIndex={inView ? 0 : -1}
            onClick={() => root.current?.scrollIntoView({ block: 'start' })}
          >
            Ver el vídeo <Icon name="arriba" size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
