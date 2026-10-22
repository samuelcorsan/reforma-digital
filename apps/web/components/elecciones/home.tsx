import Link from 'next/link';
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
  balanceSchema,
  historicalProvinceSchema,
  mapSchema,
  projectionSchema,
} from '../../lib/congreso/schema';
import { electionPages, electionsHref, type ElectionPage } from '../../lib/elecciones/pages';
import { clusters, sunflower } from '../../lib/elecciones/seats';
import { href } from '../congreso/common';
import { ProvincePicker, type ProvinceSummary } from './province-picker';
import { Icon } from '../brand/icon';
import { Bars, Cell, Chapter, Explore, Grid, Label, Legend, Stat } from './report';
import { SeatsMap, type Seat } from './seats-map';

// Orden de los grupos en el hemiciclo, de izquierda a derecha.
const hemicycleOrder = ['SUMAR', 'BILDU', 'ERC', 'PSOE', 'MIXTO', 'PNV', 'JUNTS', 'PP', 'VOX'];
const origins = [
  ['GRUPOS', 'Grupos parlamentarios', '#2A7DB5'],
  ['GOB', 'Gobierno', '#7152A8'],
  ['SEN', 'Senado', '#C9962A'],
  ['CCAA', 'Parlamentos autonómicos', '#83AE6E'],
] as const;
const majority = 176;

const madrid = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', ...options }).format(new Date());
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 864e5;
const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...options }).format(
    new Date(`${iso}T00:00:00Z`),
  );
