import { expect, it } from 'vitest';
import { desordenar, mover, ordenar } from '../apps/web/components/brand/logo-puzle';

const R = [0, 1, 3, 5, 6, 7, 9, 11];
const vecinas = (a: number, b: number) =>
  Math.abs(a - b) === 3 || (Math.abs(a - b) === 1 && Math.floor(a / 3) === Math.floor(b / 3));

it('desordena la R con deslizamientos válidos y la vuelve a ordenar por el camino más corto', () => {
  for (let i = 0; i < 50; i++) {
    let pos = R;
    const desorden = desordenar(pos, 10);
    expect(desorden).toHaveLength(10);
    for (const [desde, hasta] of desorden) {
      expect(vecinas(desde, hasta) && pos.includes(desde) && !pos.includes(hasta)).toBe(true);
      pos = mover(pos, [desde, hasta]);
    }
    expect(pos).not.toEqual(R);

    const vuelta = ordenar(pos);
    expect(vuelta.length).toBeLessThanOrEqual(desorden.length);
    for (const [desde, hasta] of vuelta) {
      expect(vecinas(desde, hasta) && pos.includes(desde) && !pos.includes(hasta)).toBe(true);
      pos = mover(pos, [desde, hasta]);
    }
    expect([...pos].sort((a, b) => a - b)).toEqual(R);
    expect(pos[0]).toBe(0);
  }
});
