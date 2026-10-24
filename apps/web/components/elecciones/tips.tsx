'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { cn } from '@reforma-digital/design/lib/utils';

type Tip = { x: number; y: number; title: string; text: string; color: string };

// Lo que tapa la cabecera fija (80 px) más un margen.
const headerOffset = 88;

// Vista previa al pasar el ratón (o el foco) por un elemento con `data-tip`: título,
// `data-tip-text` debajo y `data-tip-color` como punto. Un solo cuadro para todo el gráfico.
// Va en `fixed` para que no la recorte la tarjeta que contiene el gráfico.
export function Tips({ className, children }: { className?: string; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [below, setBelow] = useState(false);

  // Encima del puntero si cabe por debajo de la cabecera; si no, debajo. Se mide antes de pintar.
  useLayoutEffect(() => {
    const height = card.current?.offsetHeight;
    if (tip && height) setBelow(tip.y - height - 12 < headerOffset);
  }, [tip]);

  // Al desplazarse, el elemento se mueve y el cuadro fijo dejaría de señalarlo.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    addEventListener('scroll', hide, { passive: true, once: true });
    return () => removeEventListener('scroll', hide);
  }, [tip]);

  const show = (event: SyntheticEvent) => {
    const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
    if (!target) return setTip(null);
    const rect = target.getBoundingClientRect();
    setTip({
      // Centrado sobre el elemento, sin salirse de la pantalla: el cuadro mide como mucho 288 px.
      x: Math.min(Math.max(rect.left + rect.width / 2, 152), innerWidth - 152),
      // Con ratón, a la altura del puntero (las columnas altas no lo alejan); con teclado, sobre el elemento.
      y: 'clientY' in event && typeof event.clientY === 'number' ? event.clientY : rect.top,
      title: target.getAttribute('data-tip') ?? '',
      text: target.getAttribute('data-tip-text') ?? '',
      color: target.getAttribute('data-tip-color') ?? '',
    });
  };

  return (
    <div
      className={className}
      onPointerOver={show}
      onFocus={show}
      onPointerLeave={() => setTip(null)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          ref={card}
          aria-hidden="true"
          className={cn(
            'pointer-events-none fixed z-50 w-max max-w-72 -translate-x-1/2 rounded-xl bg-popover px-4 py-3 text-sm leading-snug text-popover-foreground shadow-md ring-1 ring-foreground/10',
            !below && '-translate-y-full',
          )}
          style={{ left: tip.x, top: below ? tip.y + 20 : tip.y - 12 }}
        >
          <p className="m-0 flex items-start gap-2 font-medium">
            {tip.color && (
              <i
                className="mt-1 block size-2.5 shrink-0 rounded-full"
                style={{ background: tip.color }}
              />
            )}
            {tip.title}
          </p>
          {tip.text && <p className="m-0 mt-1 text-muted-foreground">{tip.text}</p>}
        </div>
      )}
    </div>
  );
}
