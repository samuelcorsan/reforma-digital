'use client';

import { useState } from 'react';
import { Badge } from '@reforma-digital/design/ui/badge';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reforma-digital/design/ui/table';
import { decimal, shortDate, thousands } from '../../lib/elecciones/format';
import { SectionHeading } from './report';

type Poll = {
  firm: string;
  outlet: string;
  start: string;
  end: string;
  sample: number | null;
  // El CIS y los agregadores no entran en la media.
  outside: boolean;
  votes: Record<string, number>;
  seats: Record<string, [number, number]>;
};

const all = 'todas';
const short = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const field = (start: string, end: string) => {
  const a = new Date(`${start}T00:00:00Z`);
  return start === end ? shortDate(end) : `${short.format(a)}–${shortDate(end)}`;
};

// «Todas las encuestas»: de la más reciente a la más antigua, con su horquilla de escaños; se
// filtran por empresa y se ven de 25 en 25.
export function PollTable({
  parties,
  polls,
}: {
  parties: { id: string; name: string; color: string }[];
  polls: Poll[];
}) {
  const [firm, setFirm] = useState(all);
  const [count, setCount] = useState(25);
  const firms = [...new Set(polls.map((p) => p.firm))].sort((a, b) => a.localeCompare(b, 'es'));
  const items = [
    { value: all, label: 'Todas las empresas' },
    ...firms.map((f) => ({ value: f, label: f })),
  ];
  const shown = polls
    .filter((p) => firm === all || p.firm === firm)
    .sort((a, b) => b.end.localeCompare(a.end));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title="Todas las encuestas" />
        <Select
          value={firm}
          items={items}
          onValueChange={(v) => {
            setFirm(v ?? all);
            setCount(25);
          }}
        >
          <SelectTrigger aria-label="Empresa" className="w-full max-w-xs">
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
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Encuestadora</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead className="text-right">Muestra</TableHead>
              {parties.map((p) => (
                <TableHead key={p.id} className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="block size-2 rounded-full" style={{ background: p.color }} />
                    {p.name}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.slice(0, count).map((p, i) => {
              const max = Math.max(...parties.map((x) => p.votes[x.id] ?? 0));
              return (
                <TableRow key={`${p.firm}-${p.end}-${i}`}>
                  <TableCell>
                    <span className="grid gap-0.5">
                      <span className="inline-flex flex-wrap items-center gap-2 font-medium">
                        {p.firm}
                        {p.outside && <Badge variant="outline">fuera de la media</Badge>}
                      </span>
                      <span className="text-muted-foreground">{p.outlet}</span>
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{field(p.start, p.end)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {p.sample === null ? '–' : thousands(p.sample)}
                  </TableCell>
                  {parties.map((x) => {
                    const v = p.votes[x.id];
                    const e = p.seats[x.id];
                    return (
                      <TableCell key={x.id} className="text-right font-mono tabular-nums">
                        {v === undefined ? (
                          '–'
                        ) : (
                          <span className="grid">
                            <span className={v === max ? 'font-semibold' : ''}>{decimal(v)}</span>
                            {e && (
                              <span className="text-muted-foreground">
                                {e[0] === e[1] ? e[0] : `${e[0]}–${e[1]}`}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {shown.length > count && (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setCount(count + 50)}
        >
          Ver más ({shown.length - count})
        </Button>
      )}
    </>
  );
}
