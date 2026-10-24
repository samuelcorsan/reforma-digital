'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import { Input } from '@reforma-digital/design/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import { stage } from '../../lib/elecciones/laws';
import { thousands } from '../../lib/elecciones/format';

export type ExpiringLaw = {
  exp: string;
  title: string;
  href: string;
  presenter: string;
  presenterName: string;
  color: string;
  stage: number;
  extensions: number;
  days: number;
  presented: string;
};

const orders = {
  dias: { label: 'Más tiempo en el Congreso', by: (l: ExpiringLaw) => l.days },
  ampliaciones: { label: 'Más veces ampliado el plazo', by: (l: ExpiringLaw) => l.extensions },
  etapa: { label: 'Las que llegaron más lejos', by: (l: ExpiringLaw) => l.stage * 1e4 + l.days },
  recientes: { label: 'Las más recientes', by: (l: ExpiringLaw) => Date.parse(l.presented) },
};
type Order = keyof typeof orders;
const isOrder = (value: string): value is Order => value in orders;
const step = 30;
// Sin tildes ni mayúsculas, para que «politica» encuentre «Política».
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// Las 303, una por fila: hasta dónde llegó (la barra), el título, quién la presentó y los días.
export function ExpiringList({
  laws,
  presenters,
}: {
  laws: ExpiringLaw[];
  presenters: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState('');
  const [presenter, setPresenter] = useState('');
  const [reached, setReached] = useState('');
  const [order, setOrder] = useState<Order>('dias');
  const [shown, setShown] = useState(step);

  const rows = laws
    .filter(
      (l) =>
        (!query || plain(`${l.title} ${l.exp}`).includes(plain(query))) &&
        (!presenter || l.presenter === presenter) &&
        (!reached || l.stage === Number(reached)),
    )
    .sort((a, b) => orders[order].by(b) - orders[order].by(a));

  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    items: { value: string; label: string }[],
  ) => (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next ?? '');
        setShown(step);
      }}
      items={items}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <Input
          type="search"
          aria-label="Buscar por título o expediente"
          placeholder="Buscar por título o expediente…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(step);
          }}
        />
        {select('Autor', presenter, setPresenter, [
          { value: '', label: 'Todos los autores' },
          ...presenters.map((p) => ({ value: p.id, label: p.name })),
        ])}
        {select('Etapa', reached, setReached, [
          { value: '', label: 'Todas las etapas' },
          ...stage.slice(0, 5).map((label, i) => ({ value: String(i), label })),
        ])}
        {select(
          'Orden',
          order,
          (value) => isOrder(value) && setOrder(value),
          Object.entries(orders).map(([value, o]) => ({ value, label: o.label })),
        )}
      </div>
      <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
        {rows.length === laws.length
          ? `Las ${laws.length} leyes.`
          : `${rows.length} de ${laws.length} leyes.`}
      </p>
      <ol className="m-0 grid list-none p-0">
        {rows.slice(0, shown).map((l) => (
          <li
            key={l.exp}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border py-3 max-sm:grid-cols-[auto_minmax(0,1fr)]"
          >
            <span
              className="flex gap-0.5"
              role="img"
              aria-label={`Hasta dónde llegó: ${stage[l.stage] ?? ''}`}
            >
              {[0, 1, 2, 3, 4].map((k) => (
                <i
                  key={k}
                  className={cn(
                    'block h-1.5 w-3 rounded-full',
                    k <= l.stage ? 'bg-foreground' : 'bg-muted',
                  )}
                />
              ))}
            </span>
            <Link href={l.href} className="leading-snug hover:underline underline-offset-4">
              {l.title}
            </Link>
            <span className="flex items-center gap-x-4 gap-y-1 text-sm whitespace-nowrap text-muted-foreground max-sm:col-start-2 max-sm:flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <i className="block size-2 rounded-full" style={{ background: l.color }} />
                {l.presenterName}
              </span>
              <span className="w-20 text-right font-mono tabular-nums">
                {thousands(l.days)} días
              </span>
            </span>
          </li>
        ))}
      </ol>
      {rows.length > shown && (
        <Button
          variant="outline"
          className="justify-self-center"
          onClick={() => setShown(shown + step)}
        >
          Mostrar {Math.min(step, rows.length - shown)} más
        </Button>
      )}
    </div>
  );
}
