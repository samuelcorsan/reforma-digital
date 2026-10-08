import { describe, expect, it } from 'vitest';
import { dhondt, seatsByPopulation } from '../apps/web/lib/congreso';
import results2023 from '../apps/web/lib/congreso-2023.json';
import constituencies2026 from '../apps/web/lib/congreso-2026.json';

describe('art. 162 LOREG con la población del Real Decreto 806/2026', () => {
  it('reproduce los escaños de las 52 circunscripciones del anexo', () => {
    expect(constituencies2026).toHaveLength(52);
    expect(seatsByPopulation(constituencies2026)).toEqual(constituencies2026.map((c) => c.seats));
    expect(constituencies2026.reduce((sum, c) => sum + c.seats, 0)).toBe(350);
  });
});

describe("D'Hondt del art. 163 LOREG", () => {
  it.each(results2023.constituencies.map((c) => [c.name, c] as const))(
    'reproduce el reparto oficial de 2023 en %s',
    (_, c) => {
      expect(
        dhondt(
          c.candidatures.map((x) => x.votes),
          c.blank,
          c.seats,
        ),
      ).toEqual(c.candidatures.map((x) => x.seats));
    },
  );

  it('exige al menos el 3 % de los votos válidos', () => {
    expect(dhondt([600, 370, 30], 0, 100)[2]).toBe(3);
    expect(dhondt([600, 371, 29], 0, 100)[2]).toBe(0);
  });

  it('cuenta el voto en blanco al calcular la barrera', () => {
    expect(dhondt([600, 370, 30], 10, 100)[2]).toBe(0);
  });

  it('sin barrera cuando se elige un solo escaño (art. 163.2)', () => {
    expect(dhondt([20, 10], 980, 1)).toEqual([1, 0]);
  });

  it('a igual cociente da el escaño a la candidatura con más votos', () => {
    expect(dhondt([3000, 6000], 0, 2)).toEqual([0, 2]);
  });

  it('no inventa un ganador cuando la ley exige sorteo', () => {
    expect(() => dhondt([5000, 5000], 0, 1)).toThrow(/sorteo/);
    expect(dhondt([5000, 5000], 0, 2)).toEqual([1, 1]);
  });
});
