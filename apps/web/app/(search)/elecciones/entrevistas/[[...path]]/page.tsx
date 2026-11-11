import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  InterviewReport,
  InterviewsCompare,
  InterviewsHome,
  InterviewsMethod,
  interviewsHref,
  VerificationPage,
  VerificationsIndex,
} from '../../../../../components/elecciones/interviews';
import { CandidateProfile } from '../../../../../components/elecciones/candidate';
import { ElectionsFrame } from '../../../../../components/elecciones/nav';
import {
  getCandidate,
  getInterview,
  interviewName,
  rounds,
  verdictIds,
  verdicts,
} from '../../../../../lib/elecciones/interviews';
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

// /entrevistas, /entrevistas/metodologia, /entrevistas/verificaciones, /entrevistas/comparar(/<ronda>), /entrevistas/<candidato>, /entrevistas/<entrevista> y
// /entrevistas/<entrevista>/<verificación>.
function route(path: string[] = []) {
  const [id, detail, ...rest] = path;
  if (rest.length) return null;
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
  if (!detail) return { kind: 'interview' as const, interview };
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
      return pageMetadata({
        ...base,
        og: ogOf(match.candidate.slug),
        title: `${match.candidate.name} · Las entrevistas · Reforma Digital`,
        description: `La entrevista a ${match.candidate.name} (${match.candidate.party}), revisada: qué afirma y si es cierto, qué propone y si responde a lo que se le pregunta.`,
      });
    case 'interview': {
      const name = interviewName(match.interview);
      return pageMetadata({
        ...base,
        og: ogOf(match.interview.candidato),
        title: `${name} · Las entrevistas · Reforma Digital`,
        description: `El informe de la entrevista a ${name}: valoración, afirmaciones verificadas con sus fuentes, propuestas y cómo responde.`,
        index: !match.interview.ficticio,
      });
    }
    case 'verification': {
      const { interview, verification } = match;
      return pageMetadata({
        ...base,
        og: ogOf(interview.candidato),
        title: `${verdicts[verification.veredicto].name}: «${verification.cita}» · ${interviewName(interview)}`,
        description: verification.explicacion,
        index: !interview.ficticio,
      });
    }
  }
}

// Los filtros de /entrevistas/verificaciones: lo que no es una calificación o un candidato se ignora.
async function filters(searchParams: Props['searchParams']) {
  const { calificacion, candidato } = await searchParams;
  return {
    verdict: verdictIds.find((id) => id === calificacion),
    candidate: typeof candidato === 'string' ? candidato : undefined,
  };
}

export default async function Page({ params, searchParams }: Props) {
  const match = route((await params).path);
  if (!match) notFound();
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
      className="mx-auto max-w-(--container-content) px-(--page-gutter) pt-8 pb-20"
    >
      <ElectionsFrame
        current={
          match.kind === 'method' || match.kind === 'compare' || match.kind === 'verifications'
            ? sectionPage[match.kind]
            : 'entrevistas'
        }
        crumb={crumb}
      >
        {match.kind === 'home' && <InterviewsHome />}
        {match.kind === 'method' && <InterviewsMethod />}
        {match.kind === 'verifications' && <VerificationsIndex {...await filters(searchParams)} />}
        {match.kind === 'compare' && <InterviewsCompare roundId={match.round} />}
        {match.kind === 'candidate' && <CandidateProfile candidate={match.candidate} />}
        {match.kind === 'interview' && <InterviewReport interview={match.interview} />}
        {match.kind === 'verification' && (
          <VerificationPage interview={match.interview} verification={match.verification} />
        )}
      </ElectionsFrame>
    </main>
  );
}
