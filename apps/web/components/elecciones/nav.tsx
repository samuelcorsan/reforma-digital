import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { Sidebar, SidebarContent, SidebarProvider } from '@reforma-digital/design/ui/sidebar';
import { Icon } from '../brand/icon';
import {
  electionGroups,
  electionOrder,
  electionPages,
  electionsHref,
  type ElectionPage,
} from '../../lib/elecciones/pages';
import { SectionNav, type LocalNav } from './section-nav';

const authors = ['disamdev', 'jgarcelan', 'RogerKernel', 'ErikaCelestica'];

// Desde 1100 px, los apartados en una columna fija a la izquierda; por debajo, en un desplegable.
// Al final, el anterior y el siguiente. Sin `current`, es la portada; con `local`, la barra muestra
// las secciones de la página (un informe largo).
export function ElectionsFrame({
  current,
  crumb,
  local,
  children,
}: {
  current?: ElectionPage;
  crumb?: ReactNode;
  local?: LocalNav;
  children: ReactNode;
}) {
  const group = current && electionGroups.find((x) => x.pages.includes(current));
  const i = current ? electionOrder.indexOf(current) : -1;
  const previous = i > 0 ? electionOrder[i - 1] : undefined;
  const next = electionOrder[i + 1];
  return (
    <SidebarProvider className="block min-h-0 min-[1100px]:grid min-[1100px]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] min-[1100px]:items-start min-[1100px]:gap-x-10">
      <Sidebar
        collapsible="none"
        className="sticky top-24 hidden max-h-[calc(100dvh-112px)] bg-transparent min-[1100px]:flex"
      >
        <SidebarContent>
          <nav aria-label="Apartados de las elecciones">
            <SectionNav current={current} local={local} />
          </nav>
        </SidebarContent>
      </Sidebar>
      <div className="min-w-0">
        <Collapsible className="mb-8 rounded-xl ring-1 ring-border min-[1100px]:hidden">
          <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-medium">
            <span className="flex items-center gap-3">
              <Icon name={group?.icon ?? 'casa'} size={18} />
              {local ? (
                <span>{local.title}</span>
              ) : current ? (
                <span>
                  <span className="text-muted-foreground">{group?.name} · </span>
                  {electionPages[current].short}
                </span>
              ) : (
                'Portada'
              )}
            </span>
            <span aria-hidden="true" className="flex group-data-open:rotate-180">
              <Icon name="abajo" size={16} />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border p-2">
            <nav aria-label="Apartados de las elecciones">
              <SectionNav current={current} local={local} />
            </nav>
          </CollapsibleContent>
        </Collapsible>
        {crumb && (
          <nav
            aria-label="Estás en"
            className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground"
          >
            <Icon name="izquierda" size={14} />
            {crumb}
          </nav>
        )}
        {children}
        {!local && (
          <nav aria-label="Otros apartados" className="mt-16 grid grid-cols-2 gap-4">
            {previous ? (
              <Link
                href={electionsHref(previous)}
                className="grid gap-2 rounded-xl p-6 no-underline ring-1 ring-foreground/10 hover:bg-muted max-sm:p-4"
              >
                <small className="text-xs font-medium text-muted-foreground">
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
                <small className="text-xs font-medium text-muted-foreground">
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
        )}
        <p className="mt-16 mb-0 text-sm text-muted-foreground">
          Hecho por{' '}
          {authors.map((name, i) => (
            <span key={name}>
              {i > 0 && (i === authors.length - 1 ? ' y ' : ', ')}
              <a
                href={`https://x.com/${name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground"
              >
                @{name}
                <span className="sr-only"> en X (se abre en una pestaña nueva)</span>
              </a>
            </span>
          ))}
          .
        </p>
      </div>
    </SidebarProvider>
  );
}
