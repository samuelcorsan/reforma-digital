import { getHistory, read } from '../../lib/congreso/data';
import { accuracySchema, projectionSchema } from '../../lib/congreso/schema';
import { decimal, signed } from '../../lib/elecciones/format';
import { AccuracyPicker, type AccuracyElection } from './accuracy-picker';
import { Cell, Grid, ReportIntro, SectionHeading } from './report';
import { electionPages } from '../../lib/elecciones/pages';

// Rojo si la media se pasó; azul si se quedó corta; más intenso cuanto más, hasta 5 puntos.
const heat = (d: number) =>
  `color-mix(in oklab, ${d > 0 ? 'var(--brand)' : '#2C7BC4'} ${Math.round(Math.min(1, Math.abs(d) / 5) * 70)}%, var(--background))`;
const grade = (mae: number) => (mae < 1.5 ? '#2E7D5B' : mae < 2.5 ? '#B98A16' : 'var(--brand)');
const lineages = ['PP', 'PSOE', 'VOX', 'IZQ', 'CS'];

// «Cuánto acertaron»: las encuestas de las cinco últimas generales frente al resultado, hacia
// dónde fallaron, las encuestadoras y qué pasaría hoy si fallaran como entonces. Estructura de
// Escaño Abierto.
export async function Accuracy() {
  const [accuracy, projection, history] = await Promise.all([
    read('encuestas/aciertos.json', accuracySchema),
    read('encuestas/proyeccion.json', projectionSchema),
    getHistory(),
  ]);
  const E = accuracy.elecciones;
  const color = Object.fromEntries(history.familias.map((f) => [f.id, f.color]));
  const average = E.reduce((t, e) => t + e.media_mae, 0) / (E.length || 1);
  const aggregators = new Set(
    E.flatMap((e) => e.encuestas.filter((p) => p.agregador).map((p) => p.empresa)),
  );
  const name = (id: string) => E.map((e) => e.rotulos[id]).find(Boolean) ?? id;
  const elections: AccuracyElection[] = E.map((e) => ({
    id: e.id,
    name: e.nombre,
    error: e.media_mae,
    parties: e.partidos.map((id) => ({
      id,
      name: e.rotulos[id] ?? id,
      color: color[id] ?? '#8A8F98',
      result: e.resultado[id] ?? 0,
      average: e.media[id] ?? 0,
      polls: e.encuestas
        .filter((p) => !p.cis && !p.agregador && p.v[id] !== undefined)
        .map((p) => ({ firm: p.empresa, value: p.v[id] ?? 0 })),
    })),
  }));
  const base = projection.central;
  const scenarios = E.flatMap((e) => {
    const s = accuracy.escenarios[e.id];
    return s ? [{ name: e.nombre, seats: s.escanos, ppvox: s.ppvox }] : [];
  });
  const columns: [string, (s: Record<string, number>, ppvox?: number) => number][] = [
    ['PP', (s) => s.PP ?? 0],
    ['PSOE', (s) => s.PSOE ?? 0],
    ['Vox', (s) => s.VOX ?? 0],
    ['PP + Vox', (s, ppvox) => ppvox ?? (s.PP ?? 0) + (s.VOX ?? 0)],
  ];

  return (
    <>
      <ReportIntro title={electionPages.acierto.title}>
        <p>
          Error de las encuestas frente al resultado en las cinco últimas elecciones generales, por
          encuestadora, magnitud y sentido.
        </p>
      </ReportIntro>
      <section className="grid gap-6">
        <SectionHeading title="Error por elección">
          Media de las encuestas de las tres semanas previas frente al resultado. Error medio en las
          cinco últimas elecciones generales: {decimal(average)} puntos por partido. El error no
          afecta siempre a los mismos partidos ni en el mismo sentido.
        </SectionHeading>
        <AccuracyPicker elections={elections} />
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Sentido del error por partido">
          Diferencia entre la media de las encuestas y el resultado de cada partido, en puntos.
          Positivo: sobrestimado. Negativo: infravalorado.
        </SectionHeading>
        <Grid>
          <Cell>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th />
                    {E.map((e) => (
                      <th key={e.id} className="pb-1 text-center font-mono font-medium">
                        {e.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineages.map((id) => (
                    <tr key={id}>
                      <th className="pr-3 text-left font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <i
                            className="block size-2.5 rounded-full"
                            style={{ background: color[id] }}
                          />
                          {id === 'IZQ' ? 'Izquierda (Sumar, Podemos, IU)' : name(id)}
                        </span>
                      </th>
                      {E.map((e) => {
                        const d = e.media_dif[id];
                        return (
                          <td
                            key={e.id}
                            className="rounded-md py-2 text-center font-mono tabular-nums"
                            style={{ background: d === undefined ? 'var(--muted)' : heat(d) }}
                            title={
                              d === undefined
                                ? 'No se presentó o no llegó al 2,5 %'
                                : `${e.nombre}: ${d > 0 ? 'sobrestimado' : 'infravalorado'} en ${decimal(Math.abs(d))} puntos`
                            }
                          >
                            {d === undefined ? '–' : signed(d)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <i className="block size-3 rounded-xs" style={{ background: heat(4) }} />
              Sobrestimado
              <i className="ml-3 block size-3 rounded-xs" style={{ background: heat(-4) }} />
              Infravalorado
            </p>
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Error por encuestadora">
          Error medio de la última encuesta de cada empresa, en puntos por partido, en las
          elecciones generales en que publicó. Orden: número de elecciones y menor error.
        </SectionHeading>
        <Grid>
          <Cell>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 font-medium">Empresa</th>
                    <th className="py-2 text-right font-medium">Elecciones</th>
                    <th className="py-2 text-right font-medium">Error medio</th>
                    <th className="py-2 pl-4 font-medium">En cada una</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracy.ranking
                    .filter((r) => r.n >= 2)
                    .map((r) => (
                      <tr key={r.empresa} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium">
                          {r.empresa}
                          {aggregators.has(r.empresa) && (
                            <span className="ml-2 text-muted-foreground">(agregador)</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{r.n}</td>
                        <td className="py-2 text-right font-mono font-medium tabular-nums">
                          {decimal(r.mae)} pt
                        </td>
                        <td className="py-2 pl-4">
                          <span className="flex flex-wrap gap-1">
                            {r.elecciones.map((x) => (
                              <span
                                key={x.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono tabular-nums"
                              >
                                <i
                                  className="block size-2 rounded-full"
                                  style={{ background: grade(x.mae) }}
                                />
                                {E.find((e) => e.id === x.id)?.nombre ?? x.id} {decimal(x.mae)}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              Verde: menos de 1,5 puntos. Ámbar: menos de 2,5. Rojo: 2,5 o más.
            </p>
          </Cell>
        </Grid>
      </section>

      {scenarios.length > 0 && (
        <section className="mt-16 grid gap-6">
          <SectionHeading title="Proyección corregida con errores anteriores">
            Proyección actual con la media corregida según el error de cada elección en PP, PSOE,
            Vox y la izquierda (Sumar y Podemos).
          </SectionHeading>
          <Grid>
            <Cell>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 font-medium" />
                      {columns.map(([c]) => (
                        <th key={c} className="py-2 text-right font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-2 font-medium">Proyección actual</td>
                      {columns.map(([c, get]) => (
                        <td key={c} className="py-2 text-right font-mono font-medium tabular-nums">
                          {get(base)}
                        </td>
                      ))}
                    </tr>
                    {scenarios.map((s) => (
                      <tr key={s.name} className="border-b border-border last:border-0">
                        <td className="py-2">Con el error de {s.name}</td>
                        {columns.map(([c, get]) => {
                          const v = get(s.seats, s.ppvox);
                          const d = v - get(base);
                          return (
                            <td key={c} className="py-2 text-right font-mono tabular-nums">
                              {v}{' '}
                              <span
                                className={
                                  d > 0
                                    ? 'text-[#2E7D5B]'
                                    : d < 0
                                      ? 'text-brand'
                                      : 'text-muted-foreground'
                                }
                              >
                                ({d > 0 ? '+' : d < 0 ? '−' : '±'}
                                {Math.abs(d)})
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
                Un error pasado no implica que se repita en el mismo sentido.
              </p>
            </Cell>
          </Grid>
        </section>
      )}
    </>
  );
}
