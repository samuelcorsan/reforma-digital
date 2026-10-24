import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Badge } from '@reforma-digital/design/ui/badge';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import {
  deputyName,
  getElections,
  getHistory,
  getIndex,
  getPolls,
  read,
  slug,
} from '../../lib/congreso/data';
import { pollsHidden } from '../../lib/congreso/polls';
import {
  accuracySchema,
  balanceSchema,
  historicalProvinceSchema,
  mapSchema,
  marketsSchema,
  projectionSchema,
} from '../../lib/congreso/schema';
import { formatDate, percent, thousands } from '../../lib/elecciones/format';
import { origins } from '../../lib/elecciones/laws';
import { electionPages, electionsHref, type ElectionPage } from '../../lib/elecciones/pages';
import { href } from '../congreso/common';
import { ProvincePicker, type ProvinceSummary } from './province-picker';
import { Icon } from '../brand/icon';
import { Bars, CardCta, Cell, Chapter, Grid, Label, Legend, PageCard, Stat } from './report';
import { hemicycleOrder, SeatsCard } from './seats-card';
import { Tips } from './tips';

const majority = 176;

const madrid = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', ...options }).format(new Date());
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 864e5;
const shortDate = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });
const longDate = (iso: string) => formatDate(iso, { day: 'numeric', month: 'long' });
const decimal = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });

type Milestone = { fecha: string; hasta?: string; hito: string; detalle?: string };

// La cabecera cambia según la fase de la elección (textos de Escaño Abierto).
const phases = {
  precampana: {
    label: 'Precampaña',
    title: 'Antes de votar, mira lo que votaron',
    text: 'La XV legislatura se cierra con la disolución de las Cortes. Lo que dejó hecho y sin hacer, cómo se reparten los 350 escaños y cuarenta y nueve años de elecciones, con datos oficiales.',
    cta: ['caducan', '350'],
  },
  listas: {
    label: 'Ya hay listas',
    title: 'Ya hay listas: mira quién repite',
    text: 'Las candidaturas ya están en el BOE: quién de los 350 vuelve a presentarse, en qué puesto y por qué provincia.',
    cta: ['repite', 'caducan'],
  },
  campana: {
    label: 'Campaña electoral',
    title: 'Quince días de campaña. Antes, mira lo que votaron',
    text: 'Los partidos piden el voto. Aquí, lo que hicieron en la legislatura que acaba y cuánto vale un voto en cada provincia.',
    cta: ['repite', 'legislatura'],
  },
  reflexion: {
    label: 'Jornada de reflexión',
    title: 'Mañana se vota',
    text: 'Hoy no hay campaña ni propaganda. Mira cuántos diputados elige tu provincia.',
    cta: ['350', 'historico'],
  },
  votacion: {
    label: 'Hoy se vota',
    title: 'Hoy se vota, de 9.00 a 20.00',
    text: 'A las ocho de la tarde cierran los colegios y empieza el escrutinio.',
    cta: ['350', 'escano'],
  },
  despues: {
    label: 'Después del 29N',
    title: 'Ya se ha votado',
    text: 'Mientras se publican los resultados oficiales, mira cómo se reparten los 350 y cuarenta y nueve años de elecciones.',
    cta: ['350', 'historico'],
  },
} satisfies Record<string, { label: string; title: string; text: string; cta: ElectionPage[] }>;

function phase(today: string, vote: string, calendar: Milestone[]): keyof typeof phases {
  const find = (start: string) => calendar.find((m) => m.hito.startsWith(start));
  if (today > vote) return 'despues';
  if (today === vote) return 'votacion';
  if (today === find('Jornada de reflexión')?.fecha) return 'reflexion';
  const campaign = find('Campaña');
  if (campaign?.hasta && today >= campaign.fecha && today <= campaign.hasta) return 'campana';
  const lists = find('Listas presentadas');
  if (lists && today >= lists.fecha) return 'listas';
  return 'precampana';
}

