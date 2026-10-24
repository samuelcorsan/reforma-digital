'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import { decimal, ramp, thousands } from '../../lib/elecciones/format';
import { Cell, Heading, Label } from './report';
import { ProvinceSelect, Simulator, type PriceProvince } from './simulator';
import { Tips } from './tips';
import { useScale } from './use-width';

const percent = (n: number) => `${Math.round(n * 100)} %`;

// La provincia elegida manda en todo: la cifra grande, la balanza, el mapa y el simulador.
export function YourVote({
  provinces,
  initial,
  year,
  average,
  map,
  ranges,
  kpis,
  beside,
  middle,
}: {
  provinces: PriceProvince[];
  initial: string;
  year: string;
  average: number;
  map: ReactNode;
  ranges: { price: [number, number]; lost: [number, number] };
  kpis: ReactNode;
  beside: ReactNode;
  middle: ReactNode;
}) {
  const [code, setCode] = useState(initial);
  const [mode, setMode] = useState<'price' | 'lost'>('price');
  const byCode = new Map(provinces.map((p) => [p.code, p]));
  const price = (p: PriceProvince) => p.valid / p.seats;
  const sorted = [...provinces].sort((a, b) => price(a) - price(b));
  const cheapest = sorted[0];
  const dearest = sorted.at(-1);
  const current = byCode.get(code) ?? cheapest;
  const box = useRef<HTMLDivElement>(null);
  // El mapa llega dibujado del servidor con los dos colores de cada provincia (`data-price` y
  // `data-lost`): aquí se pinta el del modo elegido y se marca la provincia.
  useEffect(() => {
    for (const path of box.current?.querySelectorAll<SVGElement>('[data-province]') ?? []) {
      path.toggleAttribute('data-active', path.getAttribute('data-province') === code);
      path.style.fill = path.getAttribute(mode === 'price' ? 'data-price' : 'data-lost') ?? '';
    }
  }, [code, mode]);
  if (!current || !cheapest || !dearest) return null;

  const mine = price(current);
  const sentence =
    current.code === dearest.code ? (
      <>
        Es la provincia donde un escaño costó más votos. Un voto aquí pesa{' '}
        <b>{decimal(price(dearest) / price(cheapest))} veces menos</b> que uno de {cheapest.name}.
      </>
    ) : (
      <>
        {mine < average ? 'Menos' : 'Más'} que la media de España ({thousands(average)}). Un voto de{' '}
        {current.name} pesa <b>{decimal(price(dearest) / mine)} veces</b> uno de {dearest.name}
        {current.code === cheapest.code ? ', la que más' : ''}.
      </>
    );
  const choose = (next: string | null | undefined) => next && byCode.has(next) && setCode(next);
  const [low, high] = ranges[mode];

  return (
    <>
      <Cell className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-10">
        <div className="grid content-start gap-4">
          <Label>¿Cuánto vale tu voto?</Label>
          <ProvinceSelect provinces={provinces} value={current.code} onChange={choose} />
          <p className="m-0 grid gap-1" aria-live="polite">
            <b className="font-heading text-6xl leading-none font-normal tabular-nums lg:text-7xl">
              {thousands(mine)}
            </b>
            <span className="text-muted-foreground">votos costó cada escaño en {year}</span>
          </p>
          <p className="m-0 max-w-[48ch] text-sm leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
            {sentence}
          </p>
        </div>
        <Balance provinces={provinces} selected={current.code} onSelect={choose} />
      </Cell>
      {kpis}
      <Cell span={6}>
        <Heading
          title={mode === 'price' ? 'Votos por escaño en cada provincia' : 'Votos que no sirvieron'}
        >
          {mode === 'price'
            ? 'Votos válidos entre escaños: cuanto más intenso, más caro. Pulsa una provincia para hacerla tuya.'
            : 'Parte de los votos de cada provincia que fue a candidaturas sin escaño allí. Con pocos escaños en juego se pierden muchos más.'}
        </Heading>
        <Tabs value={mode} onValueChange={(value) => setMode(value === 'lost' ? 'lost' : 'price')}>
          <TabsList aria-label="Qué se pinta">
            <TabsTrigger value="price" className="px-3">
              Votos por escaño
            </TabsTrigger>
            <TabsTrigger value="lost" className="px-3">
              Votos que no sirvieron
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div
          ref={box}
          className="[&_[data-active]]:stroke-foreground [&_[data-active]]:[stroke-width:2.5] [&_[data-province]]:cursor-pointer"
          onClick={(event) =>
            choose(
              event.target instanceof Element
                ? event.target.closest('[data-province]')?.getAttribute('data-province')
                : null,
            )
          }
        >
          <Tips>{map}</Tips>
        </div>
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
          {mode === 'price' ? thousands(low) : percent(low)}
          <span
            className="block h-2.5 w-32 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${ramp(mode, 0)}, ${ramp(mode, 1)})`,
            }}
          />
          {mode === 'price' ? `${thousands(high)} votos` : percent(high)}
        </p>
      </Cell>
      {beside}
      {/* Las provincias de «Quién se los lleva» llevan su reparto al simulador. */}
      <div
        className="contents"
        onClick={(event) => {
          const code =
            event.target instanceof Element
              ? event.target.closest('[data-sim-province]')?.getAttribute('data-sim-province')
              : null;
          if (!code) return;
          choose(code);
          document.getElementById('simulador')?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        {middle}
      </div>
      <Simulator
        key={current.code}
        province={current}
        provinces={provinces}
        onProvince={choose}
        map={box}
      />
    </>
  );
}

