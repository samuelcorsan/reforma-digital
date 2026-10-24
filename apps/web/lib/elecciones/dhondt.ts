// El reparto de una provincia con la ley D'Hondt: entran las candidaturas con el 3 % de los votos
// válidos (en blanco incluidos) y los escaños van a los cocientes más altos (votos ÷ 1, 2, 3…).
// Los empates exactos se resuelven aquí por votos y nombre; la ley prevé un procedimiento propio.
export type Quotient = { party: string; votes: number; divisor: number; value: number };

export function dhondt(
  votes: Record<string, number>,
  seats: number,
  valid: number,
  barrier = 0.03,
) {
  const quotients = Object.entries(votes)
    .filter(([, v]) => v > 0 && v >= barrier * valid)
    .flatMap(([party, v]) =>
      Array.from({ length: seats }, (_, i) => ({
        party,
        votes: v,
        divisor: i + 1,
        value: v / (i + 1),
      })),
    )
    .sort((a, b) => b.value - a.value || b.votes - a.votes || a.party.localeCompare(b.party));
  const won = quotients.slice(0, seats);
  const result: Record<string, number> = {};
  for (const q of won) result[q.party] = (result[q.party] ?? 0) + 1;
  return { result, won, next: quotients.slice(seats, seats + 4), barrier: barrier * valid };
}
