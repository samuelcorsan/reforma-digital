import Link from 'next/link';
import { getElections, getPolls, read } from '../../lib/congreso/data';
import { marketsSchema, projectionSchema } from '../../lib/congreso/schema';
import { chance, longDate as date, thousands } from '../../lib/elecciones/format';
import { electionsHref } from '../../lib/elecciones/pages';
import { OddsChart } from './odds-chart';
import { Cell, Grid, ReportIntro, SectionHeading } from './report';

const dollars = (n: number) => `${thousands(n)} $`;
// Cada candidato, con el color de su partido; el resto, por orden.
const people: Record<string, string> = {
  'Alberto Núñez Feijóo': 'PP',
  'Pedro Sánchez': 'PSOE',
  'Santiago Abascal': 'VOX',
  'Yolanda Díaz': 'SUMAR',
};
const palette = ['#8A8F98', '#B98A16', '#7B4BA8', '#1FA8A0'];
const order = ['ganador', 'presidente', 'fuera'] as const;
const intro = {
  ganador: 'El partido con más escaños el 29N.',
  presidente: 'Quién sale investido después del 29N. Las opciones con menos del 0,5 % van juntas.',
  fuera:
    'Sánchez sigue en funciones hasta que el nuevo Congreso invista presidente: las Cortes se constituyen el 23 de diciembre y la investidura puede no llegar antes de Año Nuevo.',
};

