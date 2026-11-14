import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  availableViews,
  InterviewReport,
  playerHref,
  reportNav,
  reportViews,
  InterviewsCompare,
  InterviewsHome,
  InterviewsMethod,
  interviewsHref,
  VerificationPage,
  VerificationsIndex,
} from '../../../../../components/elecciones/interviews';
import {
  commAvailable,
  CommunicationReport,
  commNavItems,
  commViews,
} from '../../../../../components/elecciones/communication';
import { VideoDock } from '../../../../../components/elecciones/video-dock';
import { ElectionsFrame } from '../../../../../components/elecciones/nav';
import {
  getCandidate,
  getInterview,
  interviewName,
  interviewsOf,
  rounds,
  verdictIds,
  verdicts,
  type Interview,
} from '../../../../../lib/elecciones/interviews';
import { communicationPath, getCommunication } from '../../../../../lib/elecciones/communication';
import { electionPages } from '../../../../../lib/elecciones/pages';
import { pageMetadata } from '../../../../../lib/seo';

// Las vistas que son apartados de la sección, con su pestaña en la navegación.
const sectionPage = {
  home: 'entrevistas',
  method: 'entrevistas/metodologia',
  compare: 'entrevistas/comparar',
  verifications: 'entrevistas/verificaciones',
} as const;

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// /entrevistas, /entrevistas/metodologia, /entrevistas/verificaciones, /entrevistas/comparar(/<ronda>), /entrevistas/<candidato>, /entrevistas/<entrevista>,
// /entrevistas/<entrevista>/<subpágina> (verificaciones, compromisos…), /entrevistas/<entrevista>/comunicacion
// y /entrevistas/<entrevista>/<verificación>.
function route(path: string[] = []) {
  const [id, detail, sub, ...rest] = path;
  if (rest.length || (sub && detail !== communicationPath)) return null;
  if (!id) return detail ? null : { kind: 'home' as const };
  if (id === 'metodologia') return detail ? null : { kind: 'method' as const };
  if (id === 'verificaciones') return detail ? null : { kind: 'verifications' as const };
  if (id === 'comparar') {
    if (detail && !rounds.some((r) => r.id === detail)) return null;
    return { kind: 'compare' as const, round: detail };
  }
  const candidate = getCandidate(id);
  if (candidate) return detail ? null : { kind: 'candidate' as const, candidate };
  const interview = getInterview(id);
  if (!interview) return null;
  if (!detail) return { kind: 'interview' as const, interview, view: 'resumen' as const };
  const view = availableViews(interview).find((v) => v === detail && v !== 'resumen');
  if (view) return { kind: 'interview' as const, interview, view };
  if (detail === communicationPath) {
    const analysis = getCommunication(interview.id);
    if (!analysis) return null;
    const view = commAvailable(analysis).find((v) =>
      sub ? v === sub && v !== 'resumen' : v === 'resumen',
    );
    return view ? { kind: 'communication' as const, interview, analysis, view } : null;
  }
  const verification = interview.revisiones.find((r) => r.id === detail);
  return verification ? { kind: 'verification' as const, interview, verification } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const match = route(path);
  if (!match) notFound();
  const base = { path: interviewsHref(path?.join('/')), og: 'entrevistas' as const };
  // La ficha, las entrevistas y las verificaciones de un candidato llevan su imagen.
  const ogOf = (slug: string) => {
    const candidate = getCandidate(slug);
    return candidate ? (`entrevistas-${candidate.slug}` as const) : base.og;
  };
  switch (match.kind) {
    case 'home':
    case 'method':
    case 'verifications':
    case 'compare': {
      const page = electionPages[sectionPage[match.kind]];
      return pageMetadata({
        ...base,
        title: `${page.title} · Elecciones · Reforma Digital`,
        description: page.text,
      });
    }
    case 'candidate':
      return redirect(candidateTarget(match.candidate.slug));
    case 'interview': {
      const name = interviewName(match.interview);
      return pageMetadata({
        ...base,
        og: ogOf(match.interview.candidato),
        title:
          match.view === 'resumen'
            ? `${name} · Las entrevistas · Reforma Digital`
            : `${reportViews[match.view]} · ${name} · Las entrevistas · Reforma Digital`,
        description: `El informe de la entrevista a ${name}: valoración, afirmaciones verificadas con sus fuentes, propuestas y cómo responde.`,
        index: !match.interview.ficticio,
      });
    }
    case 'communication':
      return pageMetadata({
        ...base,
        og: ogOf(match.interview.candidato),
        title:
          match.view === 'resumen'
            ? `${interviewName(match.interview)}: análisis de comunicación · Las entrevistas · Reforma Digital`
            : `${commViews[match.view]} · ${interviewName(match.interview)}: análisis de comunicación · Reforma Digital`,
        description: match.analysis.titular,
      });
    case 'verification': {
      const { interview, verification } = match;
      return pageMetadata({
        ...base,
        og: ogOf(interview.candidato),
        title: `${verdicts[verification.veredicto].name}: «${verification.cita}» · ${interviewName(interview)}`,
        description: verification.explicacion,
        // Lo que nadie ha revisado no se indexa: puede cambiar.
        index: !interview.ficticio && verification.estado !== 'propuesta',
      });
    }
  }
}

