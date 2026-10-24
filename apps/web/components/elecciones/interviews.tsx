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
  comparableRound,
  interviewerOf,
  outlet,
  pendingRound,
  perMinute,
  roundInterviews,
  roundOf,
  speakingShare,
  speech,
  rounds,
  topicShare,
  verdictIds,
  verdicts,
  videoUrl,
  type Candidate,
  type Interview,
  type Mark,
} from '../../lib/elecciones/interviews';
import { electionsHref } from '../../lib/elecciones/pages';
import { Icon, type IconName } from '../brand/icon';
import { AI, Source } from '../congreso/common';
import { InterviewPlayer } from './interview-player';
import { IconChip, MarkIcon, markIcons } from './mark-icon';
import { PhotoCredits, Portrait } from './portrait';
import { Bars, Cell, Explore, Grid, Label, ReportIntro, ReportSection, Stat } from './report';

export const interviewsHref = (path = '') => electionsHref(`entrevistas${path ? `/${path}` : ''}`);

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

// La calificación con su icono y su nombre: el color solo acompaña.
function Verdict({ id }: { id: keyof typeof verdicts }) {
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <MarkIcon kind={id} color={verdicts[id].color} />
      {verdicts[id].name}
    </span>
  );
}

// Una etiqueta con el icono de su marca delante.
function MarkLabel({
  kind,
  color,
  children,
}: {
  kind: Mark['kind'];
  color?: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <MarkIcon kind={kind} color={color} className="size-6" />
      {children}
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
  const upcoming = pendingRound();
  const compared = comparableRound();
  const complete = !!compared && roundInterviews(compared.id).every((e) => e.interview);
  const status = upcoming
    ? roundInterviews(upcoming.id).some((e) => e.interview)
      ? `En revisión · ${upcoming.title}`
      : `Próxima ronda · ${shortDay(upcoming.date)}`
    : 'Rondas publicadas';
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
              Sus entrevistas largas en medios nacionales, revisadas una a una: qué afirman y si es
              cierto, qué proponen y si responden a lo que se les pregunta. Cada informe trae una
              valoración sobre 10, con sus criterios y sus pesos a la vista.
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
        <Cell span={5} label="Las rondas">
          <ol className="m-0 grid list-none gap-5 p-0">
            {[...rounds]
              .sort((x, y) => y.date.localeCompare(x.date))
              .map((r) => {
                const published = roundInterviews(r.id).filter((e) => e.interview).length;
                return (
                  <li
                    key={r.id}
                    className="grid gap-1 border-b border-border pb-5 last:border-0 last:pb-0"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <b className="font-heading text-2xl font-normal">{r.title}</b>
                      <span className="font-mono text-sm text-muted-foreground tabular-nums">
                        {shortDay(r.date)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">{r.text}</span>
                    <span className="mt-1 text-sm">
                      {published} de {candidates.length} entrevistas publicadas
                      {r.comparable ? '' : ` · ${r.note ?? 'No se comparan entre sí'}`}
                    </span>
                  </li>
                );
              })}
          </ol>
        </Cell>
      </Grid>

      <ReportSection title="Los cuatro candidatos">
        <Grid>
          {candidates.map((c) => {
            const latest = interviewsOf(c.slug)[0];
            const next = pendingRound(c.slug);
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
                      : next
                        ? `Pendiente · ${shortDay(next.date)}`
                        : 'Sin entrevistas'}
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
          <ul className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
            {a.revisiones.map((r) => (
              <li key={r.id} className="grid">
                <Cell className="gap-4">
                  <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Verdict id={r.veredicto} />
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      minuto {minute(r.segundo)}
                    </span>
                  </p>
                  <blockquote className="m-0 font-heading text-xl leading-snug">
                    «{r.cita}»
                  </blockquote>
                  <p className="m-0 text-muted-foreground">{r.explicacion}</p>
                  <Sources items={r.fuentes} />
                  <Link
                    href={interviewsHref(`${a.id}/${r.id}`)}
                    className="mt-auto self-start text-sm underline underline-offset-4"
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
              <Cell
                key={m.id}
                span={4}
                label={
                  <MarkLabel kind="momento">
                    {moments[m.tipo].name} · {minute(m.segundo)}
                  </MarkLabel>
                }
              >
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
                  label={
                    score >= 3 ? (
                      <MarkLabel kind={score === 4 ? 'completa' : 'casi'}>
                        {score === 4 ? 'Propuesta completa' : 'Casi completa'} · {minute(p.segundo)}
                      </MarkLabel>
                    ) : (
                      `Propuesta · ${minute(p.segundo)}`
                    )
                  }
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
                    <MarkLabel kind={x.tipo === 'personal' ? 'ataque' : 'critica'}>
                      {x.tipo === 'personal' ? 'Ataque personal' : 'Crítica política'} · a{' '}
                      {x.objetivo} · {minute(x.segundo)}
                    </MarkLabel>
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
  const who = interviewerOf(a) ?? 'el entrevistador';
  // Cada cifra con su barra, sobre una escala fija e igual para los cuatro.
  type Row = { name: string; value: number | null; scale: number; unit?: string; digits?: number };
  const rows = (items: Row[]) => (
    <dl className="m-0 grid gap-5">
      {items.map(({ name, value, scale, unit, digits = 0 }) => (
        <div key={name} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="m-0 font-heading text-2xl tabular-nums">
              {value == null ? '—' : decimal(value, digits)}
              {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
            </dd>
          </div>
          <span aria-hidden="true" className="relative h-1.5 rounded-full bg-muted">
            <i
              className="absolute inset-y-0 left-0 rounded-full bg-foreground"
              style={{ width: `${Math.min(1, (value ?? 0) / scale) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </dl>
  );
  return (
    <ReportSection title="Su perfil">
      <Grid>
        <Cell span={6} label="Cómo habla">
          {rows([
            { name: 'Ritmo', value: s.pace, scale: 300, unit: 'palabras/min' },
            { name: 'Muletillas', value: s.fillers, scale: 10, unit: 'por minuto', digits: 1 },
            { name: 'Titubeos', value: s.stutters, scale: 10, unit: 'por minuto', digits: 1 },
            {
              name: 'Pausa antes de responder',
              value: s.pause,
              scale: 2,
              unit: 'segundos',
              digits: 1,
            },
          ])}
          {s.top.length > 0 && (
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Las que más repite:</span>
              {s.top.map(([word, n]) => (
                <span key={word} className="rounded-full px-3 py-1 ring-1 ring-border">
                  «{word}» <span className="text-muted-foreground tabular-nums">× {n}</span>
                </span>
              ))}
            </p>
          )}
          <p className="m-0 text-sm text-muted-foreground">
            Señales observables en la transcripción, no un diagnóstico: no dicen si alguien está
            nervioso ni si es sincero.
          </p>
        </Cell>
        <Cell span={6} label={`Cómo le trató ${who}`}>
          {rows([
            { name: 'Tiempo de palabra del entrevistador', value: i.share, scale: 100, unit: '%' },
            { name: 'Preguntas por minuto', value: i.questionsPerMinute, scale: 3, digits: 1 },
            { name: 'Repreguntas', value: i.followUps, scale: 20 },
            { name: 'Veces que le corta', value: i.cuts, scale: 20 },
            { name: 'Palabras por pregunta', value: i.wordsPerQuestion, scale: 60 },
          ])}
          <p className="m-0 text-sm text-muted-foreground">
            Mismas reglas y escalas para los cuatro.
          </p>
        </Cell>
      </Grid>
    </ReportSection>
  );
}

const times = (n: number) => `${n} ${n === 1 ? 'vez' : 'veces'}`;

export function InterviewReport({ interview: a }: { interview: Interview }) {
  const interrupts = a.interrupciones.filter((x) => x.quien === 'candidato').length;
  const cuts = a.interrupciones.filter((x) => x.quien === 'jordi').length;
  const complete = a.propuestas.filter((p) => proposalScore(p) === 4).length;
  const video = videoUrl(a);
  const where = outlet(a);
  const who = interviewerOf(a);
  const round = roundOf(a);
  const candidate = getCandidate(a.candidato);
  return (
    <>
      {a.ficticio && (
        <Notice>
          <b className="font-medium">Ejemplo con un candidato ficticio y datos inventados.</b> Así
          será el informe de cada entrevista real.
        </Notice>
      )}
      <header className="mb-12 grid justify-items-start gap-6">
        {candidate && (
          <Link
            href={interviewsHref(candidate.slug)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <Icon name="izquierda" size={14} /> Ficha de {candidate.name}
          </Link>
        )}
        <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="text-foreground">
            {[where, formatDate(a.publicado.slice(0, 10), { day: 'numeric', month: 'long' })]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {who && <span>Con {who}</span>}
          {round && <span>Ronda: {round.title}</span>}
          {video && (
            <a
              href={video}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ver el original<span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          )}
        </p>
        <div className="flex items-center gap-5 max-sm:gap-4">
          {candidate && (
            <Portrait
              candidate={candidate}
              kind="avatar"
              sizes="192px"
              className="size-20 shrink-0 md:size-24"
            />
          )}
          <div className="grid gap-2">
            {candidate && (
              <p className="m-0 flex items-center gap-2 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                <Dot color={candidate.color} />
                <b className="font-medium text-foreground">{candidate.short}</b> · {candidate.party}
              </p>
            )}
            <h1 className="m-0 font-heading text-4xl leading-[1.05] font-normal lg:text-[60px]">
              {interviewName(a)}
              {candidate && <span className="text-muted-foreground"> · la entrevista</span>}
            </h1>
          </div>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-10 gap-y-5">
          {(
            [
              [
                a.pending ? 'Valoración provisional' : 'Valoración',
                decimal(a.nota.global),
                `± ${decimal(a.nota.margen)}`,
              ],
              ['Al grano', `${a.stats.alGrano} %`],
              ['Verificaciones', String(a.revisiones.length)],
              ['Propuestas completas', String(complete)],
              ['Duración', minute(a.duracion)],
            ] as const
          ).map(([name, value, aside]) => (
            <div key={name} className="grid gap-1">
              <dt>
                <Label>{name}</Label>
              </dt>
              <dd className="m-0 font-heading text-4xl leading-none tabular-nums">
                {value}
                {aside && <span className="ml-1.5 text-base text-muted-foreground">{aside}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {a.pending > 0 && (
          <p className="m-0 inline-flex items-center gap-2 rounded-2xl border border-dashed border-foreground/30 px-3.5 py-1.5 text-sm sm:rounded-full">
            <i aria-hidden="true" className="block size-1.5 shrink-0 rounded-full bg-foreground" />
            Quedan {a.pending} afirmaciones o momentos por revisar. La valoración puede cambiar
            según se aprueben.
          </p>
        )}
        {round && !round.comparable && (
          <p className="m-0 text-sm text-muted-foreground">
            Ronda «{round.title}»: {round.note ?? 'formatos distintos'}. Sus cifras no se comparan
            con las de los demás.
          </p>
        )}
        <p className="m-0 text-sm text-muted-foreground">
          Temas con más tiempo:{' '}
          {topicShare(a)
            .slice(0, 3)
            .map((t) => `${t.topic} (${t.share} %)`)
            .join(' · ')}
        </p>
      </header>

      <ReportSection title="Minuto a minuto">
        <InterviewPlayer
          youtubeId={a.youtubeId}
          source={a.youtubeId ? null : video}
          outlet={where}
          duration={a.duracion}
          segments={a.segmentos}
          speakers={{
            jordi: interviewerOf(a) ?? 'Entrevistador',
            candidato: candidate?.name ?? 'Candidato',
            verificador: 'Verificadores',
            otro: 'Otra persona',
          }}
          marks={marks(a)}
          lanes={lanes}
          minutes={perMinute(a)}
          topics={a.temas}
          color={candidate?.color ?? 'var(--foreground)'}
        />
      </ReportSection>

      <ReportSection title="Las cifras de la entrevista">
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
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5">
              {verdictIds.map((id) => (
                <div key={id} className="flex items-center gap-3">
                  <MarkIcon kind={id} color={verdicts[id].color} className="size-10" />
                  <span className="grid">
                    <dt className="text-sm text-muted-foreground">{verdicts[id].name}</dt>
                    <dd className="m-0 font-heading text-3xl leading-none tabular-nums">
                      {a.revisiones.filter((r) => r.veredicto === id).length}
                    </dd>
                  </span>
                </div>
              ))}
            </dl>
          </Cell>
          <Cell span={6} label="Quién tiene la palabra">
            <Bars
              max={100}
              rows={[
                {
                  label: interviewName(a),
                  value: speakingShare(a, 'candidato'),
                  color: candidate?.color,
                },
                {
                  label: who ?? 'El entrevistador',
                  value: speakingShare(a, 'jordi'),
                  color: 'var(--muted-foreground)',
                },
                {
                  label: 'Otras personas',
                  value: 100 - speakingShare(a, 'candidato') - speakingShare(a, 'jordi'),
                  color: 'var(--border)',
                },
              ].map((row) => ({ ...row, display: `${row.value} %` }))}
            />
          </Cell>
          <Cell span={6} label={`Lo que concretan sus ${a.propuestas.length} propuestas`}>
            <Bars
              max={100}
              rows={(
                [
                  ['que', 'Qué'],
                  ['cuanto', 'Cuánto'],
                  ['cuando', 'Cuándo'],
                  ['como', 'Cómo'],
                ] as const
              ).map(([key, label]) => {
                const value = a.propuestas.length
                  ? Math.round(
                      (a.propuestas.filter((p) => p[key]).length / a.propuestas.length) * 100,
                    )
                  : 0;
                return { label, value, display: `${value} %` };
              })}
            />
            <p className="m-0 text-sm text-muted-foreground">
              Qué parte de sus propuestas lo dice de forma explícita.
            </p>
          </Cell>
          <Cell label="A quién critica">
            <Bars
              rows={[...new Set(a.ataques.map((x) => x.objetivo))].map((target) => {
                const value = a.ataques.filter((x) => x.objetivo === target).length;
                return { label: `A ${target}`, value, display: String(value) };
              })}
            />
            <p className="m-0 text-sm text-muted-foreground">
              Interrumpe {times(interrupts)}; el entrevistador le corta {times(cuts)}.
            </p>
          </Cell>
        </Grid>
      </ReportSection>

      <ReportSections interview={a} />

      <div className="grid gap-6">
        <Explore
          links={[
            { href: interviewsHref(), text: 'Todas las entrevistas' },
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
  // Su icono y su color, si es una marca (las calificaciones).
  kind?: Mark['kind'];
  color?: string;
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
    metrics: verdictIds.map((id) => ({
      name: verdicts[id].name,
      kind: id,
      color: verdicts[id].color,
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
  const round = comparableRound();
  if (!round)
    return (
      <ReportIntro title="Los cuatro, lado a lado">
        <p>
          Solo se ponen lado a lado las rondas con el mismo formato para los cuatro. Todavía no hay
          ninguna.
        </p>
      </ReportIntro>
    );
  const entries = roundInterviews(round.id);
  const all = entries.flatMap(({ candidate, interview }) =>
    interview ? [{ candidate, interview }] : [],
  );
  return (
    <>
      <ReportIntro title="Los cuatro, lado a lado">
        <p>
          Las cuatro entrevistas de {round.title}, del {longDate(round.date)}, con la misma escala y
          siempre en el mismo orden. No hay ganador: cada cifra se lee por separado. Las rondas con
          formatos distintos no se comparan.
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
                  <Cell
                    key={m.name}
                    span={6}
                    label={
                      m.kind ? (
                        <MarkLabel kind={m.kind} color={m.color}>
                          {m.name}
                        </MarkLabel>
                      ) : (
                        m.name
                      )
                    }
                  >
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
