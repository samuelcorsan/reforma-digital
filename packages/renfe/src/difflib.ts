// La parte de `difflib.SequenceMatcher` de Python que usa renfe-cli: `ratio()` y `get_matching_blocks()`, con el
// mismo algoritmo para que los resultados coincidan. Sin elementos basura ni "populares": renfe-cli compara textos
// de menos de 200 caracteres (donde autojunk no actúa) y rutas con autojunk=False.

export type Block = [a: number, b: number, size: number];

export function matchingBlocks<T>(
  a: readonly T[],
  b: readonly T[],
  key: (item: T) => string = String,
): Block[] {
  const ka = a.map(key);
  const kb = b.map(key);
  const b2j = new Map<string, number[]>();
  kb.forEach((k, j) => {
    const list = b2j.get(k);
    if (list) list.push(j);
    else b2j.set(k, [j]);
  });

  const longest = (alo: number, ahi: number, blo: number, bhi: number): Block => {
    let [besti, bestj, bestsize] = [alo, blo, 0];
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (const j of b2j.get(ka[i]!) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > bestsize) [besti, bestj, bestsize] = [i - k + 1, j - k + 1, k];
      }
      j2len = next;
    }
    while (besti > alo && bestj > blo && ka[besti - 1] === kb[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      ka[besti + bestsize] === kb[bestj + bestsize]
    )
      bestsize += 1;
    return [besti, bestj, bestsize];
  };

  const found: Block[] = [];
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [i, j, k] = longest(alo, ahi, blo, bhi);
    if (k) {
      found.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  found.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);

  const blocks: Block[] = [];
  let [i1, j1, k1] = [0, 0, 0];
  for (const [i2, j2, k2] of found) {
    if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
    else {
      if (k1) blocks.push([i1, j1, k1]);
      [i1, j1, k1] = [i2, j2, k2];
    }
  }
  if (k1) blocks.push([i1, j1, k1]);
  blocks.push([a.length, b.length, 0]);
  return blocks;
}

export function ratio(a: string, b: string): number {
  const [ca, cb] = [[...a], [...b]]; // por puntos de código, como Python
  const total = ca.length + cb.length;
  if (!total) return 1;
  const matches = matchingBlocks(ca, cb).reduce((sum, [, , size]) => sum + size, 0);
  return (2 * matches) / total;
}
