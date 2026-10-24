import type { z } from 'zod';
import type { historySchema, indexSchema } from '../congreso/schema';

// El hemiciclo de verdad: los escaños del plano del Congreso, ordenados por la familia de quien se
// sienta hoy en cada uno y, dentro de ella, de izquierda a derecha. Así, con el resultado de 2023,
// cada escaño queda del color de quien lo ocupa.
export function realHemicycle(
  index: z.infer<typeof indexSchema>,
  history: z.infer<typeof historySchema>,
) {
  const plan = index.hemiciclo;
  const plain = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');
  const sitting = Object.fromEntries(
    (history.elecciones.at(-1)?.partidos ?? []).map(([siglas, , family]) => [
      plain(siglas),
      family,
    ]),
  );
  const order = (formation: string) =>
    history.familias.findIndex(
      (f) =>
        f.id === (sitting[plain(formation)] ?? (formation.includes('PSOE') ? 'PSOE' : 'OTROS')),
    );
  const angle = (x: number, y: number) => Math.atan2(plan.alto - y, x - plan.ancho / 2);
  const points = index.diputados
    .flatMap((d): [number, number, number][] =>
      d.baja || d.x === null || d.y === null ? [] : [[d.x, d.y, order(d.formacion)]],
    )
    .sort(([ax, ay, ak], [bx, by, bk]) => ak - bk || angle(bx, by) - angle(ax, ay))
    .map(([x, y]): [number, number] => [x, y]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    box: `${Math.min(...xs) - 7} ${Math.min(...ys) - 7} ${Math.max(...xs) - Math.min(...xs) + 14} ${Math.max(...ys) - Math.min(...ys) + 14}`,
    points,
    label: { x: plan.ancho / 2, y: plan.alto * 0.8, size: plan.ancho * 0.075 },
  };
}

// Un hemiciclo de semicírculos concéntricos para cualquier otro reparto: los escaños van de
// izquierda a derecha, así que cada partido ocupa una cuña seguida.
export function semicircle(total = 350) {
  const rows = 10;
  const outer = 300;
  const radii = Array.from({ length: rows }, (_, i) => outer * (0.4 + (0.6 * i) / (rows - 1)));
  const sum = radii.reduce((t, r) => t + r, 0);
  // Escaños por fila, en proporción a su radio, y lo que sobre o falte en las de fuera.
  const counts = radii.map((r) => Math.round((total * r) / sum));
  for (let i = rows - 1; counts.reduce((t, n) => t + n, 0) !== total; i = (i + rows - 1) % rows)
    counts[i] = (counts[i] ?? 0) + (counts.reduce((t, n) => t + n, 0) < total ? 1 : -1);
  const seats = radii.flatMap((r, i) => {
    const n = counts[i] ?? 0;
    return Array.from({ length: n }, (_, j) => {
      const a = Math.PI * (1 - j / Math.max(1, n - 1));
      return { a, x: outer + r * Math.cos(a), y: outer - r * Math.sin(a) };
    });
  });
  seats.sort((p, q) => q.a - p.a);
  return {
    box: `-8 -8 ${outer * 2 + 16} ${outer + 16}`,
    points: seats.map((p): [number, number] => [p.x, p.y]),
    label: { x: outer, y: outer - 20, size: 64 },
  };
}
