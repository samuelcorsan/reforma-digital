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
        "[margin:32px_0] [&_:is(h1,_h2)]:text-fluid-34-56 [&_:is(h1,_h2)]:leading-1.08 [&_:is(h1,_h2)]:[margin:12px_0] [&:has(>_h1)]:[--celda:4px] [&:has(>_h1)]:[--hueco-sol:calc(44_*_var(--celda)_+_16px)] [&:has(>_h1)]:relative [&:has(>_h1)]:isolate [&:has(>_h1)]:overflow-hidden [&:has(>_h1)]:flex [&:has(>_h1)]:flex-col [&:has(>_h1)]:[justify-content:flex-end] [&:has(>_h1)]:min-h-75 [&:has(>_h1)]:py-fluid-32-64 [&:has(>_h1)]:px-fluid-24-56 [&:has(>_h1)]:rounded-28 [&:has(>_h1)]:inset-ring [&:has(>_h1)]:inset-ring-border [&:has(>_h1)_>_*]:[max-width:min(62ch,_52%)] [&:has(>_h1)::after]:[content:''] [&:has(>_h1)::after]:absolute [&:has(>_h1)::after]:[z-index:-1] [&:has(>_h1)::after]:[right:clamp(0px,_4%,_56px)] [&:has(>_h1)::after]:[bottom:0] [&:has(>_h1)::after]:[width:calc(120_*_var(--celda))] [&:has(>_h1)::after]:[height:calc(44_*_var(--celda))] [&:has(>_h1)::after]:sol-disco [&:has(>_h1)::after]:[image-rendering:pixelated] [&:has(>_h1)::after]:pointer-events-none [@container(max-width:_1090px)]:[&:has(>_h1)]:[--celda:3px] [@container(max-width:_820px)]:[&:has(>_h1)]:[min-height:0] [@container(max-width:_820px)]:[&:has(>_h1)]:pb-(--hueco-sol) [@container(max-width:_820px)]:[&:has(>_h1)_>_*]:max-w-none [@container(max-width:_820px)]:[&:has(>_h1)::after]:[right:calc(50%_-_60_*_var(--celda))]"
      }
    >
      <span
        data-part="t-etiqueta"
        className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
      >
        {label}
      </span>
      <Heading>{title}</Heading>
      {children && (
        <div className={'[max-width:70ch] text-(--text-secondary) text-lg'}>{children}</div>
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
    <section className={'[margin:48px_0]'}>
      <div
        className={
          'flex [align-items:baseline] justify-between gap-4 mb-6 [&_h2]:text-32 [&_h2]:leading-1.1 [&_a]:text-sm [@media(max-width:_560px)]:flex-wrap'
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
      data-part="cg-stats"
      className={
        'flex flex-wrap gap-8 py-6 px-0 [margin:0_0_24px] border-y border-y-border [&_div]:flex [&_div]:[flex-direction:column-reverse] [&_div]:gap-2 [&_dt]:text-muted-foreground [&_dt]:text-sm [&_dd]:font-heading [&_dd]:text-4xl [&_dd]:leading-none [&_dd]:m-0 [@media(max-width:_560px)]:gap-6'
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
    <Card role="status">
      <CardContent>{children}</CardContent>
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
        '[&_>_[data-part=t-etiqueta]]:text-10 [&_>_[data-part=t-etiqueta]]:text-muted-foreground [&_p]:mt-2 [&_p]:text-(--text-secondary)'
      }
    >
      <span
        data-part="t-etiqueta"
        className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
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
        'grid [grid-template-columns:repeat(2,_minmax(0,_1fr))] gap-5 [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {votes.map((vote) => (
        <Card key={vote.id} render={<article className={'[&_h3]:[margin:16px_0_24px]'} />}>
          <CardContent>
            <div className={'flex flex-wrap gap-3 text-muted-foreground text-sm'}>
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
        '[&_dl]:flex [&_dl]:gap-5 [&_dl]:flex-wrap [&_dl]:text-sm [&_dl]:[margin:12px_0_0] [&_dl_div]:flex [&_dl_div]:items-center [&_dl_div]:gap-2 [&_dt]:flex [&_dt]:items-center [&_dt]:gap-1.5 [&_dt]:text-(--text-secondary) [&_dd]:font-semibold [&_dd]:tabular-nums [&_dd]:m-0 [&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:rounded-full'
      }
    >
      <div className={'flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted'} aria-hidden="true">
        {values.map(([value, label, kind]) => (
          <span
            key={label}
            className={`cg-voto-${kind} flex-(--flex)`}
            style={{ '--flex': value }}
          />
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
        '[&_article]:grid [&_article]:[grid-template-columns:130px_minmax(0,_1fr)] [&_article]:gap-8 [&_article]:py-6 [&_article]:px-0 [&_article]:border-b [&_article]:border-b-border [&_h3]:text-2xl [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_time]:text-muted-foreground [&_time]:font-mono [&_time]:text-sm [@media(max-width:_560px)]:[&_article]:[grid-template-columns:1fr] [@media(max-width:_560px)]:[&_article]:gap-2'
      }
    >
      {sessions.map((session) => (
        <article key={session.id}>
          <time dateTime={session.fecha}>{date(session.fecha)}</time>
          <div>
            <span
              data-part="t-etiqueta"
              className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
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
      <Card render={<div className={'[&_svg]:w-full [&_svg]:[max-height:360px]'} />}>
        <CardContent>
          El voto de cada diputado. La posición de los puntos no representa su asiento histórico.
        </CardContent>
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
    <Card render={<div className={'[&_svg]:w-full [&_svg]:[max-height:360px]'} />}>
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
          '[&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:rounded-full flex items-center flex-wrap gap-3 text-sm justify-center mt-6 [&_span]:inline-flex [&_span]:gap-1.5 [&_span]:items-center'
        }
      >
        {Object.entries(index.grupos)
          .filter(([, g]) => g.escanos)
          .map(([id, g]) => (
            <span key={id}>
              <i className="bg-(--bg)" style={{ '--bg': g.color }} />
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
        'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
      }
    >
      {deputies.map((deputy) => (
        <Card
          key={deputy.nombre}
          render={
            <Link
              data-part="cg-card"
              className={
                '[overflow-wrap:anywhere] [&_h3]:[margin:12px_0] [&_p]:[margin:12px_0] [&_[data-part=cg-stats]_dt]:[max-width:14ch] block'
              }
              href={href(`diputado/${slug(deputy.nombre)}`)}
            />
          }
        >
          <CardContent>
            <span
              className={
                'grid [place-items:center] w-14 h-14 border-2 border-(--border-color) rounded-full bg-muted font-mono'
              }
              style={{ '--border-color': index.grupos[deputy.grupo]?.color }}
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
                '[&_i]:w-2 [&_i]:h-2 [&_i]:inline-block [&_i]:rounded-full flex items-center flex-wrap gap-3 text-sm'
              }
            >
              <i className="bg-(--bg)" style={{ '--bg': index.grupos[deputy.grupo]?.color }} />
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
        'flex items-end flex-wrap gap-4 [margin:24px_0] [&_label]:[flex:1] [&_label]:[min-width:180px] [&_label]:[max-width:400px] [&_label]:grid [&_label]:gap-2 [&_label]:text-sm'
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
        className={'flex justify-center items-center gap-4 [margin:32px_0]'}
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