const chapters = [
  {
    id: 'legislatura',
    name: 'La legislatura',
    title: 'La legislatura que se acaba',
    color: '#7152A8',
  },
  { id: 'escanos', name: 'Los escaños', title: 'Cómo se reparten los 350', color: 'var(--brand)' },
  { id: 'tu-provincia', name: 'Tu provincia', title: 'Tu provincia', color: 'var(--brand-orange)' },
  {
    id: 'historia',
    name: 'La historia',
    title: 'Cuarenta y nueve años de elecciones',
    color: '#2A7DB5',
  },
  { id: 'mapa', name: 'El mapa', title: 'El mapa del voto', color: 'var(--brand-yellow)' },
  { id: 'encuestas', name: 'Las encuestas', title: 'Lo que dicen las encuestas', color: '#2F7A4A' },
];

const card = (id: ElectionPage, span: 4 | 6 | 12, children?: ReactNode) => (
  <PageCard
    key={id}
    href={electionsHref(id)}
    title={electionPages[id].title}
    text={electionPages[id].text}
    cta={electionPages[id].cta}
    span={span}
  >
    {children}
  </PageCard>
);

// Los plazos en vertical: cada hito en una línea, con la fecha a la derecha.
function Calendar({ calendar, today }: { calendar: Milestone[]; today: string }) {
  const next = calendar.findIndex((m) => m.fecha > today);
  return (
    <ol className="m-0 grid list-none p-0">
      {calendar.map((m, k) => {
        const now = (m.hasta && m.fecha <= today && today <= m.hasta) || m.fecha === today;
        const past = !now && m.fecha < today;
        const days = k === next ? dayNumber(m.fecha) - dayNumber(today) : null;
        return (
          <li
            key={`${m.fecha}-${m.hito}`}
            title={m.detalle}
            className={cn(
              'relative grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-x-3 py-1.5',
              'before:absolute before:top-0 before:bottom-0 before:left-[5px] before:w-0.5 first:before:top-[17px] last:before:bottom-auto last:before:h-[17px]',
              past || now ? 'before:bg-foreground' : 'before:bg-border',
            )}
          >
            <i
              className={cn(
                'relative mt-[5px] block size-3 rounded-full border-2 border-border bg-background',
                past && 'border-foreground bg-foreground',
                now && 'border-foreground bg-foreground ring-4 ring-foreground/15',
                k === next && 'border-foreground',
              )}
            />
            <span
              className={cn(
                'text-base leading-snug',
                past && 'text-muted-foreground',
                (now || k === next) && 'font-medium',
              )}
            >
              {m.hito}
              {days !== null && (
                <span className="block text-sm font-normal text-muted-foreground">
                  {days === 1 ? 'Mañana' : `En ${days} días`}
                </span>
              )}
            </span>
            <span className="pt-0.5 font-mono text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {m.hasta
                ? `${m.fecha.slice(5, 7) === m.hasta.slice(5, 7) ? Number(m.fecha.slice(8)) : shortDate(m.fecha)} – ${shortDate(m.hasta)}`
                : shortDate(m.fecha)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Meses contados desde el año 0, para colocar fechas en una escala mensual.
const month = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

// Los años bajo un gráfico de una columna por mes, cada uno donde empieza su enero.
function Years({ from, count }: { from: number; count: number }) {
  const first = Math.ceil(from / 12);
  const last = Math.floor((from + count - 1) / 12);
  return (
    <p aria-hidden="true" className="relative m-0 h-4 font-mono text-xs text-muted-foreground">
      {Array.from({ length: last - first + 1 }, (_, i) => (
        <span
          key={first + i}
          className="absolute border-l border-border pl-1"
          style={{ left: `${(((first + i) * 12 - from) / count) * 100}%` }}
        >
          {first + i}
        </span>
      ))}
    </p>
  );
}

// Una barra por mes, partida en tramos de color, con los años debajo. Misma altura en todas las
// tarjetas para que los gráficos de un capítulo se lean igual.
function MonthBars({
  from,
  columns,
}: {
  from: number;
  columns: { value: number; color: string }[][];
}) {
  const totals = columns.map((column) => column.reduce((sum, s) => sum + s.value, 0));
  const top = Math.max(...totals, 1);
  return (
    <div className="grid gap-1.5">
      <div aria-hidden="true" className="flex h-20 items-end gap-px">
        {columns.map((column, i) => (
          <span
            key={i}
            className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-[2px]"
            style={{ height: `${((totals[i] ?? 0) / top) * 100}%` }}
          >
            {column.map((s) => (
              <i
                key={s.color}
                className="block"
                style={{ flexGrow: s.value, background: s.color }}
              />
            ))}
          </span>
        ))}
      </div>
      <Years from={from} count={columns.length} />
    </div>
  );
}

function Spark({
  values,
  label,
  from,
  to,
}: {
  values: number[];
  label: string;
  from: string;
  to: string;
}) {
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const points = values.map(
    (v, i) =>
      `${(i / (values.length - 1)) * 100},${38 - ((v - bottom) / (top - bottom || 1)) * 36}`,
  );
  return (
    <div className="mt-auto grid gap-2">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="block h-20 w-full overflow-visible"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          points={points.join(' ')}
        />
      </svg>
      <p className="m-0 flex justify-between font-mono text-sm text-muted-foreground">
        <span>{from}</span>
        <span>{to}</span>
      </p>
    </div>
  );
}

export async function ElectionsHome() {
  const [election, source, map, history, index, polls, accuracy] = await Promise.all([
    getElections(),
    read('elecciones/elecciones.json', balanceSchema),
    read('elecciones/geo-provincias.json', mapSchema),
    getHistory(),
    getIndex(),
    getPolls(),
    read('encuestas/aciertos.json', accuracySchema),
  ]);
  const last = history.elecciones.at(-1);
  const first = history.elecciones[0];
  if (!last || !first) throw new Error('El histórico de elecciones está vacío');
  const hidden = pollsHidden(polls.veda);
  const [results, projection, markets] = await Promise.all([
    read(`elecciones/historico-${last.id}.json`, historicalProvinceSchema),
    hidden ? null : read('encuestas/proyeccion.json', projectionSchema),
    hidden ? null : read('encuestas/mercados.json', marketsSchema),
  ]);
  const year = last.fecha.slice(0, 4);
  const firstYear = first.fecha.slice(0, 4);

  const today = madrid({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const calendar = election.calendario;
  const current = phases[phase(today, election.votacion, calendar)];
  const daysLeft = dayNumber(election.votacion) - dayNumber(today);
  const lists = calendar.find((m) => m.hito.startsWith('Listas presentadas'));

  const families = Object.fromEntries(history.familias.map((f) => [f.id, f]));
  const active = index.diputados.filter((d) => !d.baja);
  const groupColor = (group: string) => index.grupos[group]?.color ?? '#888888';
  const order = (group: string) => hemicycleOrder.indexOf(group);

  // Tu provincia.
  const provinces: ProvinceSummary[] = Object.entries(map.provincias)
    .sort(([, a], [, b]) => a.corto.localeCompare(b.corto, 'es'))
    .flatMap(([id, p]) => {
      const total = last.prov[id];
      const detail = results.prov[id];
      if (!total || !detail) return [];
      const seats = election.escanos[id] ?? total.e;
      const change = seats - total.e;
      return [
        {
          id,
          name: p.corto,
          seats,
          note: change
            ? `${Math.abs(change) === 1 ? 'Uno' : Math.abs(change)} ${change > 0 ? 'más' : 'menos'} que en ${year}, por su población (${election.decreto.rd}).`
            : `Los mismos que en ${year}.`,
          stats: [
            {
              value: thousands(total.validos / total.e),
              caption: `votos costó cada escaño en ${year} (España: ${thousands(last.validos / 350)})`,
            },
            {
              value: percent(total.votantes / total.censo),
              caption: `de participación en ${year} (España: ${percent(last.votantes / last.censo)})`,
            },
            ...(detail.ultimo
              ? [
                  {
                    value: thousands(detail.ultimo.faltan),
                    caption: `votos le faltaron a ${detail.ultimo.segundo} para quitarle el último escaño a ${detail.ultimo.gana}`,
                  },
                ]
              : []),
          ],
          parties: detail.c
            .filter(([, , , s]) => s > 0)
            .map(([name, family, , s]) => ({
              name,
              seats: s,
              color: families[family]?.color ?? '#888888',
            })),
          deputies: active
            .filter((d) => d.provincia === p.circ)
            .sort((a, b) => order(a.grupo) - order(b.grupo))
            .map((d) => ({
              name: deputyName(d.nombre),
              color: groupColor(d.grupo),
              href: href(`diputado/${slug(d.nombre)}`),
            })),
          deputiesHref: href(`provincia/${slug(p.circ)}`),
          geographyHref: href(`geografia/${id}`),
        },
      ];
    });

  // Los escaños con sitio en el hemiciclo y el recuadro que ocupan, para el dibujo pequeño.
  const placed = active.flatMap((d) =>
    d.x === null || d.y === null ? [] : [{ ...d, x: d.x, y: d.y }],
  );
  const left = Math.min(...placed.map((d) => d.x)) - 6;
  const upper = Math.min(...placed.map((d) => d.y)) - 6;
  const seatsBox = `${left} ${upper} ${Math.max(...placed.map((d) => d.x)) + 6 - left} ${Math.max(...placed.map((d) => d.y)) + 6 - upper}`;
  const changes = election.escanos_cambian.filter(([id]) => map.provincias[id]);
  const changesText = new Intl.ListFormat('es', { type: 'conjunction' }).format(
    changes.map(([id, before, after]) => {
      const n = Math.abs(after - before);
      return `${map.provincias[id]?.corto ?? id} ${after > before ? 'gana' : 'pierde'} ${n === 1 ? 'un escaño' : `${n} escaños`}`;
    }),
  );

  // El precio de un escaño, de la provincia más cara a la más barata.
  const prices = Object.entries(last.prov)
    .map(([id, p]) => ({ name: map.provincias[id]?.corto ?? id, price: p.validos / p.e }))
    .sort((a, b) => b.price - a.price);
  const dearest = prices[0];
  const cheapest = prices.at(-1);
  if (!dearest || !cheapest) throw new Error('Faltan los resultados por provincia');
  const priceRow = (p: { name: string; price: number }) => ({
    label: p.name,
    value: p.price,
    display: thousands(p.price),
  });

  // El mapa del voto: la familia política más votada en cada provincia.
  const winners = Object.entries(results.prov).flatMap(([id, p]) => {
    const top = [...p.c].sort((x, y) => y[2] - x[2])[0];
    const family = top && families[top[1]];
    return top && family && map.provincias[id] ? [{ id, party: top[0], family }] : [];
  });
  const winnerOf = Object.fromEntries(winners.map((w) => [w.id, w]));
  const won: Record<string, { label: string; color: string; n: number }> = {};
  for (const { family: f } of winners) {
    won[f.id] = { label: f.nombre, color: f.color, n: (won[f.id]?.n ?? 0) + 1 };
  }
  const winnerFamilies = Object.values(won).sort((x, y) => y.n - x.n);
  const topFamily = winnerFamilies[0];

  // La legislatura.
  const b = source.balance;
  const caducan = source.caducan;
  // Una columna por mes, de la sesión constitutiva a la disolución.
  const firstMonth = month(b.desde);
  const monthCount = month(b.hasta) - firstMonth + 1;
  const monthOf = (iso: string) => month(iso) - firstMonth;
  const lawColumns = Array.from({ length: monthCount }, (_, i) =>
    origins.map(([id, , color]) => ({
      value: caducan.lista.filter((law) => law[3] === id && monthOf(law[5]) === i).length,
      color,
    })),
  );
  const votesByMonth = new Map(index.meses.map((m) => [monthOf(`${m.mes}-01`), m.votaciones]));
  const voteColumns = Array.from({ length: monthCount }, (_, i) => [
    { value: votesByMonth.get(i) ?? 0, color: 'var(--foreground)' },
  ]);

  // Las encuestas.
  const party = Object.fromEntries(polls.partidos.map((p) => [p.id, p]));
  const average = projection
    ? Object.entries(projection.media)
        .sort(([, x], [, y]) => y - x)
        .slice(0, 8)
    : [];
  const leader = average[0];
  const projected = projection
    ? Object.entries(projection.central).sort(([, x], [, y]) => y - x)
    : [];
  const blocks = projection
    ? Object.entries(projection.bloques).map(([name, members]) => {
        const total = members.reduce((sum, id) => sum + (projection.central[id] ?? 0), 0);
        return { label: name, value: total, display: String(total) };
      })
    : [];
  const market = markets?.mercados[0];
  const favourite = market && [...market.opciones].sort((x, y) => y.p - x.p)[0];
  const accuracyByDate = [...accuracy.elecciones].sort((x, y) => x.fecha.localeCompare(y.fecha));
  const lastAccuracy = accuracyByDate.at(-1);
  const worstAccuracy = Math.max(...accuracyByDate.map((e) => e.media_mae));
  const accuracyCard = card(
    'acierto',
    6,
    lastAccuracy && (
      <>
        <Stat
          value={`${decimal(lastAccuracy.media_mae)} pt`}
          caption={`de error medio de las encuestas en ${lastAccuracy.nombre}`}
        />
        <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col items-end gap-1.5">
          {accuracyByDate.map((e) => (
            <span key={e.id} className="grid gap-1.5">
              <i
                className={cn(
                  'block rounded-t-sm',
                  e === lastAccuracy ? 'bg-brand' : 'bg-muted-foreground/30',
                )}
                style={{ height: `${(e.media_mae / worstAccuracy) * 56}px` }}
              />
              <span className="text-center font-mono text-xs text-muted-foreground">
                {e.fecha.slice(2, 4)}
              </span>
            </span>
          ))}
        </div>
      </>
    ),
  );

  // Cuarenta y nueve años: escaños por familia en cada elección.
  const presentFamilies = history.familias.filter((f) =>
    history.elecciones.some((e) => (e.fam[f.id]?.[1] ?? 0) > 0),
  );

  const chapter = (id: string) => {
    const i = chapters.findIndex((c) => c.id === id);
    const c = chapters[i];
    if (!c) throw new Error(`Capítulo desconocido: ${id}`);
    return { ...c, n: i + 1 };
  };

  return (
    <>
      <Grid>
        <Cell span={7} className="gap-10">
          <Label>
            Elecciones generales · {formatDate(election.votacion, { weekday: 'long' })}{' '}
            {longDate(election.votacion)} de {election.votacion.slice(0, 4)}
          </Label>
          <div className="grid gap-8">
            <div className="grid justify-items-start gap-4">
              <Badge className="font-mono uppercase">{current.label}</Badge>
              <h1 className="m-0 max-w-[18ch] font-heading text-4xl leading-[1.08] font-normal lg:text-[56px]">
                {current.title}
              </h1>
              <p className="m-0 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
                {current.text}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {current.cta.map((id, i) => (
                <Link
                  key={id}
                  href={electionsHref(id)}
                  data-slot="button"
                  data-variant={i ? 'outline' : 'sunset'}
                  className={cn(buttonVariants({ variant: i ? 'outline' : 'sunset', size: 'xl' }))}
                >
                  {electionPages[id].title} <Icon name="derecha" size={16} />
                </Link>
              ))}
              <a
                href="#tu-provincia"
                data-slot="button"
                data-variant="outline"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              >
                Tu provincia <Icon name="abajo" size={16} />
              </a>
            </div>
          </div>
          <nav aria-label="Capítulos" className="mt-auto grid gap-3 border-t border-border pt-6">
            <Label>En esta página</Label>
            <ol className="m-0 grid list-none gap-x-6 p-0 sm:grid-cols-2">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="flex min-h-11 items-center gap-3 text-base leading-snug no-underline hover:text-muted-foreground"
                  >
                    <i
                      aria-hidden="true"
                      className="block size-2.5 shrink-0 rounded-full"
                      style={{ background: c.color }}
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Cell>
        <Cell span={5} label="Calendario electoral">
          <Stat
            value={daysLeft > 0 ? daysLeft : daysLeft === 0 ? 'Hoy' : '29N'}
            caption={
              daysLeft > 1
                ? 'días para votar'
                : daysLeft === 1
                  ? 'día: mañana se vota'
                  : daysLeft === 0
                    ? 'se vota de 9.00 a 20.00'
                    : 'elecciones generales'
            }
          />
          <Calendar calendar={calendar} today={today} />
          <p className="m-0 text-sm text-muted-foreground">
            Plazos de la Ley Orgánica del Régimen Electoral General, contados desde el{' '}
            {election.decreto.rd}.
          </p>
        </Cell>
      </Grid>

      <Chapter
        {...chapter('legislatura')}
        insight={
          <>
            La disolución deja <b>{thousands(caducan.total)} leyes</b> a medio camino. La mayoría
            las habían presentado los grupos parlamentarios.
          </>
        }
      >
        {card(
          'caducan',
          4,
          <>
            <Stat value={thousands(caducan.total)} caption="leyes caducan sin terminar" />
            <MonthBars from={firstMonth} columns={lawColumns} />
            <Legend items={origins.map(([, label, color]) => ({ label, color }))} small />
          </>,
        )}
        {card(
          'legislatura',
          4,
          <>
            <Stat
              value={thousands(b.votaciones)}
              caption={
                b.mas_ajustada
                  ? `votaciones; la más ajustada, ${b.mas_ajustada.si} a ${b.mas_ajustada.no}`
                  : `votaciones en ${b.plenos} plenos`
              }
            />
            <MonthBars from={firstMonth} columns={voteColumns} />
          </>,
        )}
        {card(
          'repite',
          4,
          <>
            {lists && (
              <Stat
                value={shortDate(lists.fecha)}
                caption={
                  today < lists.fecha ? 'el BOE publica las listas' : 'el BOE publicó las listas'
                }
              />
            )}
            <svg viewBox={seatsBox} aria-hidden="true" className="mx-auto block h-26 w-auto">
              {placed.map((d) => (
                <circle key={d.nombre} cx={d.x} cy={d.y} r={5} fill={groupColor(d.grupo)} />
              ))}
            </svg>
          </>,
        )}
      </Chapter>

      <Chapter
        {...chapter('escanos')}
        insight={
          <>
            Cada provincia elige sus diputados por separado. En {dearest.name} un escaño costó{' '}
            <b>{decimal(dearest.price / cheapest.price)} veces más votos</b> que en {cheapest.name}.
          </>
        }
      >
        {/* Como las demás tarjetas, toda la tarjeta lleva a «Los 350»; las pestañas y los escaños quedan encima del enlace. */}
        <SeatsCard
          index={index}
          map={map}
          span={7}
          className="relative transition-colors hover:bg-muted/60"
          note={`Diputados de la ${index.meta.legislatura} legislatura, elegidos en ${formatDate(last.fecha, { month: 'long', year: 'numeric' })}.`}
          footer={
            <Link
              href={electionsHref('350')}
              className="mt-auto self-end no-underline outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              <CardCta>{electionPages['350'].cta}</CardCta>
            </Link>
          }
        />
        <div className="col-span-12 grid grid-cols-12 grid-rows-[auto_auto_auto_1fr] gap-4 md:col-span-5">
          {card(
            'escano',
            12,
            <>
              <div className="grid gap-3">
                <Bars rows={prices.slice(-5).reverse().map(priceRow)} max={dearest.price} narrow />
                <span aria-hidden="true" className="font-mono text-sm text-muted-foreground">
                  …
                </span>
                <Bars
                  rows={prices
                    .slice(0, 5)
                    .reverse()
                    .map((p) => ({ ...priceRow(p), color: 'var(--brand)' }))}
                  max={dearest.price}
                  narrow
                />
                <Label>Votos por escaño en {year}</Label>
              </div>
              {changes.length > 0 && (
                <p className="m-0 border-t border-border pt-4 text-muted-foreground">
                  En {election.votacion.slice(0, 4)}, {changesText} respecto a {year}.
                </p>
              )}
            </>,
          )}
        </div>
      </Chapter>

      <Chapter
        {...chapter('tu-provincia')}
        insight="Cuántos diputados elige, cómo se repartieron la última vez y quiénes la representan hoy."
      >
        <Cell>
          <ProvincePicker provinces={provinces} />
        </Cell>
      </Chapter>

      <Chapter
        {...chapter('historia')}
        insight={
          <>
            <b>{history.elecciones.length} elecciones generales</b> desde {firstYear}, y así se
            repartieron los 350 escaños en cada una.
          </>
        }
      >
        <Cell label="Escaños por familia política">
          <Tips className="grid auto-cols-fr grid-flow-col gap-0.5 sm:gap-1">
            {history.elecciones.map((e, i) => {
              const ranked = history.familias
                .map((f) => ({ name: f.nombre, color: f.color, seats: e.fam[f.id]?.[1] ?? 0 }))
                .filter((f) => f.seats)
                .sort((x, y) => y.seats - x.seats);
              const name = `Elecciones de ${formatDate(e.fecha, { month: 'long', year: 'numeric' })}`;
              const summary = ranked
                .slice(0, 3)
                .map((f) => `${f.name} ${f.seats}`)
                .join(' · ');
              return (
                <Link
                  key={e.id}
                  href={electionsHref(e.id)}
                  aria-label={`${name}: ${summary}`}
                  data-tip={name}
                  data-tip-text={summary}
                  data-tip-color={ranked[0]?.color}
                  className="group grid min-w-0 gap-2 rounded-md no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex h-60 flex-col overflow-hidden rounded-md transition-opacity group-hover:opacity-75">
                    {history.familias.map((f) => {
                      const seatsOf = e.fam[f.id]?.[1] ?? 0;
                      return seatsOf ? (
                        <i
                          key={f.id}
                          className="block"
                          style={{ height: `${(seatsOf / 350) * 100}%`, background: f.color }}
                        />
                      ) : null;
                    })}
                  </div>
                  <span
                    className={cn(
                      'text-center font-mono text-xs text-muted-foreground sm:text-sm',
                      i % 2 && 'max-sm:invisible',
                    )}
                  >
                    {e.fecha.slice(0, 4)}
                    {history.elecciones.filter((x) => x.fecha.startsWith(e.fecha.slice(0, 4)))
                      .length > 1 && (
                      <span className="block">{formatDate(e.fecha, { month: 'short' })}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </Tips>
          <Legend items={presentFamilies.map((f) => ({ label: f.nombre, color: f.color }))} />
        </Cell>
        <Cell span={6} label="Fragmentación">
          <Stat
            value={decimal(last.metricas.nep_votos)}
            caption={`partidos efectivos en ${year}, frente a ${decimal(first.metricas.nep_votos)} en ${firstYear}`}
          />
          <Spark
            values={history.elecciones.map((e) => e.metricas.nep_votos)}
            label={`Número efectivo de partidos desde ${firstYear}`}
            from={firstYear}
            to={year}
          />
        </Cell>
        <Cell span={6} label="Participación">
          <Stat
            value={percent(last.votantes / last.censo)}
            caption={`votó en ${year}, frente al ${percent(first.votantes / first.censo)} en ${firstYear}`}
          />
          <Spark
            values={history.elecciones.map((e) => e.votantes / e.censo)}
            label={`Participación desde ${firstYear}`}
            from={firstYear}
            to={year}
          />
        </Cell>
        {card('historico', 6)}
        {card('metricas', 6)}
      </Chapter>

      {topFamily && (
        <Chapter
          {...chapter('mapa')}
          insight={
            <>
              En {year}, <b>{topFamily.label}</b> fue lo más votado en {topFamily.n} de las{' '}
              {winners.length} provincias.
            </>
          }
        >
          <Cell span={7} label={`Lo más votado en cada provincia · ${year}`}>
            {/* Las provincias no entran en el orden de tabulación: el buscador de «Tu provincia» lleva a cada ficha. */}
            <Tips>
              <svg
                viewBox={`0 0 ${map.ancho} ${map.alto}`}
                role="img"
                aria-label={`Mapa de España con el color de la familia política más votada en cada provincia en ${year}`}
                className="block h-auto w-full"
              >
                {Object.entries(map.provincias).map(([id, p]) => {
                  const w = winnerOf[id];
                  return (
                    <a
                      key={id}
                      href={href(`geografia/${id}`)}
                      tabIndex={-1}
                      data-tip={p.circ}
                      data-tip-text={w ? `Lo más votado en ${year}: ${w.party}` : undefined}
                      data-tip-color={w?.family.color}
                      className="[&:hover>path]:opacity-75"
                    >
                      <path
                        d={p.d}
                        fill={w?.family.color ?? 'var(--muted)'}
                        className="stroke-background"
                        strokeWidth={0.8}
                      />
                    </a>
                  );
                })}
                <path d={map.canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
              </svg>
            </Tips>
            <Legend
              items={winnerFamilies.map((f) => ({ label: `${f.label} ${f.n}`, color: f.color }))}
            />
          </Cell>
          <div className="col-span-12 grid grid-cols-12 gap-4 md:col-span-5">
            {card('mapa', 12)}
            {card('voto', 12)}
          </div>
        </Chapter>
      )}

      <Chapter
        {...chapter('encuestas')}
        insight={
          projection && leader ? (
            <>
              En la media de las encuestas, {party[leader[0]]?.nombre ?? leader[0]} va primero con{' '}
              <b>{decimal(leader[1])} %</b>. La ley prohíbe publicarlas desde el{' '}
              {longDate(polls.veda[0])}.
            </>
          ) : (
            'Durante los días previos a la votación, la ley prohíbe publicar encuestas.'
          )
        }
      >
        {projection ? (
          <>
            <Cell span={6} label={`Intención de voto · ${longDate(projection.fecha)}`}>
              <Bars
                rows={average.map(([id, value]) => ({
                  label: party[id]?.nombre ?? id,
                  value,
                  display: `${decimal(value)} %`,
                  color: party[id]?.color,
                }))}
              />
            </Cell>
            <Cell span={6} label="Escaños de la media">
              <div
                className="relative h-8"
                role="img"
                aria-label={projected
                  .map(([id, n]) => `${party[id]?.nombre ?? id} ${n}`)
                  .join(', ')}
              >
                <div className="flex h-full overflow-hidden rounded-full">
                  {projected.map(([id, n]) => (
                    <i
                      key={id}
                      className="block h-full border-r border-background last:border-r-0"
                      style={{ width: `${(n / 350) * 100}%`, background: party[id]?.color }}
                      title={`${party[id]?.nombre ?? id}: ${n}`}
                    />
                  ))}
                </div>
                <span
                  aria-hidden="true"
                  className="absolute -inset-y-1 w-0.5 bg-foreground"
                  style={{ left: `${(majority / 350) * 100}%` }}
                />
              </div>
              <p className="m-0 -mt-3 text-sm text-muted-foreground">
                La línea vertical marca la mayoría absoluta: {majority} escaños.
              </p>
              <Legend
                items={projected.slice(0, 6).map(([id, n]) => ({
                  label: `${party[id]?.nombre ?? id} ${n}`,
                  color: party[id]?.color ?? '#888888',
                }))}
              />
              <div className="grid gap-3 border-t border-border pt-5">
                <Label>Bloques, frente a la mayoría de {majority}</Label>
                <Bars rows={blocks} max={350} mark={majority} />
              </div>
            </Cell>
            {card('encuestas', 6)}
            {card('proyeccion', 6)}
            {card(
              'mercados',
              6,
              market && favourite && (
                <Stat
                  value={`${Math.round(favourite.p * 100)} %`}
                  caption={`${favourite.nombre}, en «${market.pregunta}», según Polymarket`}
                />
              ),
            )}
            {accuracyCard}
          </>
        ) : (
          <>
            <Cell span={6} label="Veda electoral">
              <p className="m-0 text-base text-muted-foreground">
                Las encuestas volverán a mostrarse cuando acabe el periodo de restricción.
              </p>
            </Cell>
            {accuracyCard}
          </>
        )}
      </Chapter>
    </>
  );
}
