'use client';

import { useEffect, useState, type RefObject } from 'react';

// El ancho real de un gráfico, para dibujarlo a su tamaño: así los textos miden lo que dicen.
export function useWidth(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(200, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Para los gráficos con un `viewBox` fijo: cuántas unidades del dibujo mide un píxel de pantalla.
// Un texto con `fontSize: 12 * k` mide 12 px se vea como se vea.
export function useScale(ref: RefObject<HTMLElement | null>, units: number) {
  return units / useWidth(ref, units);
}
