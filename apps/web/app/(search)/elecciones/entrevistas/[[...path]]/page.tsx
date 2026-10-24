import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  CandidatePending,
  InterviewReport,
  InterviewsHome,
  InterviewsMethod,
  interviewsHref,
  VerificationPage,
} from '../../../../../components/elecciones/interviews';
import { ElectionsFrame } from '../../../../../components/elecciones/nav';
import {
  getCandidate,
  getInterview,
  interviewName,
  interviewsOf,
  verdicts,
} from '../../../../../lib/elecciones/interviews';
import { electionPages } from '../../../../../lib/elecciones/pages';
import { pageMetadata } from '../../../../../lib/seo';

type Props = { params: Promise<{ path?: string[] }> };

// /entrevistas, /entrevistas/metodologia, /entrevistas/<candidato>, /entrevistas/<entrevista> y
// /entrevistas/<entrevista>/<verificación>.
function route(path: string[] = []) {
  const [id, detail, ...rest] = path;
  if (rest.length) return null;
  if (!id) return detail ? null : { kind: 'home' as const };
  if (id === 'metodologia') return detail ? null : { kind: 'method' as const };
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
  const base = { path: interviewsHref(path?.join('/')), og: 'elecciones' as const };
  switch (match.kind) {
    case 'home':
    case 'method': {
      const page = electionPages[match.kind === 'home' ? 'entrevistas' : 'entrevistas/metodologia'];
      return pageMetadata({
        ...base,
        title: `${page.title} · Elecciones · Reforma Digital`,
        description: page.text,
      });
    }
    case 'candidate':
      return pageMetadata({
        ...base,
        title: `${match.candidate.name} · Las entrevistas · Reforma Digital`,
        description: `La entrevista a ${match.candidate.name} (${match.candidate.party}), revisada: qué afirma y si es cierto, qué propone y si responde a lo que se le pregunta.`,
      });
    case 'interview': {
      const name = interviewName(match.interview);
      return pageMetadata({
        ...base,
        title: `${name} · Las entrevistas · Reforma Digital`,
        description: `El informe de la entrevista a ${name}: valoración, afirmaciones verificadas con sus fuentes, propuestas y cómo responde.`,
        index: !match.interview.ficticio,
      });
    }
    case 'verification': {
      const { interview, verification } = match;
      return pageMetadata({
        ...base,
        title: `${verdicts[verification.veredicto].name}: «${verification.cita}» · ${interviewName(interview)}`,
        description: verification.explicacion,
        index: !interview.ficticio,
      });
    }
  }
}

export default async function Page({ params }: Props) {
  const match = route((await params).path);
  if (!match) notFound();
  if (match.kind === 'candidate') {
    const latest = interviewsOf(match.candidate.slug)[0];
    if (latest) redirect(interviewsHref(latest.id));
  }
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
        current={match.kind === 'method' ? 'entrevistas/metodologia' : 'entrevistas'}
        crumb={crumb}
      >
        {match.kind === 'home' && <InterviewsHome />}
        {match.kind === 'method' && <InterviewsMethod />}
        {match.kind === 'candidate' && <CandidatePending candidate={match.candidate} />}
        {match.kind === 'interview' && <InterviewReport interview={match.interview} />}
        {match.kind === 'verification' && (
          <VerificationPage interview={match.interview} verification={match.verification} />
        )}
      </ElectionsFrame>
    </main>
  );
}
