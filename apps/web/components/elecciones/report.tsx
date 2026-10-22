import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import { Icon } from '../brand/icon';

// Piezas del informe visual de /elecciones: tarjetas separadas, cifras con su explicación y
// barras con su etiqueta. Escala de DESIGN.md §8.1.

const spans = {
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  12: 'md:col-span-12',
};

// Etiqueta corta en mayúsculas: el único texto que puede medir 12 px.
export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function Grid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('grid grid-cols-12 gap-4', className)}>{children}</div>;
}

export function Cell({
  span = 12,
  label,
  className,
  children,
}: {
  span?: keyof typeof spans;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'col-span-12 min-w-0 gap-6 p-6 text-base lg:p-8 max-sm:p-5',
        spans[span],
        className,
      )}
    >
      {label && <Label>{label}</Label>}
      {children}
    </Card>
  );
}

export function Stat({ value, caption }: { value: ReactNode; caption: ReactNode }) {
  return (
    <p className="m-0 grid gap-2">
      <b className="font-heading text-[40px] leading-none font-normal tabular-nums lg:text-5xl">
        {value}
      </b>
      <span className="max-w-[32ch] text-base leading-snug text-muted-foreground">{caption}</span>
    </p>
  );
}

export type Bar = { label: string; value: number; display: string; color?: string; href?: string };

// `mark` dibuja una línea de referencia, como la mayoría absoluta.
export function Bars({ rows, max, mark }: { rows: Bar[]; max?: number; mark?: number }) {
  const top = max ?? Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5rem] items-center gap-4 text-base leading-snug max-sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] max-sm:gap-3"
        >
          {row.href ? <Link href={row.href}>{row.label}</Link> : <span>{row.label}</span>}
          <span className="relative h-4 rounded-full bg-muted">
            <i
              className="block h-full rounded-full"
              style={{
                width: `${(row.value / top) * 100}%`,
                background: row.color ?? 'var(--foreground)',
              }}
            />
            {mark !== undefined && (
              <i
                aria-hidden="true"
                className="absolute -inset-y-1 w-0.5 bg-foreground"
                style={{ left: `${(mark / top) * 100}%` }}
              />
            )}
          </span>
          <span className="text-right font-mono tabular-nums">{row.display}</span>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-base text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-2">
          <i className="block size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function Explore({ links }: { links: { href: string; text: string }[] }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          data-slot="button"
          data-variant="outline"
          className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
        >
          {link.text} <Icon name="derecha" size={16} />
        </Link>
      ))}
    </div>
  );
}

export function Chapter({
  id,
  n,
  name,
  color,
  title,
  insight,
  children,
}: {
  id: string;
  n: number;
  name: string;
  color: string;
  title: string;
  insight: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="mt-24 scroll-mt-24 max-sm:mt-16">
      <header className="mb-8 grid items-end gap-x-12 gap-y-4 md:grid-cols-2">
        <div>
          <p className="m-0 mb-4 flex items-center gap-2 font-mono text-xs font-medium tracking-[0.08em] uppercase">
            <i
              aria-hidden="true"
              className="block size-2.5 rounded-full"
              style={{ background: color }}
            />
            {String(n).padStart(2, '0')} · {name}
          </p>
          <h2
            id={`${id}-titulo`}
            className="m-0 font-heading text-[32px] leading-[1.1] font-normal lg:text-[44px]"
          >
            {title}
          </h2>
        </div>
        <p className="m-0 max-w-[52ch] text-lg leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
          {insight}
        </p>
      </header>
      <Grid>{children}</Grid>
    </section>
  );
}

// Cabecera de un apartado: el título y, al lado, lo que hay que saber para leerlo.
export function ReportIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-10 grid items-end gap-x-12 gap-y-4 md:grid-cols-2">
      <h1 className="m-0 font-heading text-4xl leading-[1.1] font-normal lg:text-[52px]">
        {title}
      </h1>
      {children && (
        <div className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground [&_p]:m-0">
          {children}
        </div>
      )}
    </header>
  );
}

export function ReportStats({ items }: { items: [number | string, string][] }) {
  return (
    <dl className="mb-12 grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-4">
      {items.map(([value, label]) => (
        <Card
          key={label}
          className="flex-col-reverse justify-end gap-2 bg-muted p-6 ring-0 max-sm:p-5"
        >
          <dt className="text-base leading-snug text-muted-foreground">{label}</dt>
          <dd className="m-0 font-heading text-[40px] leading-none tabular-nums">
            {typeof value === 'number'
              ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
              : value}
          </dd>
        </Card>
      ))}
    </dl>
  );
}

export function ReportSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="my-16">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="m-0 font-heading text-[28px] leading-tight font-normal">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
