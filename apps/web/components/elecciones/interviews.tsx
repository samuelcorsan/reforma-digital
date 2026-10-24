import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Badge } from '@reforma-digital/design/ui/badge';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import { decimal, formatDate, longDate, minute } from '../../lib/elecciones/format';
import {
  answers,
  candidates,
  criteria,
  criterionIds,
  getCandidate,
  interviewName,
  interviewer,
  interviewsOf,
  lanes,
  marks,
  moments,
  proposalScore,
  roundInterviews,
  speakingShare,
  speech,
  rounds,
  topicShare,
  verdictIds,
  verdicts,
  videoUrl,
  type Candidate,
  type Interview,
} from '../../lib/elecciones/interviews';
import { electionsHref } from '../../lib/elecciones/pages';
import { Icon, type IconName } from '../brand/icon';
import { AI, Source } from '../congreso/common';
import { InterviewPlayer } from './interview-player';
import { IconChip, MarkIcon, markIcons } from './mark-icon';
import { PhotoCredits, Portrait } from './portrait';
import {
  Bars,
  Cell,
  Explore,
  Grid,
  Label,
  ReportIntro,
  ReportSection,
  ReportStats,
  Stat,
} from './report';

export const interviewsHref = (path = '') => electionsHref(`entrevistas${path ? `/${path}` : ''}`);
const nextRound = rounds[0];

export function Dot({ color }: { color: string }) {
  return (
    <i
      aria-hidden="true"
      className="block size-2.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

// El avatar, el nombre y el partido, encima del informe o de una verificación.
function CandidateLine({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex items-center gap-4">
      <Portrait candidate={candidate} kind="avatar" sizes="128px" className="size-18 shrink-0" />
      <p className="m-0 grid gap-1">
        <b className="font-medium">{candidate.name}</b>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Dot color={candidate.color} />
          {candidate.party}
        </span>
      </p>
    </div>
  );
}

// La calificación siempre con su nombre: el color solo acompaña.
function Verdict({ id }: { id: keyof typeof verdicts }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <Dot color={verdicts[id].color} />
      {verdicts[id].name}
    </span>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <Card className="mb-8 bg-muted p-5 text-base ring-0" role="note">
      <p className="m-0">{children}</p>
    </Card>
  );
}

function Sources({ items }: { items: { titulo: string; url: string }[] }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
      {items.length === 1 ? 'Fuente:' : 'Fuentes:'}
      {items.map((f) => (
        <Source key={f.url} url={f.url}>
          {f.titulo}
        </Source>
      ))}
    </p>
  );
}

// El proceso, con quién hace cada paso: la IA propone y una persona decide.
const steps: { title: string; text: string; by?: 'IA' | 'Persona' }[] = [
  { title: 'La entrevista entera', text: 'El vídeo completo, sin cortes ni clips.' },
  {
    title: 'Transcripción',
    text: 'Quién habla y en qué segundo: el entrevistador, el candidato u otras personas.',
  },
  {
    title: 'Análisis',
    text: 'Temas, cifras, propuestas, críticas, interrupciones y preguntas sin responder.',
    by: 'IA',
  },
  {
    title: 'Contraste con fuentes',
    text: 'Cada afirmación comprobable, frente al INE, Eurostat, el BOE, el Banco de España…',
    by: 'IA',
  },
  {
    title: 'Revisión humana',
    text: 'Una persona confirma cada decisión. Sin eso no se publica nada.',
    by: 'Persona',
  },
  { title: 'El informe', text: 'Cada calificación, con su explicación y sus fuentes enlazadas.' },
];

const voteDate = '2026-11-29';
// «13 nov»: el día y el mes de una fecha ISO.
export const shortDay = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });

// Lo que trae cada informe, con los mismos iconos que su línea de tiempo.
const features: { icon: IconName; color?: string; title: string; text: string }[] = [
  {
    icon: markIcons.legal,
    color: verdicts.legal.color,
    title: 'Lo que afirma, verificado',
    text: 'Cada afirmación comprobable, con su calificación y sus fuentes oficiales enlazadas.',
  },
  {
    icon: markIcons.completa,
    title: 'Lo que propone',
    text: 'Si cada propuesta dice qué, cuánto, cuándo y cómo.',
  },
  {
    icon: markIcons.repregunta,
    title: 'Cómo responde',
    text: 'Respuestas directas, evasivas, cambios de tema y las veces que le repreguntan.',
  },
  {
    icon: markIcons.momento,
    title: 'Momentos clave',
    text: 'Anuncios, choques, titulares y rectificaciones, con su cita literal.',
  },
  {
    icon: markIcons.critica,
    title: 'El tono',
    text: 'Críticas a la política de otros frente a ataques personales e interrupciones.',
  },
  {
    icon: 'documento',
    title: 'Minuto a minuto',
    text: 'La transcripción entera y una línea de tiempo con cada marca, junto al vídeo.',
  },
];

export function InterviewsHome() {
  const round = roundInterviews(nextRound.id).map((e) => e.interview);
  const complete = round.every(Boolean);
  const status = round.some(Boolean)
    ? complete && round.every((a) => !a?.pending)
      ? 'Ronda revisada'
      : 'En revisión'
    : `Pendiente · ${shortDay(nextRound.date)}`;
  return (
    <>
      <Grid>
        <Cell span={7} className="gap-10">
          <Label>Elecciones generales · 29 de noviembre de 2026</Label>
          <div className="grid justify-items-start gap-4">
            <Badge className="font-mono uppercase">{status}</Badge>
            <h1 className="m-0 max-w-[18ch] font-heading text-4xl leading-[1.08] font-normal lg:text-[56px]">
              Cuatro candidatos, las mismas reglas
            </h1>
            <p className="m-0 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
              Sus entrevistas, revisadas una a una: qué afirman y si es cierto, qué proponen y si
              responden a lo que se les pregunta. Cada informe trae una valoración sobre 10, con sus
              criterios y sus pesos a la vista.
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Link
              href={interviewsHref(complete ? 'comparar' : 'ejemplo')}
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
            >
              {complete ? 'Comparar a los cuatro' : 'Ver un informe de ejemplo'}{' '}
              <Icon name="derecha" size={16} />
            </Link>
            <Link
              href={interviewsHref('metodologia')}
              data-slot="button"
              data-variant="outline"
              className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
            >
              Cómo se revisa <Icon name="derecha" size={16} />
            </Link>
          </div>
        </Cell>
        <Cell span={5} label="La ronda">
          <Stat
            value={shortDay(nextRound.date)}
            caption={`${nextRound.title}: se publican las cuatro entrevistas el mismo día`}
          />
          <p className="m-0 text-muted-foreground">{nextRound.text}</p>
          <ol className="m-0 mt-auto grid list-none gap-2 border-t border-border p-0 pt-5">
            {[
              [nextRound.date, 'Se publican las entrevistas y empieza la revisión'],
              [voteDate, 'Elecciones generales'],
            ].map(([date, text]) => (
              <li key={date} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {date && shortDay(date)}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </Cell>
      </Grid>

      <ReportSection title="Los cuatro candidatos">
        <Grid>
          {candidates.map((c) => {
            const latest = interviewsOf(c.slug)[0];
            return (
              <Card
                key={c.slug}
                render={<Link href={interviewsHref(c.slug)} />}
                className="col-span-6 gap-4 p-3 text-base no-underline outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-3"
              >
                <Portrait candidate={c} sizes="(min-width: 768px) 360px, 60vw" />
                <div className="grid gap-1 px-2 pb-2 max-sm:px-1">
                  <h3 className="m-0 font-heading text-2xl leading-tight font-normal max-sm:text-xl">
                    {c.name}
                  </h3>
                  <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
                    <Dot color={c.color} />
                    {c.party}
                  </p>
                  <p className="m-0 mt-2 flex items-center justify-between gap-2 text-sm">
                    {latest
                      ? `${decimal(latest.nota.global)} sobre 10${latest.pending ? ', provisional' : ''}`
                      : `Pendiente · ${longDate(nextRound.date).replace(/ de \d{4}$/, '')}`}
                    <Icon name="derecha" size={16} />
                  </p>
                </div>
              </Card>
            );
          })}
        </Grid>
        <div className="mt-4">
          <PhotoCredits people={candidates}>
            <p className="m-0">De menos a más escaños en las generales de 2023.</p>
          </PhotoCredits>
        </div>
      </ReportSection>

      <ReportSection title="Qué tiene cada informe">
        <Grid>
          {features.map((f) => (
            <Cell key={f.title} span={4} className="gap-4">
              <IconChip name={f.icon} color={f.color} className="size-10" />
              <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{f.title}</h3>
              <p className="m-0 text-muted-foreground">{f.text}</p>
            </Cell>
          ))}
        </Grid>
      </ReportSection>

      <ReportSection
        title="Cómo se revisa"
        action={
          <Link
            href={interviewsHref('metodologia')}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
          >
            La metodología completa <Icon name="derecha" size={16} />
          </Link>
        }
      >
        <Grid>
          <Cell label="Del vídeo al informe">
            <ol className="m-0 grid list-none gap-x-8 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="grid content-start gap-2 border-t border-border pt-4"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {step.by && (
                      <Badge
                        variant={step.by === 'Persona' ? 'default' : 'outline'}
                        className="font-mono uppercase"
                      >
                        {step.by === 'Persona' ? 'Lo decide una persona' : 'IA'}
                      </Badge>
                    )}
                  </span>
                  <h3 className="m-0 font-heading text-xl leading-tight font-normal">
                    {step.title}
                  </h3>
                  <p className="m-0 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </Cell>
          <Cell label="Cómo se califica una afirmación">
            <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {verdictIds.map((id) => (
                <li key={id} className="grid content-start gap-2">
                  <MarkIcon kind={id} color={verdicts[id].color} className="size-10" />
                  <h3 className="m-0 mt-1 font-heading text-xl leading-tight font-normal">
                    {verdicts[id].name}
                  </h3>
                  <p className="m-0 text-muted-foreground">{verdicts[id].text}</p>
                </li>
              ))}
            </ul>
          </Cell>
        </Grid>
      </ReportSection>
    </>
  );
}

function VerdictList() {
  return (
    <dl className="m-0 grid gap-3">
      {verdictIds.map((id) => {
        const v = verdicts[id];
        return (
          <div
            key={id}
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3"
          >
            <dt className="flex items-center gap-2 font-medium">
              <MarkIcon kind={id} color={v.color} />
              {v.name}
            </dt>
            <dd className="m-0 text-muted-foreground">{v.text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// Lo que trae el informe de una entrevista: lo que afirma verificado, los momentos clave, lo que
// propone, sus críticas y su perfil. Lo comparten el informe y la ficha del candidato.
export function ReportSections({ interview: a }: { interview: Interview }) {
  const proposals = [...a.propuestas].sort((x, y) => proposalScore(y) - proposalScore(x));
  return (
    <>
      {a.revisiones.length > 0 && (
        <ReportSection title="Lo que afirma, verificado">
          <AI label="Propuesto con IA · confirmado por una persona">
            <p>Cada afirmación comprobable, contrastada con fuentes oficiales enlazadas.</p>
          </AI>
          <ul className="m-0 mt-6 grid list-none gap-4 p-0">
            {a.revisiones.map((r) => (
              <li key={r.id}>
                <Cell className="gap-4">
                  <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Verdict id={r.veredicto} />
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      minuto {minute(r.segundo)}
                    </span>
                  </p>
                  <blockquote className="m-0 font-heading text-2xl leading-snug">
                    «{r.cita}»
                  </blockquote>
                  <p className="m-0 max-w-[65ch] text-muted-foreground">{r.explicacion}</p>
                  <Sources items={r.fuentes} />
                  <Link
                    href={interviewsHref(`${a.id}/${r.id}`)}
                    className="self-start text-sm underline underline-offset-4"
                  >
                    Enlace a esta verificación
                  </Link>
                </Cell>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {a.momentos.length > 0 && (
        <ReportSection title="Momentos clave">
          <Grid>
            {a.momentos.map((m) => (
              <Cell key={m.id} span={4} label={`${moments[m.tipo].name} · ${minute(m.segundo)}`}>
                <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{m.titulo}</h3>
                <p className="m-0">«{m.cita}»</p>
                <p className="m-0 text-sm text-muted-foreground">{m.porQue}</p>
              </Cell>
            ))}
          </Grid>
        </ReportSection>
      )}

      {proposals.length > 0 && (
        <ReportSection title="Lo que propone">
          <Grid>
            {proposals.map((p) => {
              const score = proposalScore(p);
              return (
                <Cell
                  key={p.id}
                  span={6}
                  label={`${score === 4 ? 'Propuesta completa' : score === 3 ? 'Casi completa' : 'Propuesta'} · ${minute(p.segundo)}`}
                >
                  <p className="m-0 text-lg leading-snug">{p.texto}</p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
                    {(
                      [
                        ['que', 'Qué'],
                        ['cuanto', 'Cuánto'],
                        ['cuando', 'Cuándo'],
                        ['como', 'Cómo'],
                      ] as const
                    ).map(([key, name]) => (
                      <li
                        key={key}
                        className={
                          p[key]
                            ? 'rounded-full bg-foreground px-3 py-1 text-background'
                            : 'rounded-full px-3 py-1 text-muted-foreground ring-1 ring-border'
                        }
                      >
                        {p[key] ? '✓' : '✗'} {name}
                        <span className="sr-only">{p[key] ? ': lo dice' : ': no lo dice'}</span>
                      </li>
                    ))}
                  </ul>
                </Cell>
              );
            })}
          </Grid>
        </ReportSection>
      )}

      {a.ataques.length > 0 && (
        <ReportSection title="Críticas a otros">
          <Cell>
            <ul className="m-0 grid list-none gap-4 p-0">
              {a.ataques.map((x) => (
                <li
                  key={x.id}
                  className="grid gap-1 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <Label>
                    {x.tipo === 'personal' ? 'Ataque personal' : 'Crítica política'} · a{' '}
                    {x.objetivo} · {minute(x.segundo)}
                  </Label>
                  <p className="m-0">«{x.texto}»</p>
                </li>
              ))}
            </ul>
          </Cell>
        </ReportSection>
      )}
      <Profile interview={a} />
    </>
  );
}

// Su perfil: cómo habla y cómo le trató el entrevistador, con las mismas reglas para los cuatro.
function Profile({ interview: a }: { interview: Interview }) {
  const s = speech(a);
  const i = interviewer(a);
  const who = a.entrevista?.entrevistador ?? 'el entrevistador';
  const rows = (items: [string, string, string?][]) => (
    <dl className="m-0 grid gap-4">
      {items.map(([name, value, unit]) => (
        <div
          key={name}
          className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
        >
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="m-0 font-heading text-2xl tabular-nums">
            {value}
            {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <ReportSection title="Su perfil">
      <Grid>
        <Cell span={6} label="Cómo habla">
          {rows([
            ['Ritmo', String(Math.round(s.pace)), 'palabras/min'],
            ['Muletillas', decimal(s.fillers), 'por minuto'],
            ['Titubeos', decimal(s.stutters), 'por minuto'],
            ['Pausa antes de responder', s.pause == null ? '—' : decimal(s.pause), 'segundos'],
          ])}
          <p className="m-0 text-sm text-muted-foreground">
            Señales observables en la transcripción, no un diagnóstico: no dicen si alguien está
            nervioso ni si es sincero.
          </p>
        </Cell>
        <Cell span={6} label={`Cómo le trató ${who}`}>
          {rows([
            ['Tiempo de palabra del entrevistador', `${i.share} %`],
            ['Preguntas por minuto', decimal(i.questionsPerMinute)],
            ['Repreguntas', String(i.followUps)],
            ['Veces que le corta', String(i.cuts)],
            ['Palabras por pregunta', String(Math.round(i.wordsPerQuestion))],
          ])}
        </Cell>
      </Grid>
    </ReportSection>
  );
}

export function InterviewReport({ interview: a }: { interview: Interview }) {
  const complete = a.propuestas.filter((p) => proposalScore(p) === 4).length;
  const video = videoUrl(a);
  const where = [a.entrevista?.medio, a.entrevista?.programa].filter(Boolean).join(' · ');
  const candidate = getCandidate(a.candidato);
  return (
    <>
      {a.ficticio && (
        <Notice>
          <b className="font-medium">Ejemplo con un candidato ficticio y datos inventados.</b> Así
          será el informe de cada entrevista real.
        </Notice>
      )}
      {a.pending > 0 && (
        <Notice>
          <b className="font-medium">Informe provisional.</b> Quedan {a.pending} afirmaciones o
          momentos por revisar. Mientras tanto, la valoración solo cuenta lo que ya ha confirmado
          una persona.
        </Notice>
      )}
      {candidate && (
        <div className="mb-6">
          <CandidateLine candidate={candidate} />
        </div>
      )}
      <ReportIntro title={interviewName(a)}>
        <p>
          {where && `${where}, `}con {a.entrevista?.entrevistador ?? 'el entrevistador'}. Publicada
          el {longDate(a.publicado.slice(0, 10))}; dura {Math.round(a.duracion / 60)} minutos.
        </p>
        {video && <Source url={video}>Ver la entrevista completa</Source>}
      </ReportIntro>

      <ReportStats
        items={[
          [
            `${decimal(a.nota.global)} ± ${decimal(a.nota.margen)}`,
            a.pending ? 'valoración provisional, sobre 10' : 'valoración, sobre 10',
          ],
          [`${a.stats.alGrano} %`, `de respuestas al grano, en ${a.preguntas.length} preguntas`],
          [complete, complete === 1 ? 'propuesta completa' : 'propuestas completas'],
          [
            a.revisiones.length,
            a.revisiones.length === 1 ? 'afirmación verificada' : 'afirmaciones verificadas',
          ],
        ]}
      />

      <Grid>
        <Cell span={6} label="La valoración, criterio a criterio">
          <Bars
            max={10}
            rows={criterionIds.map((id) => {
              const value = a.nota.criterios[id];
              return {
                label: `${criteria[id].name} (${criteria[id].weight} %)`,
                value,
                display: decimal(value),
              };
            })}
          />
          <p className="m-0 text-sm text-muted-foreground">
            Entre paréntesis, lo que pesa cada criterio. Si dos valoraciones se solapan con su
            margen, es un empate.{' '}
            <Link href={interviewsHref('metodologia')} className="underline underline-offset-4">
              Cómo se calcula
            </Link>
            .
          </p>
        </Cell>
        <Cell span={6} label="Tiempo por tema">
          <Bars
            rows={topicShare(a)
              .slice(0, 6)
              .map((t) => ({ label: t.topic, value: t.share, display: `${t.share} %` }))}
          />
        </Cell>
        <Cell span={6} label="Cómo responde">
          <Bars
            rows={Object.entries(answers).map(([id, name]) => {
              const value = a.preguntas.filter((p) => p.respuesta === id).length;
              return { label: name, value, display: String(value) };
            })}
          />
          <p className="m-0 text-sm text-muted-foreground">
            {a.preguntas.filter((p) => p.repregunta).length} repreguntas: el entrevistador insiste
            porque no le han contestado.
          </p>
        </Cell>
        <Cell span={6} label="Las afirmaciones verificadas">
          <Bars
            rows={Object.entries(verdicts).map(([id, v]) => {
              const value = a.revisiones.filter((r) => r.veredicto === id).length;
              return { label: v.name, value, display: String(value), color: v.color };
            })}
          />
        </Cell>
      </Grid>

      <ReportSection title="Minuto a minuto">
        <InterviewPlayer
          youtubeId={a.youtubeId}
          duration={a.duracion}
          segments={a.segmentos}
          speakers={{
            jordi: a.entrevista?.entrevistador ?? 'Entrevistador',
            candidato: candidate?.name ?? 'Candidato',
            verificador: 'Verificadores',
            otro: 'Otra persona',
          }}
          marks={marks(a)}
          lanes={lanes}
        />
      </ReportSection>

      <ReportSections interview={a} />

      <div className="grid gap-6">
        <Explore
          links={[
            { href: interviewsHref(), text: 'Las cuatro entrevistas' },
            { href: interviewsHref('metodologia'), text: 'Cómo se revisan' },
          ]}
        />
        {candidate && <PhotoCredits people={[candidate]} />}
      </div>
    </>
  );
}

// Una verificación sola, para enlazarla o compartirla.
export function VerificationPage({
  interview: a,
  verification: r,
}: {
  interview: Interview;
  verification: Interview['revisiones'][number];
}) {
  const video = videoUrl(a, r.segundo);
  const candidate = getCandidate(a.candidato);
  return (
    <>
      {a.ficticio && (
        <Notice>
          <b className="font-medium">Ejemplo con un candidato ficticio y datos inventados.</b>
        </Notice>
      )}
      <Grid>
        <Cell span={8} label={`Verificación · minuto ${minute(r.segundo)}`}>
          {candidate ? (
            <CandidateLine candidate={candidate} />
          ) : (
            <p className="m-0 font-medium">{interviewName(a)}</p>
          )}
          <blockquote className="m-0 font-heading text-[32px] leading-[1.15] lg:text-[44px]">
            «{r.cita}»
          </blockquote>
          <p className="m-0 max-w-[65ch] text-lg leading-relaxed text-muted-foreground">
            {r.explicacion}
          </p>
          <div className="grid gap-2 border-t border-border pt-6">
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl">
              <Verdict id={r.veredicto} />
              <span className="text-base text-muted-foreground">{verdicts[r.veredicto].text}</span>
            </p>
            {r.pilladoEnDirecto && (
              <p className="m-0 text-sm text-muted-foreground">
                Lo señalaron en directo durante la entrevista.
              </p>
            )}
          </div>
          <Sources items={r.fuentes} />
          {video && <Source url={video}>Verlo en el vídeo, minuto {minute(r.segundo)}</Source>}
        </Cell>
      </Grid>
      <div className="mt-8">
        <Explore links={[{ href: interviewsHref(a.id), text: 'El informe completo' }]} />
      </div>
    </>
  );
}

type Metric = {
  name: string;
  // El tope de la escala, igual para los cuatro; si alguien lo pasa, la escala crece para todos.
  max: number;
  value: (a: Interview) => number;
  display?: (a: Interview) => string;
  // Lo que va junto al nombre: el margen de la valoración.
  aside?: (a: Interview) => string;
};
const count = (filter: (a: Interview) => unknown[]) => (a: Interview) => filter(a).length;
const metricGroups: { title: string; metrics: Metric[] }[] = [
  {
    title: 'La valoración',
    metrics: [
      {
        name: 'Valoración, sobre 10, con su margen',
        max: 10,
        value: (a) => a.nota.global,
        display: (a) => decimal(a.nota.global),
        aside: (a) => `± ${decimal(a.nota.margen)}`,
      },
      ...criterionIds.map((id) => ({
        name: `${criteria[id].name} (${criteria[id].weight} %)`,
        max: 10,
        value: (a: Interview) => a.nota.criterios[id],
        display: (a: Interview) => decimal(a.nota.criterios[id]),
      })),
    ],
  },
  {
    title: 'Cómo responde',
    metrics: [
      {
        name: 'Respuestas al grano',
        max: 100,
        value: (a) => a.stats.alGrano,
        display: (a) => `${a.stats.alGrano} %`,
      },
      {
        name: 'Evasivas y cambios de tema',
        max: 20,
        value: count((a) =>
          a.preguntas.filter((p) => p.respuesta === 'evasiva' || p.respuesta === 'cambio'),
        ),
      },
      {
        name: 'Repreguntas',
        max: 20,
        value: count((a) => a.preguntas.filter((p) => p.repregunta)),
      },
      {
        name: 'Tiempo de palabra del candidato',
        max: 100,
        value: (a) => speakingShare(a, 'candidato'),
        display: (a) => `${speakingShare(a, 'candidato')} %`,
      },
    ],
  },
  {
    title: 'Las propuestas',
    metrics: [
      {
        name: 'Propuestas completas',
        max: 10,
        value: count((a) => a.propuestas.filter((p) => proposalScore(p) === 4)),
      },
      {
        name: 'Casi completas',
        max: 10,
        value: count((a) => a.propuestas.filter((p) => proposalScore(p) === 3)),
      },
    ],
  },
  {
    title: 'Las verificaciones',
    metrics: Object.entries(verdicts).map(([id, v]) => ({
      name: v.name,
      max: 15,
      value: count((a) => a.revisiones.filter((r) => r.veredicto === id)),
    })),
  },
  {
    title: 'El tono',
    metrics: [
      {
        name: 'Críticas políticas',
        max: 20,
        value: count((a) => a.ataques.filter((x) => x.tipo === 'politica')),
      },
      {
        name: 'Ataques personales',
        max: 20,
        value: count((a) => a.ataques.filter((x) => x.tipo === 'personal')),
      },
      {
        name: 'Interrumpe',
        max: 20,
        value: count((a) => a.interrupciones.filter((x) => x.quien === 'candidato')),
      },
    ],
  },
  {
    title: 'Cómo le trató el entrevistador',
    metrics: [
      {
        name: 'Tiempo de palabra del entrevistador',
        max: 100,
        value: (a) => speakingShare(a, 'jordi'),
        display: (a) => `${speakingShare(a, 'jordi')} %`,
      },
      {
        name: 'Le interrumpe',
        max: 20,
        value: count((a) => a.interrupciones.filter((x) => x.quien === 'jordi')),
      },
      {
        name: 'Duración',
        max: 90,
        value: (a) => Math.round(a.duracion / 60),
        display: (a) => `${Math.round(a.duracion / 60)} min`,
      },
    ],
  },
];

// Las cuatro entrevistas de una ronda, con la misma escala y siempre en el mismo orden. Solo se
// comparan cuando están las cuatro: con una menos, la comparación no sería justa.
export function InterviewsCompare() {
  const round = rounds[0];
  const entries = roundInterviews(round.id);
  const all = entries.flatMap(({ candidate, interview }) =>
    interview ? [{ candidate, interview }] : [],
  );
  return (
    <>
      <ReportIntro title="Los cuatro, lado a lado">
        <p>
          Las cuatro entrevistas de {round.title}, del {longDate(round.date)}, con la misma escala y
          siempre en el mismo orden. No hay ganador: cada cifra se lee por separado.
        </p>
      </ReportIntro>
      {all.length < entries.length ? (
        <Grid>
          <Cell span={7} label="Pendiente">
            <p className="m-0 max-w-[60ch]">
              Se comparan cuando estén publicadas y revisadas las cuatro entrevistas de la ronda.
            </p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {entries.map(({ candidate, interview }) => (
                <li key={candidate.slug} className="flex items-center gap-3">
                  <Portrait candidate={candidate} kind="avatar" sizes="80px" className="size-10" />
                  <span className="font-medium">{candidate.name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {interview ? 'Publicada' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          </Cell>
        </Grid>
      ) : (
        metricGroups.map((group) => (
          <ReportSection key={group.title} title={group.title}>
            <Grid>
              {group.metrics.map((m) => {
                const values = all.map(({ interview }) => m.value(interview));
                return (
                  <Cell key={m.name} span={6} label={m.name}>
                    <Bars
                      max={Math.max(m.max, ...values)}
                      rows={all.map(({ candidate, interview }, i) => ({
                        label: m.aside ? `${candidate.name} ${m.aside(interview)}` : candidate.name,
                        value: values[i] ?? 0,
                        display: m.display?.(interview) ?? String(values[i]),
                        color: candidate.color,
                      }))}
                    />
                  </Cell>
                );
              })}
            </Grid>
          </ReportSection>
        ))
      )}
      <div className="mt-6 grid gap-6">
        <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
          Las cifras son totales de cada entrevista. Si dos valoraciones se solapan con su margen,
          es un empate.{' '}
          <Link href={interviewsHref('metodologia')} className="underline underline-offset-4">
            Cómo se calcula
          </Link>
          .
        </p>
        <PhotoCredits people={entries.map((e) => e.candidate)} />
      </div>
    </>
  );
}

const rules = [
  ['Propuesta completa', 'Dice qué, cuánto, cuándo y cómo'],
  ['Casi completa', 'Dice tres de esas cuatro cosas'],
  ['Repregunta', 'El entrevistador insiste porque no le han contestado'],
  ['Evasiva', 'Respuesta evasiva o cambio de tema'],
  ['Crítica política', 'Crítica a la política de otro'],
  ['Ataque personal', 'Ataque personal o descalificación'],
  ['Interrumpe', 'El candidato corta a quien habla antes de que termine'],
  ['Le interrumpen', 'El entrevistador corta al candidato antes de que termine'],
  ['Momento clave', 'Anuncio, choque, titular o rectificación, aprobado por una persona'],
];

const fairness = [
  [
    'Escalas absolutas',
    'Cada criterio tiene ejemplos fijos de lo que es un 0, un 5 y un 10. Nadie suspende solo por quedar el último.',
  ],
  [
    'Normalizado',
    'Se cuenta por pregunta y por hora, nunca en totales: las entrevistas duran distinto.',
  ],
  [
    'Muestras pequeñas',
    'Con pocas afirmaciones comprobables, la valoración se acerca al centro en lugar de dispararse.',
  ],
  ['Mismo análisis', 'Mismo modelo, misma versión y mismas instrucciones para los cuatro.'],
  ['Margen de error', 'Cada valoración lleva su margen. Si dos se solapan, es un empate.'],
  [
    'Solo lo comparable',
    'Solo se ponen lado a lado entrevistas de la misma ronda, con el mismo formato.',
  ],
];

export function InterviewsMethod() {
  return (
    <>
      <ReportIntro title="Cómo se revisan las entrevistas">
        <p>
          Se mide cómo responde cada candidato, no si tiene razón: rigor, claridad y sustancia, con
          los mismos criterios para los cuatro. La IA acelera el trabajo; las personas deciden.
        </p>
      </ReportIntro>
      <Grid>
        <Cell span={7} label="La valoración sobre 10">
          <ul className="m-0 grid list-none gap-4 p-0">
            {Object.values(criteria).map((c) => (
              <li
                key={c.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <span>
                  <b className="font-medium">{c.name}.</b>{' '}
                  <span className="text-muted-foreground">{c.text}.</span>
                </span>
                <span className="font-mono tabular-nums">{c.weight} %</span>
              </li>
            ))}
          </ul>
        </Cell>
        <Cell span={5} label="Las calificaciones">
          <VerdictList />
          <p className="m-0 text-sm text-muted-foreground">
            Cada afirmación comprobable se contrasta con fuentes oficiales (INE, Eurostat, Banco de
            España, BOE, Seguridad Social, CIS, ministerios) y se publica con sus enlaces. Ninguna
            sale sin que una persona la confirme ni sin al menos una fuente.
          </p>
        </Cell>
        <Cell span={7} label="Lo que se marca en cada entrevista">
          <dl className="m-0 grid gap-3">
            {rules.map(([name, text]) => (
              <div
                key={name}
                className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 max-sm:grid-cols-1 max-sm:gap-0"
              >
                <dt className="font-medium">{name}</dt>
                <dd className="m-0 text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </Cell>
        <Cell span={5} label="Los momentos clave">
          <dl className="m-0 grid gap-3">
            {Object.values(moments).map((m) => (
              <div key={m.name}>
                <dt className="font-medium">{m.name}</dt>
                <dd className="m-0 text-muted-foreground">{m.text}.</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-sm text-muted-foreground">
            Los propone la IA con una cita literal y una persona los aprueba. Se eligen por su
            interés informativo, nunca por si favorecen o perjudican a alguien.
          </p>
        </Cell>
      </Grid>

      <ReportSection title="Para que sea comparable">
        <Grid>
          {fairness.map(([title, text], i) => (
            <Cell key={title} span={4} label={String(i + 1).padStart(2, '0')}>
              <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{title}</h3>
              <p className="m-0 text-muted-foreground">{text}</p>
            </Cell>
          ))}
        </Grid>
      </ReportSection>

      <Grid>
        <Cell span={6} label="Qué entrevistas se revisan">
          <p className="m-0 max-w-[60ch]">
            Por rondas: siempre los cuatro candidatos a la vez, nunca uno solo. Entrevistas
            individuales y largas (30 minutos o más), en un medio de alcance nacional, publicadas
            íntegras y en la misma semana. Si falta alguno de los cuatro, la ronda no se publica.
          </p>
        </Cell>
        <Cell span={6} label="Independencia y correcciones">
          <p className="m-0 max-w-[60ch]">
            Esta sección no tiene relación con los medios cuyas entrevistas analiza ni con ningún
            partido, y los cuatro candidatos reciben el mismo tratamiento. Si hay un error, se
            corrige a la vista, con la fecha y el motivo.
          </p>
        </Cell>
      </Grid>
    </>
  );
}
