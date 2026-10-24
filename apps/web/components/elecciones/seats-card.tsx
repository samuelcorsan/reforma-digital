import type { ReactNode } from 'react';
import { deputyName, getIndex, slug } from '../../lib/congreso/data';
import type { mapSchema } from '../../lib/congreso/schema';
import { clusters, sunflower } from '../../lib/elecciones/seats';
import type { z } from 'zod';
import { href } from '../congreso/common';
import { Cell, Legend } from './report';
import { SeatsMap, type Seat } from './seats-map';

type Index = Awaited<ReturnType<typeof getIndex>>;
// Orden de los grupos en el hemiciclo, de izquierda a derecha.
export const hemicycleOrder = [
  'SUMAR',
  'BILDU',
  'ERC',
  'PSOE',
  'MIXTO',
  'PNV',
  'JUNTS',
  'PP',
  'VOX',
];

// Los 350 en su provincia y en su escaño del hemiciclo, con la leyenda de grupos. La usan la
// portada y «Los 350»; `footer` pone lo que va al pie (en la portada, el enlace de la tarjeta).
export function SeatsCard({
  index,
  map,
  note,
  span = 12,
  className,
  footer,
}: {
  index: Index;
  map: z.infer<typeof mapSchema>;
  note: string;
  span?: 7 | 12;
  className?: string;
  footer?: ReactNode;
}) {
  const active = index.diputados.filter((d) => !d.baja);
  const byCircumscription = Object.fromEntries(
    Object.entries(map.provincias).map(([id, p]) => [p.circ, id]),
  );
  const groupColor = (group: string) => index.grupos[group]?.color ?? '#8A8F98';
  const order = (group: string) => hemicycleOrder.indexOf(group);
  const counts: Record<string, number> = {};
  for (const d of active) {
    const id = byCircumscription[d.provincia];
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const centres = clusters(
    counts,
    Object.fromEntries(Object.entries(map.provincias).map(([id, p]) => [id, p.c])),
  );
  const plan = index.hemiciclo;
  const k = Math.min((map.ancho * 0.86) / plan.ancho, (map.alto * 0.8) / plan.alto);
  const ox = (map.ancho - plan.ancho * k) / 2;
  const oy = (map.alto - plan.alto * k) / 2 + 20;
  const points = Object.entries(counts).flatMap(([id, n]) => {
    const centre = centres[id];
    if (!centre) return [];
    const spiral = sunflower(n);
    return active
      .filter((d) => byCircumscription[d.provincia] === id)
      .sort((a, b) => order(a.grupo) - order(b.grupo) || a.nombre.localeCompare(b.nombre, 'es'))
      .map((d, j) => {
        const ax = centre.x + (spiral[j]?.x ?? 0);
        const ay = centre.y + (spiral[j]?.y ?? 0);
        return {
          ax,
          ay,
          bx: d.x === null ? ax : ox + d.x * k,
          by: d.y === null ? ay : oy + d.y * k,
          color: groupColor(d.grupo),
          name: deputyName(d.nombre),
          detail: [index.grupos[d.grupo]?.nombre ?? d.grupo, d.formacion, d.provincia]
            .filter(Boolean)
            .join(' · '),
          href: href(`diputado/${slug(d.nombre)}`),
        };
      });
  });
  const xs = points.map((p) => p.ax);
  const west = Math.min(...xs);
  const width = Math.max(...xs) - west || 1;
  // Los del oeste salen antes; un pequeño desfase determinista evita que se muevan en bloque.
  const seats: Seat[] = points.map((p, i) => ({
    ...p,
    delay: Math.round((((p.ax - west) / width) * 0.45 + ((i * 37) % 100) / 1250) * 1700),
  }));
  // El dibujo, recortado a lo que ocupan los escaños en las dos vistas; 30 unidades de margen
  // dejan entrar la costa que queda por encima y por debajo de los puntos.
  const ys = seats.flatMap((s) => [s.ay, s.by]);
  const top = Math.max(0, Math.min(...ys) - 30);
  const height = Math.min(map.alto, Math.max(...ys) + 30) - top;
  const legend = hemicycleOrder.filter((g) => active.some((d) => d.grupo === g));

  return (
    <Cell span={span} className={className}>
      <SeatsMap
        width={map.ancho}
        top={top}
        height={height}
        provinces={Object.entries(map.provincias).map(([id, p]) => ({ id, name: p.circ, d: p.d }))}
        canarias={map.canarias}
        seats={seats}
        hemicycleRadius={5.3 * k * 0.96}
        note={note}
      />
      <Legend
        small
        items={legend.map((g) => ({
          label: `${index.grupos[g]?.nombre ?? g} ${active.filter((d) => d.grupo === g).length}`,
          color: groupColor(g),
        }))}
      />
      {footer}
    </Cell>
  );
}
