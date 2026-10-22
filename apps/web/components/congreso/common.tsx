import { cn } from '@reforma-digital/design/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reforma-digital/design/ui/select';
import { Card, CardContent } from '@reforma-digital/design/ui/card';
import { Input } from '@reforma-digital/design/ui/input';
import { Button, buttonVariants } from '@reforma-digital/design/ui/button';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CongressIndex, SessionCard, Vote, VoteCard } from '../../lib/congreso/schema';
import { congressBase } from '../../lib/congreso/routes';
import { deputyName, slug } from '../../lib/congreso/data';
import { Icon } from '../brand/icon';

export const number = (value: number) => value.toLocaleString('es-ES');
export const date = (value: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
export const href = (path: string, month?: string) =>
  `${congressBase}${path ? `/${path}` : ''}${month ? `?periodo=${month}` : ''}`;

export function Intro({
  label = 'El Congreso',
  title,
  children,
  heading = 'h1',
}: {
  heading?: 'h1' | 'h2';
  label?: string;
  title: string;
  children?: ReactNode;
}) {
  const Heading = heading;
  return (
    <div
      className={
        "cg-intro [margin:32px_0] [&_:is(h1,_h2)]:[font-size:clamp(34px,_4.2vw,_56px)] [&_:is(h1,_h2)]:[line-height:1.08] [&_:is(h1,_h2)]:[margin:12px_0] [&:has(>_h1)]:[--celda:4px] [&:has(>_h1)]:relative [&:has(>_h1)]:isolate [&:has(>_h1)]:overflow-hidden [&:has(>_h1)]:flex [&:has(>_h1)]:flex-col [&:has(>_h1)]:[justify-content:flex-end] [&:has(>_h1)]:min-h-75 [&:has(>_h1)]:[padding:clamp(32px,_5vw,_64px)_clamp(24px,_4.5vw,_56px)] [&:has(>_h1)]:[border-radius:28px] [&:has(>_h1)]:[box-shadow:inset_0_0_0_1px_var(--border)] [&:has(>_h1)_>_*]:[max-width:min(62ch,_52%)] [&:has(>_h1)::after]:[content:''] [&:has(>_h1)::after]:absolute [&:has(>_h1)::after]:[z-index:-1] [&:has(>_h1)::after]:[right:clamp(0px,_4%,_56px)] [&:has(>_h1)::after]:[bottom:0] [&:has(>_h1)::after]:[width:calc(120_*_var(--celda))] [&:has(>_h1)::after]:[height:calc(44_*_var(--celda))] [&:has(>_h1)::after]:[background:url('/congreso/sol-disco.png')_50%_100%_/_100%_100%_no-repeat] [&:has(>_h1)::after]:[image-rendering:pixelated] [&:has(>_h1)::after]:pointer-events-none [@container(max-width:_1090px)]:[&:has(>_h1)]:[--celda:3px] [@container(max-width:_820px)]:[&:has(>_h1)]:[min-height:0] [@container(max-width:_820px)]:[&:has(>_h1)]:[padding-bottom:calc(44_*_var(--celda)_+_16px)] [@container(max-width:_820px)]:[&:has(>_h1)_>_*]:max-w-none [@container(max-width:_820px)]:[&:has(>_h1)::after]:[right:calc(50%_-_60_*_var(--celda))]"
      }
    >
      <span
        className={
          't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
        }
      >
        {label}
      </span>
      <Heading>{title}</Heading>
      {children && (
        <div className={'cg-lead [max-width:70ch] [color:var(--text-secondary)] text-lg'}>
          {children}
        </div>
      )}
    </div>
  );
}
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={'cg-section [margin:48px_0]'}>
      <div
        className={
          'cg-section-title flex [align-items:baseline] justify-between gap-4 mb-6 [&_h2]:[font-size:32px] [&_h2]:[line-height:1.1] [&_a]:text-sm [@media(max-width:_560px)]:flex-wrap'
        }
      >
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stats({ items }: { items: [number | string, string][] }) {
  return (
    <dl
      className={
        'cg-stats flex flex-wrap gap-8 [padding:24px_0] [margin:0_0_24px] [border-block:1px_solid_var(--border)] [&_div]:flex [&_div]:[flex-direction:column-reverse] [&_div]:gap-2 [&_dt]:[color:var(--muted-foreground)] [&_dt]:text-sm [&_dd]:[font-family:var(--font-brand-heading)] [&_dd]:text-4xl [&_dd]:[line-height:1] [&_dd]:m-0 [@media(max-width:_560px)]:gap-6'
      }
    >
      {items.map(([value, label]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{typeof value === 'number' ? number(value) : value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Empty({
  children = 'No hay resultados para estos filtros.',
}: {
  children?: ReactNode;
}) {
  return (
    <Card className="bg-muted ring-0" render={<p className="cg-empty" role="status" />}>
      {children}
    </Card>
  );
}
export function Source({
  url,
  children = 'Fuente oficial',
}: {
  url: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        'text-blue-600 underline underline-offset-4 ' +
        'cg-source text-sm inline-flex items-center [gap:6px] [margin:12px_0]'
      }
    >
      {children}
      <Icon name="externo" size={16} />
      <span
        className={
          'sr-only absolute [width:1px] [height:1px] p-0 [margin:-1px] overflow-hidden [clip:rect(0,_0,_0,_0)] whitespace-nowrap border-0'
        }
      >
        {' '}
        (se abre en otra pestaña)
      </span>
    </a>
  );
}
export function AI({
  children,
  label = 'Análisis generado con IA · elaboración propia',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className={
        'cg-analysis [&_>_.t-etiqueta]:[font-size:10px] [&_>_.t-etiqueta]:[color:var(--muted-foreground)] [&_p]:mt-2 [&_p]:[color:var(--text-secondary)]'
      }
    >
      <span
        className={
          't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
        }
      >
        {label}
      </span>
      {children}
    </div>
  );
}
export function Votes({ votes }: { votes: VoteCard[] }) {
  if (!votes.length) return <Empty />;
  return (
    <div
      className={
        'cg-votes grid [grid-template-columns:repeat(2,_minmax(0,_1fr))] gap-5 [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {votes.map((vote) => (
        <Card
          key={vote.id}
          render={
            <article
              className={
                'cg-vote [&_h3]:[font-size:21px] [&_h3]:[line-height:1.3] [&_h3]:[margin:16px_0_24px]'
              }
            />
          }
        >
          <CardContent>
            <div
              className={
                'cg-vote-meta flex flex-wrap gap-3 [color:var(--muted-foreground)] text-sm'
              }
            >
              <time dateTime={vote.fecha}>{date(vote.fecha)}</time>
              <span>{vote.tipo}</span>
            </div>
            <h3>
              <Link href={href(`votacion/${vote.id}`, vote.fecha.slice(0, 7))}>{vote.titulo}</Link>
            </h3>
            <VoteCount vote={vote} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function VoteCount({ vote }: { vote: VoteCard }) {
  const total = vote.si + vote.no + vote.abst + vote.novota;
  const values = [
    [vote.si, 'Sí', 'si'],
    [vote.no, 'No', 'no'],
    [vote.abst, 'Abstención', 'abst'],
    [vote.novota, 'No vota', 'ausente'],
  ] as const;
  return (
    <div
      className={
        'cg-vote-count [&_dl]:flex [&_dl]:gap-5 [&_dl]:flex-wrap [&_dl]:text-sm [&_dl]:[margin:12px_0_0] [&_dl_div]:flex [&_dl_div]:items-center [&_dl_div]:gap-2 [&_dt]:flex [&_dt]:items-center [&_dt]:[gap:6px] [&_dt]:[color:var(--text-secondary)] [&_dd]:font-semibold [&_dd]:[font-variant-numeric:tabular-nums] [&_dd]:m-0 [&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:[border-radius:50%]'
      }
    >
      <div
        className={
          'cg-vote-bar flex [gap:2px] h-2 [border-radius:999px] overflow-hidden [background:var(--muted)]'
        }
        aria-hidden="true"
      >
        {values.map(([value, label, kind]) => (
          <span key={label} className={`cg-voto-${kind}`} style={{ flex: value }} />
        ))}
      </div>
      <dl>
        {values.map(([value, label, kind]) => (
          <div key={label}>
            <dt>
              <i className={`cg-voto-${kind}`} aria-hidden="true" />
              {label}
            </dt>
            <dd>{number(value)}</dd>
          </div>
        ))}
      </dl>
      <span
        className={
          'sr-only absolute [width:1px] [height:1px] p-0 [margin:-1px] overflow-hidden [clip:rect(0,_0,_0,_0)] whitespace-nowrap border-0'
        }
      >
        Total: {total}
      </span>
    </div>
  );
}
export function Sessions({ sessions }: { sessions: SessionCard[] }) {
  if (!sessions.length) return <Empty />;
  return (
    <div
      className={
        'cg-session-list [&_article]:grid [&_article]:[grid-template-columns:130px_minmax(0,_1fr)] [&_article]:gap-8 [&_article]:[padding:24px_0] [&_article]:[border-bottom:1px_solid_var(--border)] [&_h3]:text-2xl [&_h3]:[line-height:1.3] [&_h3]:[margin:12px_0] [&_time]:[color:var(--muted-foreground)] [&_time]:[font-family:var(--font-brand-mono)] [&_time]:text-sm [@media(max-width:_560px)]:[&_article]:[grid-template-columns:1fr] [@media(max-width:_560px)]:[&_article]:gap-2'
      }
    >
      {sessions.map((session) => (
        <article key={session.id}>
          <time dateTime={session.fecha}>{date(session.fecha)}</time>
          <div>
            <span
              className={
                't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
              }
            >
              {session.organo}
            </span>
            <h3>
              <Link href={href(`sesion/${session.id.toLowerCase()}`, session.fecha.slice(0, 7))}>
                {session.titular || session.sesion}
              </Link>
            </h3>
            {session.resumen && (
              <AI>
                <p>{session.resumen}</p>
              </AI>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
export function Hemicycle({
  index,
  vote,
  province,
}: {
  index: CongressIndex;
  vote?: Vote;
  province?: string;
}) {
  const voteNames: Record<string, string> = { S: 'Sí', N: 'No', A: 'Abstención', X: 'No vota' };
  if (vote) {
    const ballots = index.diputados.flatMap((deputy, i) => {
      const ballot = vote.v.charAt(i);
      return ballot && ballot !== '-' ? [{ deputy, ballot }] : [];
    });
    return ballots.length ? (
      <Card
        className="bg-muted ring-0"
        render={<div className={'cg-hemicycle [&_svg]:w-full [&_svg]:[max-height:360px]'} />}
      >
        <p>
          El voto de cada diputado. La posición de los puntos no representa su asiento histórico.
        </p>
        <svg
          viewBox="0 0 300 180"
          role="img"
          aria-label="Votos individuales; detalle accesible en la tabla de diputados"
        >
          {ballots.map(({ deputy, ballot }, i) => (
            <circle
              key={deputy.nombre}
              cx={6 + (i % 25) * 12}
              cy={6 + Math.floor(i / 25) * 12}
              r={4}
              className={`cg-voto-${{ S: 'si', N: 'no', A: 'abst', X: 'ausente' }[ballot]}`}
            >
              <title>{`${deputyName(deputy.nombre)} · ${voteNames[ballot]}`}</title>
            </circle>
          ))}
        </svg>
      </Card>
    ) : (
      <Empty>La fuente ofrece el recuento agregado, sin el voto individual.</Empty>
    );
  }
  return (
    <Card
      className="bg-muted ring-0"
      render={<div className={'cg-hemicycle [&_svg]:w-full [&_svg]:[max-height:360px]'} />}
    >
      <svg
        viewBox={`-8 -8 ${index.hemiciclo.ancho + 16} ${index.hemiciclo.alto + 16}`}
        role="img"
        aria-label="Distribución actual de diputados en el hemiciclo; detalle en la lista de diputados"
      >
        {index.diputados.map(
          (deputy) =>
            deputy.x !== null &&
            deputy.y !== null &&
            !deputy.baja && (
              <circle
                key={deputy.nombre}
                cx={deputy.x}
                cy={deputy.y}
                r={4.2}
                fill={index.grupos[deputy.grupo]?.color}
                opacity={province && deputy.provincia !== province ? 0.15 : 1}
              >
                <title>{`${deputyName(deputy.nombre)} · ${deputy.grupo}`}</title>
              </circle>
            ),
        )}
      </svg>
      <div
        className={
          'cg-legend [&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:[border-radius:50%] flex items-center flex-wrap gap-3 text-sm justify-center mt-6 [&_span]:inline-flex [&_span]:[gap:6px] [&_span]:items-center'
        }
      >
        {Object.entries(index.grupos)
          .filter(([, g]) => g.escanos)
          .map(([id, g]) => (
            <span key={id}>
              <i style={{ background: g.color }} />
              {id} <b>{g.escanos}</b>
            </span>
          ))}
      </div>
    </Card>
  );
}
export function Deputies({
  index,
  deputies = index.diputados,
}: {
  index: CongressIndex;
  deputies?: CongressIndex['diputados'];
}) {
  if (!deputies.length) return <Empty />;
  return (
    <div
      className={
        'cg-grid grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {deputies.map((deputy) => (
        <Card
          key={deputy.nombre}
          render={
            <Link
              className={
                'cg-card [overflow-wrap:anywhere] [&_h2]:[font-size:28px] [&_h3]:text-lg [&_h3]:[line-height:1.3] [&_h3]:[margin:12px_0] [&_p]:[color:var(--text-secondary)] [&_p]:[margin:12px_0] [&_.cg-stats]:gap-5 [&_.cg-stats_dd]:[font-size:28px] [&_.cg-stats_dt]:[max-width:14ch] cg-deputy block'
              }
              href={href(`diputado/${slug(deputy.nombre)}`)}
            />
          }
        >
          <CardContent>
            <span
              className={
                'cg-avatar grid [place-items:center] w-14 h-14 [border:2px_solid] [border-radius:50%] [background:var(--muted)] [font-family:var(--font-brand-mono)]'
              }
              style={{ borderColor: index.grupos[deputy.grupo]?.color }}
            >
              {deputyName(deputy.nombre)
                .split(' ')
                .map((part) => part.charAt(0))
                .slice(0, 2)
                .join('')}
            </span>
            <h3>{deputyName(deputy.nombre)}</h3>
            <p>{deputy.provincia}</p>
            <span
              className={
                'cg-group [&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:[border-radius:50%] flex items-center flex-wrap gap-3 text-sm'
              }
            >
              <i style={{ background: index.grupos[deputy.grupo]?.color }} />
              {deputy.grupo}
              {deputy.baja ? ' · De baja' : ''}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function Filters({
  action,
  query,
  group,
  province,
  index,
  period,
  reset,
  children,
}: {
  action: string;
  query: string;
  group?: string;
  province?: string;
  index?: CongressIndex;
  period?: string;
  reset?: string;
  children?: ReactNode;
}) {
  return (
    <form
      className={
        'cg-filters flex items-end flex-wrap gap-4 [margin:24px_0] [&_label]:[flex:1] [&_label]:[min-width:180px] [&_label]:[max-width:400px] [&_label]:grid [&_label]:gap-2 [&_label]:text-sm'
      }
      action={action}
    >
      {period && <input type="hidden" name="periodo" value={period} />}
      <label>
        Buscar
        <Input
          name="q"
          defaultValue={query}
          type="search"
          placeholder="Nombre o tema"
          maxLength={200}
        />
      </label>
      {group !== undefined && index && (
        <label>
          Grupo
          <FilterSelect
            name="grupo"
            label="Grupo"
            defaultValue={group}
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(index.grupos)
                .filter(([, g]) => g.escanos)
                .map(([id]) => ({ value: id, label: id })),
            ]}
          />
        </label>
      )}
      {province !== undefined && index && (
        <label>
          Provincia
          <FilterSelect
            name="provincia"
            label="Provincia"
            defaultValue={province}
            options={[
              { value: '', label: 'Todas' },
              ...[...new Set(index.diputados.map((d) => d.provincia))]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'es'))
                .map((p) => ({ value: p, label: p })),
            ]}
          />
        </label>
      )}
      {children}
      <Button type="submit" variant="outline">
        Buscar <Icon name="buscar" size={16} />
      </Button>
      {reset && (
        <Link
          href={reset}
          data-slot="button"
          data-variant="ghost"
          className={cn(buttonVariants({ variant: 'ghost' }))}
        >
          Limpiar filtros
        </Link>
      )}
    </form>
  );
}
export function Pagination({
  page,
  total,
  params,
}: {
  page: number;
  total: number;
  params: Record<string, string>;
}) {
  const url = (next: number) => `?${new URLSearchParams({ ...params, pagina: String(next) })}`;
  const pages = Math.ceil(total / 24);
  return (
    pages > 1 && (
      <nav
        className={'cg-pagination flex justify-center items-center gap-4 [margin:32px_0]'}
        aria-label="Paginación"
      >
        {page > 1 && (
          <Link
            href={url(page - 1)}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            <Icon name="izquierda" size={16} />
            Anterior
          </Link>
        )}
        <span>
          Página {page} de {pages}
        </span>
        {page < pages && (
          <Link
            href={url(page + 1)}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Siguiente
            <Icon name="derecha" size={16} />
          </Link>
        )}
      </nav>
    )
  );
}

export function FilterSelect({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id?: string;
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select name={name} defaultValue={defaultValue} items={options}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
