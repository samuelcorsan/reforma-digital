import type { ReactNode } from 'react';
import { getHistory } from '../../lib/congreso/data';
import { electionLabel, longDate, time } from '../../lib/elecciones/format';
import { electionsHref, electionPages } from '../../lib/elecciones/pages';
import { Cell, Grid, Heading, ReportIntro } from './report';
import { Trend, type TrendPoint } from './trend';

const votes = 'var(--foreground)';
const seats = 'var(--brand)';

function Card({
  title,
  children,
  chart,
}: {
  title: string;
  children: ReactNode;
  chart: ReactNode;
}) {
  return (
    <Cell span={4} className="content-start">
      <Heading title={title}>{children}</Heading>
      {chart}
    </Cell>
  );
}

// «Métricas»: participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo, elección
// a elección. Estructura de Escaño Abierto.
export async function Metrics() {
  const history = await getHistory();
  const E = history.elecciones;
  const color = Object.fromEntries(history.familias.map((f) => [f.id, f.color]));
  const points: TrendPoint[] = E.map((e) => ({
    id: e.id,
    href: electionsHref(e.id),
    year: electionLabel(E, e.fecha),
    long: longDate(e.fecha),
    time: time(e.fecha),
  }));
  const metric = (key: keyof (typeof E)[number]['metricas']) =>
    E.map((e) => e.metricas[key] ?? null);
  // La candidatura más votada de cada elección y sus escaños.
  const first = E.map((e) => [...e.partidos].sort((a, b) => b[3] - a[3])[0]);
  const both = (e: (typeof E)[number], i: 0 | 1) => (e.fam.PSOE?.[i] ?? 0) + (e.fam.PP?.[i] ?? 0);

  return (
    <>
      <ReportIntro title={electionPages.metricas.title}>
        <p>
          Participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo, elección a
          elección.
        </p>
      </ReportIntro>
      <Grid>
        <Card
          title="Participación"
          chart={
            <Trend
              points={points}
              unit="percent"
              ticks={[0.6, 0.7, 0.8]}
              series={[
                { name: 'Participación', color: votes, values: E.map((e) => e.votantes / e.censo) },
              ]}
            />
          }
        >
          Votantes sobre el censo, incluido el voto desde el extranjero.
        </Card>
        <Card
          title="Escaños de la fuerza más votada"
          chart={
            <Trend
              points={points}
              unit="seats"
              ticks={[0, 100, 176, 220]}
              mark={176}
              bars={first.map((p) => color[p?.[2] ?? ''] ?? '#8A8F98')}
              series={[
                {
                  name: 'Escaños de la primera fuerza',
                  color: votes,
                  values: first.map((p) => p?.[4] ?? null),
                },
              ]}
            />
          }
        >
          Escaños de la candidatura más votada.
        </Card>
        <Card
          title="Número efectivo de partidos"
          chart={
            <Trend
              points={points}
              unit="decimal"
              ticks={[2, 3, 4, 5, 6]}
              series={[
                { name: 'Votos', color: votes, values: metric('nep_votos') },
                { name: 'Escaños', color: seats, values: metric('nep_escanos') },
              ]}
            />
          }
        >
          Índice de Laakso y Taagepera. Un valor de 2 corresponde a un bipartidismo puro; los
          valores más altos indican más fragmentación.
        </Card>
        <Card
          title="Voto conjunto a PSOE y PP"
          chart={
            <Trend
              points={points}
              unit="percent"
              ticks={[0.3, 0.5, 0.7, 0.9]}
              series={[
                { name: 'Escaños', color: seats, values: E.map((e) => both(e, 1) / 350) },
                { name: 'Votos', color: votes, values: E.map((e) => both(e, 0) / e.validos) },
              ]}
            />
          }
        >
          Porcentaje conjunto de votos válidos y de escaños.
        </Card>
        <Card
          title="Desproporcionalidad"
          chart={
            <Trend
              points={points}
              unit="decimal"
              ticks={[0, 4, 8, 12]}
              series={[{ name: 'Gallagher', color: votes, values: metric('gallagher') }]}
            />
          }
        >
          Índice de Gallagher: cuánto se separa el reparto de escaños del de votos, en puntos. 0
          corresponde a un reparto exactamente proporcional.
        </Card>
        <Card
          title="Volatilidad"
          chart={
            <Trend
              points={points}
              unit="percent"
              ticks={[0, 0.1, 0.2, 0.3, 0.4]}
              series={[
                {
                  name: 'Pedersen',
                  color: votes,
                  values: metric('pedersen').map((v) => (v === null ? null : v / 100)),
                },
              ]}
            />
          }
        >
          Índice de Pedersen: qué parte del voto cambió de familia de partidos respecto a la
          elección anterior.
        </Card>
        <Card
          title="Votos sin escaño"
          chart={
            <Trend
              points={points}
              unit="millions"
              ticks={[1e6, 1.5e6, 2e6, 2.5e6, 3e6, 3.5e6]}
              series={[{ name: 'Votos sin escaño', color: votes, values: metric('sin_escano') }]}
            />
          }
        >
          Votos a candidaturas que no sacaron ningún escaño en su provincia.
        </Card>
      </Grid>
      <p className="m-0 mt-6 max-w-[65ch] text-sm text-muted-foreground">
        Los índices se calculan por familias de partidos (las confluencias van con su familia) y,
        dentro de «Otros», por candidatura. Fuente: Ministerio del Interior.
      </p>
    </>
  );
}
