'use client';

import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { seatRadius } from '../../lib/elecciones/seats';
import { Stat } from './report';
import { Tips } from './tips';

export type Seat = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  color: string;
  name: string;
  detail: string;
  href: string;
  delay: number;
};

// Un punto por escaño: primero en su provincia y, al verlo, cada uno vuela a su sitio del hemiciclo.
// Encima, fuera del dibujo para no tapar Galicia, la cifra y las pestañas que cambian de vista.
export function SeatsMap({
  width,
  top,
  height,
  provinces,
  canarias,
  seats,
  hemicycleRadius,
  note,
}: {
  width: number;
  top: number;
  height: number;
  provinces: { id: string; name: string; d: string }[];
  canarias: string;
  seats: Seat[];
  hemicycleRadius: number;
  note: string;
}) {
  const [hemicycle, setHemicycle] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = svg.current;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio > 0.6)) return;
        observer.disconnect();
        timer = setTimeout(() => setHemicycle(true), 700);
      },
      { threshold: [0.6] },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const scale = hemicycleRadius / seatRadius;
  return (
    <Tabs
      value={hemicycle ? 'hemiciclo' : 'mapa'}
      onValueChange={(value) => setHemicycle(value === 'hemiciclo')}
      className="gap-4"
    >
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-72 gap-2">
          <Stat
            value="350"
            caption={
              hemicycle
                ? 'escaños en el hemiciclo, cada uno en su sitio'
                : 'escaños, repartidos entre 52 circunscripciones'
            }
          />
          <p className="m-0 text-sm text-muted-foreground">{note}</p>
        </div>
        <TabsList aria-label="Vista">
          <TabsTrigger value="mapa" className="px-3">
            Mapa
          </TabsTrigger>
          <TabsTrigger value="hemiciclo" className="px-3">
            Hemiciclo
          </TabsTrigger>
        </TabsList>
      </div>
      {/* Los escaños no entran en el orden de tabulación: cada diputado está en las listas de su provincia y de su grupo. */}
      <Tips className="relative z-10 mx-auto w-full max-w-3xl">
        <svg
          ref={svg}
          viewBox={`0 ${top} ${width} ${height}`}
          role="img"
          aria-label="Mapa de España con un punto por escaño, que se reordena en el hemiciclo del Congreso"
          className="block h-auto w-full"
        >
          <g
            className="fill-muted stroke-background transition-opacity duration-500"
            style={{ opacity: hemicycle ? 0.12 : 1 }}
          >
            {provinces.map((p) => (
              <path key={p.id} d={p.d} strokeWidth={0.8}>
                <title>{p.name}</title>
              </path>
            ))}
            <path d={canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
          </g>
          <g className="stroke-background">
            {seats.map((s) => (
              <a
                key={s.href}
                href={s.href}
                tabIndex={-1}
                data-tip={s.name}
                data-tip-text={s.detail}
                data-tip-color={s.color}
                className="[&:hover>circle]:stroke-foreground"
              >
                <circle
                  cx={s.ax}
                  cy={s.ay}
                  r={seatRadius}
                  fill={s.color}
                  strokeWidth={0.8}
                  className="transition-transform duration-900 ease-(--ease-brand) motion-reduce:transition-none"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: hemicycle
                      ? `translate(${s.bx - s.ax}px, ${s.by - s.ay}px) scale(${scale})`
                      : 'none',
                    transitionDelay: `${s.delay}ms`,
                  }}
                />
              </a>
            ))}
          </g>
        </svg>
      </Tips>
    </Tabs>
  );
}
