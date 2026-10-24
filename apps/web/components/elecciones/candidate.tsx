import Link from 'next/link';
import { Suspense } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Badge } from '@reforma-digital/design/ui/badge';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import { getPolls } from '../../lib/congreso/data';
import { pollsHidden } from '../../lib/congreso/polls';
import { decimal, longDate, signed } from '../../lib/elecciones/format';
import {
  candidates,
  interviewsOf,
  proposalScore,
  rounds,
  topicShare,
  type Candidate,
} from '../../lib/elecciones/interviews';
import { electionsHref } from '../../lib/elecciones/pages';
import { Icon } from '../brand/icon';
import { DataLoading } from '../congreso/loading';
import { Dot, interviewsHref, ReportSections, shortDay } from './interviews';
import { PhotoCredits, Portrait } from './portrait';
import { Cell, Grid, Label, ReportSection, Stat } from './report';

const round = rounds[0];

// La ficha de un candidato: su estado en la ronda, las cifras de su entrevista cuando las hay, su
// partido en las encuestas y el paso a los otros tres.
export function CandidateProfile({ candidate: c }: { candidate: Candidate }) {
  const latest = interviewsOf(c.slug)[0];
  const status = latest
    ? latest.pending
      ? 'En revisión'
      : 'Revisada'
    : `Pendiente · ${shortDay(round.date)}`;
  const figures: [string, string][] = latest
    ? [
        [
          decimal(latest.nota.global),
          `${latest.pending ? 'valoración provisional' : 'valoración'} sobre 10, ±\u00a0${decimal(latest.nota.margen)}`,
        ],
        [`${latest.stats.alGrano} %`, 'de respuestas al grano'],
        [String(latest.revisiones.length), 'afirmaciones verificadas'],
        [
          String(latest.propuestas.filter((p) => proposalScore(p) === 4).length),
          'propuestas completas',
        ],
      ]
    : [];
  return (
    <>
      <Grid>
        <div className="col-span-12 max-md:mx-auto max-md:w-56 md:col-span-4">
          <Portrait candidate={c} sizes="(min-width: 768px) 500px, 100vw" />
        </div>
        <Cell span={8} className="gap-8">
          <Label>Elecciones generales · 29 de noviembre de 2026</Label>
          <div className="grid justify-items-start gap-4">
            <Badge className="font-mono uppercase">{status}</Badge>
            <h1 className="m-0 font-heading text-4xl leading-[1.08] font-normal lg:text-[56px]">
              {c.name}
            </h1>
            <p className="m-0 flex items-center gap-2 text-lg text-muted-foreground">
              <Dot color={c.color} />
              {c.party}
            </p>
          </div>
          {latest ? (
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-4">
              {figures.map(([value, label]) => (
                <div key={label} className="grid content-start gap-1">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="m-0 font-heading text-3xl leading-none tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 max-w-[60ch] border-t border-border pt-6">
              Su entrevista en {round.title} se publica el {longDate(round.date)}. Cuando una
              persona haya revisado el análisis, aquí estarán su valoración, lo que afirma
              verificado y lo que propone.
            </p>
          )}
          {latest && (
            <div className="grid gap-3">
              {latest.pending > 0 && (
                <p className="m-0 text-sm text-muted-foreground">
                  Informe provisional: quedan {latest.pending} afirmaciones o momentos por revisar.
                </p>
              )}
              <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Temas con más tiempo:</span>
                {topicShare(latest)
                  .slice(0, 4)
                  .map((t) => (
                    <span key={t.topic} className="rounded-full px-3 py-1 ring-1 ring-border">
                      {t.topic}{' '}
                      <span className="text-muted-foreground tabular-nums">{t.share} %</span>
                    </span>
                  ))}
              </p>
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-2">
            <Link
              href={interviewsHref(latest ? latest.id : 'ejemplo')}
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
            >
              {latest ? 'Ver el informe completo' : 'Ver un informe de ejemplo'}{' '}
              <Icon name="derecha" size={16} />
            </Link>
            <Link
              href={interviewsHref('comparar')}
              data-slot="button"
              data-variant="outline"
              className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
            >
              Comparar a los cuatro <Icon name="derecha" size={16} />
            </Link>
          </div>
        </Cell>
      </Grid>
      <div className="mt-4">
        <PhotoCredits people={[c]} />
      </div>

      {latest && (
        <>
          <ReportSections interview={latest} />
          <div className="flex flex-wrap gap-2">
            <Link
              href={interviewsHref(latest.id)}
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
            >
              Verla minuto a minuto <Icon name="derecha" size={16} />
            </Link>
          </div>
        </>
      )}

      <ReportSection
        title={`${c.party}, en cifras`}
        action={
          <Link
            href={electionsHref('encuestas')}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
          >
            Todas las encuestas <Icon name="derecha" size={16} />
          </Link>
        }
      >
        <Suspense fallback={<DataLoading />}>
          <PartyFigures candidate={c} />
        </Suspense>
      </ReportSection>

      <ReportSection title="Los otros candidatos">
        <Grid>
          {candidates
            .filter((x) => x.slug !== c.slug)
            .map((x) => (
              <Card
                key={x.slug}
                render={<Link href={interviewsHref(x.slug)} />}
                className="col-span-12 flex-row items-center gap-4 p-4 text-base no-underline outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-4"
              >
                <Portrait candidate={x} kind="avatar" sizes="112px" className="size-14" />
                <span className="grid gap-1">
                  <b className="font-medium">{x.name}</b>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Dot color={x.color} />
                    {x.party}
                  </span>
                </span>
                <span className="ml-auto">
                  <Icon name="derecha" size={16} />
                </span>
              </Card>
            ))}
        </Grid>
      </ReportSection>
    </>
  );
}

// Su partido en las encuestas de la sección: el resultado de 2023 y la media de hoy. Durante la
// veda electoral, la media no se enseña.
async function PartyFigures({ candidate: c }: { candidate: Candidate }) {
  const polls = await getPolls();
  const vote = polls.resultado2023.v[c.pollId];
  const seats = polls.resultado2023.e[c.pollId]?.[0];
  const series = polls.media.partidos[c.pollId];
  if (vote === undefined || seats === undefined || !series)
    throw new Error(`Las encuestas no traen a ${c.pollId}`);
  // El último día con media.
  let day = series.m.length - 1;
  while (day >= 0 && series.m[day] == null) day--;
  const average = series.m[day];
  const spread = series.s[day];
  const date = polls.media.dias[day];
  const hidden = pollsHidden(polls.veda);
  // Frente Amplio se presentó en 2023 como Sumar.
  const successor = c.pollId === 'SUMAR';
  return (
    <Grid>
      <Cell span={4} label="Generales de 2023">
        <Stat
          value={`${decimal(vote)} %`}
          caption={`de los votos y ${seats} escaños${successor ? ', como Sumar' : ''}`}
        />
      </Cell>
      {hidden || average == null || !date ? (
        <Cell span={8} label="Las encuestas">
          <p className="m-0 max-w-[60ch] text-muted-foreground">
            {hidden
              ? 'Del 24 al 29 de noviembre la ley no permite publicar encuestas. Volverán a mostrarse cuando acabe el periodo de restricción.'
              : 'Todavía no hay encuestas suficientes para calcular su media.'}
          </p>
        </Cell>
      ) : (
        <>
          <Cell span={4} label="Media de las encuestas">
            <Stat
              value={`${decimal(average)} %`}
              caption={`a ${longDate(date)}${spread != null ? `; las encuestas se separan ±\u00a0${decimal(spread)} puntos` : ''}`}
            />
          </Cell>
          <Cell span={4} label="Desde 2023">
            <Stat value={signed(average - vote)} caption="puntos respecto a su resultado de 2023" />
          </Cell>
        </>
      )}
    </Grid>
  );
}
