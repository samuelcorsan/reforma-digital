import { describe, expect, it } from 'vitest';
import constituencies2026 from '../apps/web/lib/congreso-2026.json';
import provinces from '../apps/web/lib/spain-provinces.json';

describe('geometría de las circunscripciones', () => {
  it('tiene exactamente las 52 circunscripciones del Congreso, sin duplicados', () => {
    const ids = provinces.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(constituencies2026.map((c) => c.id)));
  });

  it.each(provinces.map((p) => [p.name, p.path] as const))(
    'dibuja %s dentro del viewBox 0 0 600 520',
    (_, path) => {
      const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      const xs = numbers.filter((_, i) => i % 2 === 0);
      const ys = numbers.filter((_, i) => i % 2 === 1);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(600);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(520);
    },
  );
});