// La balanza: cada provincia es una bola, del tamaño de sus escaños, de la más barata a la más cara.
function Balance({
  provinces,
  selected,
  onSelect,
}: {
  provinces: PriceProvince[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  const W = 640;
  const H = 170;
  const chart = useRef<HTMLDivElement>(null);
  const k = useScale(chart, W);
  const m = 16;
  const balls = useMemo(() => {
    const xs = provinces.map((p) => ({ p, v: p.valid / p.seats, r: 3 + Math.sqrt(p.seats) * 1.9 }));
    const low = Math.min(...xs.map((b) => b.v));
    const high = Math.max(...xs.map((b) => b.v));
    const placed: { p: PriceProvince; x: number; y: number; r: number }[] = [];
    // Enjambre: cada bola, en la primera altura libre alrededor del centro.
    for (const b of [...xs].sort((a, c) => c.r - a.r)) {
      const x = m + ((b.v - low) / (high - low || 1)) * (W - 2 * m);
      let y = H / 2;
      for (let k = 0; k < 60; k++) {
        y = H / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3;
        if (placed.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + b.r + 1)) break;
      }
      placed.push({ p: b.p, x, y: Math.max(b.r, Math.min(H - b.r, y)), r: b.r });
    }
    return placed;
  }, [provinces]);
  const ends = [...balls].sort((a, b) => a.x - b.x);
  const labelled = [ends[0], ends.at(-1), balls.find((b) => b.p.code === selected)].filter(
    (b, i, all): b is (typeof balls)[number] => !!b && all.indexOf(b) === i,
  );
  return (
    <div className="grid gap-2">
      <p className="m-0 flex justify-between font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        <span>Más barato</span>
        <span>Más caro</span>
      </p>
      <Tips>
        <div ref={chart}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Votos por escaño en cada provincia, de la más barata a la más cara"
            className="block h-auto w-full overflow-visible"
          >
            <line x1={m} x2={W - m} y1={H / 2} y2={H / 2} className="stroke-border" />
            {balls.map((b) => (
              <circle
                key={b.p.code}
                cx={b.x}
                cy={b.y}
                r={b.r}
                className={cn(
                  'cursor-pointer transition-colors',
                  b.p.code === selected
                    ? 'fill-foreground'
                    : 'fill-muted-foreground/35 hover:fill-muted-foreground/60',
                )}
                data-tip={b.p.name}
                data-tip-text={`${thousands(b.p.valid / b.p.seats)} votos por escaño · ${b.p.seats} escaños`}
                onClick={() => onSelect(b.p.code)}
              />
            ))}
            {labelled.map((b) => (
              <text
                key={b.p.code}
                x={Math.min(W - 4, Math.max(4, b.x))}
                y={b.y - b.r - 6}
                textAnchor={b.x < 60 ? 'start' : b.x > W - 60 ? 'end' : 'middle'}
                className={cn(
                  'pointer-events-none',
                  b.p.code === selected ? 'fill-foreground font-medium' : 'fill-muted-foreground',
                )}
                style={{ fontSize: 12 * k }}
              >
                {b.p.name}
              </text>
            ))}
          </svg>
        </div>
      </Tips>
      <p className="m-0 text-sm text-muted-foreground">
        Cada bola es una provincia, del tamaño de sus escaños. Pulsa una para hacerla tuya.
      </p>
    </div>
  );
}
