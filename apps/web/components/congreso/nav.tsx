'use client';
import { Card } from '@reforma-digital/design/ui/card';
import { cn } from '@reforma-digital/design/lib/utils';

import { buttonVariants } from '@reforma-digital/design/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@reforma-digital/design/ui/collapsible';

import { Icon } from '../brand/icon';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { congressBase, congressSections } from '../../lib/congreso/routes';

// Cada ficha mantiene marcada la vista de la que sale.
const parents: Record<string, string> = {
  votacion: 'votaciones',
  sesion: 'dias',
  iniciativa: 'leyes',
  tema: 'temas',
  diputado: 'diputados',
  cargo: 'organigrama',
};

// Las vistas de El Congreso, dos veces con los mismos enlaces: la barra con desplegables, para pantallas
// estrechas, y la columna con todas a la vista. El CSS enseña una u otra (DESIGN.md §8.7).
export function CongressNav() {
  const section =
    usePathname()
      .slice(congressBase.length + 1)
      .split('/')[0] ?? '';
  const view = parents[section] ?? section;
  const links = (pages: string[][]) =>
    pages.map(([title, path]) => {
      const href = path ? `${congressBase}/${path}` : congressBase;
      const current = path === view;
      return (
        <li key={path}>
          <Link
            href={href}
            aria-current={current ? 'page' : undefined}
            data-slot="button"
            data-variant="ghost"
            className={cn(buttonVariants({ variant: 'ghost' }))}
          >
            {title}
          </Link>
        </li>
      );
    });

  return (
    <>
      <nav
        data-part="cg-nav"
        className={
          '[max-width:var(--container-content)] [margin:auto] [padding:16px_var(--page-gutter)] flex items-center gap-6 [border-top:1px_solid_var(--border)] flex-wrap [&_[data-slot=collapsible]]:relative [&_ul]:absolute [&_ul]:[z-index:10] [&_ul]:[top:100%] [&_ul]:[right:0] [&_ul]:[min-width:220px] [&_ul]:mt-3 [&_ul]:list-none [&_li_a]:w-full [&_li_a]:justify-start [@media(min-width:_1100px)]:hidden [@media(max-width:_800px)]:gap-3 [@media(max-width:_560px)]:[&_[data-slot=collapsible]:nth-last-child(-n_+_2)_ul]:[right:0] [@media(max-width:_560px)]:[&_[data-slot=collapsible]:first-of-type_ul]:[left:0] [@media(max-width:_560px)]:[&_[data-slot=collapsible]:first-of-type_ul]:[right:auto]'
        }
        aria-label="Secciones del Congreso"
      >
        <Link
          className={'text-lg font-semibold [margin-right:auto] [@media(max-width:_800px)]:w-full'}
          href={congressBase}
        >
          El Congreso
        </Link>
        {congressSections.map((section) => (
          <Collapsible key={section.title} className="relative">
            <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 text-left">
              <span>{section.title}</span>
              <span aria-hidden="true" className="flex shrink-0 group-data-open:rotate-180">
                {<Icon name="abajo" size={16} />}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card
                render={<ul />}
                className={'[background:var(--background)] [box-shadow:var(--shadow-overlay)]'}
              >
                {links(section.pages)}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>
      <nav
        data-part="cg-lateral"
        className={
          '[&_a]:w-full [&_a]:justify-start hidden [@media(min-width:_1100px)]:block [@media(min-width:_1100px)]:sticky [@media(min-width:_1100px)]:top-24 [@media(min-width:_1100px)]:[max-height:calc(100dvh_-_112px)] [@media(min-width:_1100px)]:overflow-y-auto [@media(min-width:_1100px)]:[&_ul]:m-0 [@media(min-width:_1100px)]:[&_ul]:p-0 [@media(min-width:_1100px)]:[&_ul]:list-none [@media(min-width:_1100px)]:[&_h2]:[margin:16px_0_4px] [@media(min-width:_1100px)]:[&_h2]:px-3 [@media(min-width:_1100px)]:[&_h2]:[font-size:11px] [@media(min-width:_1100px)]:[&_h2]:[color:var(--muted-foreground)]'
        }
        aria-label="Secciones del Congreso"
      >
        {congressSections.map((section, i) => (
          <div key={section.title}>
            {i > 0 && (
              <h2
                data-part="t-etiqueta"
                className={
                  '[font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
                }
              >
                {section.title}
              </h2>
            )}
            <ul>{links(section.pages)}</ul>
          </div>
        ))}
      </nav>
    </>
  );
}
