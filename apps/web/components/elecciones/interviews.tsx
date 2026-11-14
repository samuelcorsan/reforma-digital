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
  getInterview,
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
  isHard,
  pressure,
  replyIds,
  replyNames,
  type Communication,
} from '../../lib/elecciones/communication';
import { electionPages, electionsHref } from '../../lib/elecciones/pages';
import { Icon } from '../brand/icon';
import { AI, Source } from '../congreso/common';
import {
  CompareBoard,
  type Common,
  type Figure,
  type Footprint,
  type Person,
} from './compare-board';
import { InterviewPlayer } from './interview-player';
import { answerMarks, IconChip, MarkIcon, replyMarks, type AnswerMark } from './mark-icon';
import type { LocalNav, NavItem } from './section-nav';
import { PhotoCredits, Portrait } from './portrait';
import { ScoreSimulator } from './score-simulator';
import { ShareButton } from './share-button';
import { DaysUntil } from './days-until';
import { Bars, Cell, Grid, Label, ReportIntro, ReportSection, Stat } from './report';

export const interviewsHref = (path = '') => electionsHref(`entrevistas${path ? `/${path}` : ''}`);

// Las subpáginas de una entrevista: el resumen es la de entrada (sin ruta propia).
export const reportViews = {
  resumen: 'Resumen',
  verificaciones: 'Verificaciones',
  compromisos: 'Compromisos',
  criticas: 'Críticas',
  preguntas: 'Preguntas',
  expresion: 'Expresión oral',
  video: 'Vídeo y transcripción',
} as const;
export type ReportView = keyof typeof reportViews;
export const reportHref = (id: string, view: ReportView = 'resumen') =>
  interviewsHref(view === 'resumen' ? id : `${id}/${view}`);
// El vídeo en un segundo: en YouTube, que la página abre en el reproductor flotante (o, si la
// página tiene el suyo, en él). Sin YouTube, el reproductor propio de la entrevista, con su reloj.
export const videoHref = (id: string, second = 0) => {
  const a = getInterview(id);
  return a?.youtubeId
    ? `https://www.youtube.com/watch?v=${a.youtubeId}&t=${Math.floor(second)}s`
    : playerHref(id, second);
};
// El reproductor propio de la entrevista en un segundo: con análisis de comunicación, en su línea de
// tiempo; sin él, en la subpágina «Vídeo y transcripción».
export const playerHref = (id: string, second = 0) =>
  `${
    getCommunication(id)
      ? interviewsHref(`${id}/${communicationPath}/linea`)
      : reportHref(id, 'video')
  }?t=${Math.floor(second)}#minuto`;

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
  return <Badge variant="outline">Sin revisar</Badge>;
}

// Cuánto se ha revisado, en una barra corta. Decorativa: el texto de al lado da las cifras.
function ReviewBar({ review }: { review: Interview['review'] }) {
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

// «13 nov»: el día y el mes de una fecha ISO.
const shortDay = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });

export function InterviewsHome() {
  const upcoming = pendingRound();
  const compared = comparableRound();
  const complete =
    !!compared && roundInterviews(compared.id).every((e) => e.interview || e.cancelled);
  const status =
    upcoming &&
    (roundInterviews(upcoming.id).some((e) => e.interview) ? (
      `En revisión · ${upcoming.title}`
    ) : (
      <>
        Próxima ronda · {shortDay(upcoming.date)}
        <DaysUntil date={upcoming.date} />
      </>
    ));
  return (
    <>
      <Grid>
        <div className="col-span-12 flex flex-col items-center gap-10 pt-4 pb-12 text-center lg:pt-8 lg:pb-16">
          <div className="grid justify-items-center gap-4">
            {status && <Badge>{status}</Badge>}
            <h1 className="m-0 max-w-[18ch] font-heading text-4xl leading-[1.08] font-normal lg:text-[56px]">
              {electionPages.entrevistas.title}
            </h1>
            <p className="m-0 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              Verificación de cada dato con fuentes oficiales y valoración sobre 10.
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
      </Grid>

      <section aria-label="Candidatos" className="mb-16">
        <Grid>
          {candidates.map((c) => {
            const latest = interviewsOf(c.slug)[0];
            const next = pendingRound(c.slug);
            const cancelled = cancelledRound(c.slug);
            return (
              <Card
                key={c.slug}
                render={latest ? <Link href={interviewsHref(latest.id)} /> : undefined}
                className={cn(
                  'group group/candidato col-span-6 gap-4 p-3 text-base no-underline outline-none md:col-span-3',
                  latest &&
                    'transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50',
                )}
              >
                <div className="overflow-hidden rounded-xl">
                  <Portrait
                    candidate={c}
                    sizes="(min-width: 768px) 360px, 60vw"
                    hoverColor
                    className="transition-transform duration-500 ease-(--ease-brand) motion-safe:group-hover:scale-[1.04]"
                  />
                </div>
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
                    {latest && (
                      <span className="transition-transform duration-300 ease-(--ease-brand) motion-safe:group-hover:translate-x-1">
                        <Icon name="derecha" size={16} />
                      </span>
                    )}
                  </p>
                </div>
              </Card>
            );
          })}
        </Grid>
      </section>
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
                  ` · calificación anterior: ${verdicts[r.segundaRevision.sugerencia].name}`}
              </Badge>
            )}
            {r.pilladoEnDirecto && <Badge variant="outline">Señalado en directo</Badge>}
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
      href={videoHref(a.id, second)}
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

