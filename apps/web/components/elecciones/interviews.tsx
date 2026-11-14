import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Badge } from '@reforma-digital/design/ui/badge';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { decimal, formatDate, longDate, minute } from '../../lib/elecciones/format';
import {
  allVerifications,
  answerIds,
  checkable,
  handReviewed,
  topicAt,
  directShare,
  dodges,
  followUps,
  answers,
  criteria,
  criterionIds,
  getCandidate,
  interviewName,
  intensityScale,
  interviewer,
  interviewsOf,
  communicationLanes,
  lanes,
  marks,
  moments,
  proposalKind,
  proposalKinds,
  proposalScore,
  unreviewed,
  commonQuestions,
  comparableRound,
  cancelledRound,
  compareRound,
  interviewerOf,
  outlet,
  pendingRound,
  publishedDay,
  perMinute,
  roundInterviews,
  roundOf,
  speakingShare,
  speech,
  rounds,
  topicShare,
  topicsOf,
  criticTargets,
  interruptions,
  verdictIds,
  visualIds,
  visuals,
  verdicts,
  videoUrl,
  type Interview,
  type Mark,
} from '../../lib/elecciones/interviews';
import { candidates, type Candidate } from '../../lib/elecciones/candidates';
import {
  commitmentDetail,
  communicationMarks,
  communicationPath,
  getCommunication,
  hardnessNames,
  pressure,
  replyIds,
  replyNames,
  type Communication,
} from '../../lib/elecciones/communication';
import { electionsHref } from '../../lib/elecciones/pages';
import { Icon, type IconName } from '../brand/icon';
import { AI, Source } from '../congreso/common';
import {
  CompareBoard,
  type Common,
  type Figure,
  type Footprint,
  type Person,
} from './compare-board';
import { InterviewPlayer } from './interview-player';
import {
  answerMarks,
  IconChip,
  MarkIcon,
  markIcons,
  replyMarks,
  type AnswerMark,
} from './mark-icon';
import { PageIndex } from './page-index';
import { PhotoCredits, Portrait } from './portrait';
import { ScoreSimulator } from './score-simulator';
import { ShareButton } from './share-button';
import { DaysUntil } from './days-until';
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

// Lo que aún no ha pasado la segunda revisión de IA: se publica, pero avisado.
function Unreviewed({ estado }: { estado: string }) {
  if (estado !== 'propuesta') return null;
  return (
    <Badge variant="outline" className="font-mono uppercase">
      Sin revisar
    </Badge>
  );
}

// Cuánto se ha revisado, en una barra corta. Decorativa: el texto de al lado da las cifras.
export function ReviewBar({ review }: { review: Interview['review'] }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted"
    >
      <span
        className="block h-full origin-left rounded-full bg-foreground"
        style={{ transform: `scaleX(${review.total ? review.reviewed / review.total : 1})` }}
      />
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

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Card className="mb-8 bg-muted p-5 text-base ring-0" role="note">
      <p className="m-0">{children}</p>
    </Card>
  );
}

function Sources({ items }: { items: { titulo: string; url: string }[] }) {
  if (!items.length) return null;
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

// El proceso, con lo que hace la IA en cada paso. Lo comprueba una segunda pasada de IA y, si algo no
// cuadra al contrastarlo con el análisis de comunicación, una persona; la web lo dice así.
const steps: { title: string; text: string; ai?: boolean }[] = [
  {
    title: 'Transcripción',
    text: 'La entrevista entera, sin cortes: quién habla y en qué segundo, comprobado con los subtítulos de YouTube.',
    ai: true,
  },
  {
    title: 'Análisis',
    text: 'Temas, cifras, críticas a otros e interrupciones.',
    ai: true,
  },
  {
    title: 'Contraste con fuentes',
    text: 'Cada dato se busca en el INE, Eurostat, el BOE o el Banco de España.',
    ai: true,
  },
  {
    title: 'Segunda revisión',
    text: 'Otra pasada de IA abre cada fuente y confirma, corrige o descarta la calificación. Las que no cuadran con el análisis de comunicación se revisan a mano.',
    ai: true,
  },
  {
    title: 'Análisis de comunicación',
    text: 'Cada pregunta, por lo dura que es y por cómo se responde; cada compromiso, por si se podrá comprobar; y la voz, las pausas y las trabas, con las mismas medidas para todos.',
    ai: true,
  },
  {
    title: 'El informe',
    text: 'Cada calificación con su explicación y sus fuentes, y una valoración sobre 10 con los criterios a la vista.',
  },
];

// «13 nov»: el día y el mes de una fecha ISO.
export const shortDay = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });

// Lo que trae cada informe, con los mismos iconos que su línea de tiempo.
const features: { icon: IconName; color?: string; title: string; text: string }[] = [
  {
    icon: markIcons.legal,
    color: verdicts.legal.color,
    title: 'Si dice la verdad',
    text: 'Cada dato que se puede comprobar, calificado y con la fuente oficial enlazada.',
  },
  {
    icon: markIcons.dura,
    title: 'Si contesta a lo que le preguntan',
    text: 'Cada pregunta, por lo dura que es y por cómo responde: a lo preguntado, en parte, con otra pregunta o cambiando de tema.',
  },
  {
    icon: markIcons.comprobable,
    title: 'A qué se compromete',
    text: 'Cada compromiso con su cita: si se podrá comprobar, y si dice cuándo y con qué condición.',
  },
  {
    icon: markIcons.critica,
    title: 'Si propone o critica',
    text: 'Qué respuestas proponen algo propio y cuáles critican a otros, y si critica políticas o ataca a personas.',
  },
  {
    icon: 'volumen',
    title: 'Cómo lo dice',
    text: 'El reparto de la palabra, la voz, las pausas y las trabas, en un análisis de comunicación aparte. Nada de esto sirve para saber si alguien miente.',
  },
  {
    icon: 'documento',
    title: 'Minuto a minuto',
    text: 'El vídeo con su línea de tiempo (momentos clave, verificaciones, compromisos y preguntas sin respuesta clara) y la transcripción completa.',
  },
];

