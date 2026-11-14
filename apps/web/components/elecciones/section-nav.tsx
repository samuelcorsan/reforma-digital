'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

// Un enlace de la barra; con `children`, sus partes, que se despliegan al estar dentro de ellas.
export type NavItem = { href: string; label: string; children?: NavItem[] };
// Dentro de una entrevista, la barra es la suya: de quién es, sus subpáginas y la vuelta al listado.
export type LocalNav = {
  title: string;
  subtitle?: string;
  back: { href: string; label: string };
  // La subpágina que se marca cuando la ruta no es ninguna de ellas.
  current?: string;
  items: NavItem[];
};

type Section = { key: string; label: string; el: HTMLElement };

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

// El enlace de la barra que corresponde a la ruta: el exacto o, si no, el más largo que la contiene
// (una verificación concreta cae en «Verificaciones»).
const currentHref = (items: NavItem[], pathname: string) =>
  items
    .flatMap((i) => [i, ...(i.children ?? [])])
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

// Fuera de una entrevista, un solo árbol: la portada, los grupos que se despliegan con sus apartados
// y, colgando del apartado en el que se está, las secciones de la página. Dentro de una entrevista,
// la de la entrevista. En los dos casos, la sección que se está leyendo, marcada.
export function SectionNav({ current, local }: { current?: ElectionPage; local?: LocalNav }) {
  const home = current && electionGroups.find((g) => g.pages.includes(current));
  const pathname = usePathname();

  // Las secciones de la página, también las que llegan después (las partes que cargan datos).
  const [sections, setSections] = useState<Section[]>([]);
  useEffect(() => {
    if (!current) return;
    const main = document.querySelector('main');
    const scan = () => setSections(findSections());
    scan();
    const watch = new MutationObserver(scan);
    if (main) watch.observe(main, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [current, pathname]);

  // La sección que se está leyendo: la última cuyo título ya ha pasado arriba.
  const [reading, setReading] = useState<string | null>(null);
  useEffect(() => {
    const update = () =>
      setReading(
        sections.filter((s) => s.el.getBoundingClientRect().top <= 200).at(-1)?.key ?? null,
      );
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [sections]);

  // Lo marcado, a la vista dentro de la barra: al entrar en la página y al ir leyendo.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => keepInView(root.current, true), [pathname]);
  useEffect(() => keepInView(root.current, false), [reading]);

  // Sin la que repite el nombre del enlace («Resumen» dentro de Resumen).
  const onPage = (label: string) => {
    const list = sections.filter((s) => s.label !== label);
    return (
      list.length > 1 && (
        <ul
          aria-label={`En esta página: ${label}`}
          className="m-0 my-1 ml-2 grid list-none gap-0.5 border-l border-sidebar-border p-0 pl-2.5"
        >
          {list.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => s.el.scrollIntoView({ behavior: motion() })}
                aria-current={s.key === reading ? 'location' : undefined}
                className={cn(link, s.key === reading && active)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )
    );
  };

  if (local) {
    const here = local.current ?? currentHref(local.items, pathname);
    const tree = (items: NavItem[]) => (
      <ul className="m-0 my-0.5 ml-2 grid list-none gap-0.5 border-l border-sidebar-border p-0 pl-2.5">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.href === here ? 'page' : undefined}
              className={cn(link, i.href === here && active)}
            >
              {i.label}
            </Link>
            {i.href === here && onPage(i.label)}
          </li>
        ))}
      </ul>
    );
    return (
      <SidebarGroup ref={root} className="p-0">
        <Link
          href={local.back.href}
          className="mb-4 inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-3 text-sm text-muted-foreground no-underline hover:bg-sidebar-accent hover:text-foreground"
        >
          <Icon name="izquierda" size={14} />
          {local.back.label}
        </Link>
        <div className="mb-3 grid gap-0.5 px-3">
          <span className="text-[15px] font-medium">{local.title}</span>
          {local.subtitle && (
            <span className="text-[13px] leading-snug text-muted-foreground">{local.subtitle}</span>
          )}
        </div>
        <SidebarMenu className="gap-0.5">
          {local.items.map((i) => (
            <SidebarMenuItem key={i.href}>
              <SidebarMenuButton
                render={<Link href={i.href} />}
                isActive={i.href === here}
                aria-current={i.href === here ? 'page' : undefined}
                className="h-9 text-sm"
              >
                <span>{i.label}</span>
              </SidebarMenuButton>
              {i.href === here && onPage(i.label)}
              {here && i.children?.length && here.startsWith(i.href) ? tree(i.children) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

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
                    {id === current && onPage(electionPages[id].short)}
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
