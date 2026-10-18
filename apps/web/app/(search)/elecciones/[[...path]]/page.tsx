import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Elections } from '../../../../components/congreso/elections';
import { DataLoading } from '../../../../components/congreso/loading';
import { ElectionsHome } from '../../../../components/elecciones/home';
import { ElectionsFrame } from '../../../../components/elecciones/nav';
import {
  electionPages,
  electionsHref,
  isElectionPage,
  type ElectionPage,
} from '../../../../lib/elecciones/pages';
import { pageMetadata } from '../../../../lib/seo';

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export const dynamic = 'force-dynamic';

// Un apartado (/elecciones/caducan) o la ficha de unas elecciones pasadas (/elecciones/202307).
function route(path: string[] = []): { page?: ElectionPage; detail?: string } | null {
  const [id, ...rest] = path;
  if (!id) return {};
  if (rest.length) return null;
  if (isElectionPage(id)) return { page: id, detail: id };
  if (/^\d{6}$/.test(id)) return { page: 'historico', detail: id };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const match = route(path);
  if (!match) notFound();
  const page = match.page && electionPages[match.page];
  return pageMetadata({
    title: page
      ? `${page.title} · Elecciones · Reforma Digital`
      : 'Elecciones generales del 29N · Reforma Digital',
    description:
      page?.text ??
      'Lo que deja la legislatura, cómo se reparten los 350 escaños, cuarenta y nueve años de elecciones y las encuestas, con datos oficiales.',
    path: electionsHref(path?.join('/')),
    og: 'elecciones',
  });
}

const querySchema = z.object({
  q: z.string().max(200).default(''),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
});

export default async function Page({ params, searchParams }: Props) {
  const match = route((await params).path);
  if (!match) notFound();
  const query = querySchema.safeParse(await searchParams);
  if (!query.success) notFound();
  const { page, detail } = match;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto max-w-(--container-content) px-(--page-gutter) pt-8 pb-20"
    >
      {page && detail ? (
        <ElectionsFrame
          current={page}
          crumb={
            detail !== page && (
              <Link href={electionsHref(page)} className="text-muted-foreground">
                {electionPages[page].title}
              </Link>
            )
          }
        >
          {detail === 'escano' ? (
            // El simulador D'Hondt no necesita datos: se muestra aunque no estén disponibles.
            <Elections detail={detail} query={query.data.q} page={query.data.pagina} />
          ) : (
            <Suspense key={`${detail}/${JSON.stringify(query.data)}`} fallback={<DataLoading />}>
              <Elections detail={detail} query={query.data.q} page={query.data.pagina} />
            </Suspense>
          )}
        </ElectionsFrame>
      ) : (
        <Suspense fallback={<DataLoading />}>
          <ElectionsHome />
        </Suspense>
      )}
    </main>
  );
}
