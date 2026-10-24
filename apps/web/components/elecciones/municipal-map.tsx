'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import { geoMunicipalitiesSchema, municipalityVotesSchema } from '../../lib/congreso/schema';
import type { z } from 'zod';
import { percent, thousands } from '../../lib/elecciones/format';
import { turnout, voteShare } from '../../lib/elecciones/geography';
import { Icon } from '../brand/icon';
import { load } from './load';
import { Label } from './report';
import { Tips } from './tips';

export type MapGroup = { id: string; name: string; color: string; families: string[] };
type Votes = z.infer<typeof municipalityVotesSchema>;
type Geo = z.infer<typeof geoMunicipalitiesSchema>;
type Loaded = { geo: Geo; votes: Record<'202307' | '201911', Votes> };

const elections = [
  { value: '202307', label: '23 de julio de 2023' },
  { value: '201911', label: '10 de noviembre de 2019' },
] as const;
const down = '#9A6B4F';
const mix = (color: string, t: number) =>
  `color-mix(in oklab, ${color} ${Math.round(12 + 88 * Math.max(0, Math.min(1, t)))}%, var(--muted))`;
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))] ?? 0;
};
// La parte de los votos de un grupo en un municipio (sobre los votos a candidaturas).
const share = (votes: Votes, code: string, group: MapGroup) => {
  const row = votes.municipios[code];
  return row ? voteShare(row, votes.orden, group.families) : null;
};
// El grupo más votado de un municipio («Otros» no cuenta: es un cajón de sastre).
const winner = (votes: Votes, code: string, groups: MapGroup[]) => {
  let best: MapGroup | null = null;
  let most = 0;
  for (const g of groups) {
    const v = g.id === 'OTROS' ? 0 : (share(votes, code, g) ?? 0);
    if (v > most) {
      most = v;
      best = g;
    }
  }
  return best;
};
const points = (n: number) =>
  `${(n * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pt`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${points(Math.abs(n))}`;

// El voto en los 8.131 municipios, en 2019 o en 2023, y cuánto cambió entre las dos: el resumen de
// la zona a la vista (España o una provincia, que se amplía), el mapa y la ficha del municipio que
// se pulse. El mapa pesa cerca de un megabyte: se pide al abrir la página, no va dentro del HTML.
export function MunicipalMap({
  groups,
  provinces,
}: {
  groups: MapGroup[];
  provinces: { code: string; name: string }[];
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [election, setElection] = useState<'202307' | '201911'>('202307');
  const [mode, setMode] = useState('first');
  const [change, setChange] = useState(false);
  const [province, setProvince] = useState('all');
  const [box, setBox] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      load('elecciones/geo-municipios.json', geoMunicipalitiesSchema),
      load('elecciones/municipios-202307.json', municipalityVotesSchema),
      load('elecciones/municipios-201911.json', municipalityVotesSchema),
    ])
      .then(([geo, v23, v19]) => live && setData({ geo, votes: { '202307': v23, '201911': v19 } }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const comparable = mode !== 'first';
  const showChange = change && comparable;
  const shown = showChange ? '202307' : election;
  const provinceName = provinces.find((p) => p.code === province)?.name;

  const fill = useMemo(() => {
    if (!data) return null;
    const votes = data.votes[shown];
    const codes = Object.keys(data.geo.municipios);
    const fill: Record<string, string> = {};
    if (mode === 'first') {
      for (const code of codes) {
        const best = winner(votes, code, groups);
        if (best) fill[code] = best.color;
      }
      return { fill, scale: null };
    }
    const group = groups.find((g) => g.id === mode);
    const value = (code: string, v: Votes) => {
      if (mode === 'turnout') {
        return turnout(v.municipios[code]);
      }
      return group ? share(v, code, group) : null;
    };
    const values: Record<string, number> = {};
    for (const code of codes) {
      const now = value(code, votes);
      if (now === null) continue;
      if (showChange) {
        const then = value(code, data.votes['201911']);
        if (then !== null) values[code] = now - then;
      } else values[code] = now;
    }
    const list = Object.values(values);
    const color = group?.color ?? 'var(--foreground)';
    if (showChange) {
      const limit = Math.max(Math.abs(quantile(list, 0.02)), Math.abs(quantile(list, 0.98)), 0.001);
      for (const [code, v] of Object.entries(values))
        fill[code] = mix(v >= 0 ? color : down, Math.abs(v) / limit);
      return { fill, scale: { from: -limit, to: limit, color, change: true } };
    }
    const lo = mode === 'turnout' ? quantile(list, 0.02) : 0;
    const hi = quantile(list, 0.98);
    for (const [code, v] of Object.entries(values))
      fill[code] = mix(color, (v - lo) / (hi - lo || 1));
    return { fill, scale: { from: lo, to: hi, color, change: false } };
  }, [data, shown, mode, showChange, groups]);

  // La zona a la vista: en cuántos municipios es primera fuerza cada grupo y qué parte del censo
  // vive en ellos.
  const summary = useMemo(() => {
    if (!data) return null;
    const votes = data.votes[shown];
    const won = new Map<string, { n: number; census: number }>();
    let n = 0;
    let census = 0;
    for (const code of Object.keys(data.geo.municipios)) {
      const row = votes.municipios[code];
      if (!row || (province !== 'all' && !code.startsWith(province))) continue;
      n++;
      census += row[0] ?? 0;
      const best = winner(votes, code, groups);
      if (!best) continue;
      const w = won.get(best.id) ?? { n: 0, census: 0 };
      w.n++;
      w.census += row[0] ?? 0;
      won.set(best.id, w);
    }
    const rows = groups
      .flatMap((g) => {
        const w = won.get(g.id);
        return w ? [{ group: g, ...w }] : [];
      })
      .sort((a, b) => b.n - a.n);
    return { n, census, rows };
  }, [data, shown, province, groups]);

  // Ampliar una provincia: el recuadro de sus municipios, con margen y la proporción del mapa (si
  // no, el mapa cambiaría de alto).
  const zoom = (code: string) => {
    setProvince(code);
    if (code === 'all' || !data || !svg.current) return setBox(null);
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const path of svg.current.querySelectorAll<SVGPathElement>(
      `path[data-municipality^="${code}"]`,
    )) {
      // Algún municipio no tiene trazado (su recuadro es 0, 0): no cuenta.
      if (!path.getAttribute('d')) continue;
      const b = path.getBBox();
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.width);
      y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) return setBox(null);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    const ratio = data.geo.ancho / data.geo.alto;
    let w = x1 - x0 + 2 * pad;
    let h = y1 - y0 + 2 * pad;
    if (w / h < ratio) w = h * ratio;
    else h = w / ratio;
    setBox(`${(x0 + x1 - w) / 2} ${(y0 + y1 - h) / 2} ${w} ${h}`);
  };

  // El detalle de cada municipio se calcula al pasar por encima.
  const describe = (event: PointerEvent<SVGSVGElement>) => {
    const path =
      event.target instanceof Element ? event.target.closest('[data-municipality]') : null;
    const code = path?.getAttribute('data-municipality');
    if (!path || !code || !data) return;
    const votes = data.votes[shown];
    const row = votes.municipios[code];
    if (!row) return path.setAttribute('data-tip-text', 'Sin datos');
    const top = groups
      .map((g) => [g, share(votes, code, g) ?? 0] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([g, v]) => `${g.name} ${percent(v, 1)}`);
    path.setAttribute(
      'data-tip-text',
      `Participación ${percent(turnout(row) ?? 0, 1)} · censo ${thousands(row[0] ?? 0)}. ${top.join(' · ')}. Pulsa para ver su ficha.`,
    );
  };
  const choose = (event: MouseEvent<SVGSVGElement>) => {
    const code =
      event.target instanceof Element
        ? event.target.closest('[data-municipality]')?.getAttribute('data-municipality')
        : null;
    if (code) setSelected(code);
  };

  const modes = [
    { value: 'first', label: 'Primera fuerza' },
    ...groups
      .filter((g) => g.id !== 'OTROS')
      .map((g) => ({ value: g.id, label: `Voto a ${g.name}` })),
    { value: 'turnout', label: 'Participación' },
  ];
  // Solo las provincias con algún municipio dibujado: Ceuta y Melilla no tienen trazado.
  const drawn = new Set(
    Object.entries(data?.geo.municipios ?? {}).flatMap(([code, [, d]]) =>
      d ? [code.slice(0, 2)] : [],
    ),
  );
  const provinceItems = [
    { value: 'all', label: 'Toda España' },
    ...provinces.filter((p) => drawn.has(p.code)).map((p) => ({ value: p.code, label: p.name })),
  ];
  const scale = fill?.scale;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={election}
          items={[...elections]}
          disabled={showChange}
          onValueChange={(v) => v && setElection(v === '201911' ? '201911' : '202307')}
        >
          <SelectTrigger aria-label="Elección" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {elections.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} items={modes} onValueChange={(v) => v && setMode(v)}>
          <SelectTrigger aria-label="Qué se pinta" className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={province}
          items={provinceItems}
          disabled={!data}
          onValueChange={(v) => v && zoom(v)}
        >
          <SelectTrigger aria-label="Provincia" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {provinceItems.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showChange ? 'default' : 'outline'}
          aria-pressed={showChange}
          disabled={!comparable}
          onClick={() => setChange(!change)}
        >
          Cambio desde 2019
        </Button>
      </div>
      {summary && (
        <section aria-label="Resumen de la zona" className="grid gap-4">
          <p className="m-0 max-w-[65ch] text-muted-foreground">
            {elections.find((e) => e.value === shown)?.label}, {provinceName ?? 'toda España'}:{' '}
            {thousands(summary.n)} municipios y {thousands(summary.census)} electores. Primera
            fuerza en…
          </p>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-6 gap-y-4 p-0">
            {summary.rows.map(({ group, n, census }) => (
              <li key={group.id} className="grid gap-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <i
                    className="block size-2.5 shrink-0 rounded-full"
                    style={{ background: group.color }}
                  />
                  {group.name}
                </span>
                <b className="font-heading text-[28px] leading-none font-normal tabular-nums">
                  {thousands(n)}
                </b>
                <span className="text-sm text-muted-foreground">
                  {n === 1 ? 'municipio' : 'municipios'} ·{' '}
                  {percent(census / (summary.census || 1), census < summary.census / 10 ? 1 : 0)}{' '}
                  del censo
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {failed ? (
        <p className="m-0 text-muted-foreground">No se ha podido cargar el mapa municipal.</p>
      ) : !data || !fill ? (
        <p className="m-0 text-muted-foreground" aria-live="polite">
          Cargando los 8.131 municipios…
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-3">
            <Tips>
              <svg
                ref={svg}
                viewBox={box ?? `0 0 ${data.geo.ancho} ${data.geo.alto}`}
                role="img"
                aria-label={`Mapa de los municipios de ${provinceName ?? 'España'}: ${modes.find((m) => m.value === mode)?.label}${showChange ? ', cambio desde 2019' : ''}`}
                className="block h-auto w-full"
                onPointerOver={describe}
                onClick={choose}
              >
                {Object.entries(data.geo.municipios).map(([code, [name, d]]) => (
                  <path
                    key={code}
                    d={d}
                    data-municipality={code}
                    data-tip={name}
                    fill={fill.fill[code] ?? 'var(--muted)'}
                    className="cursor-pointer stroke-card [stroke-width:0.35] hover:stroke-foreground hover:[stroke-width:1.5]"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {selected && data.geo.municipios[selected] && (
                  <path
                    d={data.geo.municipios[selected]?.[1]}
                    fill="none"
                    className="pointer-events-none stroke-foreground [stroke-width:2.5]"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </Tips>
            {scale && (
              <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
                {scale.change ? `−${points(Math.abs(scale.from))}` : percent(scale.from, 0)}
                <span
                  className="block h-2.5 w-32 rounded-full"
                  style={{
                    background: scale.change
                      ? `linear-gradient(90deg, ${mix(down, 1)}, var(--muted), ${mix(scale.color, 1)})`
                      : `linear-gradient(90deg, ${mix(scale.color, 0)}, ${mix(scale.color, 1)})`,
                  }}
                />
                {scale.change ? `+${points(scale.to)}` : `${percent(scale.to, 0)} o más`}
              </p>
            )}
          </div>
          <aside aria-live="polite" className="grid gap-4 rounded-xl bg-muted p-5">
            {selected ? (
              <Profile
                code={selected}
                name={data.geo.municipios[selected]?.[0] ?? selected}
                province={provinces.find((p) => selected.startsWith(p.code))?.name}
                data={data}
                groups={groups}
                onClose={() => setSelected(null)}
              />
            ) : (
              <p className="m-0 text-(--text-secondary)">
                Pulsa un municipio del mapa para ver su ficha: cómo votó en 2023, cuánto cambió
                desde 2019 y cuánta gente fue a votar.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

// La ficha de un municipio: participación y censo, y el voto de cada grupo en 2023 con la raya de
// 2019.
function Profile({
  code,
  name,
  province,
  data,
  groups,
  onClose,
}: {
  code: string;
  name: string;
  province?: string;
  data: Loaded;
  groups: MapGroup[];
  onClose: () => void;
}) {
  const now = data.votes['202307'];
  const then = data.votes['201911'];
  const row = now.municipios[code];
  const old = then.municipios[code];
  const rows = groups
    .filter((g) => g.id !== 'OTROS')
    .map((g) => ({ g, a: share(now, code, g) ?? 0, b: share(then, code, g) }))
    .filter((r) => r.a > 0.005 || (r.b ?? 0) > 0.005)
    .sort((x, y) => y.a - x.a);
  const top = Math.max(...rows.flatMap((r) => [r.a, r.b ?? 0]), 0.01);
  const t23 = turnout(row);
  const t19 = turnout(old);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          {province && <Label>{province}</Label>}
          <h3 className="m-0 font-heading text-[28px] leading-tight font-normal">{name}</h3>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar la ficha" onClick={onClose}>
          <span className="rotate-45">
            <Icon name="mas" size={16} />
          </span>
        </Button>
      </div>
      {!row ? (
        <p className="m-0 text-(--text-secondary)">Sin datos de 2023 para este municipio.</p>
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <dt className="text-sm text-(--text-secondary)">Participación en 2023</dt>
              <dd className="m-0 font-mono tabular-nums">
                {t23 === null ? '—' : percent(t23, 1)}
                {t23 !== null && t19 !== null && (
                  <span className="block font-sans text-sm text-(--text-secondary)">
                    {signed(t23 - t19)} desde 2019
                  </span>
                )}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-(--text-secondary)">Electores</dt>
              <dd className="m-0 font-mono tabular-nums">{thousands(row[0] ?? 0)}</dd>
            </div>
          </dl>
          <ul className="m-0 grid list-none gap-3 p-0">
            {rows.map(({ g, a, b }) => (
              <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                <span className="flex items-center gap-2">
                  <i
                    className="block size-2.5 shrink-0 rounded-full"
                    style={{ background: g.color }}
                  />
                  {g.name}
                </span>
                <span className="text-right font-mono tabular-nums">{percent(a, 1)}</span>
                <span className="relative col-span-2 h-2 rounded-full bg-background">
                  <i
                    className="block h-full rounded-full"
                    style={{ width: `${(a / top) * 100}%`, background: g.color }}
                  />
                  {b !== null && (
                    <i
                      aria-hidden="true"
                      className="absolute -inset-y-1 w-0.5 bg-foreground"
                      style={{ left: `${(b / top) * 100}%` }}
                    />
                  )}
                </span>
                {b !== null && (
                  <span className="col-span-2 text-sm text-(--text-secondary)">
                    {signed(a - b)} desde 2019
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-(--text-secondary)">
            Voto del 23J sobre los votos a candidaturas; la raya negra marca el de 2019.
          </p>
        </>
      )}
    </>
  );
}