// Los primeros a la vista y el resto plegado detrás de «Ver los N restantes».
function Rest({ count, children }: { count: number; children: ReactNode }) {
  if (count <= 0) return null;
  return (
    <Collapsible className="col-span-12 grid">
      <CollapsibleContent className="grid">{children}</CollapsibleContent>
      <CollapsibleTrigger className="group mt-4 inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full px-4 text-sm font-medium ring-1 ring-border hover:bg-muted">
        <span className="group-data-open:hidden">
          Ver {count === 1 ? 'el restante' : `los ${count} restantes`}
        </span>
        <span className="hidden group-data-open:inline">Ver menos</span>
        <span aria-hidden="true" className="flex group-data-open:rotate-180">
          <Icon name="abajo" size={14} />
        </span>
      </CollapsibleTrigger>
    </Collapsible>
  );
}

// Las preguntas por tema (los temas en el orden en que salen), con cómo responde a cada una y la leyenda de esas
// respuestas. Con análisis de comunicación, las suyas: su tema, su dureza y su clase de respuesta.
type QuestionItem = {
  key: string;
  second: number;
  text: string;
  mark: AnswerMark;
  answer: string;
  // El orden de su clase de respuesta, para agrupar por color: de responde a no le dejan.
  rank: number;
};
// Cada tema con sus preguntas ordenadas por clase de respuesta (por color) y, dentro, por minuto.
const byColor = <T extends QuestionItem>(groups: Map<string, T[]>) =>
  [...groups].map(
    ([topic, list]) =>
      [topic, [...list].sort((x, y) => x.rank - y.rank || x.second - y.second)] as const,
  );
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
        rank: replyIds.indexOf(q.respuesta),
        notes: [
          `Pregunta ${hardnessNames[q.dureza].toLowerCase()}`,
          shared.has(q.id) && 'Pregunta común a otros candidatos',
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
      groups: byColor(groups),
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
      rank: answerIds.indexOf(q.respuesta),
      notes: [
        q.repregunta && (
          <span className="inline-flex items-center gap-1.5">
            <MarkIcon kind="repregunta" className="size-5" /> Repregunta
          </span>
        ),
        shared.has(q.id) && 'Pregunta común a otros candidatos',
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
    groups: byColor(groups),
  };
}

// Una sección del informe: cada una vive en su subpágina.
type ReportPart =
  'verificaciones' | 'momentos' | 'propuestas' | 'criticas' | 'preguntas' | 'perfil';
