// Reparto de escaños del Congreso según la Ley Orgánica 5/1985 (LOREG), arts. 162 y 163.

const CEUTA_MELILLA = new Set(['51', '52']);

/** Art. 162: dos escaños por provincia, uno para Ceuta y Melilla y el resto por cuota y restos mayores. */
export function seatsByPopulation(
  constituencies: readonly { id: string; population: number }[],
): number[] {
  const provinces = constituencies.filter((c) => !CEUTA_MELILLA.has(c.id));
  const shared = 350 - CEUTA_MELILLA.size - 2 * provinces.length;
  const total = provinces.reduce((sum, c) => sum + c.population, 0);
  // Población ÷ cuota de reparto; el resto se guarda entero para comparar sin redondeos.
  const quotas = new Map(
    provinces.map((c) => [
      c,
      { seats: Math.floor((c.population * shared) / total), rest: (c.population * shared) % total },
    ]),
  );
  const left = shared - [...quotas.values()].reduce((sum, q) => sum + q.seats, 0);
  for (const q of [...quotas.values()].sort((a, b) => b.rest - a.rest).slice(0, left)) q.seats += 1;
  return constituencies.map((c) => {
    const quota = quotas.get(c);
    return quota ? 2 + quota.seats : 1;
  });
}

/** Art. 163.1.a: votos mínimos para entrar en el reparto, el 3 % de los válidos (con los votos en
 * blanco). Art. 163.2: Ceuta y Melilla, las únicas con un escaño, eligen por mayoría y sin barrera. */
export function barrier(votes: readonly number[], blank: number, seats: number): number {
  return seats === 1 ? 0 : (votes.reduce((sum, v) => sum + v, blank) * 3) / 100;
}

export type Quotient = { i: number; votes: number; divisor: number };

/** Art. 163: los cocientes de D'Hondt que obtienen escaño, en el orden en que lo obtienen. */
export function dhondtOrder(votes: readonly number[], blank: number, seats: number): Quotient[] {
  const minimum = barrier(votes, blank, seats);
  const quotients = votes.flatMap((v, i) =>
    v >= minimum ? Array.from({ length: seats }, (_, d) => ({ i, votes: v, divisor: d + 1 })) : [],
  );
  // Mayor cociente primero; a igual cociente, la candidatura con más votos totales (art. 163.1.d).
  quotients.sort((a, b) => b.votes * a.divisor - a.votes * b.divisor || b.votes - a.votes);
  const last = quotients[seats - 1];
  const next = quotients[seats];
  if (last && next && last.votes === next.votes && last.divisor === next.divisor) {
    throw new Error(
      'Empate a votos en el último escaño: el art. 163.1.d LOREG lo resuelve por sorteo',
    );
  }
  return quotients.slice(0, seats);
}

/** Art. 163: escaños de cada candidatura. */
export function dhondt(votes: readonly number[], blank: number, seats: number): number[] {
  const elected = dhondtOrder(votes, blank, seats);
  return votes.map((_, i) => elected.filter((q) => q.i === i).length);
}