// La sección trata de entrevistas, no de personas: /entrevistas/<candidato> lleva al informe de su
// entrevista más reciente o, si no tiene ninguna, a la portada de las entrevistas.
const candidateTarget = (slug: string) => {
  const latest = interviewsOf(slug)[0];
  return interviewsHref(latest ? latest.id : '');
};

// Las partes del análisis de comunicación de una entrevista, si lo tiene.
const commNav = (interview: Interview) => {
  const analysis = getCommunication(interview.id);
  return analysis ? commNavItems(interview, analysis) : [];
};

// Los filtros de /entrevistas/verificaciones: una calificación que no existe se ignora; un candidato o
// un tema que no existen dejan la lista vacía.
async function filters(searchParams: Props['searchParams']) {
  const { calificacion, candidato, tema, pagina } = await searchParams;
  return {
    verdict: verdictIds.find((id) => id === calificacion),
    candidate: typeof candidato === 'string' ? candidato : undefined,
    topic: typeof tema === 'string' ? tema : undefined,
    // Una página que no es un número va a la primera; una que se pasa, a la última.
    page: Number(pagina) || 1,
  };
}

export default async function Page({ params, searchParams }: Props) {
  const match = route((await params).path);
  if (!match) notFound();
  if (match.kind === 'candidate') redirect(candidateTarget(match.candidate.slug));
  // Antes el reproductor estaba en el informe: un enlace con minuto (`?t=`) lleva ahora al suyo.
  const { t } = await searchParams;
  if (match.kind === 'interview' && match.view === 'resumen' && typeof t === 'string')
    redirect(playerHref(match.interview.id, Number.parseInt(t, 10) || 0));
  const crumb =
    match.kind === 'verification' ? (
      <Link
        href={interviewsHref(match.interview.id)}
        className="-my-3.5 py-3.5 text-muted-foreground"
      >
        {interviewName(match.interview)}
      </Link>
    ) : undefined;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto max-w-(--container-content) px-(--page-gutter) pt-8 pb-20 min-[1100px]:max-w-(--elecciones-ancho)"
    >
      <ElectionsFrame
        current={
          match.kind === 'method' || match.kind === 'compare' || match.kind === 'verifications'
            ? sectionPage[match.kind]
            : 'entrevistas'
        }
        crumb={crumb}
        local={
          match.kind === 'interview'
            ? reportNav(match.interview, commNav(match.interview))
            : match.kind === 'communication'
              ? reportNav(match.interview, commNavItems(match.interview, match.analysis))
              : match.kind === 'verification'
                ? reportNav(match.interview, commNav(match.interview), 'verificaciones')
                : undefined
        }
      >
        {match.kind === 'home' && <InterviewsHome />}
        {match.kind === 'method' && <InterviewsMethod />}
        {match.kind === 'verifications' && <VerificationsIndex {...await filters(searchParams)} />}
        {match.kind === 'compare' && <InterviewsCompare roundId={match.round} />}
        {match.kind === 'interview' && (
          <InterviewReport interview={match.interview} view={match.view} />
        )}
        {match.kind === 'communication' && (
          <CommunicationReport
            interview={match.interview}
            analysis={match.analysis}
            view={match.view}
          />
        )}
        {match.kind === 'verification' && (
          <VerificationPage interview={match.interview} verification={match.verification} />
        )}
      </ElectionsFrame>
      <VideoDock />
    </main>
  );
}
