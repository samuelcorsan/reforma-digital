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

/** Art. 163: barrera del 3 % de los votos válidos (con los votos en blanco) y D'Hondt. */
export function dhondt(votes: readonly number[], blank: number, seats: number): number[] {
  const valid = votes.reduce((sum, v) => sum + v, blank);
  // Art. 163.2: Ceuta y Melilla, las únicas con un escaño, eligen por mayoría y sin barrera.
  const barrier = seats === 1 ? 0 : valid * 3;
  const quotients = votes.flatMap((v, i) =>
    v * 100 >= barrier
      ? Array.from({ length: seats }, (_, d) => ({ i, votes: v, divisor: d + 1 }))
      : [],
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
  const elected = quotients.slice(0, seats);
  return votes.map((_, i) => elected.filter((q) => q.i === i).length);
}
