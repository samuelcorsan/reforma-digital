import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { Elections } from '../../../../components/congreso/elections';
import { DataLoading } from '../../../../components/congreso/loading';
import { ElectionsHome } from '../../../../components/elecciones/home';
import { ElectionsFrame } from '../../../../components/elecciones/nav';
import { formatDate } from '../../../../lib/elecciones/format';
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
  // La página de una elección (`AAAAMM`): su mes y su año, sin pedir datos.
  const election =
    match.detail && /^\d{6}$/.test(match.detail)
      ? formatDate(`${match.detail.slice(0, 4)}-${match.detail.slice(4)}-01`, {
          month: 'long',
          year: 'numeric',
        })
      : null;
  return pageMetadata({
    title: election
      ? `Generales de ${election} · Elecciones · Reforma Digital`
      : page
        ? `${page.title} · Elecciones · Reforma Digital`
        : 'Elecciones generales del 29N · Reforma Digital',
    description: election
      ? `El resultado de las generales de ${election}, la legislatura que salió de ellas, cada provincia y los últimos escaños más ajustados.`
      : (page?.text ??
        'Lo que deja la legislatura, cómo se reparten los 350 escaños, cuarenta y nueve años de elecciones y las encuestas, con datos oficiales.'),
    path: electionsHref(path?.join('/')),
    og: 'elecciones',
  });
}

const querySchema = z.object({
  q: z.string().max(200).default(''),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  // La elección de «El precio de un escaño» (AAAAMM); sin ella, la última.
  eleccion: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export default async function Page({ params, searchParams }: Props) {
  const match = route((await params).path);
  if (!match) notFound();
  const query = querySchema.safeParse(await searchParams);
  if (!query.success) notFound();
  const { page, detail } = match;
  const elections = detail && (
    <Elections
      detail={detail}
      query={query.data.q}
      page={query.data.pagina}
      electionId={query.data.eleccion}
    />
  );
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
              <Link href={electionsHref(page)} className="-my-3.5 py-3.5 text-muted-foreground">
                {electionPages[page].title}
              </Link>
            )
          }
        >
          {detail === 'escano' ? (
            // «El precio de un escaño» funciona aunque no haya datos (con un ejemplo del reparto):
            // no se queda en la pantalla de carga.
            elections
          ) : (
            // Cambiar de elección («Elecciones desde 1977») no vuelve a la carga: la página se queda
            // a la vista hasta que llega la siguiente (y «Reproducir» sigue en marcha).
            <Suspense
              key={`${detail}/${query.data.q}/${query.data.pagina}`}
              fallback={<DataLoading />}
            >
              {elections}
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
