'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@reforma-digital/design/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reforma-digital/design/ui/table';
import { percent, thousands } from '../../lib/elecciones/format';
import { Icon } from '../brand/icon';
import { SectionHeading } from './report';

type Row = {
  code: string;
  name: string;
  href: string;
  seats: number;
  seatsHistory: (number | null)[];
  turnout: number;
  price: number;
  winner: { name: string; color: string } | null;
  margin: number | null;
};
type Column = 'name' | 'seats' | 'turnout' | 'price' | 'winner' | 'margin';

const columns: [Column, string][] = [
  ['name', 'Provincia'],
  ['seats', 'Escaños'],
  ['turnout', 'Participación'],
  ['price', 'Votos por escaño'],
  ['winner', 'Primera fuerza'],
  ['margin', 'Último escaño'],
];
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Los escaños de la provincia en cada elección, en escalón (van de uno en uno) y con un margen
// mínimo de 4: un escaño arriba o abajo no parece un vuelco.
function Spark({ values, selected }: { values: (number | null)[]; selected: number }) {
  const known = values.filter((v): v is number => v !== null);
  const max = Math.max(...known);
  const min = Math.min(...known);
  const range = Math.max(max - min, 4);
  const base = (max + min) / 2 - range / 2;
  const W = 64;
  const H = 18;
  const x = (j: number) => (j / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - base) / range) * (H - 4);
  const d = values
    .map((v, j) => (v === null ? '' : j ? `H${x(j)}V${y(v)}` : `M0 ${y(v)}`))
    .join('');
  const now = values[selected];
  return (
    <svg viewBox={`-2 -1 ${W + 4} ${H + 2}`} aria-hidden="true" className="h-[18px] w-16">
      <path d={d} fill="none" className="stroke-muted-foreground" strokeWidth={1.2} />
      {now !== null && now !== undefined && (
        <circle cx={x(selected)} cy={y(now)} r={2.4} className="fill-foreground" />
      )}
    </svg>
  );
}

// La tabla de las circunscripciones en la elección elegida: se ordena por cualquier columna y se
// busca por nombre.
export function ProvinceTable({
  rows,
  year,
  selected,
}: {
  rows: Row[];
  year: string;
  selected: number;
}) {
  const [sort, setSort] = useState<{ column: Column; up: boolean }>({ column: 'seats', up: false });
  const [query, setQuery] = useState('');
  const most = Math.max(...rows.map((r) => r.turnout), 0.01);
  const key = (r: Row): string | number | null =>
    sort.column === 'winner' ? (r.winner?.name ?? null) : r[sort.column];
  const shown = rows
    .filter((r) => !query || plain(r.name).includes(plain(query)))
    .sort((a, b) => {
      const x = key(a);
      const y = key(b);
      if (x === null) return 1;
      if (y === null) return -1;
      const order =
        typeof x === 'string' && typeof y === 'string'
          ? x.localeCompare(y, 'es')
          : Number(x) - Number(y);
      return sort.up ? order : -order;
    });
  const order = (column: Column) =>
    setSort((s) => ({
      column,
      up:
        s.column === column
          ? !s.up
          : column === 'name' || column === 'margin' || column === 'winner',
    }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title={`Las ${rows.length} circunscripciones en ${year}`} />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca una provincia"
          aria-label="Buscar provincia"
          className="max-w-xs"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(([column, text]) => (
                <TableHead
                  key={column}
                  aria-sort={
                    sort.column === column ? (sort.up ? 'ascending' : 'descending') : undefined
                  }
                  className={column === 'name' || column === 'winner' ? '' : 'text-right'}
                >
                  <button
                    type="button"
                    onClick={() => order(column)}
                    className="inline-flex min-h-9 items-center gap-1 font-medium"
                  >
                    {text}
                    {sort.column === column && (
                      <span className={sort.up ? 'inline-flex rotate-180' : 'inline-flex'}>
                        <Icon name="abajo" size={14} />
                      </span>
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.code}>
                <TableCell>
                  <Link href={r.href} className="hover:underline underline-offset-4">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-2">
                    <Spark values={r.seatsHistory} selected={selected} />
                    <b className="w-6 font-mono font-medium tabular-nums">{r.seats}</b>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 rounded-full bg-muted">
                      <i
                        className="block h-full rounded-full bg-muted-foreground"
                        style={{ width: `${(r.turnout / most) * 100}%` }}
                      />
                    </span>
                    <span className="font-mono tabular-nums">{percent(r.turnout)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {thousands(r.price)}
                </TableCell>
                <TableCell>
                  {r.winner ? (
                    <span className="inline-flex items-center gap-2">
                      <i
                        className="block size-2.5 rounded-full"
                        style={{ background: r.winner.color }}
                      />
                      {r.winner.name}
                    </span>
                  ) : (
                    '–'
                  )}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {r.margin === null ? '–' : `${thousands(r.margin)} votos`}
                </TableCell>
              </TableRow>
            ))}
            {!shown.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Ninguna provincia con ese nombre.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
