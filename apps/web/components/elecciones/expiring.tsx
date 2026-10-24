import Link from 'next/link';
import { getIndex, read } from '../../lib/congreso/data';
import { balanceSchema, journeysSchema } from '../../lib/congreso/schema';
import {
  origins,
  originColor,
  presenter,
  presenterColor,
  presenterName,
  stage,
} from '../../lib/elecciones/laws';
import { Card } from '@reforma-digital/design/ui/card';
import { Icon } from '../brand/icon';
import { date, href } from '../congreso/common';
import { ExpiringList, type ExpiringLaw } from './expiring-list';
import { Journeys, type Journey } from './journeys';
import { Cell, Grid, Legend, ReportIntro, ReportSection, ReportStats, Heading } from './report';
import { thousands } from '../../lib/elecciones/format';

const frozenFrom = 10;

// «Lo que caduca»: las leyes que la disolución deja a medio camino, el camino de cada ley de la
// legislatura y de dónde vinieron. Estructura de Escaño Abierto.
export async function Expiring() {
  const [source, index, journeys] = await Promise.all([
    read('elecciones/elecciones.json', balanceSchema),
    getIndex(),
    read('elecciones/viajes.json', journeysSchema),
  ]);
  const { caducan, convalidar } = source;
  const lawHref = (exp: string) => href(`iniciativa/${exp.replace('/', '-')}`);
  const laws = caducan.lista.map(
    ([exp, title, , , authors, presented, reached, extensions, days]) => {
      const who = presenter(authors);
      return {
        exp,
        title,
        href: lawHref(exp),
        presenter: who,
        presenterName: presenterName(who),
        color: presenterColor(who, index.grupos),
        stage: reached,
        extensions,
        days,
        presented,
      };
    },
  );

  // El viaje de cada ley de la legislatura: el punto lleva el color de su origen.
  const all: Journey[] = journeys.leyes.map(
    ([exp, title, , origin, authors, , presented, dates, state, end, extensions]) => {
      const who = presenter(authors);
      return {
        exp,
        title,
        href: lawHref(exp),
        presenter: who,
        presenterName: presenterName(who),
        color: originColor(origin),
        presented,
        dates,
        stage: dates.filter(Boolean).length,
        destination:
          state === 'caduca'
            ? 'caduca'
            : state === 'en trámite'
              ? 'pendiente'
              : state === 'rechazada' || state === 'aprobada'
                ? state
                : 'fuera',
        end,
        extensions,
      };
    },
  );
  // En el sankey, el Gobierno, cada grupo de más a menos leyes, varios grupos, el Senado y las comunidades.
  const counts = new Map<string, number>();
  for (const l of all) counts.set(l.presenter, (counts.get(l.presenter) ?? 0) + 1);
  const fixed = ['GOB', 'VARIOS', 'SEN', 'CCAA'];
  const flowPresenters = [
    'GOB',
    ...[...counts.keys()]
      .filter((id) => !fixed.includes(id))
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)),
    'VARIOS',
    'SEN',
    'CCAA',
  ]
    .filter((id) => counts.get(id))
    .map((id) => ({ id, name: presenterName(id), color: presenterColor(id, index.grupos) }));

  const closest = laws
    .filter((l) => l.stage >= 3)
    .sort((a, b) => b.stage - a.stage || b.days - a.days);
  const frozen = [...laws].sort((a, b) => b.extensions - a.extensions).slice(0, 5);
  const presenters = [...new Set(laws.map((l) => l.presenter))]
    .map((id) => ({ id, name: presenterName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const rows: ExpiringLaw[] = laws;

  return (
    <>
      <ReportIntro title="Lo que caduca">
        <p>
          Al disolverse las Cortes caducan todos los asuntos que el Congreso no había terminado. Las
          leyes a medio tramitar tendrán que volver a presentarse en la próxima legislatura y
          empezar de cero.
        </p>
      </ReportIntro>
      <ReportStats
        items={[
          [caducan.total, 'leyes caducan sin terminar su tramitación'],
          [caducan.proyectos, 'proyectos del Gobierno'],
          [caducan.proposiciones, 'proposiciones de grupos, Senado y comunidades'],
          [
            laws.filter((l) => l.extensions >= frozenFrom).length,
            'con el plazo de enmiendas ampliado diez veces o más',
          ],
          [
            Math.round(laws.reduce((sum, l) => sum + l.days, 0) / laws.length),
            'días de media en el Congreso',
          ],
        ]}
      />
      <Grid>
        <Cell>
          <Journeys
            laws={all}
            start={journeys.inicio}
            dissolution={journeys.disolucion}
            presenters={flowPresenters}
            intro={{
              path: (
                <>
                  <Heading title="El camino de cada ley">
                    Cada punto es una ley: entra el día en que se presentó y avanza a medida que
                    pasa cada etapa. Dale a reproducir o arrastra la fecha: el{' '}
                    {date(journeys.disolucion)}, con la disolución, todo lo que seguía en trámite
                    cae. Pasa por un punto para ver su viaje.
                  </Heading>
                  <Legend
                    small
                    items={origins.map(([, label, color]) => ({
                      label:
                        label === 'Grupos'
                          ? 'Proposiciones de los grupos'
                          : label === 'CCAA'
                            ? 'Proposiciones autonómicas'
                            : label === 'Senado'
                              ? 'Proposiciones del Senado'
                              : 'Proyectos del Gobierno',
                      color,
                    }))}
                  />
                </>
              ),
              flows: (
                <Heading title="De dónde vinieron y dónde acabaron">
                  Los {thousands(all.length)} proyectos y proposiciones de ley de toda la
                  legislatura: quién los presentó, hasta dónde llegó cada uno y dónde se quedó el
                  resto. Las firmadas por más de un grupo van juntas.
                </Heading>
              ),
            }}
          />
        </Cell>
        <Cell span={6}>
          <Heading title="Las que estaban más cerca">
            Ya las había aprobado el Pleno del Congreso. La barra marca hasta qué etapa llegaron.
          </Heading>
          <ol className="m-0 grid list-none gap-3 p-0">
            {closest.map((l) => (
              <li key={l.exp} className="grid gap-1.5 rounded-xl bg-muted/60 p-4">
                <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                  {stage[l.stage]}
                </span>
                <Link href={l.href} className="leading-snug hover:underline underline-offset-4">
                  {l.title}
                </Link>
                <span className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="block size-2 rounded-full" style={{ background: l.color }} />
                    {l.presenterName}
                  </span>
                  <span className="font-mono tabular-nums">{thousands(l.days)} días</span>
                </span>
              </li>
            ))}
          </ol>
        </Cell>
        <Cell span={6}>
          <Heading title="Las más congeladas">
            Veces que se amplió su plazo de enmiendas: mientras se amplía, la ley no avanza.
          </Heading>
          <ol className="m-0 grid list-none p-0">
            {frozen.map((l) => (
              <li
                key={l.exp}
                className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-4 border-t border-border py-4 first:border-t-0 first:pt-0"
              >
                <p className="m-0 grid text-right">
                  <b className="font-heading text-3xl leading-none font-normal tabular-nums">
                    {l.extensions}
                  </b>
                  <span className="text-sm text-muted-foreground">veces</span>
                </p>
                <span className="grid gap-1">
                  <Link href={l.href} className="leading-snug hover:underline underline-offset-4">
                    {l.title}
                  </Link>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <i className="block size-2 rounded-full" style={{ background: l.color }} />
                    {l.presenterName}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Cell>
        <Cell>
          <Heading title={`Las ${caducan.total}, una a una`}>
            Busca una ley o filtra por quién la presentó y hasta dónde llegó.
          </Heading>
          <ExpiringList laws={rows} presenters={presenters} />
        </Cell>
      </Grid>
      {convalidar.length > 0 && (
        <ReportSection title="Decretos pendientes de convalidar">
          <p className="m-0 mb-6 max-w-[65ch] text-muted-foreground">
            Publicados poco antes de la disolución y aún sin votar. Los convalidará o derogará la
            Diputación Permanente, que sigue en funciones hasta que se constituyan las nuevas
            Cortes.
          </p>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {convalidar.map((d) => (
              <li key={d.numero} className="grid">
                <Card
                  render={<a href={d.pdf} target="_blank" rel="noopener noreferrer" />}
                  className="gap-3 p-6 text-base no-underline outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:p-5"
                >
                  <span className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    RDL {d.numero} · BOE {date(d.fecha)}
                  </span>
                  <span className="leading-snug">
                    {d.titulo
                      .replace(/^Real Decreto-ley \d+\/\d{4}, de \d+ de \p{L}+, /u, '')
                      .replace(/^./, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Plazo para votarlo: hasta el {date(d.limite_aprox)}, aproximadamente.
                  </span>
                  <span className="mt-auto flex items-center justify-end gap-2 pt-2 text-sm text-muted-foreground">
                    Leer el texto oficial
                    <span className="text-foreground">
                      <Icon name="externo" size={16} />
                    </span>
                    <span className="sr-only">(se abre en una pestaña nueva)</span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}
    </>
  );
}
