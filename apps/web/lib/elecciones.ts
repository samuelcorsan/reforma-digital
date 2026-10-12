// Datos de la sección «¿Cuánto vale tu voto?»: une escaños y población de 2026, resultados de
// 2023 y geometría por código INE de provincia.
import results2023 from './congreso-2023.json';
import constituencies2026 from './congreso-2026.json';
import shapes from './spain-provinces.json';

export const SEATS = 350;
export const averagePerSeat = constituencies2026.reduce((sum, c) => sum + c.population, 0) / SEATS;

// Habitantes por escaño: cada banda se muestra con un tono neutro y su leyenda.
export const bands = [
  { max: 70_000, label: 'Menos de 70.000' },
  { max: 110_000, label: '70.000 a 110.000' },
  { max: 150_000, label: '110.000 a 150.000' },
  { max: Infinity, label: '150.000 o más' },
];

// Canarias va en un recuadro, desplazada respecto a spain-provinces.json para no rozar Ceuta.
const CANARIAS = new Set(['35', '38']);
export const recuadroCanarias = { x: 4, y: 428, width: 176, height: 88 };
const desplazarCanarias = (path: string) =>
  path.replace(
    /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    (_, x: string, y: string) => `${+(Number(x) - 12).toFixed(1)},${+(Number(y) + 8).toFixed(1)}`,
  );

// En pantalla, sin la forma doble y con el artículo delante; el JSON conserva el nombre oficial.
const nombres: Record<string, string> = {
  '01': 'Álava',
  '03': 'Alicante',
  '07': 'Illes Balears',
  '12': 'Castellón',
  '15': 'A Coruña',
  '26': 'La Rioja',
  '35': 'Las Palmas',
  '46': 'Valencia',
};

export const provincias = constituencies2026.map((c) => {
  const shape = shapes.find((s) => s.id === c.id);
  const before = results2023.constituencies.find((r) => r.id === c.id);
  if (!shape || !before) throw new Error(`Faltan datos de la circunscripción ${c.id}`);
  const perSeat = c.population / c.seats;
  // Centro aproximado: media de los vértices del trazado.
  const path = CANARIAS.has(c.id) ? desplazarCanarias(shape.path) : shape.path;
  const n = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const x = n.filter((_, i) => i % 2 === 0);
  const y = n.filter((_, i) => i % 2 === 1);
  return {
    ...c,
    name: nombres[c.id] ?? c.name,
    path,
    centro: {
      x: x.reduce((a, b) => a + b, 0) / x.length,
      y: y.reduce((a, b) => a + b, 0) / y.length,
    },
    perSeat,
    band: bands.findIndex((b) => perSeat < b.max),
    seats2023: before.seats,
    validVotesPerSeat2023:
      before.candidatures.reduce((sum, x) => sum + x.votes, before.blank) / before.seats,
  };
});

export type Provincia = (typeof provincias)[number];

/** Valor de `?provincia=`: un código INE de las 52 circunscripciones o nada. */
export function provinciaDe(param: string | string[] | undefined): Provincia | undefined {
  return typeof param === 'string' ? provincias.find((p) => p.id === param) : undefined;
}

// Cartograma de Dorling: un círculo por provincia, con área proporcional a sus escaños, que parte
// de su posición en el mapa y se separa de los vecinos hasta no solaparse.
export const cartograma = (() => {
  const nodes = provincias.map(({ id, centro, seats }) => ({
    id,
    x0: centro.x,
    y0: centro.y,
    x: centro.x,
    y: centro.y,
    r: 7 * Math.sqrt(seats),
  }));
  for (let step = 0; step < 300; step++) {
    for (const [i, a] of nodes.entries()) {
      for (const b of nodes.slice(i + 1)) {
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const overlap = a.r + b.r + 1.5 - d;
        if (overlap <= 0) continue;
        const ux = (dx / d) * (overlap / 2);
        const uy = (dy / d) * (overlap / 2);
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
      }
    }
    for (const n of nodes) {
      n.x = Math.min(600 - n.r, Math.max(n.r, n.x + (n.x0 - n.x) * 0.02));
      n.y = Math.min(520 - n.r, Math.max(n.r, n.y + (n.y0 - n.y) * 0.02));
    }
  }
  return nodes.map(({ id, x, y, r }) => ({ id, x, y, r }));
})();
