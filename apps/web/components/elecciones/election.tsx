import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reforma-digital/design/ui/table';
import { decimal, formatDate, percent, thousands } from '../../lib/elecciones/format';
import { electionsHref } from '../../lib/elecciones/pages';
import { shortParty } from '../../lib/elecciones/parties';
import { Icon } from '../brand/icon';
import { href } from '../congreso/common';
import { electionData } from './election-data';
import { Hemicycle, ProvinceSection } from './province-section';
import { Cell, Grid, Heading, Legend, ReportIntro, SectionHeading, Stat } from './report';
import { Tips } from './tips';

const millions = (n: number) => `${decimal(n / 1e6, 2)} M`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '=');
// Lo que duró una legislatura, en años y meses.
const duration = (from: string, to: string) => {
  const [y1 = 0, m1 = 0, d1 = 0] = from.split('-').map(Number);
  const [y2 = 0, m2 = 0, d2 = 0] = to.split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? 'año' : 'años'}` : '';
  const m = rest ? `${rest} ${rest === 1 ? 'mes' : 'meses'}` : '';
  return [y, m].filter(Boolean).join(' y ') || 'menos de un mes';
};

// La página de cada elección general (`/elecciones/AAAAMM`): el resultado, la legislatura que
// salió de ella, las candidaturas, el cambio respecto a la anterior, cada provincia y los últimos
// escaños más ajustados. Estructura de Escaño Abierto.
export async function Election({ id }: { id: string }) {
  const data = await electionData(id);
  const { history, E, k, e, color, label, details, name, provinceHref } = data;
  if (e.id !== id) notFound();
  const previous = E[k - 1];
  const next = E[k + 1];
  const isLast = !next;
  const turnout = e.votantes / e.censo;
  const turnoutBefore = previous ? previous.votantes / previous.censo : null;
  const { withSeats, largest, majority, legislature, president } = data;

  // Resultados: candidaturas con escaño o con el 0,5 %, y su cambio con las mismas siglas.
  const rows = e.partidos.filter(([, , , v, s]) => s > 0 || v >= e.validos * 0.005);
  const most = Math.max(...rows.map(([, , , v]) => v / e.validos));
  const before = Object.fromEntries((previous?.partidos ?? []).map((p) => [p[0], p]));

  // El cambio de escaños por familia.
  const change = previous
    ? history.familias
        .map((f) => {
          const now = e.fam[f.id]?.[1] ?? 0;
          const then = previous.fam[f.id]?.[1] ?? 0;
          return { f, now, then, d: now - then };
        })
        .filter((x) => x.now || x.then)
    : [];
  const biggest = Math.max(1, ...change.map((x) => Math.abs(x.d)));

  // Votos y escaños: la parte de cada uno, para las candidaturas con escaño.
  const pairs = withSeats.slice(0, 14).map(([siglas, full, f, v, s]) => ({
    siglas,
    full,
    color: color(f),
    votes: v / e.validos,
    seats: s / 350,
    n: s,
  }));
  const top = Math.min(
    1,
    Math.ceil(Math.max(...pairs.map((p) => Math.max(p.votes, p.seats))) * 10) / 10,
  );

  // Los últimos escaños más ajustados.
  const closest = Object.entries(details[k]?.prov ?? {})
    .flatMap(([code, p]) => (p.ultimo ? [{ code, ...p.ultimo }] : []))
    .sort((a, b) => a.faltan - b.faltan)
    .slice(0, 8);

  return (
    <>
      <nav aria-label="Otras elecciones" className="mb-8 flex flex-wrap justify-between gap-3">
        {previous ? (
          <Link
            href={electionsHref(previous.id)}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <Icon name="izquierda" size={16} /> {label(previous)}
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={next ? electionsHref(next.id) : electionsHref()}
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          {next ? label(next) : '29N'} <Icon name="derecha" size={16} />
        </Link>
      </nav>
      <ReportIntro title={formatDate(e.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}>
        <p>
          {largest &&
            (majority
              ? `${shortParty(largest[0])} obtuvo mayoría absoluta con ${largest[4]} escaños.`
              : `Sin mayoría absoluta: ${shortParty(largest[0])}, primera fuerza con ${largest[4]} escaños, a ${176 - largest[4]} de los 176.`)}{' '}
          Participación: {percent(turnout)} del censo
          {turnoutBefore !== null && previous
            ? ` (${(turnout - turnoutBefore) * 100 >= 0 ? '+' : '−'}${decimal(Math.abs(turnout - turnoutBefore) * 100)} puntos respecto a ${label(previous)})`
            : ''}
          .
        </p>
      </ReportIntro>

      <Grid>
        {[
          [percent(turnout), 'participación'],
          [millions(e.votantes), 'votantes'],
          [String(withSeats.length), 'candidaturas con escaño'],
          [decimal(e.metricas.nep_votos), 'número efectivo de partidos (votos)'],
          [decimal(e.metricas.gallagher), 'desproporcionalidad (índice de Gallagher)'],
          [millions(e.metricas.sin_escano), 'votos sin escaño'],
        ].map(([value, caption]) => (
          <Cell key={caption} span={4}>
            <Stat value={value} caption={caption} />
          </Cell>
        ))}
        <Cell span={7}>
          <Heading title="Composición del Congreso" />
          <Hemicycle data={data} limit={10} small />
        </Cell>
        <Cell span={5} className="content-start">
          <Heading title="Legislatura" />
          <dl className="m-0 grid gap-4">
            {[
              ['Legislatura', legislature],
              ['Presidencia del Gobierno', president],
              [
                'Duración',
                isLast
                  ? `${duration(e.fecha, e.hasta)}, hasta la disolución del ${formatDate(e.hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : `${duration(e.fecha, e.hasta)}, hasta las elecciones del ${formatDate(e.hasta, { day: 'numeric', month: 'long', year: 'numeric' })}`,
              ],
            ].map(([term, detail]) => (
              <div key={term} className="grid gap-1">
                <dt className="text-sm text-muted-foreground">{term}</dt>
                <dd className="m-0 text-lg font-medium">{detail}</dd>
              </div>
            ))}
          </dl>
          {isLast && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={electionsHref('legislatura')}
                className={buttonVariants({ variant: 'outline' })}
              >
                Balance de la XV legislatura <Icon name="derecha" size={16} />
              </Link>
              <Link href={href('')} className={buttonVariants({ variant: 'outline' })}>
                Actividad parlamentaria <Icon name="derecha" size={16} />
              </Link>
            </div>
          )}
        </Cell>
      </Grid>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Resultados">
          Candidaturas con escaño o con más del 0,5 % de los votos válidos. Votos válidos:{' '}
          {thousands(e.validos)}, de ellos {thousands(e.blancos)} en blanco; nulos:{' '}
          {thousands(e.nulos)}.
        </SectionHeading>
        <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidatura</TableHead>
                <TableHead className="text-right">Votos</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="w-1/5" />
                <TableHead className="text-right">Escaños</TableHead>
                {previous && (
                  <TableHead className="text-right">Respecto a {label(previous)}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([siglas, full, f, v, s]) => {
                const then = before[siglas];
                return (
                  <TableRow key={`${siglas}-${full}`}>
                    <TableCell title={full}>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <i
                          className="block size-2.5 shrink-0 rounded-full"
                          style={{ background: color(f) }}
                        />
                        {siglas}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {thousands(v)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {percent(v / e.validos)}
                    </TableCell>
                    <TableCell>
                      <span className="block h-2.5 rounded-full bg-muted">
                        <i
                          className="block h-full rounded-full"
                          style={{
                            width: `${(v / e.validos / most) * 100}%`,
                            background: color(f),
                          }}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {s}
                    </TableCell>
                    {previous && (
                      <TableCell
                        className="text-right font-mono tabular-nums"
                        title={
                          then
                            ? undefined
                            : `Sin candidatura con estas siglas en ${label(previous)}. La variación por familias figura más abajo.`
                        }
                      >
                        {then ? (
                          signed(s - then[4])
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <Grid className="mt-6">
        {previous && (
          <Cell span={6} className="content-start">
            <Heading title={`Variación de escaños respecto a ${label(previous)}`}>
              Por familia de partidos.
            </Heading>
            <Tips>
              <ul className="m-0 grid list-none gap-1 p-0 text-sm">
                {change.map(({ f, now, then, d }) => (
                  <li
                    key={f.id}
                    tabIndex={0}
                    data-tip={f.nombre}
                    data-tip-text={`${then} → ${now} escaños`}
                    data-tip-color={f.color}
                    className="grid min-h-9 grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 rounded-md px-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span>{f.nombre}</span>
                    <span className="flex justify-end">
                      {d < 0 && (
                        <i
                          className="block h-3 rounded-l-[3px]"
                          style={{ width: `${(-d / biggest) * 100}%`, background: f.color }}
                        />
                      )}
                    </span>
                    <span className="flex border-l border-border">
                      {d > 0 && (
                        <i
                          className="block h-3 rounded-r-[3px]"
                          style={{ width: `${(d / biggest) * 100}%`, background: f.color }}
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-right font-mono tabular-nums',
                        d > 0 ? 'text-[#2E7D5B]' : d < 0 ? 'text-brand' : 'text-muted-foreground',
                      )}
                    >
                      {signed(d)}
                    </span>
                  </li>
                ))}
              </ul>
            </Tips>
          </Cell>
        )}
        <Cell span={previous ? 6 : 12} className="content-start">
          <Heading title="Votos y escaños">
            Porcentaje de votos (anillo) y de escaños (punto) de cada candidatura con escaño.
          </Heading>
          <Tips>
            <ul className="m-0 grid list-none gap-1 p-0 text-sm">
              {pairs.map((p) => {
                const from = Math.min(p.votes, p.seats);
                const to = Math.max(p.votes, p.seats);
                return (
                  <li
                    key={`${p.siglas}-${p.full}`}
                    tabIndex={0}
                    data-tip={p.full}
                    data-tip-text={`${percent(p.votes)} de los votos · ${percent(p.seats)} de los escaños (${p.n})`}
                    data-tip-color={p.color}
                    className="grid min-h-8 grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium break-words">{shortParty(p.siglas)}</span>
                    <span className="relative h-4">
                      <i className="absolute inset-x-0 top-1/2 block h-px bg-border" />
                      <i
                        className="absolute top-1/2 block h-0.5 -translate-y-1/2"
                        style={{
                          left: `${(from / top) * 100}%`,
                          width: `${((to - from) / top) * 100}%`,
                          background: p.color,
                        }}
                      />
                      <i
                        className="absolute top-1/2 block size-3 -translate-1/2 rounded-full border-2 bg-card"
                        style={{ left: `${(p.votes / top) * 100}%`, borderColor: p.color }}
                      />
                      <i
                        className="absolute top-1/2 block size-3 -translate-1/2 rounded-full"
                        style={{ left: `${(p.seats / top) * 100}%`, background: p.color }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Tips>
          <p
            className="m-0 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-3 px-1.5 font-mono text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <span />
            <span className="relative h-4">
              {Array.from({ length: Math.round(top * 10) + 1 }, (_, i) => i / 10).map((v) => (
                <span
                  key={v}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${(v / top) * 100}%` }}
                >
                  {Math.round(v * 100)} %
                </span>
              ))}
            </span>
          </p>
        </Cell>
      </Grid>

      <ProvinceSection data={data} title="Resultados por circunscripción">
        Las {data.codes.length} circunscripciones en {label(e)}.
      </ProvinceSection>

      {closest.length > 0 && (
        <section className="mt-16 grid gap-6">
          <SectionHeading title="Últimos escaños con menor diferencia">
            Último diputado asignado por el sistema D&apos;Hondt en cada provincia y votos que
            faltaron a la siguiente candidatura.{' '}
            <Link
              href={`${electionsHref('escano')}?eleccion=${e.id}`}
              className="underline underline-offset-4"
            >
              Más en «Votos por escaño»
            </Link>
            .
          </SectionHeading>
          <Grid>
            <Cell>
              <ul className="m-0 grid list-none p-0">
                {closest.map((c) => (
                  <li
                    key={c.code}
                    className="grid gap-x-4 gap-y-1 border-b border-border py-3 last:border-0 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-baseline"
                  >
                    <Link
                      href={provinceHref(c.code)}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {name(c.code)}
                    </Link>
                    <span className="text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
                      Asignado a <b>{shortParty(c.gana)}</b>; a <b>{shortParty(c.segundo)}</b> le
                      faltaron
                    </span>
                    <b className="font-mono font-medium tabular-nums">
                      {thousands(c.faltan)} votos
                    </b>
                  </li>
                ))}
              </ul>
            </Cell>
          </Grid>
        </section>
      )}

      <p className="m-0 mt-8 max-w-[65ch] text-sm text-muted-foreground">
        Fuente: Ministerio del Interior, resultados oficiales de las elecciones al Congreso. Las
        candidaturas se agrupan en familias con reglas fijas, iguales para las {E.length}{' '}
        elecciones.
      </p>
    </>
  );
}