function ReportSections({
  interview: a,
  only,
  quiet,
}: {
  interview: Interview;
  only: ReportPart;
  quiet?: boolean;
}) {
  const proposals = [...a.propuestas].sort((x, y) => proposalScore(y) - proposalScore(x));
  const byVerdict = verdictOrder
    .map((id) => [id, a.revisiones.filter((r) => r.veredicto === id)] as const)
    .filter(([, list]) => list.length > 0);
  const c = getCommunication(a.id);
  const questions = questionGroups(a);
  return (
    <>
      {only === 'verificaciones' && a.revisiones.length > 0 && (
        <ReportSection quiet={quiet} id="verificaciones" title="Verificación de afirmaciones">
          <AI label="Verificado y revisado con IA">
            <p>
              La IA busca cada dato en fuentes oficiales y lo califica. Una segunda pasada de IA
              abre esas fuentes y confirma o corrige la calificación; ninguna persona las revisa.
              «Sin revisar» marca las que aún no han pasado esa segunda pasada.
            </p>
          </AI>
          <div className="mt-6 grid gap-4">
            {byVerdict.map(([id, list]) => {
              // Cada una en una fila: la cita a la vista; el porqué y las fuentes, al desplegar.
              const items = (
                <ul className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
                  {list.map((r) => (
                    <li key={r.id} className="grid gap-2 border-b border-border py-4 last:border-0">
                      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Jump interview={a} second={r.segundo} />
                        <Unreviewed estado={r.estado} />
                      </p>
                      <blockquote className="m-0 font-heading text-lg leading-snug">
                        «{r.cita}»
                      </blockquote>
                      <Fold
                        summary={<span className="text-sm font-medium">Explicación y fuentes</span>}
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
              );
              const title = (
                <span className="flex items-center gap-3 font-heading text-2xl leading-tight font-normal">
                  <MarkIcon kind={id} color={verdicts[id].color} />
                  {verdicts[id].name}
                  <span className="text-muted-foreground tabular-nums">{list.length}</span>
                </span>
              );
              // Todas plegadas, con su recuento: se abre la que interesa.
              return (
                <div key={id} className="grid">
                  <Cell className="gap-2">
                    <Fold summary={<h3 className="m-0">{title}</h3>}>
                      <p className="m-0 text-sm text-muted-foreground">{verdicts[id].text}</p>
                      {items}
                    </Fold>
                  </Cell>
                </div>
              );
            })}
          </div>
        </ReportSection>
      )}

      {only === 'propuestas' && c && c.compromisos.length > 0 && (
        <ReportSection quiet={quiet} id="propuestas" title="Compromisos">
          {(() => {
            // Los comprobables primero; se ven cuatro y el resto se despliega.
            const list = [...c.compromisos].sort(
              (x, y) => +y.verificable - +x.verificable || x.segundo - y.segundo,
            );
            const card = (x: (typeof list)[number]) => (
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
            );
            return (
              <Grid>
                {list.slice(0, 4).map(card)}
                <Rest count={list.length - 4}>
                  <Grid className="mt-4">{list.slice(4).map(card)}</Grid>
                </Rest>
              </Grid>
            );
          })()}
        </ReportSection>
      )}

      {only === 'momentos' && !c && a.momentos.length > 0 && (
        <ReportSection quiet={quiet} id="momentos" title="Momentos clave">
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

      {only === 'propuestas' && !c && proposals.length > 0 && (
        <ReportSection quiet={quiet} id="propuestas" title="Propuestas">
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

      {only === 'criticas' && a.ataques.length > 0 && (
        <ReportSection quiet={quiet} id="criticas" title="Críticas a terceros">
          {(() => {
            const row = (x: (typeof a.ataques)[number]) => (
              <li key={x.id} className="grid gap-1 border-b border-border py-4 last:border-0">
                <Label>
                  <MarkLabel kind={x.tipo === 'personal' ? 'ataque' : 'critica'}>
                    {x.tipo === 'personal' ? 'Ataque personal' : 'Crítica política'} · a{' '}
                    {x.objetivo}
                  </MarkLabel>
                </Label>
                <p className="m-0">«{x.texto}»</p>
                <Jump interview={a} second={x.segundo} />
              </li>
            );
            return (
              <Cell className="gap-0">
                <ul className="m-0 grid list-none p-0">{a.ataques.slice(0, 6).map(row)}</ul>
                <Rest count={a.ataques.length - 6}>
                  <ul className="m-0 grid list-none border-t border-border p-0">
                    {a.ataques.slice(6).map(row)}
                  </ul>
                </Rest>
              </Cell>
            );
          })()}
        </ReportSection>
      )}
      {only === 'preguntas' && questions.total > 0 && (
        <ReportSection
          quiet={quiet}
          id="preguntas"
          title={`Preguntas por tema (${questions.total})`}
        >
          <ul className="m-0 mb-4 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted-foreground">
            {questions.legend
              .filter((l) => l.count > 0)
              .map((l) => (
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

      {only === 'perfil' && <Profile interview={a} />}
    </>
  );
}

// Su perfil: cómo habla y cómo le trató el entrevistador, con las mismas reglas para los cuatro.
function Profile({ interview: a }: { interview: Interview }) {
  const s = speech(a);
  const i = interviewer(a);
  const c = getCommunication(a.id);
  const who = interviewerOf(a);
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
    <ReportSection id="perfil" title="Expresión oral y trato del entrevistador">
      <Grid>
        {c ? (
          <Cell span={6} label="Expresión oral">
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
              Fuente: análisis de comunicación. Traba: repetición de una palabra o corte a media
              frase. Estas cifras no indican nerviosismo ni sinceridad.
            </p>
          </Cell>
        ) : (
          <Cell span={6} label="Expresión oral">
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
                <span className="text-muted-foreground">Palabras más repetidas:</span>
                {s.top.map(([word, n]) => (
                  <span key={word} className="rounded-full px-3 py-1 ring-1 ring-border">
                    «{word}» <span className="text-muted-foreground tabular-nums">× {n}</span>
                  </span>
                ))}
              </p>
            )}
            <p className="m-0 text-sm text-muted-foreground">
              Recuentos sobre la transcripción. No indican nerviosismo ni sinceridad.
            </p>
          </Cell>
        )}
        <Cell
          span={6}
          label={who ? `Intervenciones de ${who}` : 'Intervenciones del entrevistador'}
        >
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
                : 'Interrupciones al candidato',
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

// El resumen de la entrevista, en un bento: cada dato con el tamaño que necesita. Las conclusiones
// del análisis de comunicación en grande; la valoración y sus criterios al lado; debajo, veracidad,
// respuestas, compromisos, palabra, temas y críticas. Al final, una tarjeta por cada subpágina.
function ReportSummary({ interview: a }: { interview: Interview }) {
  const c = getCommunication(a.id);
  const who = interviewerOf(a);
  const candidate = getCandidate(a.candidato);
  const count = (id: keyof typeof verdicts) =>
    a.revisiones.filter((r) => r.veredicto === id).length;
  const stack = (['legal', 'amarilla', 'sinfuente', 'fuera', 'roja'] as const).filter(count);
  const total = a.revisiones.length;
  const { hard, answered } = c ? pressure(c) : { hard: 0, answered: 0 };
  const share = (x: { length: number }, of: { length: number }) =>
    Math.round((x.length / (of.length || 1)) * 100);
  // Cómo responde: cada clase con su icono y su color, en una barra y en la leyenda.
  const replies = (
    c
      ? replyIds.map((id) => ({
          mark: replyMarks[id],
          name: replyNames[id],
          // Solo las duras, como «N de M preguntas duras» encima.
          n: c.preguntas.filter((q) => isHard(q) && q.respuesta === id).length,
        }))
      : answerIds.map((id) => ({
          mark: answerMarks[id],
          name: answers[id],
          n: a.preguntas.filter((p) => p.respuesta === id).length,
        }))
  ).filter((r) => r.n > 0);
  const commitments = c?.compromisos ?? [];
  const commitRows: [string, number][] = c
    ? [
        [
          'Con plazo',
          share(
            commitments.filter((x) => x.plazo !== null),
            commitments,
          ),
        ],
        [
          'Con condición',
          share(
            commitments.filter((x) => x.condicion !== null),
            commitments,
          ),
        ],
      ]
    : (
        [
          ['que', 'Qué'],
          ['cuanto', 'Cuánto'],
          ['cuando', 'Cuándo'],
          ['como', 'Cómo'],
        ] as const
      ).map(([key, label]) => [
        label,
        share(
          a.propuestas.filter((p) => p[key]),
          a.propuestas,
        ),
      ]);
  const figure = (value: ReactNode, text: ReactNode) => (
    <p className="m-0 grid gap-1.5">
      <span className="font-heading text-4xl leading-none tabular-nums lg:text-5xl">{value}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </p>
  );
  // Una barra partida en tramos, con su color, y debajo la leyenda con icono, nombre y número.
  const split = (
    parts: { key: string; n: number; color: string; icon: ReactNode; name: string }[],
  ) => (
    <>
      <span aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <i key={p.key} className="block h-full" style={{ flex: p.n, background: p.color }} />
        ))}
      </span>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            {p.icon}
            {p.name}
            <b className="font-medium tabular-nums">{p.n}</b>
          </li>
        ))}
      </ul>
    </>
  );
  const tile = 'gap-4 p-5 lg:p-6';
  const views = availableViews(a).filter((v) => v !== 'resumen');
  const blurb: Record<ReportView, string> = {
    resumen: '',
    verificaciones: `${total} afirmaciones con su calificación y sus fuentes`,
    compromisos: c
      ? `${commitments.length} compromisos, comprobables o no`
      : `${a.propuestas.length} propuestas y lo que les falta`,
    criticas: `${a.ataques.length} críticas y a quién van`,
    preguntas: `${c?.preguntas.length ?? a.preguntas.length} preguntas por tema y cómo responde`,
    expresion: 'Ritmo, trabas, pausas y trato del entrevistador',
    video: `${minute(a.duracion)} con línea de tiempo y transcripción`,
  };
  return (
    <>
      <ReportSection id="resumen" title="Resumen">
        <Grid className="grid-flow-dense">
          {c && (
            <Cell span={6} label="Conclusiones" className={tile}>
              <p className="m-0 max-w-[48ch] font-heading text-2xl leading-snug lg:text-[28px]">
                {c.titular}
              </p>
            </Cell>
          )}

          <Cell
            span={3}
            label={a.pending ? 'Valoración provisional' : 'Valoración'}
            className={tile}
          >
            {figure(
              <>
                {decimal(a.nota.global)}
                <span className="ml-1.5 text-lg text-muted-foreground">/ 10</span>
              </>,
              `Margen de ± ${decimal(a.nota.margen)} puntos.`,
            )}
          </Cell>

          <Cell span={3} label="Reparto de la palabra" className={tile}>
            {figure(
              `${speakingShare(a, 'candidato')} %`,
              `${c ? 'de las palabras' : 'del tiempo'}, frente al ${speakingShare(a, 'jordi')} % de ${who ?? 'el entrevistador'}.`,
            )}
            <span aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              <i
                className="block h-full"
                style={{
                  flex: speakingShare(a, 'candidato'),
                  background: candidate?.color ?? 'var(--foreground)',
                }}
              />
              <i
                className="block h-full bg-muted-foreground/30"
                style={{ flex: speakingShare(a, 'jordi') }}
              />
            </span>
          </Cell>

          {total > 0 && (
            <Cell span={8} label="Veracidad" className={tile}>
              {figure(
                `${count('legal') + count('amarilla')} de ${total}`,
                'afirmaciones verificadas son ciertas o tienen matices.',
              )}
              {split(
                stack.map((id) => ({
                  key: id,
                  n: count(id),
                  color: verdicts[id].color,
                  icon: <MarkIcon kind={id} color={verdicts[id].color} className="size-5" />,
                  name: verdicts[id].name,
                })),
              )}
            </Cell>
          )}

          <Cell span={4} label="Por criterio" className={tile}>
            <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
              {criterionIds.flatMap((id) => {
                const value = a.nota.criterios[id];
                return value === undefined
                  ? []
                  : [
                      <li
                        key={id}
                        className="grid grid-cols-[minmax(0,1fr)_4rem_2rem] items-center gap-3"
                      >
                        <span className="truncate">
                          {criteria[id].name}{' '}
                          <span className="text-muted-foreground">{criteria[id].weight} %</span>
                        </span>
                        <span aria-hidden="true" className="h-1.5 rounded-full bg-muted">
                          <i
                            className="block h-full rounded-full bg-foreground"
                            style={{ width: `${value * 10}%` }}
                          />
                        </span>
                        <span className="text-right font-mono tabular-nums">{decimal(value)}</span>
                      </li>,
                    ];
              })}
            </ul>
            <Link
              href={interviewsHref('metodologia')}
              className="inline-flex items-center gap-2 self-start text-sm font-medium no-underline underline-offset-4 hover:underline"
            >
              Cómo se calcula <Icon name="derecha" size={14} />
            </Link>
          </Cell>

          <Cell span={6} label="Respuesta a las preguntas" className={tile}>
            {c
              ? figure(`${answered} de ${hard}`, 'preguntas duras con respuesta a lo preguntado.')
              : figure(`${a.stats.alGrano} %`, 'de respuestas directas.')}
            {split(
              replies.map((r) => ({
                key: r.name,
                n: r.n,
                color: r.mark.color,
                icon: <IconChip name={r.mark.icon} color={r.mark.color} className="size-5" />,
                name: r.name,
              })),
            )}
          </Cell>

          <Cell span={6} label={c ? 'Compromisos' : 'Propuestas'} className={tile}>
            {c
              ? figure(`${checkable(a)} de ${commitments.length}`, 'compromisos comprobables.')
              : figure(`${checkable(a)} de ${a.propuestas.length}`, 'propuestas completas.')}
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {commitRows.map(([label, value]) => (
                <li key={label} className="grid gap-1 rounded-xl bg-muted/60 p-3">
                  <span className="font-heading text-2xl leading-none tabular-nums">{value} %</span>
                  <span className="text-sm text-muted-foreground">{label.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </Cell>

          <Cell span={6} label="Temas con más tiempo" className={tile}>
            <Bars
              rows={topicShare(a)
                .slice(0, 4)
                .map((t) => ({ label: t.topic, value: t.share, display: `${t.share} %` }))}
            />
          </Cell>

          {a.ataques.length > 0 && (
            <Cell span={6} label="Destinatarios de las críticas" className={tile}>
              <Bars
                rows={[
                  ...a.ataques.reduce(
                    (count, x) => count.set(x.objetivo, (count.get(x.objetivo) ?? 0) + 1),
                    new Map<string, number>(),
                  ),
                ]
                  .sort((x, y) => y[1] - x[1])
                  .slice(0, 4)
                  .map(([target, value]) => ({ label: target, value, display: String(value) }))}
              />
            </Cell>
          )}
        </Grid>
      </ReportSection>

      {/* Qué se puede ver de la entrevista: una tarjeta por subpágina, con lo que contiene. */}
      <section aria-labelledby="detalle" className="my-16">
        <h2
          id="detalle"
          data-section-title
          className="m-0 mb-6 scroll-mt-40 font-heading text-[32px] leading-tight font-normal lg:text-[36px]"
        >
          Ver en detalle
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((view) => (
            <li key={view}>
              <Link
                href={reportHref(a.id, view)}
                className="group flex h-full min-h-28 flex-col gap-2 rounded-[20px] p-5 no-underline ring-1 ring-border transition-colors hover:bg-muted/60 motion-reduce:transition-none"
              >
                <span className="flex items-center justify-between gap-3 text-lg font-medium">
                  {viewName(a, view)}
                  <span className="flex transition-transform duration-300 ease-(--ease-brand) motion-safe:group-hover:translate-x-1">
                    <Icon name="derecha" size={16} />
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{blurb[view]}</span>
              </Link>
            </li>
          ))}
          {c && (
            <li>
              <Link
                href={interviewsHref(`${a.id}/${communicationPath}`)}
                className="group flex h-full min-h-28 flex-col gap-2 rounded-[20px] p-5 no-underline ring-1 ring-border transition-colors hover:bg-muted/60 motion-reduce:transition-none"
              >
                <span className="flex items-center justify-between gap-3 text-lg font-medium">
                  Análisis de comunicación
                  <span className="flex transition-transform duration-300 ease-(--ease-brand) motion-safe:group-hover:translate-x-1">
                    <Icon name="derecha" size={16} />
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  Voz, cara, temas y relación con el entrevistador
                </span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    </>
  );
}

// Las subpáginas que tiene esta entrevista (sin verificaciones, no hay subpágina de verificaciones).
export function availableViews(a: Interview): ReportView[] {
  const c = getCommunication(a.id);
  return (Object.keys(reportViews) as ReportView[]).filter((view) => {
    if (view === 'verificaciones') return a.revisiones.length > 0;
    if (view === 'compromisos') return (c?.compromisos ?? a.propuestas).length > 0;
    if (view === 'criticas') return a.ataques.length > 0;
    if (view === 'preguntas') return (c?.preguntas ?? a.preguntas).length > 0;
    // Con análisis de comunicación, la expresión oral y el trato del entrevistador están en él.
    if (view === 'expresion') return !c;
    // Con análisis de comunicación, la línea de tiempo y la transcripción viven en él.
    if (view === 'video') return !c;
    return true;
  });
}
const viewName = (a: Interview, view: ReportView) =>
  view === 'compromisos' && !getCommunication(a.id) ? 'Propuestas' : reportViews[view];

// Las subpáginas de la entrevista, para la barra lateral, y el análisis de comunicación.
// `analysis`: las partes del análisis de comunicación, que cuelgan de él en la barra lateral.
export function reportNav(a: Interview, analysis: NavItem['children'] = []): LocalNav {
  return {
    title: interviewName(a),
    sections: [
      {
        items: [
          ...availableViews(a).map((view) => ({
            href: reportHref(a.id, view),
            label: viewName(a, view),
          })),
          ...(getCommunication(a.id)
            ? [
                {
                  href: interviewsHref(`${a.id}/${communicationPath}`),
                  label: 'Análisis de comunicación',
                  children: analysis,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

export function InterviewReport({
  interview: a,
  view = 'resumen',
}: {
  interview: Interview;
  view?: ReportView;
}) {
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
          <b className="font-medium">Ejemplo con un candidato ficticio y datos inventados.</b> El
          formato es el mismo que el de los informes reales.
        </Notice>
      )}
      {view === 'resumen' ? (
        <>
          <Link
            href={interviewsHref()}
            className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <Icon name="izquierda" size={14} /> {electionPages.entrevistas.title}
          </Link>
          {/* Cabecera: quién, dónde y la frase que resume la entrevista. Las cifras van en el resumen. */}
          <header className="mb-4 grid items-center gap-x-8 gap-y-5 md:grid-cols-[9rem_minmax(0,1fr)]">
            {candidate ? (
              <Portrait
                candidate={candidate}
                sizes="(min-width: 768px) 240px, 40vw"
                hoverColor
                className="max-md:w-32"
              />
            ) : (
              <div className="grid aspect-[3/4] place-content-center rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground max-md:w-32">
                Candidato ficticio
              </div>
            )}
            <div className="grid content-start justify-items-start gap-3">
              <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                {candidate && <Dot color={candidate.color} />}
                {[
                  candidate?.party,
                  where,
                  day && formatDate(day, { day: 'numeric', month: 'long' }),
                  who && `Entrevistador: ${who}`,
                  minute(a.duracion),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h1 className="m-0 font-heading text-4xl leading-[1.05] font-normal lg:text-[56px]">
                {candidate && <span className="text-muted-foreground">Entrevista a </span>}
                {interviewName(a)}
              </h1>
              {communication?.frase && (
                <p className="m-0 max-w-[60ch] text-lg leading-snug text-muted-foreground">
                  {communication.frase}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {video ? (
                  <a
                    href={video}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-slot="button"
                    data-variant="outline"
                    className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
                  >
                    Ver la entrevista original
                    <span aria-hidden="true"> ↗</span>
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                ) : (
                  <p className="m-0 text-sm text-muted-foreground">
                    {a.ficticio
                      ? 'Entrevista ficticia, sin vídeo original.'
                      : 'Enlace al vídeo original no disponible.'}
                  </p>
                )}
                <ShareButton title={`Entrevista a ${interviewName(a)}: análisis`} />
              </div>
            </div>
          </header>
        </>
      ) : (
        // En las subpáginas, una cabecera ligera, como la de las del análisis de comunicación.
        <header className="mb-4 grid justify-items-start gap-2">
          <Link
            href={reportHref(a.id)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <Icon name="izquierda" size={14} /> Entrevista a {interviewName(a)}
          </Link>
          <h1 className="m-0 font-heading text-4xl leading-[1.08] font-normal lg:text-[52px]">
            {viewName(a, view)}
          </h1>
        </header>
      )}
      {(a.pending > 0 || (round && !round.comparable)) && (
        <div className="mb-4 grid gap-2 text-sm text-muted-foreground">
          {a.pending > 0 && (
            <p className="m-0 inline-flex items-center gap-3">
              <ReviewBar review={a.review} />
              Revisadas {a.review.reviewed} de {a.review.total} verificaciones y momentos. El resto
              está pendiente de revisión y la valoración puede cambiar.
            </p>
          )}
          {round && !round.comparable && (
            <p className="m-0">
              Ronda «{round.title}»: {round.note ?? 'formatos distintos'}. Sus cifras no se comparan
              con las de los demás.
            </p>
          )}
        </div>
      )}

      {view === 'resumen' && <ReportSummary interview={a} />}
      {view === 'verificaciones' && <ReportSections interview={a} only="verificaciones" quiet />}
      {view === 'compromisos' && <ReportSections interview={a} only="propuestas" quiet />}
      {view === 'criticas' && <ReportSections interview={a} only="criticas" quiet />}
      {view === 'preguntas' && <ReportSections interview={a} only="preguntas" quiet />}
      {view === 'expresion' && <ReportSections interview={a} only="perfil" quiet />}
      {view === 'video' && <TimelineAndTranscript interview={a} />}

      {view !== 'resumen' && <ViewPager interview={a} view={view} />}
    </>
  );
}

// Los momentos clave y el reproductor (vídeo, línea de tiempo y transcripción). Con análisis de
// comunicación viven en él; sin él, en la subpágina «Vídeo y transcripción» del informe.
export function TimelineAndTranscript({ interview: a }: { interview: Interview }) {
  const video = videoUrl(a);
  const where = outlet(a);
  const candidate = getCandidate(a.candidato);
  const communication = getCommunication(a.id);
  return (
    <>
      <ReportSections interview={a} only="momentos" />
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
    </>
  );
}

// Al pie de cada subpágina, la anterior y la siguiente de la misma entrevista.
function ViewPager({ interview: a, view }: { interview: Interview; view: ReportView }) {
  const views = availableViews(a);
  const i = views.indexOf(view);
  const card = (v: ReportView | undefined, next: boolean) =>
    v ? (
      <Link
        href={reportHref(a.id, v)}
        className={cn(
          'grid gap-1 rounded-xl p-5 no-underline ring-1 ring-border transition-colors hover:bg-muted motion-reduce:transition-none',
          next && 'text-right',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
            next && 'justify-end',
          )}
        >
          {next ? (
            <>
              Siguiente <Icon name="derecha" size={14} />
            </>
          ) : (
            <>
              <Icon name="izquierda" size={14} /> Anterior
            </>
          )}
        </span>
        <b className="text-lg font-medium">{viewName(a, v)}</b>
      </Link>
    ) : (
      <span />
    );
  return (
    <nav
      aria-label={`Partes de la entrevista a ${interviewName(a)}`}
      className="mt-16 grid grid-cols-2 gap-4"
    >
      {card(views[i - 1], false)}
      {card(views[i + 1], true)}
    </nav>
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
          <b className="font-medium">Sin revisar.</b> Calificación y fuentes pendientes de la
          segunda revisión de IA; pueden cambiar.
        </Notice>
      )}
      <Grid>
        <Cell span={8}>
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
                Señalado en directo durante la entrevista.
              </p>
            )}
          </div>
          <Sources items={r.fuentes} />
          {video && <Source url={video}>Vídeo, minuto {minute(r.segundo)}</Source>}
          <div>
            <ShareButton title={`${verdicts[r.veredicto].name}: «${r.cita}»`} />
          </div>
        </Cell>
      </Grid>
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
      <span className="text-xs font-medium text-muted-foreground sm:pt-3">{label}</span>
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
      <ReportIntro title={electionPages['entrevistas/verificaciones'].title}>
        <p>
          Los datos que dan los candidatos en sus entrevistas, buscados en fuentes oficiales y
          calificados por la IA. Una segunda pasada de IA confirma o corrige cada calificación, y
          las que no cuadraban con el análisis de comunicación se revisaron a mano.
        </p>
      </ReportIntro>
      {all.length === 0 ? (
        <p>No hay verificaciones publicadas.</p>
      ) : (
        <>
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
            <p>No hay verificaciones con estos filtros.</p>
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
    title: 'Valoración',
    metrics: [
      {
        name: 'Valoración sobre 10 y margen',
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
    title: 'Respuestas',
    metrics: [
      {
        name: 'Respuestas directas',
        max: 100,
        value: (a) => a.stats.alGrano,
        display: (a) => `${a.stats.alGrano} %`,
      },
      { name: 'Respuestas que no contestan a lo preguntado', max: 30, value: dodges },
      { name: 'Repreguntas e insistencias', max: 100, value: followUps },
      {
        name: 'Parte de la palabra del candidato',
        max: 100,
        value: (a) => speakingShare(a, 'candidato'),
        display: (a) => `${speakingShare(a, 'candidato')} %`,
      },
    ],
  },
  {
    title: 'Compromisos',
    metrics: [
      { name: 'Comprobables', max: 20, value: checkable },
      {
        name: 'Total',
        max: 40,
        value: (a) => getCommunication(a.id)?.compromisos.length ?? a.propuestas.length,
      },
    ],
  },
  {
    title: 'Verificaciones',
    metrics: verdictIds.map((id) => ({
      name: verdicts[id].name,
      kind: id,
      color: verdicts[id].color,
      max: 15,
      value: count((a) => a.revisiones.filter((r) => r.veredicto === id)),
    })),
  },
  {
    title: 'Tono',
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
        name: 'Interrupciones del candidato',
        max: 20,
        value: (a) => interruptions(a).candidate,
      },
    ],
  },
  {
    title: 'Entrevistador',
    metrics: [
      {
        name: 'Cortes o cierres del intercambio',
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
      <ReportIntro title={electionPages['entrevistas/comparar'].title}>
        <p>No hay rondas de entrevistas.</p>
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
      <ReportIntro title={electionPages['entrevistas/comparar'].title}>
        <p>
          Las entrevistas de una misma ronda, con las mismas reglas y la misma escala. No hay
          ganador. Pulsa en un candidato de la barra para destacarlo en todos los gráficos.
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
          <Cell span={7}>
            <p className="m-0 max-w-[60ch]">No hay entrevistas publicadas en esta ronda.</p>
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
          Cifras totales de cada entrevista. Dos valoraciones cuyos márgenes se solapan se
          consideran empate.{' '}
          <Link href={interviewsHref('metodologia')} className="underline underline-offset-4">
            Metodología de cálculo
          </Link>
          .
        </p>
      </div>
    </>
  );
}

// La huella: ocho ejes, cada uno de 0 al mismo tope para los cuatro.
const average = (values: number[]) => values.reduce((t, v) => t + v, 0) / (values.length || 1);
const footprintAxes: { name: string; text: string; value: (a: Interview) => number }[] = [
  {
    name: 'Palabra',
    text: 'Parte de la palabra del candidato',
    value: (a) => speakingShare(a, 'candidato') / 100,
  },
  {
    name: 'Directas',
    text: 'Respuestas directas',
    value: directShare,
  },
  {
    name: 'Compromisos',
    text: 'Compromisos comprobables (tope: 20)',
    value: (a) => checkable(a) / 20,
  },
  {
    name: 'Intensidad',
    text: 'Intensidad media por minuto',
    value: (a) => average(perMinute(a).map((m) => m.intensity)),
  },
  {
    name: 'Críticas',
    text: 'Críticas a la política de otros (tope: 20)',
    value: (a) => a.ataques.filter((x) => x.tipo === 'politica').length / 20,
  },
  {
    name: 'Interrupciones',
    text: 'Interrupciones del candidato (tope: 10)',
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
    'Incluye una cifra, una ley o un sí o un no comprobable',
  ],
  [
    'compromiso',
    'Compromiso sin objeto comprobable',
    'Una intención general, como «bajar los impuestos»',
  ],
  [
    'dura',
    'Pregunta dura sin respuesta clara',
    'Pregunta incómoda, repregunta o insistencia sin respuesta completa a lo preguntado',
  ],
  ['pausa', 'Pausa larga', 'Silencio de 1,5 segundos o más en la respuesta'],
  ['traba', 'Traba', 'Repetición de una palabra o corte a media frase'],
  ['comentado', 'Lo más comentado', 'Minuto citado en los comentarios de YouTube'],
  ['critica', 'Crítica política', 'Crítica a la política de otro'],
  ['ataque', 'Ataque personal', 'Descalificación personal'],
  ['interrumpe', 'Interrumpe', 'Interrupción del candidato a quien habla'],
  ['interrumpido', 'Le interrumpen', 'Interrupción del entrevistador al candidato'],
  [
    'momento',
    'Momento clave',
    'Minuto en el que coinciden varias señales, con la cita correspondiente',
  ],
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
    'Repetición de una palabra o de un grupo de palabras, o corte a media frase',
  ],
  ['Pausas', 'por 1.000 palabras', 'Silencios de más de 0,4 segundos dentro de una intervención'],
];

const fairness = [
  [
    'Escalas absolutas',
    'Cada criterio tiene ejemplos fijos de lo que es un 0, un 5 y un 10. La posición relativa no determina la valoración.',
  ],
  [
    'Datos por hora',
    'Se cuenta por pregunta y por hora, porque las entrevistas no duran lo mismo.',
  ],
  [
    'Muestras pequeñas',
    'Con pocas afirmaciones comprobables, la valoración se acerca al centro en lugar de dispararse.',
  ],
  ['Mismo análisis', 'Mismo modelo, misma versión y mismas instrucciones para todos.'],
  ['Margen de error', 'Cada valoración lleva su margen. Si dos se solapan, es un empate.'],
  [
    'Comparación dentro de cada ronda',
    'Solo se ponen lado a lado entrevistas de la misma ronda, con el mismo formato.',
  ],
];

export function InterviewsMethod() {
  return (
    <>
      <ReportIntro title={electionPages['entrevistas/metodologia'].title}>
        <p>
          La valoración no juzga las ideas de nadie. Mide cómo responde cada candidato: si sus datos
          son ciertos, si va al grano y si concreta lo que propone, con los mismos criterios para
          todos. Todo lo hace la IA y lo comprueba una segunda pasada de IA. Como ninguna persona lo
          revisa a mano, cada dato lleva su fuente enlazada para que puedas comprobarlo.
        </p>
      </ReportIntro>
      <Grid>
        <Cell span={7} label="Valoración sobre 10: criterios y pesos">
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
        <Cell span={5} label="Calificaciones">
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
        <Cell span={7} label="Marcas de la línea de tiempo">
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
        <Cell span={5} label="Preguntas, compromisos y momentos clave">
          <p className="m-0">
            Proceden del análisis de comunicación. Cada pregunta se clasifica por su dureza y por
            cómo se responde; cada compromiso, por si se podrá comprobar. Los momentos clave son
            puntos donde coinciden varias señales medidas por separado, como la voz, las pausas o
            cómo se pregunta y se responde.
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            Que varias señales coincidan no demuestra relación entre ellas ni intención alguna.
          </p>
        </Cell>
      </Grid>

      <ReportSection title="Simulador de ponderación">
        <p className="m-0 mb-6 max-w-[65ch] text-muted-foreground">
          Dos candidatos ficticios con perfiles opuestos. El orden entre ambos depende del peso de
          cada criterio; por eso los pesos son públicos.
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

      <ReportSection title="Indicadores por minuto">
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
              Mide el intercambio entre ambos, no las emociones.
            </p>
          </Cell>
          <Cell span={6} label="Expresión oral">
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
              todos. No indican nerviosismo ni sinceridad.
            </p>
          </Cell>
          <Cell label="Elementos visuales del vídeo">
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

      <ReportSection title="Análisis de comunicación">
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
          <Cell span={5} label="Expresión facial: unidades de acción FACS">
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

      <ReportSection title="Criterios de comparabilidad">
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
        <Cell span={6} label="Entrevistas incluidas">
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
        <Cell label="Créditos de las fotos">
          <PhotoCredits people={candidates} />
        </Cell>
      </Grid>
    </>
  );
}
