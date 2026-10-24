'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@reforma-digital/design/ui/combobox';
import { Icon } from '../brand/icon';
import { Explore, Label, Legend, Stat } from './report';

export type ProvinceSummary = {
  id: string;
  name: string;
  seats: number;
  note: string;
  stats: { value: string; caption: string }[];
  parties: { name: string; seats: number; color: string }[];
  deputies: { name: string; color: string; href: string }[];
  deputiesHref: string;
  geographyHref: string;
};

const maxDeputies = 14;

// Un buscador de provincias con su ficha. Empieza por la que más diputados elige, para que la
// ficha se vea antes de elegir.
export function ProvincePicker({ provinces }: { provinces: ProvinceSummary[] }) {
  const [p, setP] = useState<ProvinceSummary | null>(() =>
    provinces.reduce<ProvinceSummary | null>((a, b) => (!a || b.seats > a.seats ? b : a), null),
  );
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Label>Elige tu provincia</Label>
        <Combobox
          items={provinces}
          value={p}
          onValueChange={setP}
          itemToStringLabel={(province) => province.name}
          isItemEqualToValue={(a, b) => a.id === b.id}
        >
          <ComboboxInput
            aria-label="Provincia"
            placeholder="Escribe o elige una provincia"
            className="max-w-sm"
          />
          <ComboboxContent>
            <ComboboxEmpty>Ninguna provincia coincide.</ComboboxEmpty>
            <ComboboxList>
              {(province: ProvinceSummary) => (
                <ComboboxItem key={province.id} value={province}>
                  {province.name}
                  <span className="ml-auto font-mono text-muted-foreground tabular-nums">
                    {province.seats}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p className="m-0 text-sm text-muted-foreground">
          Junto a cada una, los diputados que elige el 29N.
        </p>
      </div>
      {p && (
        <div className="grid gap-8 border-t border-border pt-8">
          <div className="grid gap-2" aria-live="polite">
            <h3 className="m-0 font-heading text-[32px] leading-tight font-normal">
              {p.name} elige {p.seats} {p.seats === 1 ? 'diputado' : 'diputados'}
            </h3>
            <p className="m-0 text-base text-muted-foreground">{p.note}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-8">
            {p.stats.map((stat) => (
              <Stat key={stat.caption} value={stat.value} caption={stat.caption} />
            ))}
          </div>
          <div className="grid gap-3 border-t border-border pt-6">
            <Label>Reparto de la última elección</Label>
            <div
              className="flex flex-wrap gap-1.5"
              role="img"
              aria-label={p.parties.map((x) => `${x.name} ${x.seats}`).join(', ')}
            >
              {p.parties.flatMap((x) =>
                Array.from({ length: x.seats }, (_, i) => (
                  <i
                    key={`${x.name}-${i}`}
                    className="block size-5 rounded-full"
                    style={{ background: x.color }}
                  />
                )),
              )}
            </div>
            <Legend
              items={p.parties.map((x) => ({ label: `${x.name} ${x.seats}`, color: x.color }))}
            />
          </div>
          {p.deputies.length > 0 && (
            <div className="grid gap-3 border-t border-border pt-6">
              <Label>Sus {p.deputies.length} diputados en la XV legislatura</Label>
              <div className="flex flex-wrap gap-1.5">
                {p.deputies.slice(0, maxDeputies).map((d) => (
                  <Link
                    key={d.href}
                    href={d.href}
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1.5 text-base no-underline hover:bg-muted/70"
                  >
                    <i className="block size-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </Link>
                ))}
                {p.deputies.length > maxDeputies && (
                  <Link
                    href={p.deputiesHref}
                    className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-base text-muted-foreground"
                  >
                    y {p.deputies.length - maxDeputies} más <Icon name="derecha" size={14} />
                  </Link>
                )}
              </div>
            </div>
          )}
          <Explore
            links={[
              { href: p.deputiesHref, text: 'Qué hicieron sus diputados' },
              { href: p.geographyHref, text: 'Su geografía' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