// «Los mercados»: lo que se apuesta en Polymarket sobre quién gana, quién preside y cuándo se va
// Sánchez, día a día, y al lado de la proyección. Estructura de Escaño Abierto.
export async function Markets() {
  const [markets, polls, projection, election] = await Promise.all([
    read('encuestas/mercados.json', marketsSchema),
    getPolls(),
    read('encuestas/proyeccion.json', projectionSchema),
    getElections(),
  ]);
  const partyColor = Object.fromEntries(
    polls.partidos.flatMap((p) => [
      [p.id, p.color],
      [p.nombre, p.color],
    ]),
  );
  const color = (name: string, i: number) =>
    partyColor[people[name] ?? name] ?? palette[i % palette.length] ?? '#8A8F98';
  const by = Object.fromEntries(markets.mercados.map((m) => [m.tipo, m]));
  const present = order.flatMap((t) => (by[t] ? [by[t]] : []));
  const headline = {
    ganador: (name: string) => `${name} gana las elecciones`,
    presidente: (name: string) => `${name.split(' ').at(-1)}, próximo presidente`,
    fuera: (name: string) => `Sánchez, fuera antes del ${name.replace(/ de 20\d\d$/, '')}`,
  };
  const S = projection.simulacion;
  const option = (t: 'ganador' | 'presidente', re: RegExp) =>
    by[t]?.opciones.find((o) => re.test(o.nombre));
  const compare = [
    ['El PP saca más escaños que nadie', '', option('ganador', /^PP$/)?.p, S.primero.PP ?? 0],
    [
      'Feijóo, presidente',
      'En la proyección: PP y Vox suman 176.',
      option('presidente', /Feijóo/)?.p,
      S.bloques['PP + Vox']?.p176,
    ],
    [
      'Sánchez, presidente',
      'En la proyección: él y sus socios de 2023 suman 176.',
      option('presidente', /Sánchez/)?.p,
      S.bloques['PSOE y sus socios de 2023']?.p176,
    ],
  ] as const;

  return (
    <>
      <ReportIntro title="Los mercados">
        <p>
          Lo que apuestan en Polymarket: quién gana, quién preside y cuándo se va Sánchez, día a
          día.
        </p>
      </ReportIntro>
      <section className="grid gap-6">
        <SectionHeading title="Lo que apuestan">
          En Polymarket se apuesta dinero a lo que pasará; el precio de cada apuesta es la
          probabilidad que le da el mercado. No es una encuesta: es lo que creen, con dinero,
          quienes apuestan. Datos del {date(markets.actualizado)}.
        </SectionHeading>
        <Grid>
          {present.map((m) => {
            const o = m.opciones[0];
            if (!o) return null;
            const h = o.hist ?? [];
            const d = h
              .map(
                ([, p], i) =>
                  `${i ? 'L' : 'M'}${(i / Math.max(1, h.length - 1)) * 100} ${32 - p * 30}`,
              )
              .join('');
            return (
              <Cell key={m.tipo} span={4} className="content-start gap-3">
                <p className="m-0 text-sm text-muted-foreground">{m.pregunta}</p>
                <b className="font-heading text-[40px] leading-none font-normal tabular-nums">
                  {chance(o.p)}
                </b>
                <p className="m-0 font-medium">{headline[m.tipo](o.nombre)}</p>
                {h.length > 1 && (
                  <svg
                    viewBox="0 0 100 34"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="h-10 w-full"
                  >
                    <path d={`${d}L100 34L0 34Z`} fill={color(o.nombre, 0)} opacity={0.12} />
                    <path
                      d={d}
                      fill="none"
                      stroke={m.tipo === 'fuera' ? 'var(--foreground)' : color(o.nombre, 0)}
                      strokeWidth={1.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
                <p className="m-0 font-mono text-sm text-muted-foreground">
                  {dollars(m.volumen)} apostados
                </p>
              </Cell>
            );
          })}
        </Grid>
      </section>

      {present.map((m) => {
        const shown = m.opciones.filter((o) => o.p >= 0.005);
        const rest = m.opciones.filter((o) => o.p < 0.005);
        const rows = [
          ...shown.map((o, i) => ({ name: o.nombre, p: o.p, color: color(o.nombre, i) })),
          ...(rest.length
            ? [
                {
                  name: `Otros (${rest.length})`,
                  p: rest.reduce((t, o) => t + o.p, 0),
                  color: 'var(--muted-foreground)',
                },
              ]
            : []),
        ];
        return (
          <section key={m.tipo} className="mt-16 grid gap-6">
            <SectionHeading title={m.pregunta}>{intro[m.tipo]}</SectionHeading>
            <Grid>
              <Cell span={5} className="content-start">
                <ul className="m-0 grid list-none gap-2 p-0 text-sm">
                  {rows.map((r) => (
                    <li
                      key={r.name}
                      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3"
                    >
                      <span className="font-medium break-words">{r.name}</span>
                      <span className="h-3 rounded-xs bg-muted">
                        <i
                          className="block h-full rounded-xs"
                          style={{ width: `${r.p * 100}%`, background: r.color }}
                        />
                      </span>
                      <b className="text-right font-mono font-medium tabular-nums">{chance(r.p)}</b>
                    </li>
                  ))}
                </ul>
                <p className="m-0 text-sm text-muted-foreground">
                  {dollars(m.volumen)} apostados desde el {date(m.inicio)} ·{' '}
                  <Link href={m.url} className="underline underline-offset-4">
                    el mercado en Polymarket
                  </Link>
                </p>
              </Cell>
              <Cell span={7}>
                <OddsChart
                  dissolution={election.convocatoria}
                  series={m.opciones
                    .filter((o) => (o.hist?.length ?? 0) > 1)
                    .slice(0, 4)
                    .map((o, i) => ({
                      name: m.tipo === 'fuera' ? 'Sánchez fuera' : o.nombre,
                      color: m.tipo === 'fuera' ? 'var(--foreground)' : color(o.nombre, i),
                      history: o.hist ?? [],
                    }))}
                />
              </Cell>
            </Grid>
          </section>
        );
      })}

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Las apuestas y la proyección">
          Lo que dice el mercado al lado de lo que sale de nuestra{' '}
          <Link href={electionsHref('proyeccion')} className="underline underline-offset-4">
            proyección
          </Link>{' '}
          con la media de las encuestas.
        </SectionHeading>
        <Grid>
          <Cell>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 font-normal text-muted-foreground" />
                  <th className="py-2 text-right font-mono text-sm font-medium">Polymarket</th>
                  <th className="py-2 text-right font-mono text-sm font-medium">Proyección</th>
                </tr>
              </thead>
              <tbody>
                {compare.map(([title, note, market, model]) =>
                  market === undefined || model === undefined ? null : (
                    <tr key={title} className="border-b border-border last:border-0">
                      <td className="py-3">
                        <span className="grid gap-0.5">
                          <span className="font-medium">{title}</span>
                          {note && <span className="text-sm text-muted-foreground">{note}</span>}
                        </span>
                      </td>
                      <td className="py-3 text-right font-heading text-2xl tabular-nums">
                        {chance(market)}
                      </td>
                      <td className="py-3 text-right font-heading text-2xl tabular-nums">
                        {chance(model)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
              Las dos cosas no miden lo mismo: la proyección dice qué pasaría si se votara hoy como
              dicen las encuestas; el mercado apuesta por lo que pasará el 29N y después (pactos,
              investidura). Un mercado con poco dinero se mueve con pocas apuestas.
            </p>
          </Cell>
        </Grid>
      </section>
    </>
  );
}
