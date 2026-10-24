import Link from 'next/link';
import { thousands } from '../../lib/elecciones/format';

// Ceuta y Melilla eligen un diputado cada una; el resto de provincias parte de dos (art. 162 LOREG).
const singleSeat = new Set(['51', '52']);
const minimumColor = 'var(--foreground)';
const populationColor = 'var(--brand)';

// La regla del reparto, explicada con los números del decreto: el mínimo que tiene cada provincia,
// los escaños que se reparten por población y lo que pesa un voto en cada sitio.
export function Apportionment({
  population,
  seats,
  provinces,
  year,
}: {
  population: Record<string, number>;
  seats: Record<string, number>;
  provinces: Record<string, { name: string; href: string }>;
  year: number;
}) {
  const codes = Object.keys(seats).sort((a, b) => (population[b] ?? 0) - (population[a] ?? 0));
  const minimum = (c: string) => (singleSeat.has(c) ? 1 : 2);
  const total = codes.reduce((sum, c) => sum + (seats[c] ?? 0), 0);
  const fixed = codes.reduce((sum, c) => sum + minimum(c), 0);
  const shared = codes.filter((c) => !singleSeat.has(c));
  const people = shared.reduce((sum, c) => sum + (population[c] ?? 0), 0);
  const quota = people / (total - fixed);
  const perSeat = shared
    .map((c) => ({ c, n: (population[c] ?? 0) / (seats[c] ?? 1) }))
    .sort((a, b) => a.n - b.n);
  const light = perSeat[0];
  const heavy = perSeat.at(-1);
  const name = (c: string) => provinces[c]?.name ?? c;
  const ratio =
    light && heavy
      ? (heavy.n / light.n).toLocaleString('es-ES', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : '';

  const steps = [
    {
      n: '1',
      value: thousands(fixed),
      title: 'escaños, igual para todas',
      text: `Cada provincia empieza con dos diputados, tenga la población que tenga; Ceuta y Melilla, con uno. Así se reparten ${thousands(fixed)} de los ${total}.`,
    },
    {
      n: '2',
      value: thousands(total - fixed),
      title: 'escaños, según la población',
      text: `Los ${thousands(total - fixed)} restantes se dan por habitantes: uno por cada ${thousands(quota)} personas del padrón de ${year}. Los que sobran al redondear van a las provincias que más se quedaron cerca de otro.`,
    },
    {
      n: '3',
      value: `${ratio}×`,
      title: 'pesa más un voto en la provincia más pequeña',
      text:
        light && heavy
          ? `${name(light.c)} elige un diputado por cada ${thousands(light.n)} habitantes; ${name(heavy.c)}, uno por cada ${thousands(heavy.n)}. El mínimo de dos pesa mucho más donde vive menos gente.`
          : '',
    },
  ];

  return (
    <div className="grid gap-8">
      <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="grid content-start gap-2">
            <span className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Paso {s.n}
            </span>
            <p className="m-0 grid gap-1">
              <b className="font-heading text-[40px] leading-none font-normal tabular-nums">
                {s.value}
              </b>
              <span className="font-medium">{s.title}</span>
            </p>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="block size-2.5 rounded-xs" style={{ background: minimumColor }} />
              El mínimo por ley
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="block size-2.5 rounded-xs" style={{ background: populationColor }} />
              Por su población
            </span>
          </p>
          <span className="font-mono text-sm text-muted-foreground max-sm:hidden">
            habitantes por escaño
          </span>
        </div>
        <ol className="m-0 grid list-none gap-1 p-0">
          {codes.map((c) => {
            const n = seats[c] ?? 0;
            const base = minimum(c);
            return (
              <li
                key={c}
                className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2rem_5.5rem] items-center gap-3 text-sm max-sm:grid-cols-[minmax(0,6rem)_minmax(0,1fr)_2rem]"
              >
                <Link
                  href={provinces[c]?.href ?? '#'}
                  className="hover:underline underline-offset-4"
                >
                  {name(c)}
                </Link>
                <span
                  className="flex flex-wrap gap-0.5"
                  role="img"
                  aria-label={`${base} por el mínimo y ${n - base} por población`}
                >
                  {Array.from({ length: n }, (_, j) => (
                    <i
                      key={j}
                      className="block size-2.5 rounded-xs"
                      style={{ background: j < base ? minimumColor : populationColor }}
                    />
                  ))}
                </span>
                <span className="text-right font-mono tabular-nums">{n}</span>
                <span className="text-right font-mono text-sm text-muted-foreground tabular-nums max-sm:hidden">
                  {thousands((population[c] ?? 0) / Math.max(1, n))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
