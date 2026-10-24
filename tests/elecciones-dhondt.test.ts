import { describe, expect, it } from 'vitest';
import { dhondt } from '../apps/web/lib/elecciones/dhondt';

describe('reparto D’Hondt de una provincia', () => {
  it('da los escaños a los cocientes más altos', () => {
    const votes = { A: 340_000, B: 280_000, C: 160_000, D: 60_000, E: 15_000 };
    const { result, won, next } = dhondt(votes, 7, 855_000);
    expect(result).toEqual({ A: 3, B: 3, C: 1 });
    expect(won.at(-1)).toMatchObject({ party: 'B', divisor: 3 });
    expect(next[0]).toMatchObject({ party: 'A', divisor: 4 });
  });

  it('deja fuera a quien no llega al 3 % de los válidos', () => {
    const { result } = dhondt({ A: 970, B: 29 }, 3, 1_000);
    expect(result).toEqual({ A: 3 });
  });
});