export function InterviewsHome() {
  const upcoming = pendingRound();
  const compared = comparableRound();
  const complete =
    !!compared && roundInterviews(compared.id).every((e) => e.interview || e.cancelled);
  const status = upcoming ? (
    roundInterviews(upcoming.id).some((e) => e.interview) ? (
      `En revisión · ${upcoming.title}`
    ) : (
      <>
        Próxima ronda · {shortDay(upcoming.date)}
        <DaysUntil date={upcoming.date} />
      </>
    )
  ) : (
    'Rondas publicadas'
  );
  return (
    <>
      <Grid>
        <div className="col-span-12 flex flex-col items-center gap-10 pt-4 pb-12 text-center lg:pt-8 lg:pb-16">
          <div className="grid justify-items-center gap-4">
            <Badge className="font-mono uppercase">{status}</Badge>
            <h1 className="m-0 max-w-[18ch] font-heading text-4xl leading-[1.08] font-normal lg:text-[56px]">
              Qué dicen los candidatos y si es verdad
            </h1>
            <p className="m-0 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              La IA analiza sus entrevistas largas: busca cada dato que dan en fuentes oficiales y
              les pone una valoración sobre 10, con los criterios a la vista.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={interviewsHref(complete ? 'comparar' : 'ejemplo')}
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
            >
              {complete ? 'Comparar las entrevistas' : 'Ver un ejemplo'}{' '}
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
        </div>
        <Cell label="Las rondas">
          <ol className="m-0 grid list-none gap-5 p-0">
            {[...rounds]
              .sort((x, y) => y.date.localeCompare(x.date))
              .map((r) => {
                const entries = roundInterviews(r.id);
                const published = entries.filter((e) => e.interview).length;
                const cancelled = entries.filter((e) => e.cancelled).map((e) => e.candidate.name);
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
                    <span className="max-w-[65ch] text-muted-foreground">{r.text}</span>
                    <span className="mt-1 text-sm">
                      {published} de {entries.length - cancelled.length} publicadas
                      {cancelled.length > 0 && ` · Cancelada la de ${cancelled.join(' y la de ')}`}
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
            const cancelled = cancelledRound(c.slug);
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
                        : cancelled
                          ? `Cancelada · ${cancelled.title}`
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
            <p className="m-0">Ordenados de menos a más escaños en las generales de 2023.</p>
          </PhotoCredits>
        </div>
      </ReportSection>

      <ReportSection title="Qué trae cada informe">
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
                    {step.ai && (
                      <Badge variant="outline" className="font-mono uppercase">
                        IA
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
          <Cell label="Las calificaciones">
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
type Verification = Interview['revisiones'][number];

// Una verificación en una tarjeta: en el informe, sin el nombre; en la lista de todas, con él.
function VerificationCard({
  interview: a,
  verification: r,
  named,
}: {
  interview: Interview;
  verification: Verification;
  named?: boolean;
}) {
  const day = publishedDay(a);
  const candidate = getCandidate(a.candidato);
  const color = verdicts[r.veredicto].color;
  return (
    <Cell className="gap-0 overflow-hidden p-0 lg:p-0 max-sm:p-0">
      {/* La calificación, en una franja con su color: se distingue de un vistazo en la lista. */}
      <p
        className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3.5 max-sm:px-5"
        style={{ background: `color-mix(in oklab, ${color} 12%, var(--background))` }}
      >
        <Verdict id={r.veredicto} />
        <Unreviewed estado={r.estado} />
        <span className="ml-auto">
          <Jump interview={a} second={r.segundo} />
        </span>
      </p>
      <div className="grid flex-1 content-start gap-4 p-6 max-sm:p-5">
        {named && (
          <div className="flex items-center gap-3">
            {candidate && (
              <Portrait candidate={candidate} kind="avatar" sizes="72px" className="size-9" />
            )}
            <span className="grid leading-tight">
              <Link
                href={interviewsHref(a.id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {interviewName(a)}
              </Link>
              <span className="text-sm text-muted-foreground">
                {[outlet(a) || a.titulo, day && shortDay(day)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
        )}
        <blockquote
          className="m-0 border-l-2 pl-4 font-heading text-xl leading-snug"
          style={{ borderColor: color }}
        >
          «{r.cita}»
        </blockquote>
        <p className="m-0 text-muted-foreground">{r.explicacion}</p>
        {(handReviewed(r) || r.pilladoEnDirecto) && (
          <p className="m-0 flex flex-wrap gap-2">
            {handReviewed(r) && (
              <Badge variant="outline" title={r.segundaRevision?.nota}>
                Revisada a mano
                {r.segundaRevision?.sugerencia &&
                  ` · antes, ${verdicts[r.segundaRevision.sugerencia].name}`}
              </Badge>
            )}
            {r.pilladoEnDirecto && <Badge variant="outline">Se lo señalaron en directo</Badge>}
          </p>
        )}
      </div>
      <div className="grid gap-3 border-t border-border px-6 py-4 max-sm:px-5">
        <Sources items={r.fuentes} />
        <Link
          href={interviewsHref(`${a.id}/${r.id}`)}
          className="inline-flex items-center gap-1.5 self-start text-sm underline underline-offset-4"
        >
          <Icon name="copiar" size={14} /> Enlace a esta verificación
        </Link>
      </div>
    </Cell>
  );
}

// Lo que no se sostiene, primero.
const verdictOrder = ['roja', 'fuera', 'amarilla', 'sinfuente', 'legal'] as const;

// «▶ 20:22»: el vídeo en ese minuto. En el informe, el reproductor intercepta el enlace y lo pone
// sin mover la página; desde otra página, abre el informe en ese minuto.
export function Jump({ interview: a, second }: { interview: Interview; second: number }) {
  return (
    <a
      href={`${interviewsHref(a.id)}?t=${Math.floor(second)}#minuto`}
      aria-label={`Ver en el vídeo, minuto ${minute(second)}`}
      className="inline-flex min-h-8 items-center gap-1.5 self-start justify-self-start rounded-full px-2.5 font-mono text-sm tabular-nums no-underline ring-1 ring-border transition-colors hover:bg-muted motion-reduce:transition-none"
    >
      <Icon name="reproducir" size={12} />
      {minute(second)}
    </a>
  );
}

// Un bloque plegado: se ve el resumen y se despliega el resto.
export function Fold({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex min-h-11 w-full cursor-pointer items-center gap-3 text-left">
        {summary}
        <span
          aria-hidden="true"
          className="ml-auto flex shrink-0 group-data-open:rotate-180 motion-safe:transition-transform"
        >
          <Icon name="abajo" size={16} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// Las preguntas por tema, en el orden en que salen, con cómo responde a cada una y la leyenda de esas
// respuestas. Con análisis de comunicación, las suyas: su tema, su dureza y su clase de respuesta.
type QuestionItem = { key: string; second: number; text: string; mark: AnswerMark; answer: string };
function questionGroups(a: Interview) {
  const c = getCommunication(a.id);
  const shared = new Set(
    (a.jornada ? commonQuestions(a.jornada) : []).flatMap((q) => q.respuestas[a.candidato] ?? []),
  );
  const groups = new Map<string, (QuestionItem & { notes: ReactNode[] })[]>();
  const add = (topic: string, item: QuestionItem & { notes: ReactNode[] }) =>
    groups.set(topic, [...(groups.get(topic) ?? []), item]);
  if (c) {
    const list = [...c.preguntas].sort((x, y) => x.segundo - y.segundo);
    list.forEach((q) =>
      add(q.tema, {
        key: q.id,
        second: q.segundo,
        text: q.texto,
        mark: replyMarks[q.respuesta],
        answer: replyNames[q.respuesta],
        notes: [
          `Pregunta ${hardnessNames[q.dureza].toLowerCase()}`,
          shared.has(q.id) && 'También se la hicieron a otros candidatos',
        ],
      }),
    );
    return {
      total: list.length,
      legend: replyIds.map((id) => ({
        mark: replyMarks[id],
        name: replyNames[id],
        count: list.filter((q) => q.respuesta === id).length,
      })),
      groups: [...groups],
    };
  }
  // Sin comunicación, el tema es el que suena en ese segundo.
  for (const q of [...a.preguntas].sort((x, y) => x.segundo - y.segundo)) {
    add(a.temas.find((t) => t.inicio <= q.segundo && q.segundo < t.fin)?.tema ?? 'Otros temas', {
      key: q.id,
      second: q.segundo,
      text: q.texto,
      mark: answerMarks[q.respuesta],
      answer: answers[q.respuesta],
      notes: [
        q.repregunta && (
          <span className="inline-flex items-center gap-1.5">
            <MarkIcon kind="repregunta" className="size-5" /> Repregunta
          </span>
        ),
        shared.has(q.id) && 'También se la hicieron a otros candidatos',
      ],
    });
  }
  return {
    total: a.preguntas.length,
    legend: answerIds.map((id) => ({
      mark: answerMarks[id],
      name: answers[id],
      count: a.preguntas.filter((p) => p.respuesta === id).length,
    })),
    groups: [...groups],
  };
}

export function ReportSections({ interview: a }: { interview: Interview }) {
  const proposals = [...a.propuestas].sort((x, y) => proposalScore(y) - proposalScore(x));
  const byVerdict = verdictOrder
    .map((id) => [id, a.revisiones.filter((r) => r.veredicto === id)] as const)
    .filter(([, list]) => list.length > 0);
  const c = getCommunication(a.id);
  const questions = questionGroups(a);
  return (
    <>
      {a.revisiones.length > 0 && (
        <ReportSection id="verificaciones" title="Lo que afirma, verificado">
          <AI label="Verificado y revisado con IA">
            <p>
              La IA busca cada dato en fuentes oficiales y lo califica. Una segunda pasada de IA
              abre esas fuentes y confirma o corrige la calificación; ninguna persona las revisa.
              «Sin revisar» marca las que aún no han pasado esa segunda pasada.
            </p>
          </AI>
          <div className="mt-6 grid gap-4">
            {/* Cuántas hay de cada calificación, y un enlace a su grupo. */}
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {byVerdict.map(([id, list]) => (
                <li key={id}>
                  <a
                    href={`#v-${id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 no-underline ring-1 ring-border transition-colors hover:bg-muted motion-reduce:transition-none"
                  >
                    <MarkIcon kind={id} color={verdicts[id].color} className="size-8" />
                    {verdicts[id].name}
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      {list.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {byVerdict.map(([id, list]) => (
              <div key={id} id={`v-${id}`} className="grid scroll-mt-40">
                <Cell className="gap-2">
                  <h3 className="m-0 flex items-center gap-3 font-heading text-2xl leading-tight font-normal">
                    <MarkIcon kind={id} color={verdicts[id].color} />
                    {verdicts[id].name}
                    <span className="text-muted-foreground tabular-nums">{list.length}</span>
                  </h3>
                  <p className="m-0 text-sm text-muted-foreground">{verdicts[id].text}</p>
                  {/* Cada una en una fila: la cita a la vista; el porqué y las fuentes, al desplegar. */}
                  <ul className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
                    {list.map((r) => (
                      <li
                        key={r.id}
                        className="grid gap-2 border-b border-border py-4 last:border-0"
                      >
                        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Jump interview={a} second={r.segundo} />
                          <Unreviewed estado={r.estado} />
                        </p>
                        <blockquote className="m-0 font-heading text-lg leading-snug">
                          «{r.cita}»
                        </blockquote>
                        <Fold
                          summary={<span className="text-sm font-medium">Por qué y fuentes</span>}
                        >
                          <p className="m-0 text-muted-foreground">{r.explicacion}</p>
                          <Sources items={r.fuentes} />
                          <Link
                            href={interviewsHref(`${a.id}/${r.id}`)}
                            className="self-start text-sm underline underline-offset-4"
                          >
                            Enlace a esta verificación
                          </Link>
                        </Fold>
                      </li>
                    ))}
                  </ul>
                </Cell>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {c && c.momentos.length > 0 && (
        <ReportSection id="momentos" title="Momentos clave">
          <Grid>
            {[...c.momentos]
              .sort((x, y) => x.segundo - y.segundo)
              .map((m) => (
                <Cell
                  key={m.segundo}
                  span={4}
                  label={
                    <MarkLabel kind="momento">
                      {m.quien === 'jordi' ? 'Del entrevistador' : 'Momento clave'}
                    </MarkLabel>
                  }
                >
                  <h3 className="m-0 font-heading text-2xl leading-tight font-normal">
                    {m.titulo}
                  </h3>
                  {m.cita && <p className="m-0">«{m.cita}»</p>}
                  <Jump interview={a} second={m.segundo} />
                </Cell>
              ))}
          </Grid>
        </ReportSection>
      )}

      {c && c.compromisos.length > 0 && (
        <ReportSection id="propuestas" title="Sus compromisos">
          <Grid>
            {[...c.compromisos]
              .sort((x, y) => +y.verificable - +x.verificable || x.segundo - y.segundo)
              .map((x) => (
                <Cell
                  key={`${x.segundo}-${x.compromiso}`}
                  span={6}
                  label={
                    <MarkLabel kind={x.verificable ? 'comprobable' : 'compromiso'}>
                      {x.verificable ? 'Comprobable' : 'Sin objeto comprobable'}
                    </MarkLabel>
                  }
                >
                  <p className="m-0 text-lg leading-snug">{x.compromiso}</p>
                  <p className="m-0 text-muted-foreground">«{x.cita}»</p>
                  <Jump interview={a} second={x.segundo} />
                  <p className="m-0 mt-auto text-sm text-muted-foreground">{commitmentDetail(x)}</p>
                </Cell>
              ))}
          </Grid>
        </ReportSection>
      )}

      {!c && a.momentos.length > 0 && (
        <ReportSection id="momentos" title="Momentos clave">
          <Grid>
            {a.momentos.map((m) => (
              <Cell
                key={m.id}
                span={4}
                label={
                  <MarkLabel kind="momento">{unreviewed(moments[m.tipo].name, m.estado)}</MarkLabel>
                }
              >
                <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{m.titulo}</h3>
                <p className="m-0">«{m.cita}»</p>
                <p className="m-0 text-sm text-muted-foreground">{m.porQue}</p>
                <Jump interview={a} second={m.segundo} />
              </Cell>
            ))}
          </Grid>
        </ReportSection>
      )}

      {!c && proposals.length > 0 && (
        <ReportSection id="propuestas" title="Lo que propone">
          <Grid>
            {proposals.map((p) => {
              const kind = proposalKind(p);
              return (
                <Cell
                  key={p.id}
                  span={6}
                  label={<MarkLabel kind={kind}>{proposalKinds[kind]}</MarkLabel>}
                >
                  <p className="m-0 text-lg leading-snug">{p.texto}</p>
                  <Jump interview={a} second={p.segundo} />
                  {/* Lo que dice y lo que le falta: cuatro casillas iguales, con icono y texto. */}
                  <ul className="m-0 mt-auto grid list-none grid-cols-4 gap-1.5 p-0 text-sm max-sm:grid-cols-2">
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
                        className={cn(
                          'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2',
                          p[key]
                            ? 'bg-muted font-medium text-foreground'
                            : 'border border-dashed border-muted-foreground/40 text-muted-foreground',
                        )}
                      >
                        <Icon name={p[key] ? 'hecho' : 'nunca'} size={14} />
                        {name}
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
        <ReportSection id="criticas" title="Críticas a otros">
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
                      {x.objetivo}
                    </MarkLabel>
                  </Label>
                  <p className="m-0">«{x.texto}»</p>
                  <Jump interview={a} second={x.segundo} />
                </li>
              ))}
            </ul>
          </Cell>
        </ReportSection>
      )}
      {questions.total > 0 && (
        <ReportSection id="preguntas" title={`Las ${questions.total} preguntas`}>
          <ul className="m-0 mb-4 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted-foreground">
            {questions.legend.map((l) => (
              <li key={l.name} className="flex items-center gap-1.5">
                <IconChip name={l.mark.icon} color={l.mark.color} className="size-6" />
                {l.name} ({l.count})
              </li>
            ))}
          </ul>
          <Cell className="gap-0 py-2 lg:py-2">
            <ul className="m-0 grid list-none p-0">
              {questions.groups.map(([topic, list]) => (
                <li key={topic} className="border-b border-border py-2 last:border-0">
                  <Fold
                    summary={
                      <span className="grid gap-1.5">
                        <span className="font-medium">
                          {topic}{' '}
                          <span className="font-normal text-muted-foreground">
                            · {list.length} {list.length === 1 ? 'pregunta' : 'preguntas'}
                          </span>
                        </span>
                        {/* Cómo responde a cada una, en orden: el texto de dentro da el detalle. */}
                        <span aria-hidden="true" className="flex flex-wrap gap-1">
                          {list.map((q) => (
                            <i
                              key={q.key}
                              className="block size-3 rounded-[3px]"
                              style={{ background: q.mark.color }}
                            />
                          ))}
                        </span>
                      </span>
                    }
                  >
                    <ol className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
                      {list.map((q) => (
                        <li
                          key={q.key}
                          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-0"
                        >
                          <Jump interview={a} second={q.second} />
                          <span className="grid gap-2">
                            <span className="leading-snug">{q.text}</span>
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <IconChip
                                  name={q.mark.icon}
                                  color={q.mark.color}
                                  className="size-6"
                                />
                                {q.answer}
                              </span>
                              {q.notes.filter(Boolean).map((note, n) => (
                                <span key={n}>{note}</span>
                              ))}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Fold>
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
  const c = getCommunication(a.id);
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
    <ReportSection id="perfil" title="Su perfil">
      <Grid>
        {c ? (
          <Cell span={6} label="Cómo habla">
            {rows([
              {
                name: 'Ritmo, en habla continua',
                value: c.habla.invitado.palabrasPorMinuto,
                scale: 300,
                unit: 'palabras/min',
              },
              {
                name: 'Trabas',
                value: c.habla.invitado.trabasPor100,
                scale: 1,
                unit: 'por 100 palabras',
                digits: 2,
              },
              {
                name: 'Pausas de más de 0,4 s',
                value: c.habla.invitado.pausasPor1000,
                scale: 30,
                unit: 'por 1.000 palabras',
                digits: 1,
              },
            ])}
            <p className="m-0 text-sm text-muted-foreground">
              Del análisis de comunicación: una traba es repetir una palabra o cortarse a media
              frase. No dicen si alguien está nervioso ni si es sincero.
            </p>
          </Cell>
        ) : (
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
              Son recuentos sobre la transcripción. No dicen si alguien está nervioso ni si es
              sincero.
            </p>
          </Cell>
        )}
        <Cell span={6} label={`Cómo le trató ${who}`}>
          {rows([
            c
              ? {
                  name: 'Parte de las palabras del entrevistador',
                  value: i.share,
                  scale: 100,
                  unit: '%',
                }
              : {
                  name: 'Tiempo de palabra del entrevistador',
                  value: i.share,
                  scale: 100,
                  unit: '%',
                },
            {
              name: 'Preguntas por minuto',
              value: (c?.preguntas.length ?? a.preguntas.length) / (a.duracion / 60 || 1),
              scale: 3,
              digits: 1,
            },
            {
              name: c ? 'Repreguntas e insistencias' : 'Repreguntas',
              value: followUps(a),
              scale: c ? 60 : 20,
            },
            {
              name: c
                ? 'Intercambios que cierra con un corte o un comentario'
                : 'Veces que le corta',
              value: i.cuts,
              scale: 20,
            },
            c
              ? {
                  name: 'Palabras por intervención',
                  value: c.habla.jordi.palabras / (c.preguntas.length || 1),
                  scale: 60,
                }
              : { name: 'Palabras por pregunta', value: i.wordsPerQuestion, scale: 60 },
          ])}
        </Cell>
      </Grid>
    </ReportSection>
  );
}

const times = (n: number) => `${n} ${n === 1 ? 'vez' : 'veces'}`;

// Cómo lo dice, en corto: el titular y las claves del análisis de comunicación, con tres cifras y el
// enlace al análisis completo.
function CommunicationSummary({ interview: a }: { interview: Interview }) {
  const c = getCommunication(a.id);
  if (!c) return null;
  const { hard, answered } = pressure(c);
  // De cada clave, su título en negrita («**Habló sobre todo él.** El 72,8 %…»).
  const keys = c.claves.flatMap((k) => /^\*\*(.+?)\*\*/.exec(k)?.[1] ?? []).slice(0, 4);
  return (
    <Grid className="-mt-8 mb-12">
      <Cell span={7} label="Cómo lo dice">
        <p className="m-0 font-heading text-2xl leading-tight">{c.titular}</p>
        <ul className="m-0 grid list-disc gap-2 pl-5">
          {keys.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <Link
          href={interviewsHref(`${a.id}/${communicationPath}`)}
          className="inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4"
        >
          Ver el análisis de comunicación completo <span aria-hidden="true">→</span>
        </Link>
      </Cell>
      <Cell span={5} className="content-start">
        <Stat
          value={`${answered} de ${hard}`}
          caption="preguntas duras que contesta a lo preguntado"
        />
        <Stat
          value={`${c.promesas.verificables} de ${c.promesas.total}`}
          caption="promesas que se podrán comprobar"
        />
      </Cell>
    </Grid>
  );
}

export function InterviewReport({ interview: a }: { interview: Interview }) {
  const { candidate: interrupts, interviewer: cuts } = interruptions(a);
  const video = videoUrl(a);
  const where = outlet(a);
  const who = interviewerOf(a);
  const day = publishedDay(a);
  const round = roundOf(a);
  const candidate = getCandidate(a.candidato);
  const communication = getCommunication(a.id);
  return (
    <>
      {a.ficticio && (
        <Notice>
          <b className="font-medium">Ejemplo con un candidato ficticio y datos inventados.</b> Así
          será el informe de cada entrevista real.
        </Notice>
      )}
      {candidate && (
        <Link
          href={interviewsHref(candidate.slug)}
          className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          <Icon name="izquierda" size={14} /> Ficha de {candidate.name}
        </Link>
      )}
      <Card
        render={<header />}
        className="mb-12 grid grid-cols-[minmax(0,1fr)] gap-8 p-6 text-base md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:p-8 max-sm:p-5"
      >
        {candidate ? (
          <Portrait
            candidate={candidate}
            sizes="(min-width: 768px) 320px, 60vw"
            className="max-md:mx-auto max-md:w-48"
          />
        ) : (
          <div className="grid aspect-[3/4] place-content-center rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground max-md:mx-auto max-md:w-48">
            Candidato ficticio
          </div>
        )}
        <div className="grid content-start justify-items-start gap-6">
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="text-foreground">
              {[where, day && formatDate(day, { day: 'numeric', month: 'long' })]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {who && <span>Con {who}</span>}
            {round && <span>Ronda: {round.title}</span>}
          </p>
          <div className="grid gap-2">
            {candidate && (
              <p className="m-0 flex items-center gap-2 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                <Dot color={candidate.color} />
                <b className="font-medium text-foreground">{candidate.short}</b>
                {candidate.party !== candidate.short && ` · ${candidate.party}`}
              </p>
            )}
            <h1 className="m-0 font-heading text-4xl leading-[1.05] font-normal lg:text-[56px]">
              {interviewName(a)}
              {candidate && <span className="text-muted-foreground"> · la entrevista</span>}
            </h1>
            {communication?.frase && (
              <p className="m-0 mt-2 max-w-[60ch] text-lg leading-snug text-muted-foreground">
                {communication.frase}
              </p>
            )}
          </div>
          <div className="grid w-full gap-x-10 gap-y-6 border-t border-border pt-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            {/* La valoración, en grande, con su margen sobre la escala de 0 a 10. */}
            <div className="grid content-start gap-2">
              <Label>{a.pending ? 'Valoración provisional' : 'Valoración'}</Label>
              <p className="m-0 font-heading text-6xl leading-none whitespace-nowrap tabular-nums">
                {decimal(a.nota.global)}
                <span className="ml-1.5 text-lg text-muted-foreground">
                  ± {decimal(a.nota.margen)}
                </span>
              </p>
              <span
                aria-hidden="true"
                className="relative mt-1 block h-1.5 w-44 rounded-full bg-muted"
              >
                <i
                  className="absolute inset-y-0 rounded-full bg-foreground/25"
                  style={{
                    left: `${(a.nota.global - a.nota.margen) * 10}%`,
                    width: `${a.nota.margen * 20}%`,
                  }}
                />
                <i
                  className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                  style={{ left: `${a.nota.global * 10}%` }}
                />
              </span>
              <span className="text-sm text-muted-foreground">sobre 10</span>
            </div>
            <dl className="m-0 grid grid-cols-2 content-start gap-x-6 gap-y-5 md:grid-cols-4">
              {(
                [
                  ['Al grano', `${a.stats.alGrano} %`, 'de respuestas'],
                  communication
                    ? [
                        'Compromisos',
                        String(checkable(a)),
                        `comprobables de ${communication.compromisos.length}`,
                      ]
                    : ['Propuestas', String(checkable(a)), `completas de ${a.propuestas.length}`],
                  ['Verificaciones', String(a.revisiones.length), 'afirmaciones'],
                  ['Duración', minute(a.duracion), 'de entrevista'],
                ] as const
              ).map(([name, value, aside]) => (
                <div key={name} className="grid content-start gap-1">
                  <dt className="whitespace-nowrap">
                    <Label>{name}</Label>
                  </dt>
                  <dd className="m-0 grid gap-1">
                    <span className="font-heading text-3xl leading-none whitespace-nowrap tabular-nums">
                      {value}
                    </span>
                    <span className="text-sm text-muted-foreground">{aside}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {/* Lo que afirma, de un vistazo: cada calificación con su icono, enlazada a su grupo. */}
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {verdictOrder.map((id) => {
              const n = a.revisiones.filter((r) => r.veredicto === id).length;
              return (
                n > 0 && (
                  <li key={id}>
                    <a
                      href={`#v-${id}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-sm no-underline ring-1 ring-border hover:bg-muted"
                    >
                      <MarkIcon kind={id} color={verdicts[id].color} />
                      <span className="font-medium tabular-nums">{n}</span>
                      {verdicts[id].name}
                    </a>
                  </li>
                )
              );
            })}
          </ul>
          {/* Quién tiene la palabra: su parte, en el color de su partido. */}
          <div className="grid w-full gap-1.5">
            <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-muted">
              <i
                style={{
                  width: `${speakingShare(a, 'candidato')}%`,
                  background: candidate?.color ?? 'var(--foreground)',
                }}
              />
              <i
                className="bg-muted-foreground/30"
                style={{ width: `${speakingShare(a, 'jordi')}%` }}
              />
            </span>
            <p className="m-0 flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
              <span>
                <b className="font-medium text-foreground">{speakingShare(a, 'candidato')} %</b>{' '}
                {communication ? 'de las palabras' : 'del tiempo'}: {interviewName(a)}
              </span>
              {who && (
                <span>
                  {speakingShare(a, 'jordi')} %: {who}
                </span>
              )}
            </p>
          </div>
          {a.pending > 0 && (
            <p className="m-0 inline-flex items-center gap-3 rounded-2xl border border-dashed border-foreground/30 px-3.5 py-1.5 text-sm sm:rounded-full">
              <ReviewBar review={a.review} />
              <span>
                <b className="font-medium">
                  Revisadas {a.review.reviewed} de {a.review.total}
                </b>{' '}
                verificaciones y momentos. El resto, sin revisar: la valoración puede cambiar.
              </span>
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
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {video ? (
              <a
                href={video}
                target="_blank"
                rel="noopener noreferrer"
                data-slot="button"
                data-variant="sunset"
                className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
              >
                <span className="sm:hidden">Ver el original</span>
                <span className="max-sm:hidden">
                  Ver la entrevista original
                  {a.youtubeId
                    ? ' en YouTube'
                    : a.entrevista?.medio
                      ? ` en ${a.entrevista.medio}`
                      : ''}
                </span>
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                {a.ficticio
                  ? 'Es una entrevista ficticia: no tiene vídeo original.'
                  : 'Todavía no hay enlace al vídeo original.'}
              </p>
            )}
            {candidate && (
              <Link
                href={interviewsHref(candidate.slug)}
                data-slot="button"
                data-variant="outline"
                className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
              >
                Ver su ficha <Icon name="derecha" size={16} />
              </Link>
            )}
            <ShareButton title={`La entrevista a ${interviewName(a)}, revisada`} />
          </div>
        </div>
      </Card>
      {communication && <CommunicationSummary interview={a} />}

      <PageIndex
        items={[
          ['minuto', 'Minuto a minuto'],
          ['cifras', 'Las cifras'],
          [a.revisiones.length > 0 && 'verificaciones', 'Verificaciones'],
          [(communication?.momentos ?? a.momentos).length > 0 && 'momentos', 'Momentos clave'],
          [
            (communication?.compromisos ?? a.propuestas).length > 0 && 'propuestas',
            communication ? 'Compromisos' : 'Propuestas',
          ],
          [a.ataques.length > 0 && 'criticas', 'Críticas'],
          [(communication?.preguntas ?? a.preguntas).length > 0 && 'preguntas', 'Preguntas'],
          ['perfil', 'Perfil'],
        ]}
      />

      <ReportSection id="minuto" title="Minuto a minuto">
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
          marks={
            communication
              ? [
                  // Sus momentos, compromisos y preguntas sustituyen a los nuestros.
                  ...marks(a).filter(
                    (m) => !(m.lane in communicationLanes) && m.lane !== 'momentos',
                  ),
                  ...communicationMarks(communication),
                ].sort((x, y) => x.second - y.second)
              : marks(a)
          }
          lanes={communication ? { ...lanes, ...communicationLanes } : lanes}
          voice={communication?.voz}
          minutes={perMinute(a)}
          topics={topicsOf(a)}
          color={candidate?.color ?? 'var(--foreground)'}
        />
      </ReportSection>

      <ReportSection id="cifras" title="Las cifras de la entrevista">
        <Grid>
          <Cell span={6} label="La valoración, criterio a criterio">
            <Bars
              max={10}
              rows={criterionIds.flatMap((id) => {
                const value = a.nota.criterios[id];
                return value === undefined
                  ? []
                  : {
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
            {communication && (
              <p className="m-0 text-sm text-muted-foreground">
                De los {communication.temas.length} tramos, {who ?? 'el entrevistador'} saca{' '}
                {communication.temas.filter((t) => t.quien === 'jordi').length} y {interviewName(a)}
                , {communication.temas.filter((t) => t.quien === 'invitado').length}.
              </p>
            )}
          </Cell>
          <Cell span={6} label="Cómo responde">
            <Bars
              rows={
                communication
                  ? replyIds.map((id) => {
                      const value = communication.preguntas.filter(
                        (q) => q.respuesta === id,
                      ).length;
                      return { label: replyNames[id], value, display: String(value) };
                    })
                  : Object.entries(answers).map(([id, name]) => {
                      const value = a.preguntas.filter((p) => p.respuesta === id).length;
                      return { label: name, value, display: String(value) };
                    })
              }
            />
            <p className="m-0 text-sm text-muted-foreground">
              {communication
                ? `${followUps(a)} repreguntas e insistencias: las veces que el entrevistador vuelve sobre lo mismo.`
                : `${followUps(a)} repreguntas: las veces que el entrevistador insiste porque no le han contestado.`}
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
                ...(communication
                  ? []
                  : [
                      {
                        label: 'Otras personas',
                        value: 100 - speakingShare(a, 'candidato') - speakingShare(a, 'jordi'),
                        color: 'var(--border)',
                      },
                    ]),
              ].map((row) => ({ ...row, display: `${row.value} %` }))}
            />
            {communication && (
              <p className="m-0 text-sm text-muted-foreground">
                Su parte de las palabras que dicen los dos.
              </p>
            )}
          </Cell>
          {communication ? (
            <Cell span={6} label={`Sus ${communication.compromisos.length} compromisos`}>
              <Bars
                max={100}
                rows={(
                  [
                    ['Comprobables', (x) => x.verificable],
                    ['Con plazo', (x) => x.plazo !== null],
                    ['Con condición', (x) => x.condicion !== null],
                  ] as const satisfies readonly [
                    string,
                    (x: Communication['compromisos'][number]) => boolean,
                  ][]
                ).map(([label, test]) => {
                  const value = Math.round(
                    (communication.compromisos.filter(test).length /
                      (communication.compromisos.length || 1)) *
                      100,
                  );
                  return { label, value, display: `${value} %` };
                })}
              />
            </Cell>
          ) : (
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
            </Cell>
          )}
          <Cell label="A quién critica">
            <Bars
              rows={criticTargets(a)
                .slice(0, 8)
                .map(([target, value]) => ({
                  label: `A ${target}`,
                  value,
                  display: String(value),
                }))}
            />
            <p className="m-0 text-sm text-muted-foreground">
              {communication
                ? `Cuántas de sus ${communication.preguntas.length} respuestas critican a cada uno. Interrumpe de forma notable ${times(interrupts)}; ${who ?? 'el entrevistador'} cierra ${cuts} intercambios con un corte o un comentario suyo.`
                : `Interrumpe ${times(interrupts)}; el entrevistador le corta ${times(cuts)}.`}
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
  verification: Verification;
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
      {r.estado === 'propuesta' && (
        <Notice>
          <b className="font-medium">Sin revisar.</b> La segunda revisión de IA aún no ha comprobado
          esta calificación ni sus fuentes: pueden cambiar.
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
          <div>
            <ShareButton title={`${verdicts[r.veredicto].name}: «${r.cita}»`} />
          </div>
        </Cell>
      </Grid>
      <div className="mt-8">
        <Explore
          links={[
            {
              href: `${interviewsHref(a.id)}?t=${Math.floor(r.segundo)}#minuto`,
              text: 'El informe completo, en este minuto',
            },
          ]}
        />
      </div>
    </>
  );
}

// Un filtro de la lista: pastillas que son enlaces, para que cada vista tenga su dirección y funcione
// sin JavaScript. Las opciones de `more` quedan plegadas (y abiertas si una está elegida). En móvil,
// cada fila se desliza de lado en vez de apilarse, y ahí van todas, sin plegar.
type FilterOption = { href: string; active: boolean; count: number; children: ReactNode };
function FilterPill({ option: o }: { option: FilterOption }) {
  return (
    <Link
      href={o.href}
      scroll={false}
      aria-current={o.active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap no-underline ring-1 transition-colors motion-reduce:transition-none',
        o.active ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-muted',
      )}
    >
      {o.children}
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          o.active ? 'text-background/70' : 'text-muted-foreground',
        )}
      >
        {o.count}
      </span>
    </Link>
  );
}
function FilterLinks({
  label,
  options,
  more = [],
}: {
  label: string;
  options: FilterOption[];
  more?: FilterOption[];
}) {
  return (
    <nav
      aria-label={label}
      className="grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-4"
    >
      <span className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase sm:pt-3">
        {label}
      </span>
      <div className="flex flex-wrap gap-2 max-sm:-mx-5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-5 max-sm:py-0.5 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
        {options.map((o) => (
          <FilterPill key={o.href} option={o} />
        ))}
        {more.map((o) => (
          <span key={o.href} className="contents sm:hidden">
            <FilterPill option={o} />
          </span>
        ))}
        {more.length > 0 && (
          <details className="group max-sm:hidden" open={more.some((o) => o.active)}>
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full px-3.5 text-sm ring-1 ring-border hover:bg-muted [&::-webkit-details-marker]:hidden">
              Más temas
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {more.length}
              </span>
              <span aria-hidden="true" className="flex group-open:rotate-180">
                <Icon name="abajo" size={14} />
              </span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {more.map((o) => (
                <FilterPill key={o.href} option={o} />
              ))}
            </div>
          </details>
        )}
      </div>
    </nav>
  );
}

// Las verificaciones de cada página de la lista.
const perPage = 24;

export function VerificationsIndex({
  verdict,
  candidate,
  topic,
  page = 1,
}: {
  verdict?: Verification['veredicto'];
  candidate?: string;
  topic?: string;
  page?: number;
}) {
  // Lo que no se sostiene, primero; dentro de cada calificación, en el orden de la entrevista.
  const all = allVerifications()
    .map((v) => ({ ...v, topic: topicAt(v.interview, v.verification.segundo) }))
    .sort(
      (x, y) =>
        verdictOrder.indexOf(x.verification.veredicto) -
          verdictOrder.indexOf(y.verification.veredicto) ||
        x.interview.candidato.localeCompare(y.interview.candidato) ||
        x.verification.segundo - y.verification.segundo,
    );
  const ofTopic = all.filter((v) => !topic || v.topic === topic);
  const ofCandidate = ofTopic.filter((v) => !candidate || v.interview.candidato === candidate);
  const ofVerdict = ofTopic.filter((v) => !verdict || v.verification.veredicto === verdict);
  const shown = ofCandidate.filter((v) => !verdict || v.verification.veredicto === verdict);
  // Los temas, de más a menos verificaciones con los otros filtros puestos.
  const rest = all.filter(
    (v) =>
      (!candidate || v.interview.candidato === candidate) &&
      (!verdict || v.verification.veredicto === verdict),
  );
  const inTopic = new Map<string, number>();
  for (const v of rest) if (v.topic) inTopic.set(v.topic, (inTopic.get(v.topic) ?? 0) + 1);
  const topics = [...inTopic.keys()].sort((x, y) => inTopic.get(y)! - inTopic.get(x)!);
  const pages = Math.max(1, Math.ceil(shown.length / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const href = (q: {
    calificacion?: string;
    candidato?: string;
    tema?: string;
    pagina?: string;
  }) => {
    const query = new URLSearchParams(
      Object.entries(q).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    return interviewsHref(`verificaciones${query ? `?${query}` : ''}`);
  };
  const topicOption = (name: string) => ({
    href: href({ calificacion: verdict, candidato: candidate, tema: name }),
    active: topic === name,
    count: inTopic.get(name) ?? 0,
    children: name,
  });
  const people = [...new Set(all.map((v) => v.interview.candidato))].map((slug) => {
    const interview = all.find((v) => v.interview.candidato === slug)?.interview;
    return { slug, name: interview ? interviewName(interview) : slug };
  });
  return (
    <>
      <ReportIntro title="Todo lo verificado">
        <p>
          Los datos que dan los candidatos en sus entrevistas, buscados en fuentes oficiales y
          calificados por la IA. Una segunda pasada de IA confirma o corrige cada calificación, y
          las que no cuadraban con el análisis de comunicación se revisaron a mano: lo dice su
          ficha. Primero, lo que no se sostiene.
        </p>
      </ReportIntro>
      {all.length === 0 ? (
        <p>Todavía no hay ninguna verificación publicada.</p>
      ) : (
        <>
          <Cell label="Cómo salen los datos de cada uno" className="mb-8">
            <ul className="m-0 grid list-none gap-4 p-0">
              {people.map((p) => {
                const own = all.filter((v) => v.interview.candidato === p.slug);
                return (
                  <li
                    key={p.slug}
                    className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-4 max-sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <Link
                      href={href({ candidato: p.slug })}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span
                      aria-hidden="true"
                      className="flex h-3 overflow-hidden rounded-full bg-muted max-sm:order-last max-sm:col-span-2"
                    >
                      {verdictOrder.map((id) => (
                        <i
                          key={id}
                          style={{
                            width: `${(own.filter((v) => v.verification.veredicto === id).length / (own.length || 1)) * 100}%`,
                            background: verdicts[id].color,
                          }}
                        />
                      ))}
                    </span>
                    <span className="flex flex-wrap justify-end gap-x-3 text-sm tabular-nums">
                      {verdictOrder.slice(0, 2).map((id) => (
                        <span key={id} className="inline-flex items-center gap-1">
                          <MarkIcon kind={id} color={verdicts[id].color} className="size-5" />
                          {own.filter((v) => v.verification.veredicto === id).length}{' '}
                          {verdicts[id].name}
                        </span>
                      ))}
                      <span className="text-muted-foreground">de {own.length}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted-foreground">
              {verdictOrder.map((id) => (
                <li key={id} className="inline-flex items-center gap-1.5">
                  <MarkIcon kind={id} color={verdicts[id].color} className="size-5" />
                  {verdicts[id].name}
                </li>
              ))}
            </ul>
            <p className="m-0 text-sm text-muted-foreground">
              No es una nota: cada uno habla de cosas distintas y da más o menos cifras. La
              valoración sobre 10 de cada entrevista tiene en cuenta mucho más.
            </p>
          </Cell>
          <div className="mb-8 grid gap-5 rounded-2xl p-5 ring-1 ring-border lg:p-6">
            <FilterLinks
              label="Calificación"
              options={[
                {
                  href: href({ candidato: candidate, tema: topic }),
                  active: !verdict,
                  count: ofCandidate.length,
                  children: 'Todas',
                },
                ...verdictOrder.map((id) => ({
                  href: href({ calificacion: id, candidato: candidate, tema: topic }),
                  active: verdict === id,
                  count: ofCandidate.filter((v) => v.verification.veredicto === id).length,
                  children: (
                    <>
                      <MarkIcon kind={id} color={verdicts[id].color} className="-ml-2 size-7" />
                      {verdicts[id].name}
                    </>
                  ),
                })),
              ]}
            />
            {people.length > 1 && (
              <FilterLinks
                label="Candidato"
                options={[
                  {
                    href: href({ calificacion: verdict, tema: topic }),
                    active: !candidate,
                    count: ofVerdict.length,
                    children: 'Todos',
                  },
                  ...people.map((p) => {
                    const c = getCandidate(p.slug);
                    return {
                      href: href({ calificacion: verdict, candidato: p.slug, tema: topic }),
                      active: candidate === p.slug,
                      count: ofVerdict.filter((v) => v.interview.candidato === p.slug).length,
                      children: (
                        <>
                          {c && (
                            <Portrait
                              candidate={c}
                              kind="avatar"
                              sizes="56px"
                              className="-ml-2 size-7"
                            />
                          )}
                          {p.name}
                        </>
                      ),
                    };
                  }),
                ]}
              />
            )}
            {topics.length > 1 && (
              <FilterLinks
                label="Tema"
                options={[
                  {
                    href: href({ calificacion: verdict, candidato: candidate }),
                    active: !topic,
                    count: rest.length,
                    children: 'Todos',
                  },
                  ...topics.slice(0, 8).map(topicOption),
                ]}
                more={topics.slice(8).map(topicOption)}
              />
            )}
            <p className="m-0 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <span>
                {shown.length} {shown.length === 1 ? 'verificación' : 'verificaciones'}
                {pages > 1 && ` · página ${current} de ${pages}`}
              </span>
              {(verdict || candidate || topic) && (
                <Link
                  href={href({})}
                  scroll={false}
                  className="text-foreground underline underline-offset-4"
                >
                  Quitar los filtros
                </Link>
              )}
            </p>
          </div>
          {shown.length === 0 ? (
            <p>Ninguna verificación con estos filtros.</p>
          ) : (
            <>
              <ul
                id="lista"
                className="m-0 grid scroll-mt-28 list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3"
              >
                {shown
                  .slice((current - 1) * perPage, current * perPage)
                  .map(({ interview, verification }) => (
                    <li key={`${interview.id}/${verification.id}`} className="grid">
                      <VerificationCard interview={interview} verification={verification} named />
                    </li>
                  ))}
              </ul>
              {pages > 1 && (
                <nav
                  aria-label="Páginas"
                  className="mt-10 flex flex-wrap items-center justify-center gap-2"
                >
                  {current > 1 && (
                    <Link
                      href={`${href({ calificacion: verdict, candidato: candidate, tema: topic, pagina: String(current - 1) })}#lista`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
                    >
                      <Icon name="izquierda" size={16} /> Anterior
                    </Link>
                  )}
                  {Array.from({ length: pages }, (_, n) => n + 1).map((n) => (
                    <Link
                      key={n}
                      href={`${href({ calificacion: verdict, candidato: candidate, tema: topic, pagina: n > 1 ? String(n) : undefined })}#lista`}
                      aria-current={n === current ? 'page' : undefined}
                      className={cn(
                        'grid size-11 place-items-center rounded-full font-mono text-sm tabular-nums no-underline ring-1',
                        n === current
                          ? 'bg-foreground text-background ring-foreground'
                          : 'ring-border hover:bg-muted',
                      )}
                    >
                      {n}
                    </Link>
                  ))}
                  {current < pages && (
                    <Link
                      href={`${href({ calificacion: verdict, candidato: candidate, tema: topic, pagina: String(current + 1) })}#lista`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
                    >
                      Siguiente <Icon name="derecha" size={16} />
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </>
      )}
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
        value: (a: Interview) => a.nota.criterios[id] ?? 0,
        display: (a: Interview) => {
          const value = a.nota.criterios[id];
          return value === undefined ? '—' : decimal(value);
        },
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
      { name: 'No contesta a lo preguntado', max: 30, value: dodges },
      { name: 'Repreguntas e insistencias', max: 100, value: followUps },
      {
        name: 'Su parte de la palabra',
        max: 100,
        value: (a) => speakingShare(a, 'candidato'),
        display: (a) => `${speakingShare(a, 'candidato')} %`,
      },
    ],
  },
  {
    title: 'Los compromisos',
    metrics: [
      { name: 'Comprobables', max: 20, value: checkable },
      {
        name: 'En total',
        max: 40,
        value: (a) => getCommunication(a.id)?.compromisos.length ?? a.propuestas.length,
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
        value: (a) => interruptions(a).candidate,
      },
    ],
  },
  {
    title: 'Cómo le trató el entrevistador',
    metrics: [
      {
        name: 'Parte de la palabra del entrevistador',
        max: 100,
        value: (a) => speakingShare(a, 'jordi'),
        display: (a) => `${speakingShare(a, 'jordi')} %`,
      },
      {
        name: 'Le corta o cierra el intercambio',
        max: 20,
        value: (a) => interruptions(a).interviewer,
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

// «Lado a lado», como el comparador de El VAR Electoral: una ronda a la vez, con la
// misma escala y siempre en el mismo orden. Las entrevistas que faltan quedan como pendientes y,
// si la ronda no es comparable, se avisa.
export function InterviewsCompare({ roundId }: { roundId?: string }) {
  const round = rounds.find((r) => r.id === roundId) ?? compareRound();
  if (!round)
    return (
      <ReportIntro title="Lado a lado">
        <p>Todavía no hay ninguna ronda de entrevistas.</p>
      </ReportIntro>
    );
  const entries = roundInterviews(round.id);
  const all = entries.flatMap(({ candidate, interview }) =>
    interview ? [{ candidate, interview }] : [],
  );
  const people: Person[] = entries.map(({ candidate, interview, cancelled }) => ({
    candidate,
    score: interview ? decimal(interview.nota.global) : null,
    provisional: !!interview?.pending,
    interviewId: interview?.id ?? null,
    cancelled,
  }));
  const figures: Figure[] = metricGroups.flatMap((group) =>
    group.metrics.map((m) => {
      const values = all.map(({ interview }) => m.value(interview));
      return {
        group: group.title,
        name: m.name,
        max: Math.max(m.max, ...values),
        kind: m.kind,
        color: m.color,
        values: Object.fromEntries(
          all.map(({ candidate, interview }, i) => [
            candidate.slug,
            {
              value: values[i] ?? 0,
              display: `${m.display?.(interview) ?? String(values[i])}${m.aside ? ` ${m.aside(interview)}` : ''}`,
            },
          ]),
        ),
      };
    }),
  );
  const footprint: Footprint = {
    axes: footprintAxes.map(({ name, text }) => ({ name, text })),
    values: Object.fromEntries(
      all.map(({ candidate, interview }) => [
        candidate.slug,
        footprintAxes.map((axis) => axis.value(interview)),
      ]),
    ),
  };
  // Con análisis de comunicación, sus preguntas y su forma de clasificar las respuestas.
  const askedIn = (interview: Interview, id: string | undefined) => {
    const c = getCommunication(interview.id);
    const q = c?.preguntas.find((p) => p.id === id);
    if (q) return { text: q.texto, name: replyNames[q.respuesta], ...replyMarks[q.respuesta] };
    const p = c ? undefined : interview.preguntas.find((x) => x.id === id);
    return p && { text: p.texto, name: answers[p.respuesta], ...answerMarks[p.respuesta] };
  };
  const commons: Common[] = commonQuestions(round.id).map((q) => ({
    id: q.id,
    topic: q.tema,
    question: q.pregunta,
    answers: Object.fromEntries(
      all.flatMap(({ candidate, interview }) => {
        const asked = askedIn(interview, q.respuestas[candidate.slug]);
        return asked ? [[candidate.slug, { ...asked, href: interviewsHref(interview.id) }]] : [];
      }),
    ),
  }));
  const answerLegend = all.every(({ interview }) => getCommunication(interview.id))
    ? replyIds.map((id) => ({ name: replyNames[id], ...replyMarks[id] }))
    : answerIds.map((id) => ({ name: answers[id], ...answerMarks[id] }));

  return (
    <>
      <ReportIntro title="Lado a lado">
        <p>
          Las entrevistas de una misma ronda, con las mismas reglas y la misma escala: cómo responde
          cada candidato, qué preguntas se repitieron y todas las cifras. No hay ganador. Pulsa en
          un candidato de la barra para destacarlo en todos los gráficos.
        </p>
      </ReportIntro>

      <div className="mb-12 grid justify-items-start gap-4">
        <Label>Ronda</Label>
        <nav aria-label="Rondas" className="flex flex-wrap gap-2">
          {[...rounds]
            .sort((x, y) => y.date.localeCompare(x.date))
            .map((r) => (
              <Link
                key={r.id}
                href={interviewsHref(`comparar/${r.id}`)}
                aria-current={r.id === round.id ? 'page' : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm no-underline ring-1 ring-border hover:bg-muted aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:ring-foreground"
              >
                {r.title}
                <span className="opacity-60">· {shortDay(r.date)}</span>
              </Link>
            ))}
        </nav>
        <p className="m-0 max-w-[65ch] text-muted-foreground">{round.text}</p>
        {!round.comparable && (
          <p className="m-0 max-w-[65ch] rounded-xl border border-dashed border-destructive/50 px-4 py-3 text-sm text-destructive">
            {round.note
              ? `${round.note[0]?.toUpperCase()}${round.note.slice(1)}`
              : 'Formatos distintos'}
            : las cifras no se pueden comparar entre candidatos.
          </p>
        )}
      </div>

      {all.length ? (
        <CompareBoard
          people={people}
          figures={figures}
          footprint={footprint}
          commons={commons}
          answers={answerLegend}
        />
      ) : (
        <Grid>
          <Cell span={7} label="Pendiente">
            <p className="m-0 max-w-[60ch]">
              Todavía no hay ninguna entrevista publicada en esta ronda.
            </p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {entries.map(({ candidate }) => (
                <li key={candidate.slug} className="flex items-center gap-3">
                  <Portrait candidate={candidate} kind="avatar" sizes="80px" className="size-10" />
                  <span className="font-medium">{candidate.name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">Pendiente</span>
                </li>
              ))}
            </ul>
          </Cell>
        </Grid>
      )}
      <div className="mt-12 grid gap-6">
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

// La huella: ocho ejes, cada uno de 0 al mismo tope para los cuatro.
const average = (values: number[]) => values.reduce((t, v) => t + v, 0) / (values.length || 1);
const footprintAxes: { name: string; text: string; value: (a: Interview) => number }[] = [
  {
    name: 'Palabra',
    text: 'Su parte de la palabra',
    value: (a) => speakingShare(a, 'candidato') / 100,
  },
  {
    name: 'Directas',
    text: 'Respuestas que van al grano',
    value: directShare,
  },
  {
    name: 'Compromisos',
    text: 'Compromisos comprobables (tope: 20)',
    value: (a) => checkable(a) / 20,
  },
  {
    name: 'Intensidad',
    text: 'Ida y vuelta por minuto, de media',
    value: (a) => average(perMinute(a).map((m) => m.intensity)),
  },
  {
    name: 'Críticas',
    text: 'Críticas a la política de otros (tope: 20)',
    value: (a) => a.ataques.filter((x) => x.tipo === 'politica').length / 20,
  },
  {
    name: 'Interrumpe',
    text: 'Veces que corta a quien habla (tope: 10)',
    value: (a) => interruptions(a).candidate / 10,
  },
  { name: 'Ritmo', text: 'Palabras por minuto (tope: 300)', value: (a) => speech(a).pace / 300 },
  {
    name: 'Trabas',
    text: 'Trabas por cada 100 palabras (tope: 1)',
    value: (a) =>
      getCommunication(a.id)?.habla.invitado.trabasPor100 ??
      (speech(a).stutters / (speech(a).pace || 1)) * 100,
  },
];

// Lo que se marca en cada entrevista, con el icono que lleva en la línea de tiempo.
const rules: [Mark['kind'], string, string][] = [
  [
    'comprobable',
    'Compromiso comprobable',
    'Tiene una cifra, una ley o un sí o un no que se podrá comprobar',
  ],
  [
    'compromiso',
    'Compromiso sin objeto comprobable',
    'Una intención general, como «bajar los impuestos»',
  ],
  [
    'dura',
    'Pregunta dura sin respuesta clara',
    'Incómoda, repregunta o insistencia, y la respuesta no contesta del todo a lo preguntado',
  ],
  ['pausa', 'Pausa larga', 'Un silencio de un segundo y medio o más en su respuesta'],
  ['traba', 'Traba', 'Repite una palabra o se corta a media frase'],
  ['comentado', 'Lo más comentado', 'Un minuto que citan los comentarios de YouTube'],
  ['critica', 'Crítica política', 'Crítica a la política de otro'],
  ['ataque', 'Ataque personal', 'Ataque personal o descalificación'],
  ['interrumpe', 'Interrumpe', 'El candidato corta a quien habla antes de que termine'],
  ['interrumpido', 'Le interrumpen', 'El entrevistador corta al candidato antes de que termine'],
  ['momento', 'Momento clave', 'Donde coinciden varias señales, con lo que se oye en ese minuto'],
];

const officialSources = [
  'INE',
  'EPA',
  'Eurostat',
  'Banco de España',
  'BOE',
  'Seguridad Social',
  'CIS',
  'AIReF',
  'Ministerios',
];
// Las señales de «Cómo habla»: nombre, unidad y qué cuenta.
const speechSignals = [
  ['Ritmo', 'palabras por minuto', 'Palabras por minuto en los tramos que habla sin pausas'],
  [
    'Trabas',
    'por 100 palabras',
    'Repite una palabra o un grupo de palabras, o se corta a media frase',
  ],
  ['Pausas', 'por 1.000 palabras', 'Silencios de más de 0,4 segundos dentro de lo que dice'],
];

const fairness = [
  [
    'Escalas absolutas',
    'Cada criterio tiene ejemplos fijos de lo que es un 0, un 5 y un 10. Nadie suspende solo por quedar el último.',
  ],
  [
    'Por hora, no en totales',
    'Se cuenta por pregunta y por hora, porque las entrevistas no duran lo mismo.',
  ],
  [
    'Muestras pequeñas',
    'Con pocas afirmaciones comprobables, la valoración se acerca al centro en lugar de dispararse.',
  ],
  ['Mismo análisis', 'Mismo modelo, misma versión y mismas instrucciones para todos.'],
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
          La valoración no juzga las ideas de nadie. Mide cómo responde cada candidato: si sus datos
          son ciertos, si va al grano y si concreta lo que propone, con los mismos criterios para
          todos. Todo lo hace la IA y lo comprueba una segunda pasada de IA. Como ninguna persona lo
          revisa a mano, cada dato lleva su fuente enlazada para que puedas comprobarlo.
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
            Cada afirmación se busca primero en fuentes oficiales y, si no las hay, en prensa de
            referencia, y se publica con los enlaces. Si ninguna fuente la confirma ni la desmiente,
            sale como «Sin fuente»: no se califica ni cuenta en la valoración. Después, una segunda
            pasada de IA abre cada fuente y confirma o corrige la calificación. Lo que aún no ha
            pasado por ella lleva la marca «Sin revisar».
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
            {officialSources.map((name) => (
              <li key={name} className="rounded-full px-3 py-1 ring-1 ring-border">
                {name}
              </li>
            ))}
          </ul>
        </Cell>
        <Cell span={7} label="Lo que se marca en cada entrevista">
          <dl className="m-0 grid gap-3">
            {rules.map(([kind, name, text]) => (
              <div
                key={name}
                className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1"
              >
                <dt className="flex items-center gap-2 font-medium">
                  <MarkIcon kind={kind} />
                  {name}
                </dt>
                <dd className="m-0 text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </Cell>
        <Cell span={5} label="Las preguntas, los compromisos y los momentos clave">
          <p className="m-0">
            Salen del análisis de comunicación. Cada pregunta se clasifica por su dureza y por cómo
            se responde; cada compromiso, por si se podrá comprobar. Los momentos clave son puntos
            donde coinciden varias señales medidas por separado, como la voz, las pausas o cómo se
            pregunta y se responde.
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            Que varias señales coincidan no demuestra relación entre ellas ni intención alguna.
          </p>
        </Cell>
      </Grid>

      <ReportSection title="Pon tú los pesos">
        <p className="m-0 mb-6 max-w-[65ch] text-muted-foreground">
          Dos candidatos ficticios con perfiles opuestos. Mueve los pesos y verás que cambia quién
          queda por delante: por eso son públicos.
        </p>
        <Grid>
          <Cell>
            <ScoreSimulator
              criteria={criterionIds.map((id) => ({
                id,
                name: criteria[id].name,
                weight: criteria[id].weight,
              }))}
            />
          </Cell>
        </Grid>
      </ReportSection>

      <ReportSection title="Lo que se mide minuto a minuto">
        <Grid>
          <Cell span={6} label="Intensidad">
            <p className="m-0">
              Cada minuto suma los cambios de turno entre el entrevistador y el candidato (de cuatro
              palabras o más), el triple por cada interrupción y el doble por cada momento de
              tensión: preguntas duras sin respuesta clara, ataques personales y datos que no salen
              «Cierto».
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              La escala es la misma para todos, con un máximo de {intensityScale} puntos por minuto.
              Mide el ida y vuelta, no las emociones.
            </p>
          </Cell>
          <Cell span={6} label="Cómo habla">
            <dl className="m-0 grid gap-3">
              {speechSignals.map(([name, unit, text]) => (
                <div key={name}>
                  <dt className="font-medium">
                    {name} <span className="font-normal text-muted-foreground">({unit})</span>
                  </dt>
                  <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 text-sm text-muted-foreground">
              Las mide el análisis de comunicación, palabra a palabra y con las mismas reglas para
              todos. No dicen si alguien está nervioso ni si es sincero.
            </p>
          </Cell>
          <Cell label="Lo que solo se ve en el vídeo">
            <dl className="m-0 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {visualIds.map((id) => (
                <div key={id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                  <MarkIcon kind={id} />
                  <span>
                    <dt className="font-medium">{visuals[id].name}</dt>
                    <dd className="m-0 text-sm text-muted-foreground">{visuals[id].text}.</dd>
                  </span>
                </div>
              ))}
            </dl>
          </Cell>
        </Grid>
      </ReportSection>

      <ReportSection title="El análisis de comunicación">
        <Grid>
          <Cell span={7}>
            <p className="m-0 max-w-[65ch]">
              Algunas entrevistas tienen, aparte de la revisión, un análisis de comunicación: cómo
              pregunta el entrevistador y cómo se le responde, la voz, las trabas, los silencios y
              los movimientos de la cara, con las mismas medidas para todos los de su ronda. No
              entra en la valoración sobre 10 ni usa sus calificaciones.
            </p>
            <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
              Las preguntas y las respuestas las clasifica una IA con un criterio escrito; la voz y
              la cara las mide un programa, frase a frase y fotograma a fotograma. Cada informe dice
              cómo se ha hecho y qué no puede decir.
            </p>
          </Cell>
          <Cell span={5} label="La cara, solo como movimiento">
            <p className="m-0">
              Se mide con unidades de acción del sistema FACS, que nombran movimientos de músculos:
              cejas, párpados, comisuras. Nunca con etiquetas de emoción, y cada persona se compara
              con su propia cara.
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              Ni los gestos, ni la voz, ni las pausas sirven para saber si alguien dice la verdad.
            </p>
          </Cell>
        </Grid>
      </ReportSection>

      <ReportSection title="Para que sea comparable">
        <Grid>
          {fairness.map(([title, text]) => (
            <Cell key={title} span={4}>
              <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{title}</h3>
              <p className="m-0 text-muted-foreground">{text}</p>
            </Cell>
          ))}
        </Grid>
      </ReportSection>

      <Grid>
        <Cell span={6} label="Qué entrevistas se revisan">
          <p className="m-0 max-w-[60ch]">
            Por rondas: el mismo programa entrevista a los cuatro candidatos en la misma semana,
            nunca a uno solo. Entrevistas individuales de 30 minutos o más, en un medio de alcance
            nacional y publicadas íntegras. Si un candidato cancela, la ronda sale con los demás y
            lo indica.
          </p>
        </Cell>
        <Cell span={6} label="Independencia y correcciones">
          <p className="m-0 max-w-[60ch]">
            Esta sección no tiene relación con los medios cuyas entrevistas analiza ni con ningún
            partido, y todos los candidatos reciben el mismo trato. Si hay un error, se corrige a la
            vista, con la fecha y el motivo.
          </p>
        </Cell>
      </Grid>
    </>
  );
}
