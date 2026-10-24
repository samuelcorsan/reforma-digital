import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@reforma-digital/design/ui/table';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card, CardContent } from '@reforma-digital/design/ui/card';
import { mapSchema } from '../../lib/congreso/schema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getElections, getPolls, getGeography, read, slug } from '../../lib/congreso/data';
import { municipalities } from '../../lib/congreso/queries';
import { pollsHidden } from '../../lib/congreso/polls';
import { Intro, Stats, Source, Filters, Pagination, Empty, href, number } from './common';
import { ElectionContext } from './election-context';
import { Bars, ReportIntro } from '../elecciones/report';
import { The350 } from '../elecciones/the-350';
import { Election } from '../elecciones/election';
import { ElectionHistory } from '../elecciones/history';
import { Accuracy } from '../elecciones/accuracy';
import { Markets } from '../elecciones/markets';
import { Polls } from '../elecciones/polls';
import { Projection } from '../elecciones/projection';
import { SeatPrice } from '../elecciones/seat-price';

export async function Geography({
  detail,
  query,
  page,
}: {
  detail?: string;
  query: string;
  page: number;
}) {
  const geography = await getGeography();
  const map = await read('elecciones/geo-provincias.json', mapSchema);
  const selected = detail
    ? Object.entries(geography.provincias).find(([id, p]) => id === detail || slug(p.n) === detail)
    : undefined;
  if (detail && !selected && detail !== 'municipios') notFound();
  if (detail === 'municipios') {
    const data = await municipalities(query, page);
    return (
      <>
        <Intro title="Municipio a municipio">
          <p>
            Datos del INE · población de {data.anio}. Los años de renta y edad pueden ser distintos.
          </p>
        </Intro>
        <Filters action={href('geografia/municipios')} query={query} />
        <div
          className={
            'cg-table overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:text-left [&_th]:p-3 [&_th]:[border-bottom:1px_solid_var(--border)] [&_th]:[vertical-align:top] [&_td]:p-3 [&_td]:[border-bottom:1px_solid_var(--border)] [&_td]:[vertical-align:top] [&_th]:text-sm'
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Municipio</TableHead>
                <TableHead>Población</TableHead>
                <TableHead>Renta por persona</TableHead>
                <TableHead>Edad media</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map(([id, m]) => (
                <TableRow key={id}>
                  <TableHead>{m[0]}</TableHead>
                  <TableCell>{number(m[4])}</TableCell>
                  <TableCell>{m[6] === null ? '—' : `${number(m[6])} €`}</TableCell>
                  <TableCell>{m[7] ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={page} total={data.total} params={{ q: query }} />
      </>
    );
  }
  const provinces = selected
    ? [selected]
    : Object.entries(geography.provincias).filter(([, p]) =>
        p.n.toLowerCase().includes(query.toLowerCase()),
      );
  return (
    <>
      {selected && (
        <Intro title={selected[1].n}>
          <p>Población, renta, edad y representación, con datos del INE y del Congreso.</p>
        </Intro>
      )}
      <div
        className={
          'cg-geo-hero grid [grid-template-columns:1fr_1fr] items-center gap-12 [margin:32px_0] [&_>_svg]:w-full [&_>_svg]:[max-height:420px] [@media(max-width:_800px)]:[grid-template-columns:1fr]'
        }
      >
        <svg
          viewBox={`0 0 ${map.ancho} ${map.alto}`}
          aria-label="Provincias de España; selecciona una para consultar sus datos"
          role="img"
        >
          {Object.entries(map.provincias).map(([id, p]) => (
            <a href={href(`geografia/${id}`)} key={id} aria-label={p.n}>
              <path
                d={p.d}
                fill={selected && selected[0] !== id ? 'var(--muted)' : 'var(--brand)'}
                stroke={'var(--background)'}
                strokeWidth={0.6}
              >
                <title>{p.n}</title>
              </path>
            </a>
          ))}
        </svg>
        <div>
          <h2>Tu provincia, a escala</h2>
          <p>
            El mapa enlaza a las mismas fichas que la lista. Los datos no describen la situación de
            cada persona.
          </p>
          <Link
            href={href('geografia/municipios')}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Consultar los municipios
          </Link>
          <Source url="https://www.ine.es/">Instituto Nacional de Estadística</Source>
        </div>
      </div>
      <Filters action={href('geografia')} query={query} />
      <div
        className={
          'cg-grid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
        }
      >
        {provinces.map(([id, p]) => (
          <Card
            key={id}
            render={
              <article
                className={
                  'cg-card [overflow-wrap:anywhere] [&_h2]:[font-size:28px] [&_h3]:text-lg [&_h3]:[line-height:1.3] [&_h3]:[margin:12px_0] [&_p]:[color:var(--text-secondary)] [&_p]:[margin:12px_0] [&_.cg-stats]:gap-5 [&_.cg-stats_dd]:[font-size:28px] [&_.cg-stats_dt]:[max-width:14ch]'
                }
              />
            }
          >
            <CardContent>
              <h2>
                <Link href={href(`geografia/${id}`)}>{p.n}</Link>
              </h2>
              <Stats
                items={[
                  [p.pob, 'Habitantes'],
                  [p.esc, 'Escaños'],
                  [`${number(p.renta)} €`, 'Renta por persona'],
                  [p.edad, 'Edad media'],
                  [p.dens, 'Habitantes / km²'],
                ]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className={'cg-muted [color:var(--muted-foreground)] text-sm'}>
        Años de referencia:{' '}
        {Object.entries(geography.fuentes)
          .map(([name, year]) => `${name}: ${year}`)
          .join(' · ')}
      </p>
    </>
  );
}

export async function Elections({
  detail,
  query,
  page,
  electionId,
}: {
  detail?: string;
  query: string;
  page: number;
  electionId?: string;
}) {
  if (detail === 'escano') return <SeatPrice election={electionId} />;
  const election = await getElections();
  const selected = detail ?? '';
  if (['caducan', 'legislatura', 'repite', 'metricas', 'mapa', 'voto'].includes(selected))
    return <ElectionContext detail={selected} query={query} page={page} />;
  if (['encuestas', 'proyeccion', 'mercados', 'acierto'].includes(selected)) {
    const polls = await getPolls();
    if (pollsHidden(polls.veda))
      return (
        <>
          <ReportIntro title="Encuestas temporalmente ocultas" />
          <p>La publicación está restringida durante el periodo indicado en la fuente.</p>
        </>
      );
    if (selected === 'proyeccion') return <Projection />;
    if (selected === 'mercados') return <Markets />;
    if (selected === 'acierto') return <Accuracy />;
    return <Polls />;
  }
  if (selected === '350') return <The350 />;
  if (selected === 'historico') return <ElectionHistory election={electionId} />;
  if (/^\d{6}$/.test(selected)) return <Election id={selected} />;
  notFound();
}
