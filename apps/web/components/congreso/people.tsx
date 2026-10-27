import { Card, CardContent } from '@reforma-digital/design/ui/card';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@reforma-digital/design/ui/collapsible';

import { Icon } from '../brand/icon';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { slug, deputyName, getQuestions } from '../../lib/congreso/data';
import {
  cargos,
  deputyExtra,
  deputyVotes,
  findCargo,
  interventions,
  interventionsByGroup,
  organsSummary,
  votes,
} from '../../lib/congreso/queries';
import type { CongressIndex } from '../../lib/congreso/schema';
import {
  Intro,
  Section,
  Stats,
  Source,
  Votes,
  Empty,
  Deputies,
  Filters,
  Pagination,
  Hemicycle,
  Avatar,
  date,
  href,
} from './common';
import { Interventions } from './activity';

const boeUrl = (id: string) => `https://www.boe.es/diario_boe/txt.php?id=${encodeURIComponent(id)}`;

export async function People({
  section,
  detail,
  index,
  period,
  query,
  group,
  province,
  page,
}: {
  section: string;
  detail?: string;
  index: CongressIndex;
  period: string;
  query: string;
  group: string;
  province: string;
  page: number;
}) {
  if (section === 'cargo') {
    const cargo = detail ? await findCargo(detail) : null;
    if (!cargo) notFound();
    return (
      <>
        <Intro label={cargo.ministerio} title={cargo.cargo} />
        <Section title="Quién ha ocupado el cargo">
          <ol
            className={
              'cg-timeline list-none p-0 [&_li]:[padding:0_0_24px_24px] [&_li]:[border-left:2px_solid_var(--border)] [&_h3]:[margin:8px_0] [&_h3]:text-lg'
            }
          >
            {cargo.mandatos.map((m, i) => (
              <li key={i}>
                <h3>{m.persona}</h3>
                <p>
                  {m.desde ? date(m.desde) : 'Inicio no disponible'} → {m.hasta || 'Actualidad'}
                </p>
                {m.boe && <Source url={boeUrl(m.boe)}>Nombramiento en el BOE</Source>}
              </li>
            ))}
          </ol>
        </Section>
      </>
    );
  }
  if (section === 'organigrama') {
    const [organs, found] = await Promise.all([organsSummary(), cargos(query, page)]);
    return (
      <>
        <Stats
          items={[
            [organs.cifras.cargos_ocupados, 'Cargos ocupados'],
            [organs.cifras.ministerios, 'Ministerios'],
            [organs.cifras.cambios_30, 'Cambios en 30 días'],
          ]}
        />
        <Filters action={href('organigrama')} query={query} />
        <div
          className={
            'cg-grid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
          }
        >
          {found.rows.map(([id, cargo]) => (
            <Card
              key={id}
              render={
                <Link
                  className={
                    'cg-card [overflow-wrap:anywhere] [&_h2]:[font-size:28px] [&_h3]:text-lg [&_h3]:[line-height:1.3] [&_h3]:[margin:12px_0] [&_p]:[color:var(--text-secondary)] [&_p]:[margin:12px_0] [&_.cg-stats]:gap-5 [&_.cg-stats_dd]:[font-size:28px] [&_.cg-stats_dt]:[max-width:14ch]'
                  }
                  href={href(`cargo/${id}`)}
                />
              }
            >
              <CardContent>
                <span
                  className={
                    't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
                  }
                >
                  {cargo.ministerio}
                </span>
                <h3>{cargo.cargo}</h3>
                <p>{cargo.mandatos.find((m) => !m.hasta)?.persona || 'Vacante'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination page={page} total={found.total} params={{ q: query }} />
      </>
    );
  }
  if (section === 'diputado') {
    const deputy = index.diputados.find((d) => slug(d.nombre) === detail);
    if (!deputy) notFound();
    const i = index.diputados.indexOf(deputy);
    const [ballots, said, extra, summary] = await Promise.all([
      deputyVotes(period, i, page),
      interventions({ period, speaker: slug(deputy.nombre.split(',')[0] || '') }, page),
      deputyExtra(deputy.nombre),
      getQuestions(),
    ]);
    const questions = summary.diputados[String(i)];
    return (
      <>
        <Intro label={`${deputy.grupo} · ${deputy.provincia}`} title={deputyName(deputy.nombre)}>
          <Avatar index={index} deputy={deputy} size={96} />
          <p>
            {deputy.baja
              ? `De baja desde ${deputy.baja}`
              : 'Diputado en activo en el último registro'}
          </p>
        </Intro>
        <Stats
          items={[
            [ballots.total, 'Votaciones en el periodo'],
            [said.total, 'Intervenciones analizadas'],
            [questions?.[0] ?? 0, 'Preguntas en la legislatura'],
          ]}
        />
        {deputy.codigo && (
          <Source
            url={`https://www.congreso.es/busqueda-de-diputados?p_p_id=diputados&p_p_lifecycle=0&_diputados_mostrarFicha=true&_diputados_codParlamentario=${encodeURIComponent(String(deputy.codigo))}&_diputados_legislatura=${index.meta.legislatura}`}
          >
            Ficha del Congreso
          </Source>
        )}
        {extra && (
          <>
            <Section title="Biografía">
              <p>{extra.bio}</p>
            </Section>
            <Section title="Comisiones">
              <ul
                className={
                  'cg-list list-none p-0 [&_:is(li,_article)]:flex [&_:is(li,_article)]:justify-between [&_:is(li,_article)]:gap-6 [&_:is(li,_article)]:[padding:16px_0] [&_:is(li,_article)]:[border-bottom:1px_solid_var(--border)] [&_span]:[color:var(--muted-foreground)]'
                }
              >
                {extra.comisiones.map(([commission, role]) => (
                  <li key={`${commission}-${role}`}>
                    <b>{commission}</b>
                    <span>{role}</span>
                  </li>
                ))}
              </ul>
            </Section>
            {extra.intereses && (
              <Section title="Declaración de intereses">
                <p>Información del registro público del Congreso.</p>
                {Object.entries(extra.intereses).map(([label, value]) => (
                  <Collapsible
                    className={
                      'cg-transcript [padding:16px_0] [border-bottom:1px_solid_var(--border)] [&_summary]:cursor-pointer [&_summary]:font-medium [&_p]:[max-width:80ch] [&_p]:[white-space:pre-line]'
                    }
                    key={label}
                  >
                    <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 text-left">
                      <span>{<>{label.replaceAll('_', ' ')}</>}</span>
                      <span aria-hidden="true" className="flex shrink-0 group-data-open:rotate-180">
                        {<Icon name="abajo" size={16} />}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {typeof value === 'string' ? (
                        <p>{value}</p>
                      ) : (
                        <ul>
                          {value.map((row, j) => (
                            <li key={j}>
                              {typeof row === 'string' ? row : row.filter(Boolean).join(' · ')}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </Section>
            )}
            {extra.bienes?.length ? (
              <Section title="Declaración de bienes y rentas">
                <p className="[max-width:70ch] [color:var(--text-secondary)]">
                  Declaraciones publicadas en el Boletín Oficial de las Cortes Generales. El
                  Congreso las publica escaneadas: enlazamos la página del original, sin transcribir
                  cifras.
                </p>
                <ul
                  className={
                    'cg-list list-none p-0 [&_:is(li,_article)]:flex [&_:is(li,_article)]:justify-between [&_:is(li,_article)]:gap-6 [&_:is(li,_article)]:[padding:16px_0] [&_:is(li,_article)]:[border-bottom:1px_solid_var(--border)] [&_span]:[color:var(--muted-foreground)] [&_.cg-source]:whitespace-nowrap'
                  }
                >
                  {extra.bienes.map((d) => (
                    <li key={d.url}>
                      <div className="flex flex-col gap-1">
                        <b>
                          {
                            {
                              inicial: 'Declaración inicial',
                              modificación: 'Modificación',
                              final: 'Declaración final',
                              '': 'Declaración',
                            }[d.tipo]
                          }
                        </b>
                        <span className="text-sm">Publicada el {date(d.fecha)}</span>
                      </div>
                      <Source url={d.url}>
                        BOCG {d.bocg}, pág. {d.pagina}
                      </Source>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </>
        )}
        <Section title="Cómo votó">
          <div
            className={
              'cg-list list-none p-0 [&_:is(li,_article)]:flex [&_:is(li,_article)]:justify-between [&_:is(li,_article)]:gap-6 [&_:is(li,_article)]:[padding:16px_0] [&_:is(li,_article)]:[border-bottom:1px_solid_var(--border)] [&_span]:[color:var(--muted-foreground)]'
            }
          >
            {ballots.rows.map((vote) => (
              <article key={vote.id}>
                <Link href={href(`votacion/${vote.id}`, vote.fecha.slice(0, 7))}>
                  {vote.titulo}
                </Link>
                <b>{{ S: 'Sí', N: 'No', A: 'Abstención', X: 'No vota' }[vote.voto]}</b>
              </article>
            ))}
          </div>
          <Pagination page={page} total={ballots.total} params={{ periodo: period }} />
        </Section>
        <Section title="Qué dijo">
          <Interventions interventions={said.rows} />
          <Pagination page={page} total={said.total} params={{ periodo: period }} />
        </Section>
      </>
    );
  }
  if (section === 'grupos') {
    const [byGroup, latest] = await Promise.all([
      interventionsByGroup(period),
      votes({ period }, 1, 12),
    ]);
    return (
      <>
        <Hemicycle index={index} />
        <div
          className={
            'cg-grid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
          }
        >
          {Object.entries(index.grupos)
            .filter(([, g]) => g.escanos)
            .map(([id, g]) => (
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
                  <span
                    className={
                      'cg-group [&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:[border-radius:50%] flex items-center flex-wrap gap-3 text-sm'
                    }
                  >
                    <i style={{ background: g.color }} />
                    {id}
                  </span>
                  <h2>{g.nombre}</h2>
                  <Stats
                    items={[
                      [g.escanos, 'Escaños'],
                      [byGroup.get(id) ?? 0, 'Intervenciones analizadas'],
                    ]}
                  />
                  <Link href={`${href('diputados')}?grupo=${id}`}>Ver sus diputados</Link>
                  <Collapsible>
                    <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 text-left">
                      <span>{'Voto mayoritario del grupo'}</span>
                      <span aria-hidden="true" className="flex shrink-0 group-data-open:rotate-180">
                        {<Icon name="abajo" size={16} />}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul
                        className={
                          'cg-list list-none p-0 [&_:is(li,_article)]:flex [&_:is(li,_article)]:justify-between [&_:is(li,_article)]:gap-6 [&_:is(li,_article)]:[padding:16px_0] [&_:is(li,_article)]:[border-bottom:1px_solid_var(--border)] [&_span]:[color:var(--muted-foreground)]'
                        }
                      >
                        {latest.rows.map((v) => (
                          <li key={v.id}>
                            <Link href={href(`votacion/${v.id}`, v.fecha.slice(0, 7))}>
                              {v.titulo}
                            </Link>
                            <b>
                              {{ S: 'Sí', N: 'No', A: 'Abstención', X: 'No vota' }[
                                v.grupos[id] || ''
                              ] || 'Voto dividido'}
                            </b>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            ))}
        </div>
      </>
    );
  }
  if (section === 'oradores') {
    const found = await interventions({ period, q: query, group }, page);
    return (
      <>
        <Filters
          action={href('oradores')}
          query={query}
          group={group}
          index={index}
          period={period}
        />
        <Interventions interventions={found.rows} />
        <Pagination
          page={page}
          total={found.total}
          params={{ q: query, grupo: group, periodo: period }}
        />
      </>
    );
  }
  const selectedProvince =
    section === 'provincia' && detail
      ? index.diputados.find((d) => slug(d.provincia) === detail)?.provincia
      : province;
  if (section === 'provincia' && detail && !selectedProvince) notFound();
  const deputies = index.diputados.filter(
    (d) =>
      (section === 'diputados' || !d.baja) &&
      (!selectedProvince || d.provincia === selectedProvince) &&
      (!group || d.grupo === group) &&
      `${d.nombre} ${d.provincia}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      {detail && (
        <Intro
          title={
            section === 'provincia'
              ? `Tus diputados${selectedProvince ? ` · ${selectedProvince}` : ''}`
              : 'Quién te representa'
          }
        >
          <p>Miembros actuales e históricos de la legislatura {index.meta.legislatura}.</p>
        </Intro>
      )}
      <Filters
        action={href(section)}
        query={query}
        group={group}
        province={selectedProvince || ''}
        index={index}
      />
      {section === 'provincia' && <Hemicycle index={index} province={selectedProvince} />}
      <Deputies index={index} deputies={deputies.slice((page - 1) * 24, page * 24)} />
      {!deputies.length && <Empty />}
      <Pagination
        page={page}
        total={deputies.length}
        params={{ q: query, grupo: group, provincia: selectedProvince || '' }}
      />
    </>
  );
}
