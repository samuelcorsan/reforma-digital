'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@reforma-digital/design/ui/sidebar';
import { cn } from '@reforma-digital/design/lib/utils';
import { Icon } from '../brand/icon';
import {
  electionGroups,
  electionPages,
  electionsHref,
  type ElectionPage,
} from '../../lib/elecciones/pages';

// Las secciones de una página. `href` es un ancla (`#id`) o, para lo que vive en otra
// página, una ruta. Los informes la dan hecha; en las demás páginas sale de sus títulos de sección.
// Un enlace de la página; con `children`, sus partes, que se despliegan al estar dentro de ellas.
export type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };
export type LocalNav = {
  title: string;
  sections: { items: NavItem[] }[];
};

type Section = {
  key: string;
  label: string;
  href?: string;
  el?: HTMLElement | null;
  children?: NavItem['children'];
};

const item = 'h-10 gap-3 px-3 text-[15px] [&_svg]:size-[18px]';
// Las secciones de la página y las partes del análisis: más pequeñas, y la actual marcada.
const link =
  'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug text-muted-foreground no-underline transition-colors hover:bg-sidebar-accent hover:text-foreground motion-reduce:transition-none';
const active = 'bg-sidebar-accent font-medium text-foreground';

// Los títulos de sección de la página (`data-section-title`). No se les pone `id`, para no tocar el
// HTML que React aún tiene que hidratar: se guarda el elemento y se lleva a él al pulsar.
const findSections = (): Section[] =>
  [...document.querySelectorAll<HTMLElement>('main [data-section-title]')].map((el, i) => ({
    key: `s${i}`,
    label: el.textContent?.trim() ?? '',
    el,
  }));

// Lo marcado, a la vista dentro de la barra, que tiene su propio scroll y se monta de nuevo en cada
// página: al entrar, centrado y sin animación; al ir leyendo, solo lo justo. Sin mover la página.
function keepInView(root: HTMLElement | null, center: boolean) {
  const box = root?.closest<HTMLElement>('[data-slot=sidebar-content]');
  const marked = root?.querySelectorAll<HTMLElement>('[aria-current]');
  const el = marked?.[marked.length - 1];
  if (!box || !el) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (center) box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  else if (r.top < b.top + 8) box.scrollTop -= b.top + 8 - r.top;
  else if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - b.bottom + 8;
}

const motion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : ('smooth' as const);

// Un solo árbol: la portada, los grupos que se despliegan con sus apartados y, colgando del apartado
// en el que se está, las secciones de la página, con la que se está leyendo marcada.
export function SectionNav({ current, local }: { current?: ElectionPage; local?: LocalNav }) {
  const home = current && electionGroups.find((g) => g.pages.includes(current));
  const pathname = usePathname();
  const [found, setFound] = useState<Section[]>([]);
  const sections = useMemo<Section[]>(
    () =>
      local ? local.sections.flatMap((s) => s.items.map((i) => ({ key: i.href, ...i }))) : found,
    [local, found],
  );

  // Las secciones de la página, también las que llegan después (las partes que cargan datos).
  useEffect(() => {
    if (local || !current) return;
    const main = document.querySelector('main');
    const scan = () => setFound(findSections());
    scan();
    const watch = new MutationObserver(scan);
    if (main) watch.observe(main, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [local, current]);

  // La sección que se está leyendo: la última cuyo título ya ha pasado arriba.
  const [reading, setReading] = useState<string | null>(null);
  useEffect(() => {
    const targets = sections.map(
      (s) =>
        [
          s.key,
          s.el ?? (s.href?.startsWith('#') ? document.getElementById(s.href.slice(1)) : null),
        ] as const,
    );
    const update = () =>
      setReading(
        targets.filter(([, el]) => el && el.getBoundingClientRect().top <= 200).at(-1)?.[0] ?? null,
      );
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [sections]);

  // Lo marcado, a la vista dentro de la barra: al entrar en la página y al ir leyendo.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => keepInView(root.current, true), [pathname]);
  useEffect(() => keepInView(root.current, false), [reading]);

  return (
    <SidebarGroup ref={root} className="p-0">
      <SidebarMenu className="gap-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<Link href={electionsHref()} />}
            isActive={!current}
            aria-current={current ? undefined : 'page'}
            className={item}
          >
            <Icon name="casa" size={18} />
            <span>Portada</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarSeparator className="mx-0 my-2" />
        {electionGroups.map((g) => (
          <Collapsible key={g.name} defaultOpen={g === home} render={<SidebarMenuItem />}>
            <CollapsibleTrigger render={<SidebarMenuButton className={item} />}>
              <Icon name={g.icon} size={18} />
              <span>{g.name}</span>
              <span
                aria-hidden="true"
                className="ml-auto flex text-muted-foreground transition-transform group-data-[panel-open]/menu-button:rotate-90 motion-reduce:transition-none [&_svg]:size-3.5!"
              >
                <Icon name="derecha" size={14} />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="mx-0 my-0.5 ml-5 border-0 px-0 pl-2">
                {g.pages.map((id) => (
                  <SidebarMenuSubItem key={id}>
                    <SidebarMenuSubButton
                      render={<Link href={electionsHref(id)} />}
                      isActive={id === current}
                      aria-current={id === current ? 'page' : undefined}
                      className="h-9 text-sm"
                    >
                      <span>{electionPages[id].short}</span>
                    </SidebarMenuSubButton>
                    {id === current && sections.length > 1 && (
                      <ul
                        aria-label={`En esta página: ${local?.title ?? electionPages[id].short}`}
                        className="m-0 my-1 ml-2 grid list-none gap-0.5 border-l border-sidebar-border p-0 pl-2.5"
                      >
                        {sections.map((s) => {
                          // Un ancla, si es la que se está leyendo; una subpágina, si es esta.
                          const here =
                            s.href?.startsWith('#') === false
                              ? s.href === pathname
                              : s.key === reading;
                          const className = cn(link, here && active);
                          return (
                            <li key={s.key}>
                              {s.href ? (
                                <Link
                                  href={s.href}
                                  aria-current={
                                    here
                                      ? s.href.startsWith('#')
                                        ? 'location'
                                        : 'page'
                                      : undefined
                                  }
                                  className={className}
                                >
                                  {s.label}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => s.el?.scrollIntoView({ behavior: motion() })}
                                  aria-current={here ? 'location' : undefined}
                                  className={className}
                                >
                                  {s.label}
                                </button>
                              )}
                              {s.href && s.children?.length && pathname.startsWith(s.href) ? (
                                <ul className="m-0 my-0.5 ml-2 grid list-none gap-0.5 border-l border-sidebar-border p-0 pl-2">
                                  {s.children.map((child) => (
                                    <li key={child.href}>
                                      <Link
                                        href={child.href}
                                        aria-current={child.href === pathname ? 'page' : undefined}
                                        className={cn(link, child.href === pathname && active)}
                                      >
                                        {child.label}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
