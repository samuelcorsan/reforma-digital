'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Dibuja su contenido a `width` × `height` px y lo encoge entero hasta el ancho disponible, como una captura. */
export function FitWidth({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState<number>();
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const observador = new ResizeObserver(([e]) => {
      if (e) setEscala(Math.min(1, e.contentRect.width / width));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [width]);
  return (
    // La proporción reserva el alto antes de medir, para que la página no salte.
    <div
      ref={marco}
      className="mx-auto w-full"
      style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
    >
      <div
        className="origin-top-left"
        style={{
          width,
          height,
          transform: `scale(${escala ?? 1})`,
          visibility: escala ? undefined : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
