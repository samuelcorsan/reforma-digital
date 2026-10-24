import { getElections, getHistory, getIndex, read, slug } from '../../lib/congreso/data';
import { balanceSchema, mapSchema } from '../../lib/congreso/schema';
import { formatDate } from '../../lib/elecciones/format';
import { href } from '../congreso/common';
import { Apportionment } from './apportionment';
import { Reparto, type RepartoElection } from './reparto';
import { Cell, Grid, Legend, ReportIntro, SectionHeading } from './report';
import { SeatsCard } from './seats-card';

// «Los 350»: del mapa al hemiciclo, la regla que reparte los escaños y cómo ha cambiado el reparto
// desde 1977. Estructura de Escaño Abierto.
export async function The350() {
  const [election, source, history, index, map] = await Promise.all([
    getElections(),
    read('elecciones/elecciones.json', balanceSchema),
    getHistory(),
    getIndex(),
    read('elecciones/geo-provincias.json', mapSchema),
  ]);
  const last = history.elecciones.at(-1);
  const provinces = Object.fromEntries(
    Object.entries(map.provincias).map(([id, p]) => [
      id,
      { name: p.corto, href: href(`provincia/${slug(p.circ)}`) },
    ]),
  );
  const year = (iso: string) => iso.slice(0, 4);
  const elections: RepartoElection[] = [
    ...history.elecciones.map((e) => ({
      id: e.id,
      // En 2019 hubo dos: abril y noviembre.
      short:
        history.elecciones.filter((x) => year(x.fecha) === year(e.fecha)).length > 1
          ? `${year(e.fecha)} ${formatDate(e.fecha, { month: 'short' })}`
          : year(e.fecha),
      long: formatDate(e.fecha, { month: 'long', year: 'numeric' }),
      prov: Object.fromEntries(Object.entries(e.prov).map(([c, p]) => [c, { e: p.e, fam: p.fam }])),
    })),
    // Con el decreto de convocatoria se conoce el reparto del 29N; aún sin votar, en gris.
    {
      id: year(election.votacion),
      short: year(election.votacion),
      long: formatDate(election.votacion, { day: 'numeric', month: 'long', year: 'numeric' }),
      prov: Object.fromEntries(
        Object.entries(election.escanos).map(([c, e]) => [c, { e, fam: {} }]),
      ),
    },
  ];
  const families = history.familias.filter((f) =>
    history.elecciones.some((e) => (e.fam[f.id]?.[1] ?? 0) > 0),
  );

  return (
    <>
      <ReportIntro title="Los 350">
        <p>
          Cada escaño sale de una provincia. Del mapa al hemiciclo, y cómo ha cambiado el reparto
          desde {history.elecciones[0]?.fecha.slice(0, 4)}.
        </p>
      </ReportIntro>
      <Grid>
        <SeatsCard
          index={index}
          map={map}
          note={`Diputados de la ${index.meta.legislatura} legislatura${last ? `, elegidos en ${formatDate(last.fecha, { month: 'long', year: 'numeric' })}` : ''}.`}
        />
      </Grid>
      <section className="mt-16 grid gap-6">
        <SectionHeading title="La regla: por qué Soria elige 2 y Madrid 38">
          Los diputados de cada provincia no dependen solo de cuánta gente vive en ella. La ley
          electoral (art. 162 de la LOREG) los reparte en dos pasos, con el padrón de{' '}
          {source.padron.anio}, y de ahí sale el reparto del decreto del 29N.
        </SectionHeading>
        <Grid>
          <Cell>
            <Apportionment
              population={source.padron.pob}
              seats={election.escanos}
              provinces={provinces}
              year={source.padron.anio}
            />
          </Cell>
        </Grid>
      </section>
      <section className="mt-16 grid gap-6">
        <SectionHeading title="Cómo ha cambiado el reparto">
          Cada provincia tiene al menos dos diputados (Ceuta y Melilla, uno) y el resto se reparte
          según su población antes de cada elección. Cada punto es un escaño, del color de la
          familia que lo ganó. Pulsa uno para ir a su provincia.
        </SectionHeading>
        <Grid>
          <Cell>
            <Reparto
              elections={elections}
              families={families}
              provinces={provinces}
              centres={Object.fromEntries(
                Object.entries(map.provincias).map(([id, p]) => [id, p.c]),
              )}
              width={map.ancho}
              height={map.alto}
              background={
                <g key="mapa" aria-hidden="true">
                  {Object.entries(map.provincias).map(([id, p]) => (
                    <path
                      key={id}
                      d={p.d}
                      className="fill-muted stroke-background"
                      strokeWidth={0.8}
                    />
                  ))}
                  <path d={map.canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
                </g>
              }
            />
            <Legend small items={families.map((f) => ({ label: f.nombre, color: f.color }))} />
          </Cell>
        </Grid>
      </section>
    </>
  );
}
