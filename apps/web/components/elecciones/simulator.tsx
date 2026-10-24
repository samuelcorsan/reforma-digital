'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import { dhondt, type Quotient } from '../../lib/elecciones/dhondt';
import { ink, thousands } from '../../lib/elecciones/format';
import { useFirstSight } from './first-sight';
import { Cell, Label } from './report';
import { Icon } from '../brand/icon';
import { Tips } from './tips';

// En qué punto va la explicación: `k` escaños repartidos; en la fase 1 se señala la barra que se
// lleva el siguiente. `null` es el reparto completo.
type Step = { k: number; phase: 0 | 1 } | null;

export type PriceProvince = {
  code: string;
  name: string;
  seats: number;
  valid: number;
  lost: number;
  // Las candidaturas con al menos el 0,5 % (las demás no cambian el reparto): [siglas, color, votos].
  parties: [string, string, number][];
};

// Un medio paso: señalar la barra más larga (fase 1) o darle el escaño (fase 0 del siguiente).
const advance = (s: Step, total: number): Step => {
  if (!s) return { k: 0, phase: 0 };
  if (s.phase === 0 && s.k < total) return { k: s.k, phase: 1 };
  return s.k + 1 >= total ? null : { k: s.k + 1, phase: 0 };
};

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const plus = (n: number) => `${n > 0 ? '+' : '−'}${thousands(Math.abs(n))}`;

