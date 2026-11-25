import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@reforma-digital/design/ui/table';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@reforma-digital/design/ui/collapsible';
import { Card, CardContent } from '@reforma-digital/design/ui/card';

import { Icon } from '../brand/icon';
import { rawQuestionSchema, rawSessionSchema } from '../../lib/congreso/schema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from '@reforma-digital/db';
import { z } from 'zod';
import { getQuestions, congressUrl, slug } from '../../lib/congreso/data';
import {
  approvedLaws,
  findLaw,
  findSession,
  findTopic,
  findVote,
  interventions,
  lawFacets,
  laws,
  sessions,
  topics,
  votes,
} from '../../lib/congreso/queries';
import type { LawFilter } from '../../lib/congreso/queries';
import type { CongressIndex, Intervention, LawCard } from '../../lib/congreso/schema';
import {
  Intro,
  Section,
  Stats,
  Empty,
  Source,
  AI,
  Votes,
  VoteCount,
  Sessions,
  Filters,
  FilterSelect,
  Pagination,
  Hemicycle,
  date,
  href,
  number,
} from './common';

export function Interventions({
  interventions,
}: {
  interventions: (Intervention & { item: string })[];
}) {
  return interventions.length ? (
    <div
      className={
        'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {interventions.map((iv, i) => (
        <Card
          key={`${iv.s}-${i}`}
          render={
            <article
              data-part="cg-card"
              className={
                '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
              }
            />
          }
        >
          <CardContent>
            <span
              data-part="t-etiqueta"
              className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
            >
              {iv.g} · {iv.tono}
            </span>
            <h3>{iv.orador}</h3>
            <p className={'text-muted-foreground text-sm'}>{iv.item}</p>
            <AI>
              <p>{iv.frase || iv.resumen || 'El resumen está en la ficha de la sesión.'}</p>
            </AI>
            {iv.cita && <blockquote>«{iv.cita}»</blockquote>}
            {iv.ia && (
              <Collapsible>
                <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 text-left">
                  <span>{'Cómo se generó'}</span>
                  <span aria-hidden="true" className="flex shrink-0 group-data-open:rotate-180">
                    {<Icon name="abajo" size={16} />}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p>
                    Modelo: {iv.ia.model}. Prompt: {iv.ia.prompt}.{' '}
                    {iv.ia.provider === 'cache-importada'
                      ? 'Análisis conservado del histórico de Escaño Abierto.'
                      : 'Generado en Reforma Digital con NaN.'}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            )}
            <Link href={href(`sesion/${iv.s.toLowerCase()}`)}>Ver la sesión</Link>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <Empty>No hay intervenciones analizadas en este periodo.</Empty>
  );
}
function Laws({ laws, legislature }: { laws: LawCard[]; legislature: string }) {
  return laws.length ? (
    <div
      className={
        'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {laws.map((law) => (
        <Card
          key={law.exp}
          render={
            <article
              data-part="cg-card"
              className={
                '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
              }
            />
          }
        >
          <CardContent>
            <span
              data-part="t-etiqueta"
              className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
            >
              {law.tipo} · {law.estado}
            </span>
            <h3>
              <Link href={href(`iniciativa/${law.exp.replace('/', '-')}`)}>{law.titulo}</Link>
            </h3>
            <p>{law.situacion}</p>
            <Source url={congressUrl(law.exp, legislature)}>Expediente {law.exp}</Source>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <Empty />
  );
}

export async function Activity({
  section,
  detail,
  index,
  period,
  query,
  page,
  lawFilter,
}: {
  section: string;
  detail?: string;
  index: CongressIndex;
  period: string;
  query: string;
  page: number;
  lawFilter: Required<Pick<LawFilter, 'status' | 'type' | 'year' | 'order'>>;
}) {
  if (section === 'preguntas') {
    const summary = await getQuestions();
    const sql = connection();
    const pattern = `%${query}%`;
    const [count, rows] = await Promise.all([
      sql`SELECT count(*)::int AS total FROM congreso_questions WHERE legislature=${index.meta.legislatura} AND title ILIKE ${pattern}`,
      sql`SELECT content FROM congreso_questions WHERE legislature=${index.meta.legislatura} AND title ILIKE ${pattern} ORDER BY date DESC,id LIMIT 24 OFFSET ${(page - 1) * 24}`,
    ]);
    const questions = z.array(z.object({ content: rawQuestionSchema })).parse(rows);
    return (
      <>
        <Stats
          items={[
            [summary.total, 'Preguntas registradas'],
            [summary.estados.pendiente ?? 0, 'Pendientes'],
            [summary.demora.mediana ?? '—', 'Mediana de días hasta contestar'],
          ]}
        />
        <Filters action={href('preguntas')} query={query} />
        <div
          className={
            'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
          }
        >
          {questions.map(({ content: question }) => (
            <Card
              key={question.exp}
              render={
                <article
                  data-part="cg-card"
                  className={
                    '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
                  }
                />
              }
            >
              <CardContent>
                <span
                  data-part="t-etiqueta"
                  className={
                    'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'
                  }
                >
                  {question.estado} · {date(question.presentada)}
                </span>
                <h3>{question.titulo}</h3>
                <p>{question.autores.map(([name]) => name).join(', ')}</p>
                <Source url={congressUrl(question.exp, index.meta.legislatura)}>
                  Expediente {question.exp}
                </Source>
              </CardContent>
            </Card>
          ))}
        </div>
        {!questions.length && <Empty />}
        <Pagination page={page} total={z.number().parse(count[0]?.total)} params={{ q: query }} />
      </>
    );
  }
  if (section === 'iniciativa') {
    const law = detail ? await findLaw(detail) : null;
    if (!law) notFound();
    const related = await votes({ initiative: law.exp }, 1, null);
    return (
      <>
        <Intro label={law.tipo} title={law.titulo}>
          <p>{law.situacion}</p>
        </Intro>
        <Stats
          items={[
            [law.estado, 'Estado'],
            [date(law.presentada), 'Presentada'],
            [law.etapa, 'Etapa'],
          ]}
        />
        <Source url={congressUrl(law.exp, index.meta.legislatura)}>Expediente completo</Source>
        <Section title="Tramitación">
          <ol
            className={
              'list-none p-0 [&_li]:pt-0 [&_li]:pr-0 [&_li]:pb-6 [&_li]:pl-6 [&_li]:border-l-2 [&_li]:border-l-border [&_h3]:[margin:8px_0] [&_h3]:text-lg'
            }
          >
            {law.fases.map(([organ, phase, from, to], i) => (
              <li key={i}>
                <h3>{phase}</h3>
                <p>
                  {organ} · {from}
                  {to ? ` → ${to}` : ''}
                </p>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Votaciones relacionadas">
          <Votes votes={related.rows} />
        </Section>
      </>
    );
  }
  if (section === 'leyes') {
    const { status, type, year, order } = lawFilter;
    const [found, approved, facets] = await Promise.all([
      laws({ q: query, ...lawFilter }, page),
      approvedLaws(),
      lawFacets(),
    ]);
    const all = (values: string[], label: string) => [
      { value: '', label },
      ...values.map((value) => ({ value, label: value })),
    ];
    const filtered = query || status || type || year || order !== 'recientes';
    return (
      <>
        <Filters action={href('leyes')} query={query} reset={filtered ? href('leyes') : undefined}>
          <label>
            Estado
            <FilterSelect
              name="estado"
              label="Estado"
              defaultValue={status}
              options={all(facets.estados, 'Todos')}
            />
          </label>
          <label>
            Tipo
            <FilterSelect
              name="tipo"
              label="Tipo"
              defaultValue={type}
              options={all(facets.tipos, 'Todos')}
            />
          </label>
          <label>
            Año
            <FilterSelect
              name="anio"
              label="Año de presentación"
              defaultValue={year}
              options={all(facets.anios, 'Todos')}
            />
          </label>
          <label>
            Orden
            <FilterSelect
              name="orden"
              label="Orden"
              defaultValue={order}
              options={[
                { value: 'recientes', label: 'Más recientes' },
                { value: 'antiguas', label: 'Más antiguas' },
              ]}
            />
          </label>
        </Filters>
        <Laws laws={found.rows} legislature={index.meta.legislatura} />
        <Pagination
          page={page}
          total={found.total}
          params={{ q: query, estado: status, tipo: type, anio: year, orden: order }}
        />
        <Section title="Leyes publicadas">
          <div
            className={
              'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
            }
          >
            {approved.map((law, i) => (
              <Card
                key={`${law.pdf}-${i}`}
                render={
                  <article
                    data-part="cg-card"
                    className={
                      '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
                    }
                  />
                }
              >
                <CardContent>
                  <h3>{law.titulo}</h3>
                  <p>{date(law.fecha)}</p>
                  <Source url={law.pdf}>Publicación oficial</Source>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      </>
    );
  }
  if (section === 'temas')
    return (
      <>
        <div
          className={
            'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
          }
        >
          {(await topics()).map((topic) => (
            <Card
              key={topic.id}
              render={
                <Link
                  href={href(`tema/${topic.id}`)}
                  data-part="cg-card"
                  className={
                    '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
                  }
                />
              }
            >
              <CardContent>
                <h2>{topic.nombre}</h2>
                <p>
                  {number(topic.votos)} votaciones · {topic.leyes.length} iniciativas ·{' '}
                  {number(topic.preguntas)} preguntas
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  if (section === 'tema') {
    if (!detail) notFound();
    const topic = await findTopic(detail);
    if (!topic) notFound();
    const [topicVotes, topicLaws] = await Promise.all([
      votes({ topic: detail }, page),
      laws({ exps: topic.leyes }, 1, null),
    ]);
    return (
      <>
        <Intro title={topic.nombre} />
        <Stats
          items={[
            [topic.votos, 'Votaciones'],
            [topic.leyes.length, 'Iniciativas'],
            [topic.preguntas, 'Preguntas'],
          ]}
        />
        <Votes votes={topicVotes.rows} />
        <Pagination page={page} total={topic.votos} params={{}} />
        <Section title="Leyes relacionadas">
          <Laws laws={topicLaws.rows} legislature={index.meta.legislatura} />
        </Section>
      </>
    );
  }
  if (section === 'votacion') {
    const vote = detail ? await findVote(detail) : null;
    if (!vote) notFound();
    const names: Record<string, string> = { S: 'Sí', N: 'No', A: 'Abstención', X: 'No vota' };
    return (
      <>
        <Intro label={`${date(vote.fecha)} · ${vote.tipo}`} title={vote.titulo}>
          <p>{vote.texto}</p>
        </Intro>
        <VoteCount vote={vote} />
        <p>
          Estos recuentos describen el voto. La aprobación depende del procedimiento y la mayoría
          exigida.
        </p>
        <Hemicycle index={index} vote={vote} />
        {vote.json && <Source url={vote.json}>Votación oficial</Source>}
        <Section title="El voto de cada diputado">
          <div
            className={
              'overflow-x-auto [&_table]:[border-collapse:collapse] [&_table]:w-full [&_table]:text-left [&_th]:p-3 [&_th]:border-b [&_th]:border-b-border [&_th]:[vertical-align:top] [&_td]:p-3 [&_td]:border-b [&_td]:border-b-border [&_td]:[vertical-align:top] [&_th]:text-sm'
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diputado</TableHead>
                  <TableHead>Grupo en la votación</TableHead>
                  <TableHead>Voto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {index.diputados.map(
                  (d, i) =>
                    vote.v.charAt(i) &&
                    vote.v.charAt(i) !== '-' && (
                      <TableRow key={d.nombre}>
                        <TableCell>
                          <Link href={href(`diputado/${slug(d.nombre)}`)}>{d.nombre}</Link>
                        </TableCell>
                        <TableCell>{vote.cg?.[String(i)] || d.grupo}</TableCell>
                        <TableCell>{names[vote.v.charAt(i)]}</TableCell>
                      </TableRow>
                    ),
                )}
              </TableBody>
            </Table>
          </div>
        </Section>
      </>
    );
  }
  if (section === 'sesion') {
    const session = detail ? await findSession(detail) : null;
    if (!session) notFound();
    const [sessionVotes, said, rows] = await Promise.all([
      votes({ ids: session.puntos.flatMap((p) => p.votos) }, 1, null),
      interventions({ session: session.id }, 1, null),
      connection()`SELECT content FROM congreso_sessions WHERE legislature=${index.meta.legislatura} AND id=${session.id}`,
    ]);
    const raw = rows.length ? rawSessionSchema.parse(rows[0]?.content) : null;
    return (
      <>
        <Intro
          label={`${date(session.fecha)} · ${session.organo}`}
          title={session.titular || session.sesion}
        />
        {session.resumen && (
          <AI label={session.fuente === 'mvp' ? 'Resumen revisado del histórico' : undefined}>
            <p>{session.resumen}</p>
          </AI>
        )}
        {session.ds && <Source url={session.ds}>Diario de Sesiones</Source>}
        <Section title="Orden del día">
          <ol
            className={
              'list-none p-0 [&_li]:pt-0 [&_li]:pr-0 [&_li]:pb-6 [&_li]:pl-6 [&_li]:border-l-2 [&_li]:border-l-border [&_h3]:[margin:8px_0] [&_h3]:text-lg'
            }
          >
            {session.puntos.map((p, i) => (
              <li key={i}>
                <h3>{p.titulo}</h3>
                <p>{p.tipo}</p>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Votaciones">
          <Votes votes={sessionVotes.rows} />
        </Section>
        <Section title="Qué se dijo">
          <Interventions interventions={said.rows} />
        </Section>
        {raw && (
          <Section title="Intervenciones completas del Diario">
            <p>
              Texto extraído del PDF oficial; consulta el original para comprobar la transcripción.
            </p>
            {raw.intervenciones.map((iv, i) => (
              <Collapsible
                className={
                  'py-4 px-0 border-b border-b-border [&_summary]:cursor-pointer [&_summary]:font-medium [&_p]:[max-width:80ch] [&_p]:[white-space:pre-line]'
                }
                key={i}
              >
                <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 text-left">
                  <span>
                    {
                      <>
                        {iv.orador} · {iv.grupo} · {iv.item || 'Turno de palabra'}
                      </>
                    }
                  </span>
                  <span aria-hidden="true" className="flex shrink-0 group-data-open:rotate-180">
                    {<Icon name="abajo" size={16} />}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p>{iv.texto}</p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </Section>
        )}
      </>
    );
  }
  if (section === 'votaciones') {
    const found = await votes({ period, q: query }, page);
    return (
      <>
        <Filters action={href('votaciones')} query={query} period={period} />
        <Votes votes={found.rows} />
        <Pagination page={page} total={found.total} params={{ q: query, periodo: period }} />
      </>
    );
  }
  const found = await sessions({ period, q: query }, page);
  return (
    <>
      <Filters action={href('dias')} query={query} period={period} />
      <Sessions sessions={found.rows} />
      <Pagination page={page} total={found.total} params={{ q: query, periodo: period }} />
    </>
  );
}
