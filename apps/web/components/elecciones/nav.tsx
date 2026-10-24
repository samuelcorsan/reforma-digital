import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { Icon } from '../brand/icon';
import {
  electionGroups,
  electionOrder,
  electionPages,
  electionsHref,
  type ElectionPage,
} from '../../lib/elecciones/pages';

function Groups({ current }: { current: ElectionPage }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-6 pt-6">
      {electionGroups.map((group, i) => (
        <div key={group.name} className="grid content-start gap-2">
          <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            <b className="font-medium text-foreground">{String(i + 1).padStart(2, '0')}</b>{' '}
            {group.name}
          </span>
          <ul className="m-0 grid list-none gap-1 p-0">
            {group.pages.map((id) => (
              <li key={id}>
                <Link
                  href={electionsHref(id)}
                  aria-current={id === current ? 'page' : undefined}
                  className="text-sm text-muted-foreground no-underline hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                >
                  {electionPages[id].title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Migas, el capítulo con sus apartados y, al final, el anterior y el siguiente.
export function ElectionsFrame({
  current,
  crumb,
  children,
}: {
  current: ElectionPage;
  crumb?: ReactNode;
  children: ReactNode;
}) {
  const g = electionGroups.findIndex((x) => x.pages.includes(current));
  const group = electionGroups[g];
  const i = electionOrder.indexOf(current);
  const previous = electionOrder[i - 1];
  const next = electionOrder[i + 1];
  return (
    <>
      <nav
        aria-label="Estás en"
        className="flex flex-wrap items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground uppercase"
      >
        <Link href={electionsHref()} className="-my-3.5 py-3.5 text-muted-foreground">
          Elecciones 29N
        </Link>
        {group && <span aria-hidden="true">/</span>}
        {group && <span>{group.name}</span>}
        {crumb && <span aria-hidden="true">/</span>}
        {crumb}
      </nav>
      <nav
        aria-label={`Apartados de ${group?.name ?? 'las elecciones'}`}
        className="relative mt-6 mb-10 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border"
      >
        <span className="mr-4 flex items-center font-mono text-xs font-medium tracking-[0.08em] uppercase max-md:w-full max-md:pt-2">
          {String(g + 1).padStart(2, '0')} · {group?.name}
        </span>
        {/* Se desplaza en horizontal en móvil, sin barra: el subrayado de 1 px abría un scroll vertical. */}
        <div className="flex overflow-x-auto [scrollbar-width:none] max-md:w-full [&::-webkit-scrollbar]:hidden">
          {group?.pages.map((id) => (
            <Link
              key={id}
              href={electionsHref(id)}
              aria-current={id === current ? 'page' : undefined}
              className="-mb-px flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground no-underline hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              {electionPages[id].short}
            </Link>
          ))}
        </div>
        <Collapsible className="ml-auto max-md:ml-0 max-md:w-full">
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 px-3 text-sm font-medium">
            Todos los apartados
            <span aria-hidden="true" className="flex group-data-open:rotate-180">
              <Icon name="abajo" size={16} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="absolute inset-x-0 top-full z-10 border-b border-border bg-background pb-6">
            <Groups current={current} />
          </CollapsibleContent>
        </Collapsible>
      </nav>
      {children}
      <nav aria-label="Otros apartados" className="mt-16 grid grid-cols-2 gap-4">
        {previous ? (
          <Link
            href={electionsHref(previous)}
            className="grid gap-2 rounded-xl p-6 no-underline ring-1 ring-foreground/10 hover:bg-muted max-sm:p-4"
          >
            <small className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="izquierda" size={14} /> Anterior
              </span>
            </small>
            <b className="text-lg font-medium">{electionPages[previous].title}</b>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={electionsHref(next)}
            className="grid gap-2 rounded-xl p-6 text-right no-underline ring-1 ring-foreground/10 hover:bg-muted max-sm:p-4"
          >
            <small className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              <span className="inline-flex items-center gap-1.5">
                Siguiente <Icon name="derecha" size={14} />
              </span>
            </small>
            <b className="text-lg font-medium">{electionPages[next].title}</b>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
