import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants, Button } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';

import { FilterSelect } from '../../../../components/congreso/common';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getIndex } from '../../../../lib/congreso/data';
import { periodCounts, sessions, votes } from '../../../../lib/congreso/queries';
import { congressBase, congressRoute } from '../../../../lib/congreso/routes';
import { pageMetadata } from '../../../../lib/seo';
import {
  Intro,
  Section,
  Stats,
  Sessions,
  Votes,
  Hemicycle,
  Empty,
  date,
  href,
} from '../../../../components/congreso/common';
import { Activity } from '../../../../components/congreso/activity';
import { People } from '../../../../components/congreso/people';
import { Explore } from '../../../../components/congreso/explore';
import { Geography } from '../../../../components/congreso/elections';
import { Information } from '../../../../components/congreso/information';
import { StaticIntro } from '../../../../components/congreso/intro';
import { DataLoading } from '../../../../components/congreso/loading';

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  const route = congressRoute(path);
  if (!route) notFound();
  return pageMetadata({
    title: `${route.title} · El Congreso · Reforma Digital`,
    description:
      'Qué se dijo, cómo se votó y quién te representa. Actividad parlamentaria con datos oficiales, fuentes y análisis identificados como IA.',
    path: href(path.map(encodeURIComponent).join('/')),
    og: 'congreso',
  });
}
const querySchema = z.object({
  q: z.string().max(200).default(''),
  grupo: z.string().max(30).default(''),
  provincia: z.string().max(80).default(''),
  periodo: z.string().max(10).default('reciente'),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  vista: z.string().max(30).default('citas'),
  estado: z.string().max(30).default(''),
  tipo: z.string().max(30).default(''),
  anio: z.union([z.literal(''), z.string().regex(/^\d{4}$/)]).default(''),
  orden: z.enum(['recientes', 'antiguas']).default('recientes'),
});
export default async function Page({ params, searchParams }: Props) {
  const route = congressRoute((await params).path);
  if (!route) notFound();
  const parsed = querySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { section, detail } = route;
  const information = ['sobre', 'metodo', 'glosario', 'como-ley'].includes(section);
  return (
    <main id="main" tabIndex={-1}>
      {section === '' && (
        <section
          data-part="cg-hero"
          className={
            "[--celda:8px] [--hueco-sol:calc(32_*_var(--celda)_+_24px)] relative isolate overflow-hidden [margin:0_8px] pt-24 px-(--page-gutter) pb-(--hueco-sol) rounded-28 inset-ring inset-ring-border text-center [&::after]:[content:''] [&::after]:absolute [&::after]:[z-index:-1] [&::after]:[inset:auto_0_0] [&::after]:[height:calc(32_*_var(--celda))] [&::after]:sol-horizonte [&::after]:[image-rendering:pixelated] [&::after]:pointer-events-none [&_h1]:text-fluid-36-72-suave [&_h1]:leading-1.08 [&_h1]:[max-width:25ch] [&_h1]:[margin:24px_auto] [&_p]:[max-width:62ch] [&_p]:[margin:0_auto] [&_p]:text-(--text-secondary) [&_p]:text-lg [&_[data-slot=button][data-variant=outline]]:absolute [&_[data-slot=button][data-variant=outline]]:[inset:auto_0_24px] [&_[data-slot=button][data-variant=outline]]:[width:fit-content] [&_[data-slot=button][data-variant=outline]]:[margin-inline:auto] [@media(max-width:_560px)]:[--celda:6px] [@media(max-width:_560px)]:pt-16 [@media(max-width:_560px)]:[&_p]:text-base"
          }
        >
          <span
            data-part="t-etiqueta"
            className={'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase'}
          >
            Un proyecto de Reforma Digital
          </span>
          <h1>Lo que pasa en el Congreso, contado para cualquiera.</h1>
          <p>
            Cada pleno resumido, cada votación con el voto de cada diputado y cada ley, desde que
            entra hasta que se publica. Con datos oficiales, en lenguaje claro y con código abierto.
          </p>
          <a
            href="#lo-ultimo"
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Lo último del Congreso ↓
          </a>
        </section>
      )}
      <div
        data-part="cg-body"
        className={
          '[max-width:var(--container-content)] [margin:auto] pt-8 px-(--page-gutter) pb-20 [&_.sol-tabs]:mb-6 [container-type:inline-size] [&_a:not([data-slot=button][data-variant=default],_[data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline],_[data-slot=button][data-variant=ghost],_[data-slot=button][data-size=icon],_[data-slot=button][data-size=icon-lg],_[data-part=cg-card]):hover]:underline [&_a:not([data-slot=button][data-variant=default],_[data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline],_[data-slot=button][data-variant=ghost],_[data-slot=button][data-size=icon],_[data-slot=button][data-size=icon-lg],_[data-part=cg-card]):hover]:underline-offset-3'
        }
      >
        {information ? (
          <Information section={section} title={route.title} />
        ) : (
          <>
            <StaticIntro section={section} detail={detail} province={parsed.data.provincia} />
            <Suspense
              key={`${section}/${detail ?? ''}/${JSON.stringify(parsed.data)}`}
              fallback={<DataLoading />}
            >
              <Data route={route} query={parsed.data} />
            </Suspense>
          </>
        )}
      </div>
    </main>
  );
}

