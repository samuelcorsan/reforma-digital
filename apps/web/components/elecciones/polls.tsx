import { getElections, getPolls } from '../../lib/congreso/data';
import { decimal, longDate, toDay } from '../../lib/elecciones/format';
import { Source } from '../congreso/common';
import { PollChart, type ChartParty } from './poll-chart';
import { PollTable } from './poll-table';
import { Cell, Grid, Label, ReportIntro, SectionHeading } from './report';

const percent = (n: number) => `${decimal(n)}\u00a0%`;
const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

// «Las encuestas»: la media de hoy, la media día a día con cada encuesta y la tabla de todas.
// Estructura de Escaño Abierto.
export async function Polls() {
  const [polls, election] = await Promise.all([getPolls(), getElections()]);
  const { dias } = polls.media;
  const valid = polls.encuestas.filter((p) => !p.cis && !p.agregador);
  // La media de cada partido el último día con dato, hace 30 días y en los últimos 90.
  const today = polls.partidos.flatMap((p) => {
    const m = polls.media.partidos[p.id]?.m ?? [];
    let last = m.length - 1;
    while (last > 0 && m[last] === null) last--;
    const now = m[last];
    if (now === null || now === undefined) return [];
    return [{ ...p, now, before: m[last - 30] ?? null, spark: m.slice(-90) }];
  });
  today.sort((a, b) => b.now - a.now);
  const [first, second] = today;
  const latest = [...valid].sort((a, b) => b.fin.localeCompare(a.fin))[0];
  const recent = new Set(
    valid.filter((p) => toDay(polls.actualizado) - toDay(p.fin) <= 45).map((p) => p.empresa),
  ).size;
  // El gráfico: los partidos que pasan del 1 % hoy, con su media y cada encuesta.
  const shown = today.filter((p) => p.now >= 1);
  const parties: ChartParty[] = shown.map((p) => ({
    id: p.id,
    name: p.nombre,
    color: p.color,
    m: (polls.media.partidos[p.id]?.m ?? []).map(round),
    s: (polls.media.partidos[p.id]?.s ?? []).map(round),
    result: polls.resultado2023.v[p.id] ?? null,
  }));

  return (
    <>
      <ReportIntro title="Las encuestas">
        <p>
          Todas las encuestas desde 2023 y su media día a día: cómo ha cambiado la intención de voto
          camino del 29N.
        </p>
      </ReportIntro>
      <section className="grid gap-6">
        <SectionHeading title="La media de hoy">
          De las {recent} encuestas de los últimos 45 días, la más reciente de cada empresa. Cambio
          respecto a hace 30 días.
        </SectionHeading>
        <Grid>
          {today.slice(0, 6).map((p) => {
            const d = p.before === null ? null : p.now - p.before;
            const known = p.spark.flatMap((v, i) => (v === null ? [] : [[i, v] as const]));
            const lo = Math.min(...known.map(([, v]) => v));
            const hi = Math.max(...known.map(([, v]) => v));
            return (
              <Cell key={p.id} span={4} className="gap-3">
                <Label>
                  <span className="inline-flex items-center gap-2">
                    <i className="block size-2.5 rounded-full" style={{ background: p.color }} />
                    {p.nombre}
                  </span>
                </Label>
                <div className="flex items-end justify-between gap-4">
                  <p className="m-0 grid gap-1">
                    <b className="font-heading text-[40px] leading-none font-normal tabular-nums">
                      {percent(p.now)}
                    </b>
                    <span className="text-sm text-muted-foreground">
                      {d === null
                        ? 'sin dato de hace 30 días'
                        : Math.abs(d) < 0.25
                          ? '= en 30 días'
                          : `${d > 0 ? '+' : '−'}${decimal(Math.abs(d))} puntos en 30 días`}
                    </span>
                  </p>
                  <svg
                    viewBox="0 0 90 32"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="h-10 w-28 shrink-0"
                  >
                    <path
                      d={known
                        .map(
                          ([i, v], j) =>
                            `${j ? 'L' : 'M'}${i} ${30 - ((v - lo) / (hi - lo || 1)) * 28}`,
                        )
                        .join('')}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={1.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </Cell>
            );
          })}
        </Grid>
        {first && second && latest && (
          <p className="m-0 max-w-[65ch] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
            <b>{first.nombre}</b> saca {decimal(first.now - second.now)} puntos a {second.nombre}.
            La última encuesta es de <b>{latest.empresa}</b> para {latest.medio}, del{' '}
            {longDate(latest.fin)}. {polls.encuestas.length} encuestas desde julio de 2023.
          </p>
        )}
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="La media, día a día">
          Cada línea es la media; la sombra, cuánto se separan las encuestas entre sí; cada punto,
          una encuesta. Pasa por encima para ver un día.
        </SectionHeading>
        <Grid>
          <Cell>
            <PollChart
              days={dias}
              parties={parties}
              polls={valid.map((p) => ({ fin: p.fin, v: p.v }))}
              resultDate={polls.resultado2023.fecha}
              dissolution={election.convocatoria}
              election={polls.eleccion}
            />
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <PollTable
          parties={shown.slice(0, 10).map((p) => ({ id: p.id, name: p.nombre, color: p.color }))}
          polls={polls.encuestas.map((p) => ({
            firm: p.empresa,
            outlet: p.medio,
            start: p.ini,
            end: p.fin,
            sample: p.n,
            outside: p.cis || !!p.agregador,
            votes: p.v,
            seats: p.e,
          }))}
        />
        <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
          La media toma la última encuesta de cada empresa de los 45 días anteriores; cada una pesa
          la mitad cada dos semanas y algo más cuanto mayor es su muestra. El CIS y los agregadores
          no entran. Datos recopilados de Wikipedia hasta el {longDate(polls.actualizado)}. Desde el
          24 de noviembre la ley prohíbe publicar encuestas.
        </p>
        <Source url={polls.fuente}>Tabla de origen en Wikipedia</Source>
      </section>
    </>
  );
}
