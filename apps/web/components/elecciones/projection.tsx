import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { getHistory, getPolls, read, slug } from '../../lib/congreso/data';
import { mapSchema, projectionSchema } from '../../lib/congreso/schema';
import { chance, longDate as date } from '../../lib/elecciones/format';
import { semicircle } from '../../lib/elecciones/hemicycle';
import { links } from '../../lib/site';
import { href } from '../congreso/common';
import { Majority, ProjectionMap, SeatSeries, SeatSum } from './projection-parts';
import { Cell, Grid, Label, Legend, ReportIntro, SectionHeading } from './report';
import { Tips } from './tips';

// La familia de cada partido de las encuestas, para sentarlo en el hemiciclo en su sitio.
const families: Record<string, string> = {
  SUMAR: 'IZQ',
  PODEMOS: 'IZQ',
  BILDU: 'BILDU',
  ERC: 'ERC',
  BNG: 'BNG',
  PSOE: 'PSOE',
  PNV: 'PNV',
  JUNTS: 'CIU',
  CC: 'CC',
  PP: 'PP',
  VOX: 'VOX',
};
const partners = 'PSOE y sus socios de 2023';

// «La proyección»: los escaños que salen de la media de las encuestas, lo probable que es cada
// mayoría, la proyección semana a semana y provincia a provincia. Estructura de Escaño Abierto.
export async function Projection() {
  const [polls, projection, map, history] = await Promise.all([
    getPolls(),
    read('encuestas/proyeccion.json', projectionSchema),
    read('elecciones/geo-provincias.json', mapSchema),
    getHistory(),
  ]);
  const S = projection.simulacion;
  const party = Object.fromEntries(polls.partidos.map((p) => [p.id, p]));
  const name = (id: string) => party[id]?.nombre ?? id;
  const color = (id: string) => party[id]?.color ?? '#8A8F98';
  const order = (id: string) =>
    history.familias.findIndex((f) => f.id === (families[id] ?? 'OTROS'));
  const seats = Object.entries(projection.central)
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => order(a) - order(b) || y - x);
  const hemicycle = semicircle();
  const seatParty = seats.flatMap(([id, n]) => Array<string>(n).fill(id));
  const bySeats = [...seats].sort(([, a], [, b]) => b - a);

  // Las cuatro preguntas.
  const [firstId, firstP] = Object.entries(S.primero).sort(([, a], [, b]) => b - a)[0] ?? ['', 0];
  const right = S.bloques['PP + Vox'];
  const alone = Object.entries(S.solo176).sort(([, a], [, b]) => b - a)[0];
  const again = S.bloques[partners];
  const questions = [
    {
      value: chance(firstP),
      title: `${name(firstId)}, primera fuerza`,
      text: `En ${S.n.toLocaleString('es-ES')} simulaciones, la candidatura con más escaños.`,
    },
    right && {
      value: chance(right.p176),
      title: 'PP y Vox suman mayoría absoluta',
      text: `${right.med} escaños (entre ${right.p05} y ${right.p95}); hacen falta 176.`,
    },
    {
      value: chance(alone?.[1] ?? 0),
      title: 'Un partido solo, mayoría absoluta',
      text: alone
        ? `${name(alone[0])} llega a 176 sin nadie más.`
        : 'Ningún partido llega a 176 sin nadie más.',
    },
    again && {
      value: chance(again.p176),
      title: 'Los socios de la investidura de 2023 repiten mayoría',
      text: `PSOE, Frente Amplio, Podemos, ERC, Junts, Bildu, PNV, BNG y CC: ${again.med} escaños (entre ${again.p05} y ${again.p95}).`,
    },
  ].filter((q) => !!q);

  // Escaños por partido: lo más probable, el margen y lo que sacó en 2023.
  const rows = Object.entries(S.partidos)
    .filter(([, p]) => p.p95 > 0)
    .sort(([, a], [, b]) => b.med - a.med || b.media - a.media);
  // Escala de raíz cuadrada: separa los partidos pequeños sin aplastar a los grandes.
  const top =
    [10, 25, 50, 100, 150, 200, 350].find((t) => t >= Math.max(...rows.map(([, p]) => p.p95))) ??
    350;
  const ticks = [0, 1, 5, 10, 25, 50, 100, 150, 200, 350].filter((t) => t <= top);
  const position = (v: number) => (Math.sqrt(Math.max(0, v)) / Math.sqrt(top)) * 100;
  // Las columnas de cada fila y del eje: nombre, gráfico y cifras.
  // En el móvil, nombre y cifras en una línea y el gráfico debajo, a todo el ancho.
  const row =
    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_7rem]';
  const before = (id: string) => polls.resultado2023.e[id]?.[0] ?? null;

  // Provincia a provincia: quién se lleva más escaños (a igualdad, más votos).
  const codes = Object.keys(map.provincias).filter((c) => projection.provincias[c]);
  const winner = (code: string) =>
    Object.entries(projection.provincias[code] ?? {}).sort(
      ([a, x], [b, y]) =>
        y - x || (projection.votos[code]?.[b] ?? 0) - (projection.votos[code]?.[a] ?? 0),
    )[0]?.[0];
  const provinces = codes.map((code) => {
    const shape = map.provincias[code];
    return {
      code,
      name: shape?.corto ?? code,
      href: shape ? href(`provincia/${slug(shape.circ)}`) : '',
      seats: Object.entries(projection.provincias[code] ?? {})
        .filter(([, n]) => n > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([id, n]): [string, number] => [id, n]),
      votes: Object.entries(projection.votos[code] ?? {})
        .filter(([id, v]) => v >= 3 || (projection.provincias[code]?.[id] ?? 0) > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([id, v]): [string, number] => [id, v]),
      last: projection.ultimos[code] ?? null,
    };
  });
  const byCode = Object.fromEntries(provinces.map((p) => [p.code, p]));
  const parties = Object.fromEntries(
    polls.partidos.map((p) => [p.id, { name: p.nombre, color: p.color }]),
  );

  return (
    <>
      <ReportIntro title="La proyección">
        <p>
          Los escaños que salen de la media de las encuestas, provincia a provincia, y lo probable
          que es cada mayoría.
        </p>
      </ReportIntro>
      <section className="grid gap-6">
        <SectionHeading title="Si las elecciones fueran hoy">
          Los escaños que salen de la media de las encuestas del {date(projection.fecha)}, provincia
          a provincia y con la ley D&apos;Hondt; y lo probable que es cada cosa, en{' '}
          {S.n.toLocaleString('es-ES')} simulaciones.
        </SectionHeading>
        <Grid>
          <Cell span={7}>
            <Tips>
              <svg
                viewBox={hemicycle.box}
                role="img"
                aria-label={`Hemiciclo de la proyección: ${bySeats.map(([id, n]) => `${name(id)} ${n}`).join(', ')}`}
                className="block h-auto w-full"
              >
                {hemicycle.points.map(([x, y], i) => {
                  const id = seatParty[i];
                  const sim = id ? S.partidos[id] : undefined;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={5.3}
                      fill={id ? color(id) : 'var(--muted)'}
                      data-tip={id ? name(id) : undefined}
                      data-tip-text={
                        id && sim
                          ? `${projection.central[id]} escaños (entre ${sim.p05} y ${sim.p95})`
                          : undefined
                      }
                      data-tip-color={id ? color(id) : undefined}
                    />
                  );
                })}
                <text
                  x={hemicycle.label.x}
                  y={hemicycle.label.y}
                  textAnchor="middle"
                  className="fill-foreground font-heading"
                  style={{ fontSize: hemicycle.label.size }}
                >
                  350
                </text>
              </svg>
            </Tips>
            <Legend
              small
              items={bySeats.map(([id, n]) => ({ label: `${name(id)} ${n}`, color: color(id) }))}
            />
          </Cell>
          <Cell span={5} className="content-start">
            <ul className="m-0 grid list-none gap-5 p-0">
              {questions.map((q) => (
                <li
                  key={q.title}
                  className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1"
                >
                  {/* El título, a la altura de la cifra; la explicación, debajo. */}
                  <b className="font-heading text-[40px] leading-none font-normal whitespace-nowrap tabular-nums">
                    {q.value}
                  </b>
                  <span className="font-medium">{q.title}</span>
                  <span className="col-start-2 text-sm text-muted-foreground">{q.text}</span>
                </li>
              ))}
            </ul>
          </Cell>
          <SeatSum
            parties={bySeats.map(([id, n]) => ({ id, name: name(id), color: color(id), seats: n }))}
          />
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Escaños por partido">
          La raya es lo más probable; la barra, el margen en 9 de cada 10 simulaciones; el rombo, lo
          que sacó en 2023. La escala se estira en los números pequeños para que se vean también los
          partidos con pocos escaños.
        </SectionHeading>
        <Grid>
          <Cell>
            <Tips>
              <ul className="m-0 grid list-none p-0 text-sm">
                {rows.map(([id, p]) => {
                  const b = before(id);
                  return (
                    <li
                      key={id}
                      tabIndex={0}
                      data-tip={name(id)}
                      data-tip-text={`Lo más probable, ${p.med} escaños; entre ${p.p05} y ${p.p95} en 9 de cada 10 simulaciones.${b === null ? ' En 2023 no se presentó.' : ` En 2023 sacó ${b}.`}`}
                      data-tip-color={color(id)}
                      className={cn(
                        row,
                        'min-h-11 rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                      )}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <i
                          className="block size-2.5 shrink-0 rounded-full"
                          style={{ background: color(id) }}
                        />
                        {name(id)}
                      </span>
                      <span className="relative self-stretch max-sm:order-last max-sm:col-span-2 max-sm:h-6">
                        {ticks.map((t) => (
                          <i
                            key={t}
                            className="absolute inset-y-0 block w-px bg-border"
                            style={{ left: `${position(t)}%` }}
                          />
                        ))}
                        <i
                          className="absolute top-1/2 block h-3 min-w-1.5 -translate-y-1/2 rounded-full"
                          style={{
                            left: `${position(p.p05)}%`,
                            width: `${position(p.p95) - position(p.p05)}%`,
                            background: `color-mix(in oklab, ${color(id)} 35%, transparent)`,
                          }}
                        />
                        <i
                          className="absolute top-1/2 block h-5 w-[3px] -translate-1/2 rounded-full"
                          style={{ left: `${position(p.med)}%`, background: color(id) }}
                        />
                        {b !== null && (
                          <i
                            className="absolute top-1/2 block size-2.5 -translate-1/2 rotate-45 border-2 border-foreground bg-background"
                            style={{ left: `${position(b)}%` }}
                          />
                        )}
                      </span>
                      <span className="flex items-baseline justify-end gap-2 font-mono tabular-nums">
                        <b className="font-medium">{p.med}</b>
                        <span className="text-muted-foreground">
                          {p.p05 === p.p95 ? '' : `${p.p05}–${p.p95}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Tips>
            <p
              className={cn(row, 'm-0 px-2 font-mono text-xs text-muted-foreground')}
              aria-hidden="true"
            >
              <span className="max-sm:hidden" />
              <span className="relative h-4 max-sm:col-span-2">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${position(t)}%` }}
                  >
                    {t}
                  </span>
                ))}
              </span>
              <span className="text-right max-sm:hidden">escaños</span>
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-muted-foreground">
              <li className="inline-flex items-center gap-2">
                <i className="block h-4 w-[3px] rounded-full bg-muted-foreground" />
                Lo más probable
              </li>
              <li className="inline-flex items-center gap-2">
                <i className="block h-3 w-8 rounded-full bg-muted-foreground/35" />
                En 9 de cada 10 simulaciones
              </li>
              <li className="inline-flex items-center gap-2">
                <i className="block size-2.5 rotate-45 border-2 border-foreground bg-background" />
                Lo que sacó en 2023
              </li>
            </ul>
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="¿Llegan a 176?">
          Cuántas simulaciones acaban con cada número de escaños. A la derecha de la línea, mayoría
          absoluta.
        </SectionHeading>
        <Grid>
          <Cell>
            <Majority
              blocs={Object.entries(S.bloques).map(([bloc, b]) => ({
                name: bloc,
                parties: b.partidos.map(name).join(', '),
                color: b.partidos.includes('PP') ? color('PP') : color('PSOE'),
                hist: b.hist,
                p176: b.p176,
              }))}
            />
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Semana a semana">
          La proyección con la media de cada semana desde 2023 (sin simulaciones: lo más probable).
        </SectionHeading>
        <Grid>
          <Cell>
            <SeatSeries
              weeks={projection.serie}
              lines={['PP', 'PSOE', 'VOX', 'SUMAR'].map((id) => ({
                id,
                name: name(id),
                color: color(id),
              }))}
              election={polls.eleccion}
            />
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Provincia a provincia">
          Quién se llevaría más escaños en cada una. Con borde discontinuo, donde el último escaño
          está a menos de medio punto. Pulsa una provincia.
        </SectionHeading>
        <Grid>
          <ProjectionMap
            provinces={provinces}
            parties={parties}
            map={
              <svg
                key="mapa"
                viewBox={`0 0 ${map.ancho} ${map.alto}`}
                aria-hidden="true"
                className="block h-auto w-full"
              >
                {codes.map((code) => {
                  const p = byCode[code];
                  const w = winner(code);
                  const close = (p?.last?.falta ?? 1) < 0.5;
                  return (
                    <path
                      key={code}
                      d={map.provincias[code]?.d}
                      data-province={code}
                      data-tip={p?.name}
                      data-tip-text={p?.seats.map(([id, n]) => `${name(id)} ${n}`).join(' · ')}
                      data-tip-color={w ? color(w) : undefined}
                      fill={
                        w
                          ? `color-mix(in oklab, ${color(w)} 75%, var(--background))`
                          : 'var(--muted)'
                      }
                      className={
                        close
                          ? 'cursor-pointer stroke-foreground'
                          : 'cursor-pointer stroke-background'
                      }
                      strokeWidth={close ? 1.6 : 0.8}
                      strokeDasharray={close ? '3 2' : undefined}
                    />
                  );
                })}
                <path d={map.canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
              </svg>
            }
          />
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Cómo se hace" />
        <Grid>
          <Cell>
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
              {[
                'La media de las encuestas de cada partido, la misma de «Las encuestas».',
                'Se reparte por provincias con el voto de 2023: si un partido sube un 10 % en España, sube un 10 % en cada provincia (Podemos, con el perfil de Sumar).',
                "En cada provincia, la ley D'Hondt con la barrera del 3 % y los escaños de 2026.",
                `Se repite ${S.n.toLocaleString('es-ES')} veces moviendo un poco la media y cada provincia, para ver lo probable que es cada resultado.`,
              ].map((text, i) => (
                <li key={text} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                  <Label>{String(i + 1).padStart(2, '0')}</Label>
                  <p className="m-0">{text}</p>
                </li>
              ))}
            </ol>
            <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
              No es un pronóstico: es lo que saldría si se votara hoy como dicen las encuestas, con
              su margen de error.{' '}
              <Link
                href={`${links.repo}/blob/main/apps/ingestion/escano/proyeccion.py`}
                className="underline underline-offset-4"
              >
                El código de la proyección
              </Link>
              .
            </p>
          </Cell>
        </Grid>
      </section>
    </>
  );
}