async function Data({
  route,
  query,
}: {
  route: NonNullable<ReturnType<typeof congressRoute>>;
  query: z.infer<typeof querySchema>;
}) {
  const { q, grupo, provincia, periodo, pagina, vista, estado, tipo, anio, orden } = query;

  const index = await getIndex();
  if (!['reciente', 'todo', ...index.meses.map((m) => m.mes)].includes(periodo)) notFound();
  const { section, detail } = route;
  let content;
  if (
    [
      'dias',
      'votaciones',
      'votacion',
      'sesion',
      'leyes',
      'iniciativa',
      'temas',
      'tema',
      'preguntas',
    ].includes(section)
  ) {
    content = (
      <Activity
        section={section}
        detail={detail}
        index={index}
        period={periodo}
        query={q}
        page={pagina}
        lawFilter={{ status: estado, type: tipo, year: anio, order: orden }}
      />
    );
  } else if (
    ['diputados', 'diputado', 'grupos', 'oradores', 'organigrama', 'cargo', 'provincia'].includes(
      section,
    )
  ) {
    content = (
      <People
        section={section}
        detail={detail}
        index={index}
        period={periodo}
        query={q}
        group={grupo}
        province={provincia}
        page={pagina}
      />
    );
  } else if (['explora', 'semana'].includes(section)) {
    content = <Explore section={section} detail={detail} query={q} page={pagina} tab={vista} />;
  } else if (section === 'geografia')
    content = <Geography detail={detail} query={q} page={pagina} />;
  else {
    const [counts, latestSessions, latestVotes] = await Promise.all([
      periodCounts(periodo),
      sessions({ period: periodo }, 1, 6),
      votes({ period: periodo }, 1, 6),
    ]);
    content = (
      <>
        <div id="lo-ultimo">
          <Intro
            label={`Legislatura ${index.meta.legislatura} · datos hasta ${date(index.meta.datos_hasta)}`}
            title="Lo último del Congreso"
            heading="h2"
          >
            <p>Qué se dijo, cómo se votó y quién te representa.</p>
          </Intro>
        </div>
        <Stats
          items={[
            [counts.sesiones, 'Sesiones'],
            [counts.votaciones, 'Votaciones'],
            [counts.intervenciones, 'Intervenciones analizadas'],
          ]}
        />
        <Section
          title="Cada escaño, a la vista"
          action={<Link href={href('diputados')}>Quién te representa →</Link>}
        >
          <Hemicycle index={index} />
        </Section>
        <Section
          title="Las últimas sesiones"
          action={<Link href={href('dias', periodo)}>Ver todas →</Link>}
        >
          <Sessions sessions={latestSessions.rows} />
        </Section>
        <Section
          title="Así se votó"
          action={<Link href={href('votaciones', periodo)}>Ver todas →</Link>}
        >
          <Votes votes={latestVotes.rows} />
        </Section>
        <Section title="Próximos plenos">
          {index.agenda.plenos.length ? (
            <div
              className={
                'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
              }
            >
              {index.agenda.plenos.map((pleno) => (
                <Card
                  key={pleno.fecha}
                  render={
                    <article
                      data-part="cg-card"
                      className={
                        '[overflow-wrap:anywhere] [&_h2]:text-28 [&_h3]:text-lg [&_h3]:leading-1.3 [&_h3]:[margin:12px_0] [&_p]:text-(--text-secondary) [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:text-28 [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
                      }
                    />
                  }
                >
                  <h3>{date(pleno.fecha)}</h3>
                  <ul>
                    {pleno.puntos.map((p, i) => (
                      <li key={i}>{p.titulo}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ) : (
            <Empty>No hay plenos convocados en el último registro.</Empty>
          )}
        </Section>
      </>
    );
  }
  return (
    <>
      {['', 'dias', 'votaciones', 'diputado', 'grupos', 'oradores'].includes(section) && (
        <form
          className={
            'flex items-center flex-wrap gap-3 pb-6 [&_.campo]:w-auto [@media(max-width:_560px)]:[&_.campo]:[max-width:190px]'
          }
          action={`${congressBase}/${section}${detail ? `/${detail}` : ''}`}
        >
          <label htmlFor="congress-period">Periodo</label>
          <FilterSelect
            id="congress-period"
            name="periodo"
            label="Periodo"
            defaultValue={periodo}
            options={[
              { value: 'reciente', label: 'Últimos tres meses' },
              { value: 'todo', label: 'Toda la legislatura' },
              ...index.meses
                .slice()
                .reverse()
                .map((m) => ({ value: m.mes, label: m.mes })),
            ]}
          />
          <Button type="submit" variant="outline">
            Aplicar
          </Button>
        </form>
      )}
      {content}
      <p className={'text-muted-foreground text-sm mt-16 pt-6 border-t border-t-border'}>
        Snapshot generado el {date(index.meta.generado)}. Los distintos conjuntos pueden tener
        fechas de actualización diferentes. <Link href={href('metodo')}>Método y fuentes</Link>.
      </p>
    </>
  );
}
