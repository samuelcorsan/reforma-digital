'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@reforma-digital/design/lib/utils';
import { shortDate } from '../../lib/elecciones/format';
import { Cell, Heading } from './report';
import { Tips } from './tips';

export type RelevoSeat = {
  key: string;
  x: number;
  y: number;
  color: string;
  changed: boolean;
  title: string;
  chain: string;
  href: string;
};
type Person = { name: string; href: string | null; color: string };
export type Departure = {
  seat: string | null;
  date: string;
  out: Person;
  in: Person;
  where: string;
};

const monthName = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const months = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sept',
  'oct',
  'nov',
  'dic',
];

function Name({ person }: { person: Person }) {
  const content = (
    <>
      <i className="mr-1.5 inline-block size-2 rounded-full" style={{ background: person.color }} />
      {person.name}
    </>
  );
  return person.href ? (
    <Link href={person.href} className="hover:underline underline-offset-4">
      {content}
    </Link>
  ) : (
    <span>{content}</span>
  );
}

// Los escaños que cambiaron de manos y cuándo: pulsar un mes los marca en el hemiciclo y en la lista.
export function Relevos({
  seats,
  box,
  departures,
  span,
}: {
  seats: RelevoSeat[];
  box: string;
  departures: Departure[];
  span: string[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState<string | null>(null);
  const counts = new Map(
    span.map((m) => [m, departures.filter((d) => d.date.startsWith(m)).length]),
  );
  const most = Math.max(1, ...counts.values());
  const shown = month ? departures.filter((d) => d.date.startsWith(month)) : departures;
  const marked = new Set(shown.map((d) => d.seat));
  const changed = seats.filter((s) => s.changed).length;

  return (
    <>
      <Cell span={7}>
        <Heading title="Los escaños que cambiaron de manos">
          Encendidos, los que tuvieron relevo. Pasa por uno para ver quién lo ocupó; púlsalo para ir
          a la ficha de quien lo ocupa hoy.
        </Heading>
        <Tips className="mx-auto w-full max-w-xl">
          <svg
            viewBox={box}
            role="img"
            aria-label={`Hemiciclo: ${changed} escaños cambiaron de manos durante la legislatura`}
            className="block h-auto w-full"
          >
            {seats.map((s) => {
              const on = month ? marked.has(s.key) : s.changed;
              return (
                <circle
                  key={s.key}
                  cx={s.x}
                  cy={s.y}
                  r={5.3}
                  fill={s.color}
                  className={cn(
                    'cursor-pointer transition-opacity duration-200 hover:stroke-foreground hover:[stroke-width:1.5]',
                    month && on && 'stroke-foreground [stroke-width:1.5]',
                  )}
                  style={{ opacity: on ? 1 : 0.2 }}
                  data-tip={s.title}
                  data-tip-text={s.chain}
                  data-tip-color={s.color}
                  onClick={() => router.push(s.href)}
                />
              );
            })}
          </svg>
        </Tips>
        <p className="m-0 mt-auto text-sm text-muted-foreground">
          {changed} escaños cambiaron de manos; algunos, más de una vez.
        </p>
      </Cell>
      <Cell span={5}>
        <Heading title="Cuándo se fueron">
          Salidas por mes. Pulsa uno para verlas en el hemiciclo y en la lista.
        </Heading>
        <div className="grid gap-1.5">
          <Tips>
            <div role="group" aria-label="Salidas por mes" className="flex h-20 items-end gap-px">
              {span.map((m) => {
                const gone = departures.filter((d) => d.date.startsWith(m));
                const n = gone.length;
                const label = `${months[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}: ${n} ${n === 1 ? 'salida' : 'salidas'}`;
                const names = gone.slice(0, 3).map((d) => d.out.name);
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!n}
                    aria-pressed={month === m}
                    aria-label={label}
                    onClick={() => setMonth(month === m ? null : m)}
                    className="group flex h-full flex-1 items-end disabled:cursor-default"
                    {...(n && {
                      'data-tip': monthName.format(new Date(`${m}-01T00:00:00Z`)),
                      'data-tip-text': `${n} ${n === 1 ? 'salida' : 'salidas'}: ${names.join(', ')}${n > names.length ? ` y ${n - names.length} más` : ''}`,
                      'data-tip-color': 'var(--brand)',
                    })}
                  >
                    <i
                      className={cn(
                        'block w-full rounded-t-[2px] bg-brand transition-opacity',
                        month && month !== m && 'opacity-30',
                        'group-enabled:group-hover:opacity-100 group-enabled:group-hover:outline-2 group-enabled:group-hover:outline-foreground',
                      )}
                      style={{ height: `${(n / most) * 100}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </Tips>
          <p
            aria-hidden="true"
            className="relative m-0 h-4 font-mono text-xs text-muted-foreground"
          >
            {span.map((m, i) =>
              m.endsWith('-01') ? (
                <span
                  key={m}
                  className="absolute border-l border-border pl-1"
                  style={{ left: `${(i / span.length) * 100}%` }}
                >
                  {m.slice(0, 4)}
                </span>
              ) : null,
            )}
          </p>
        </div>
        <ul className="m-0 grid max-h-96 list-none overflow-auto p-0" aria-live="polite">
          {shown.map((d) => (
            <li
              key={`${d.date}-${d.out.name}`}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-border py-2.5 text-sm first:border-t-0"
            >
              <span className="row-span-2 font-mono text-sm text-muted-foreground">
                {shortDate(d.date)}
              </span>
              <span className="leading-snug">
                <Name person={d.out} /> <span className="text-muted-foreground">→</span>{' '}
                <Name person={d.in} />
              </span>
              <span className="text-sm text-muted-foreground">{d.where}</span>
            </li>
          ))}
        </ul>
      </Cell>
    </>
  );
}