const shortDate = (iso: string) => format(iso, { day: 'numeric', month: 'short' });
const longDate = (iso: string) => format(iso, { day: 'numeric', month: 'long' });
// es-ES no agrupa los números de cuatro cifras («1340»); aquí siempre llevan punto de miles.
const thousands = (value: number) =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const decimal = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const percent = (value: number) =>
  `${(value * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

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
  { id: 'encuestas', name: 'Las encuestas', title: 'Lo que dicen las encuestas', color: '#2F7A4A' },
];

const explore = (ids: ElectionPage[]) =>
  ids.map((id) => ({ href: electionsHref(id), text: electionPages[id].title }));

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
  const [election, source, map, history, index, polls] = await Promise.all([
    getElections(),
    read('elecciones/elecciones.json', balanceSchema),
    read('elecciones/geo-provincias.json', mapSchema),
    getHistory(),
    getIndex(),
    getPolls(),
  ]);
  const last = history.elecciones.at(-1);
  const first = history.elecciones[0];
  if (!last || !first) throw new Error('El histórico de elecciones está vacío');
  const hidden = pollsHidden(polls.veda);
  const [results, projection] = await Promise.all([
    read(`elecciones/historico-${last.id}.json`, historicalProvinceSchema),
    hidden ? null : read('encuestas/proyeccion.json', projectionSchema),
  ]);
  const year = last.fecha.slice(0, 4);
  const firstYear = first.fecha.slice(0, 4);

  const today = madrid({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const calendar = election.calendario;
  const current = phases[phase(today, election.votacion, calendar)];
  const daysLeft = dayNumber(election.votacion) - dayNumber(today);

  const families = Object.fromEntries(history.familias.map((f) => [f.id, f]));
  const active = index.diputados.filter((d) => !d.baja);
  const byCircumscription = Object.fromEntries(
    Object.entries(map.provincias).map(([id, p]) => [p.circ, id]),
  );
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
          stats: [
            {
              value: String(seats),
              caption: `${seats === 1 ? 'diputado elige' : 'diputados elige'} en ${election.votacion.slice(0, 4)}${change ? ` (${change > 0 ? '+' : ''}${change} respecto a ${year})` : ''}`,
            },
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

  // Los 350: en su provincia y en su escaño del hemiciclo.
  const counts: Record<string, number> = {};
  for (const d of active) {
    const id = byCircumscription[d.provincia];
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const centres = clusters(
    counts,
    Object.fromEntries(Object.entries(map.provincias).map(([id, p]) => [id, p.c])),
  );
  const plan = index.hemiciclo;
  const k = Math.min((map.ancho * 0.86) / plan.ancho, (map.alto * 0.8) / plan.alto);
  const ox = (map.ancho - plan.ancho * k) / 2;
  const oy = (map.alto - plan.alto * k) / 2 + 20;
  const points = Object.entries(counts).flatMap(([id, n]) => {
    const centre = centres[id];
    if (!centre) return [];
    const spiral = sunflower(n);
    return active
      .filter((d) => byCircumscription[d.provincia] === id)
      .sort((a, b) => order(a.grupo) - order(b.grupo) || a.nombre.localeCompare(b.nombre, 'es'))
      .map((d, j) => {
        const ax = centre.x + (spiral[j]?.x ?? 0);
        const ay = centre.y + (spiral[j]?.y ?? 0);
        return {
          ax,
          ay,
          bx: d.x === null ? ax : ox + d.x * k,
          by: d.y === null ? ay : oy + d.y * k,
          color: groupColor(d.grupo),
          label: `${deputyName(d.nombre)} · ${index.grupos[d.grupo]?.nombre ?? d.grupo} · ${d.provincia}`,
        };
      });
  });
  const xs = points.map((p) => p.ax);
  const west = Math.min(...xs);
  const span = Math.max(...xs) - west || 1;
  // Los del oeste salen antes; un pequeño desfase determinista evita que se muevan en bloque.
  const seats: Seat[] = points.map((p, i) => ({
    ...p,
    delay: Math.round((((p.ax - west) / span) * 0.45 + ((i * 37) % 100) / 1250) * 1700),
  }));
  const legend = hemicycleOrder.filter((g) => active.some((d) => d.grupo === g));
  const changes = election.escanos_cambian.filter(([id]) => map.provincias[id]);

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

  // La legislatura.
  const b = source.balance;
  const caducan = source.caducan;

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
            Elecciones generales · {format(election.votacion, { weekday: 'long' })}{' '}
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
        <Cell span={5} label="Lo que caduca">
          <Stat value={thousands(caducan.total)} caption="leyes caducan sin terminar" />
          <div className="grid gap-4 border-t border-border pt-6">
            <Label>Quién las presentó</Label>
            <Bars
              rows={origins.map(([id, label, color]) => {
                const value = caducan.por_origen[id] ?? 0;
                return { label, value, display: String(value), color };
              })}
            />
          </div>
        </Cell>
        <Cell span={7} label="Una ley, un cuadrado">
          <svg
            viewBox={`0 0 ${31 * 7} ${Math.ceil(caducan.lista.length / 31) * 7}`}
            aria-hidden="true"
            className="my-auto block h-auto w-full"
          >
            {caducan.lista.map((law, i) => (
              <rect
                key={law[0]}
                x={(i % 31) * 7}
                y={Math.floor(i / 31) * 7}
                width={5.5}
                height={5.5}
                rx={1.5}
                fill={origins.find(([id]) => id === law[3])?.[2] ?? '#888888'}
              />
            ))}
          </svg>
        </Cell>
        <Cell span={3} label="Votaciones">
          <Stat value={thousands(b.votaciones)} caption={`en ${b.plenos} plenos`} />
        </Cell>
        <Cell span={3} label="Leyes">
          <Stat value={b.leyes} caption={`aprobadas, más ${b.leyes_organicas} orgánicas`} />
        </Cell>
        <Cell span={3} label="Decretos-ley">
          <Stat value={b.decretos_ley} caption="aprobados por el Gobierno" />
        </Cell>
        <Cell span={3} label="Preguntas">
          <Stat
            value={thousands(b.preguntas)}
            caption={`${thousands(b.sin_respuesta)} sin respuesta`}
          />
        </Cell>
        <div className="col-span-12">
          <Explore links={explore(['caducan', 'legislatura', 'repite'])} />
        </div>
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
        <Cell>
          <SeatsMap
            width={map.ancho}
            height={map.alto}
            provinces={Object.entries(map.provincias).map(([id, p]) => ({
              id,
              name: p.circ,
              d: p.d,
            }))}
            canarias={map.canarias}
            seats={seats}
            hemicycleRadius={5.3 * k * 0.96}
            groups={legend.map((g) => ({
              label: index.grupos[g]?.nombre ?? g,
              color: groupColor(g),
              seats: active.filter((d) => d.grupo === g).length,
            }))}
          />
        </Cell>
        <Cell span={8} label={`Votos por escaño en ${year}`}>
          <Bars rows={prices.slice(0, 5).map(priceRow)} max={dearest.price} />
          <span aria-hidden="true" className="block border-t border-dashed border-border" />
          <Bars rows={prices.slice(-5).map(priceRow)} max={dearest.price} />
          <p className="m-0 text-sm text-muted-foreground">
            Las cinco provincias donde un escaño costó más votos y las cinco donde costó menos.
          </p>
        </Cell>
        <Cell span={4} label={`Cambios para ${election.votacion.slice(0, 4)}`}>
          {changes.length ? (
            changes.map(([id, before, after]) => (
              <Stat
                key={id}
                value={`${after > before ? '+' : '−'}${Math.abs(after - before)}`}
                caption={`${map.provincias[id]?.corto ?? id} pasa de ${before} a ${after} escaños por su población`}
              />
            ))
          ) : (
            <Stat value="0" caption="provincias cambian de escaños" />
          )}
        </Cell>
        <div className="col-span-12">
          <Explore links={explore(['350', 'escano'])} />
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
          <div
            role="img"
            aria-label={`Escaños de cada familia política en las elecciones generales desde ${firstYear}`}
            className="grid auto-cols-fr grid-flow-col gap-0.5 sm:gap-1"
          >
            {history.elecciones.map((e, i) => (
              <div key={e.id} className="grid min-w-0 gap-2">
                <div className="flex h-60 flex-col overflow-hidden rounded-md">
                  {history.familias.map((f) => {
                    const seatsOf = e.fam[f.id]?.[1] ?? 0;
                    return seatsOf ? (
                      <i
                        key={f.id}
                        title={`${e.fecha.slice(0, 4)} · ${f.nombre}: ${seatsOf} escaños`}
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
                    <span className="block">{format(e.fecha, { month: 'short' })}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
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
        <div className="col-span-12">
          <Explore links={explore(['historico', 'metricas', 'mapa', 'voto'])} />
        </div>
      </Chapter>

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
            <div className="col-span-12">
              <Explore links={explore(['encuestas', 'proyeccion', 'mercados', 'acierto'])} />
            </div>
          </>
        ) : (
          <Cell label="Veda electoral">
            <p className="m-0 text-base text-muted-foreground">
              Las encuestas volverán a mostrarse cuando acabe el periodo de restricción.
            </p>
            <Explore links={explore(['acierto'])} />
          </Cell>
        )}
      </Chapter>
    </>
  );
}
