'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../brand/icon';

// Los «▶ minuto» enlazan al vídeo en YouTube en ese segundo. Con JavaScript, en vez de salir de la
// página, el vídeo se abre aquí, flotando abajo a la derecha. YouTube (sin cookies) no se carga hasta
// que alguien pulsa uno. Si la página tiene su propio reproductor, él atiende el enlace antes.
const minute = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function VideoDock() {
  const [video, setVideo] = useState<{ id: string; second: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      // Los que abren pestaña nueva («Ver la entrevista original») y los del propio panel, no.
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return;
      if (box.current?.contains(link)) return;
      const url = new URL(link.href);
      const id = url.searchParams.get('v');
      if (url.hostname !== 'www.youtube.com' || url.pathname !== '/watch' || !id) return;
      event.preventDefault();
      setVideo({ id, second: Number.parseInt(url.searchParams.get('t') ?? '0', 10) || 0 });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Al abrirse, el foco va al botón de cerrar, para que se anuncie y se pueda cerrar enseguida.
  // Entra subiendo un poco; con movimiento reducido, aparece sin más.
  const open = !!video;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) close.current?.focus();
    if (!open || !box.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    box.current.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }, [open]);

  if (!video) return null;
  return (
    <div
      ref={box}
      role="dialog"
      onKeyDown={(event) => event.key === 'Escape' && setVideo(null)}
      aria-label={`Vídeo de la entrevista, minuto ${minute(video.second)}`}
      className="fixed right-4 bottom-4 z-50 w-[min(440px,calc(100%-2rem))] overflow-hidden rounded-2xl bg-card shadow-(--shadow-overlay) ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <span className="font-mono text-muted-foreground tabular-nums">
          Minuto {minute(video.second)}
        </span>
        <a
          href={`https://www.youtube.com/watch?v=${video.id}&t=${video.second}s`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex min-h-9 items-center gap-1 px-1 font-medium no-underline hover:underline"
        >
          Abrir en YouTube<span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
        <button
          ref={close}
          type="button"
          onClick={() => setVideo(null)}
          aria-label="Cerrar el vídeo"
          className="grid size-9 place-items-center rounded-full hover:bg-muted"
        >
          <Icon name="nunca" size={16} />
        </button>
      </div>
      <iframe
        key={`${video.id}-${video.second}`}
        src={`https://www.youtube-nocookie.com/embed/${video.id}?start=${video.second}&autoplay=1&rel=0`}
        title={`Vídeo de la entrevista desde el minuto ${minute(video.second)}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="block aspect-video w-full border-0 bg-muted"
      />
    </div>
  );
}