// «Juega con los votos»: el reparto D'Hondt de la provincia con sus votos reales, ronda a ronda;
// los votos se pueden cambiar y la tabla de cocientes dice por qué cada escaño fue a quien fue.
export function Simulator({
  province,
  provinces,
  onProvince,
  map,
}: {
  province: PriceProvince;
  provinces: PriceProvince[];
  onProvince: (code: string | null) => void;
  map: RefObject<HTMLDivElement | null>;
}) {
  const real = Object.fromEntries(province.parties.map(([name, , votes]) => [name, votes]));
  const color = Object.fromEntries(province.parties.map(([name, c]) => [name, c]));
  const rest = province.valid - Object.values(real).reduce((a, b) => a + b, 0);
  const [votes, setVotes] = useState(real);
  const [step, setStep] = useState<Step>(null);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const timers = useRef<number[]>([]);
  const shape = useRef<SVGPathElement>(null);

  const total = (v: Record<string, number>) => rest + Object.values(v).reduce((a, b) => a + b, 0);
  const run = (v: Record<string, number>) => dhondt(v, province.seats, total(v));
  const r = run(votes);
  const N = r.won.length;
  const realResult = run(real).result;
  const n = step ? step.k : N;
  const toca = step?.phase === 1 ? r.won[step.k] : undefined;
  const finished = n >= N;
  const last = finished ? r.won.at(-1) : undefined;
  const out = finished ? r.next[0] : undefined;
  const assigned = (k: number) => {
    const c: Record<string, number> = {};
    for (const q of r.won.slice(0, k)) c[q.party] = (c[q.party] ?? 0) + 1;
    return c;
  };
  const now = assigned(n);
  const pace = N > 12 ? Math.max(130, 4200 / N) : 520;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => {
        const next = advance(step, N);
        setStep(next);
        if (!next) {
          setPlaying(false);
          setDone(true);
        }
      },
      step?.k === 0 && step.phase === 0 ? 1300 : step?.phase === 1 ? pace : pace * 0.9,
    );
    return () => clearTimeout(timer);
  }, [playing, step, N, pace]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  // La silueta de la provincia: la misma forma del mapa, encuadrada a su tamaño.
  useEffect(() => {
    const source = map.current?.querySelector(`[data-province="${province.code}"]`);
    const path = shape.current;
    const d = source?.getAttribute('d');
    if (!path || !d || !(source instanceof SVGGraphicsElement)) return;
    path.setAttribute('d', d);
    const box = source.getBBox();
    const pad = Math.max(box.width, box.height) * 0.06;
    path.ownerSVGElement?.setAttribute(
      'viewBox',
      `${box.x - pad} ${box.y - pad} ${box.width + 2 * pad} ${box.height + 2 * pad}`,
    );
  }, [map, province.code]);

  const play = () => {
    if (reducedMotion()) return setStep(null);
    setDone(false);
    setStep({ k: 0, phase: 0 });
    setPlaying(true);
  };
  // La primera vez que se ve (y cada vez que llega otra provincia ya a la vista), se explica solo.
  const bars = useFirstSight(play, 0.4);
  const edit = (next: Record<string, number>) => {
    setPlaying(false);
    setStep(null);
    setDone(false);
    setVotes(next);
  };
  // Cuántos votos más necesita una candidatura para sacar un escaño más (búsqueda binaria), y se
  // mueven hasta ahí poco a poco.
  const oneMore = (party: string) => {
    const has = r.result[party] ?? 0;
    const start = votes[party] ?? 0;
    let low = start;
    let high = start + province.valid * 2;
    const wins = (v: number) => (run({ ...votes, [party]: v }).result[party] ?? 0) > has;
    if (!wins(high)) return;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (wins(mid)) high = mid;
      else low = mid;
    }
    const target = high;
    edit(votes);
    setNote(`${party} necesita ${thousands(target - start)} votos más`);
    const begin = performance.now() + 500;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - begin) / (reducedMotion() ? 1 : 900)));
      const v = Math.round(start + (target - start) * (1 - (1 - t) ** 3));
      setVotes((current) => ({ ...current, [party]: v }));
      if (t < 1) timers.current.push(window.setTimeout(tick, 16));
    };
    timers.current.push(window.setTimeout(tick, 500));
  };

  const top = Math.max(1, ...Object.values(votes));
  const width = (q: number) => (q / top) * 96;
  const leader = Object.entries(r.result).sort(
    ([a, x], [b, y]) => y - x || (votes[b] ?? 0) - (votes[a] ?? 0),
  )[0]?.[0];
  const changes = province.parties
    .map(([name]) => [name, (r.result[name] ?? 0) - (realResult[name] ?? 0)] as const)
    .filter(([, d]) => d)
    .sort(([, a], [, b]) => b - a);
  const below = province.parties
    .filter(([name]) => (votes[name] ?? 0) > 0 && (votes[name] ?? 0) < r.barrier)
    .map(([name]) => name);
  const rows = province.parties
    .filter(([name]) => (votes[name] ?? 0) >= r.barrier && votes[name])
    .sort(([a], [b]) => (votes[b] ?? 0) - (votes[a] ?? 0));
  const columns = Math.min(province.seats, 12);
  const won = new Set(r.won.slice(0, n).map((q) => `${q.party}|${q.divisor}`));
  const is = (q: Quotient | undefined, name: string, d: number) =>
    q?.party === name && q.divisor === d;
  const latest = step && step.k > 0 && step.phase === 0 ? r.won[step.k - 1] : undefined;

  const narration = finished ? (
    last ? (
      <>
        El último escaño fue para <b>{last.party}</b>, con {thousands(last.value)} (÷
        {last.divisor}).
        {out && (
          <>
            {' '}
            La barra más larga que se queda sin escaño es la de <b>{out.party}</b>:{' '}
            {thousands(out.value)}.
          </>
        )}
      </>
    ) : (
      'Ninguna candidatura pasa la barrera.'
    )
  ) : toca ? (
    <>
      <span className="mr-2 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Escaño {n + 1} de {province.seats}
      </span>
      La barra más larga es la de <b style={{ color: color[toca.party] }}>{toca.party}</b>:{' '}
      {thousands(toca.value)}.
    </>
  ) : latest ? (
    <>
      <span className="mr-2 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Escaño {n} de {province.seats}
      </span>
      Para <b style={{ color: color[latest.party] }}>{latest.party}</b>. Su barra pasa a ÷
      {(now[latest.party] ?? 0) + 1}:{' '}
      {thousands((votes[latest.party] ?? 0) / ((now[latest.party] ?? 0) + 1))}.
    </>
  ) : (
    'Al empezar, cada barra es el total de votos (÷1). Las que no llegan al 3 % no juegan.'
  );

  return (
    <Cell>
      <div className="flex items-start justify-between gap-6">
        <div className="grid gap-2">
          <Label>Juega con los votos</Label>
          <h2
            id="simulador"
            className="m-0 flex scroll-mt-28 flex-wrap items-center gap-x-3 gap-y-2 font-heading text-[28px] leading-tight font-normal"
          >
            ¿Cuántos votos cambian un escaño en
            <ProvinceSelect provinces={provinces} value={province.code} onChange={onProvince} />?
          </h2>
          <p className="m-0 max-w-[75ch] text-muted-foreground">
            {province.seats === 1
              ? 'Aquí se reparte un solo escaño: se lo lleva quien más votos tiene.'
              : `Los ${province.seats} escaños se reparten por rondas. En cada una, el escaño es para la barra más larga; y esa barra se divide entre uno más (÷2, ÷3…) para la ronda siguiente.`}
          </p>
        </div>
        <figure className="m-0 hidden w-28 shrink-0 text-center sm:block" aria-hidden="true">
          <svg className="block h-24 w-full">
            <path
              ref={shape}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              style={{
                stroke: leader ? color[leader] : 'var(--foreground)',
                fill: `color-mix(in oklab, ${leader ? color[leader] : 'var(--foreground)'} 22%, transparent)`,
              }}
            />
          </svg>
          <figcaption className="mt-1 font-mono text-sm text-muted-foreground">
            {province.seats} {province.seats === 1 ? 'escaño' : 'escaños'}
          </figcaption>
        </figure>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="sunset"
              size="sm"
              onClick={() => (playing ? setPlaying(false) : step ? setPlaying(true) : play())}
            >
              {playing ? 'Pausa' : step ? 'Seguir' : done ? 'Repetir el reparto' : 'Ver el reparto'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPlaying(false);
                const next = !step
                  ? ({ k: 0, phase: 0 } as const)
                  : step.k + 1 >= N
                    ? null
                    : ({ k: step.k + 1, phase: 0 } as const);
                setStep(next);
                setDone(!next);
              }}
            >
              Siguiente escaño <Icon name="derecha" size={14} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => edit(real)}>
              Resultado real
            </Button>
          </div>
          <div ref={bars} className="grid gap-1.5">
            <p className="m-0 grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] gap-3 font-mono text-sm text-muted-foreground">
              <span />
              <span className="relative h-5">
                {last && (
                  <span
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${Math.min(80, Math.max(12, width(last.value)))}%` }}
                  >
                    último escaño: {thousands(last.value)}
                  </span>
                )}
              </span>
              <span className="w-20 text-right text-xs font-medium tracking-[0.08em] uppercase">
                Escaños
              </span>
            </p>
            {province.parties.map(([name]) => {
              const v = votes[name] ?? 0;
              const passes = v > 0 && v >= r.barrier;
              const d = (now[name] ?? 0) + 1;
              const seats = now[name] ?? 0;
              return (
                <div
                  key={name}
                  className={cn(
                    'grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md text-sm transition-colors',
                    toca?.party === name && 'bg-muted',
                    !passes && 'text-muted-foreground',
                  )}
                >
                  <span className="font-medium break-words">{name}</span>
                  <span className="relative grid gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="relative h-3 flex-1">
                        <i
                          className="absolute inset-0 block origin-left rounded-xs transition-transform duration-500 motion-reduce:transition-none"
                          style={{
                            transform: `scaleX(${width(passes ? v / d : v) / 100})`,
                            background: passes ? color[name] : 'var(--muted)',
                          }}
                        />
                        {last && (
                          <i
                            className="absolute -inset-y-1 block w-px border-l border-dashed border-foreground"
                            style={{ left: `${width(last.value)}%` }}
                          />
                        )}
                      </span>
                    </span>
                    <small className="font-mono text-sm text-muted-foreground tabular-nums">
                      {passes ? (
                        <>
                          {thousands(v)} ÷ {d} ={' '}
                          <b className="font-medium text-foreground">{thousands(v / d)}</b>
                        </>
                      ) : (
                        'no llega al 3 %'
                      )}
                    </small>
                  </span>
                  <span className="flex w-20 flex-wrap items-center justify-end gap-0.5">
                    {passes && <b className="mr-1 font-mono font-medium tabular-nums">{seats}</b>}
                    {Array.from({ length: Math.min(seats, 12) }, (_, j) => (
                      <i
                        key={j}
                        className="block size-2 shrink-0 rounded-xs"
                        style={{ background: color[name] }}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <p
            className="m-0 min-h-10 text-sm text-muted-foreground [&_b]:font-medium"
            aria-live="polite"
          >
            {narration}
          </p>
        </div>

        <div className="grid content-start gap-3">
          <Label>
            {province.seats === 1 ? 'El escaño' : `Los ${province.seats} escaños`} de{' '}
            {province.name}
          </Label>
          <Tips>
            <ol
              className={cn(
                'm-0 grid list-none gap-1 p-0',
                province.seats > 12
                  ? 'grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]'
                  : 'grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]',
              )}
            >
              {Array.from({ length: province.seats }, (_, i) => {
                const q = i < n ? r.won[i] : undefined;
                const c = q ? (color[q.party] ?? '#8A8F98') : undefined;
                return (
                  <li
                    key={i}
                    tabIndex={0}
                    data-tip={`Escaño ${i + 1}.º`}
                    data-tip-text={
                      q
                        ? `${q.party}: ${thousands(q.votes)} ÷ ${q.divisor} = ${thousands(q.value)}`
                        : 'Aún sin repartir'
                    }
                    data-tip-color={c}
                    className={cn(
                      'grid min-h-12 content-start gap-0.5 rounded-md p-1.5 font-mono text-xs leading-tight',
                      !q && 'border border-dashed border-border text-muted-foreground',
                    )}
                    style={c ? { background: c, color: ink(c) } : undefined}
                  >
                    <span className="opacity-80">{i + 1}.º</span>
                    {q && province.seats <= 12 && (
                      <b className="font-sans text-sm font-medium break-words">{q.party}</b>
                    )}
                  </li>
                );
              })}
            </ol>
          </Tips>
          <p className="m-0 flex min-h-6 flex-wrap gap-2 text-sm" aria-live="polite">
            {note && <span className="text-muted-foreground">{note}</span>}
            {changes.map(([name, d]) => (
              <span
                key={name}
                className={cn('font-medium', d > 0 ? 'text-[#2E7D5B]' : 'text-brand')}
              >
                {name} {d > 0 ? '+' : '−'}
                {Math.abs(d)}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-6">
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 text-sm">
          <b className="font-medium">Los votos</b>
          <span className="text-muted-foreground">
            Arrástralos, o pide <b className="font-medium text-foreground">+1 escaño</b> y la web
            calcula cuántos faltan.
          </span>
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {province.parties.map(([name]) => {
            const v = votes[name] ?? 0;
            const dv = v - (real[name] ?? 0);
            return (
              <li
                key={name}
                className={cn(
                  'grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 text-sm max-sm:grid-cols-[minmax(0,6rem)_minmax(0,1fr)]',
                  v < r.barrier && 'text-muted-foreground',
                )}
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <i className="block size-2.5 rounded-full" style={{ background: color[name] }} />
                  {name}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(v, Math.round((real[name] ?? 0) * 2 + province.valid * 0.02))}
                  step={Math.max(1, Math.round(province.valid / 2000))}
                  value={v}
                  aria-label={`Votos de ${name}`}
                  onChange={(event) => edit({ ...votes, [name]: Number(event.target.value) })}
                  className="-my-3.5 h-11 w-full"
                  style={{ accentColor: color[name] }}
                />
                <span className="text-right font-mono tabular-nums max-sm:text-left">
                  {thousands(v)}
                  {dv !== 0 && (
                    <small className={cn('ml-1 text-sm', dv > 0 ? 'text-[#2E7D5B]' : 'text-brand')}>
                      {plus(dv)}
                    </small>
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(r.result[name] ?? 0) >= province.seats}
                  onClick={() => oneMore(name)}
                >
                  +1 escaño
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="m-0 text-sm text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
          Para entrar en el reparto hace falta el 3 % de los votos válidos:{' '}
          <b>{thousands(r.barrier)}</b>.{below.length > 0 && ` No llegan: ${below.join(', ')}.`}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="grid gap-2 border-t border-border pt-6">
          <h3 className="m-0 text-base font-medium">La tabla de cocientes</h3>
          <p className="m-0 text-sm text-muted-foreground">
            Las mismas rondas, en números: los votos de cada candidatura entre 1, 2, 3… Los{' '}
            {province.seats} cocientes más altos se llevan los escaños (en color); el recuadro marca
            el último y el discontinuo, el primero que se queda fuera.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 font-mono text-sm tabular-nums">
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: columns }, (_, d) => (
                    <th
                      key={d}
                      className="px-2 py-1.5 text-right font-normal text-muted-foreground"
                    >
                      ÷{d + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([name]) => (
                  <tr key={name}>
                    <th className="py-1.5 pr-3 text-left font-sans text-sm font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <i
                          className="block size-2.5 rounded-full"
                          style={{ background: color[name] }}
                        />
                        {name}
                      </span>
                    </th>
                    {Array.from({ length: columns }, (_, i) => {
                      const d = i + 1;
                      const c = color[name] ?? '#8A8F98';
                      const taken = won.has(`${name}|${d}`);
                      return (
                        <td
                          key={d}
                          className={cn(
                            'rounded-xs px-2 py-1.5 text-right',
                            !taken && 'bg-muted/50',
                            is(last, name, d) && 'outline-2 -outline-offset-2 outline-foreground',
                            is(out, name, d) &&
                              'outline-dashed outline-2 -outline-offset-2 outline-foreground',
                            is(toca, name, d) && 'outline-2 -outline-offset-2 outline-brand',
                          )}
                          style={taken ? { background: c, color: ink(c) } : undefined}
                        >
                          {thousands((votes[name] ?? 0) / d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {province.seats > columns && (
            <p className="m-0 text-sm text-muted-foreground">
              Se muestran los {columns} primeros divisores.
            </p>
          )}
        </div>
      )}
    </Cell>
  );
}

export function ProvinceSelect({
  provinces,
  value,
  onChange,
}: {
  provinces: PriceProvince[];
  value: string;
  onChange: (value: string | null) => void;
}) {
  const items = [...provinces]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((p) => ({ value: p.code, label: p.name }));
  return (
    <Select value={value} onValueChange={onChange} items={items}>
      <SelectTrigger aria-label="Provincia" className="w-full max-w-xs font-sans">
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
}

// El simulador con una sola provincia, sin mapa: el ejemplo cuando no hay resultados.
export function ExampleSimulator({ province }: { province: PriceProvince }) {
  const map = useRef<HTMLDivElement>(null);
  return <Simulator province={province} provinces={[province]} onProvince={() => {}} map={map} />;
}
