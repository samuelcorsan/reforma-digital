import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@reforma-digital/design/ui/navigation-menu';

import Link from 'next/link';
import { endpoints } from '../../lib/developers/api';
import { Icon } from './icon';
import { Logo } from './logo';
import { LogoLink } from './logo-link';
import { MobileMenu } from './mobile-menu';

// Pastillas de cristal sin barra detrás. Sin borde, el canto lo marca solo el tono y es igual en
// todas; el hover oscurece con una sombra interior (que sí se anima) y la zona de clic
// crece hasta 40 px sin cambiar la pieza.
const pieza = cn(
  buttonVariants({ variant: 'secondary' }),
  'relative h-8.5 border-0 px-3 bg-secondary/60 backdrop-blur-xl backdrop-saturate-150 hover:bg-secondary/60 hover:backdrop-blur-xl [@media(prefers-reduced-transparency:reduce)]:bg-secondary',
  'shadow-[inset_0_0_0_40px_rgb(0_0_0/0)] hover:shadow-[inset_0_0_0_40px_rgb(0_0_0/0.06)] aria-[current=page]:shadow-[inset_0_0_0_40px_rgb(0_0_0/0.06)]',
  'transition-[box-shadow,scale] duration-150 ease-out active:scale-[0.96] active:not-aria-[haspopup]:translate-y-0 motion-reduce:transition-none',
  'focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground',
  'before:absolute before:inset-x-0 before:-inset-y-[3px]',
);
const participar = cn(pieza, 'border border-border bg-background pr-2.5 hover:bg-background');

// Al bajar los primeros 40 px, --pliegue va de 0 a 1 (animación ligada al scroll, sin JS): el
// texto «Reforma Digital» se pliega y la R, sin encoger (36 px), queda centrada en un icono blanco
// de 56 × 56 px con el borde de «Participar». El icono baja 11 px para que su borde superior
// quede a la altura del de los botones del menú, y se alinea con la columna. El fondo y el borde
// van en una capa que solo cambia de opacidad. -my-1 evita que la cabecera crezca.
// Sin `animation-timeline`, la animación dura 0 s y se queda en 1: la R en su icono.
const logo =
  'relative isolate mr-auto -my-1 -ml-[14.5px] flex h-14 items-center rounded-[14px] px-[14.5px] outline-none [translate:calc(14.5px*var(--pliegue))_calc(11px*var(--pliegue))] before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:border before:border-border before:bg-background before:[opacity:var(--pliegue)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground [&_[data-part=marca]]:[gap:calc(0.5em*(1-var(--pliegue)))] [&_[data-part=marca-texto]]:[overflow-x:clip] [&_[data-part=marca-texto]]:[max-width:calc(6em*(1-var(--pliegue)))] [&_[data-part=marca-texto]]:[opacity:calc(1-var(--pliegue))]';

export function Header({ current }: { current?: string }) {
  const links = [
    { href: '/congreso', text: 'El Congreso', current: current === '/congreso' },
    { href: '/elecciones', text: 'Elecciones', current: current === '/elecciones' },
    {
      href: '/developers/api',
      text: 'Desarrolladores',
      current: current === '/developers',
      children: [
        { href: '/developers/api', text: 'API' },
        { href: '/developers/mcp', text: 'MCP' },
      ],
    },
    { href: '/equipo', text: 'Equipo', current: current === '/equipo' },
  ];

  return (
    <header
      data-part="in-nav"
      className="pointer-events-none sticky top-0 z-40 flex items-center gap-4 min-h-20 [padding:16px_max(var(--page-gutter),_calc((100%_-_var(--container-content))_/_2_+_var(--page-gutter)))] [&_>_*]:pointer-events-auto [&_nav]:flex [&_nav]:items-center [&_nav]:gap-1 [@media(max-width:_800px)]:[&_nav]:hidden [animation-name:cabecera-pliegue] [animation-fill-mode:both] [animation-timing-function:linear] [animation-timeline:scroll()] [animation-range:0_40px] motion-reduce:[animation-timing-function:steps(1,end)]"
    >
      <LogoLink className={logo}>
        <Logo size={36} />
      </LogoLink>
      <nav aria-label="Navegación principal">
        {links.map((link) =>
          link.children ? (
            <Desarrolladores key={link.href} current={link.current} />
          ) : (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.current ? 'page' : undefined}
              data-slot="button"
              data-variant="secondary"
              className={pieza}
            >
              {link.text}
            </Link>
          ),
        )}
        <Link href="/#participar" data-slot="button" data-variant="outline" className={participar}>
          Participar <Icon name="derecha" size={16} />
        </Link>
      </nav>
      <MobileMenu links={links} />
    </header>
  );
}

// El menú «Desarrolladores»: la API y la biblioteca MCP, en dos columnas. Los endpoints salen de
// lib/developers/api.ts; los servidores no se listan, que irán creciendo. Se abre al pasar o al pulsar.
const columnas = [
  {
    titulo: 'API',
    items: [
      {
        href: '/developers/api',
        label: 'Introducción',
        text: 'Los datos del Congreso en JSON, sin clave ni registro.',
      },
      ...endpoints.flatMap(({ id, menu }) =>
        menu ? [{ href: `/developers/api#${id}`, ...menu }] : [],
      ),
    ],
  },
  {
    titulo: 'MCP',
    items: [
      {
        href: '/developers/mcp',
        label: 'Biblioteca',
        text: 'Conecta tu asistente a datos públicos de España.',
      },
    ],
  },
];

function Desarrolladores({ current }: { current: boolean }) {
  return (
    <NavigationMenu align="end" className="max-w-none flex-none">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              pieza,
              'gap-0.5 font-normal data-popup-open:bg-secondary/60 data-popup-open:shadow-[inset_0_0_0_40px_rgb(0_0_0/0.06)]',
              current && 'shadow-[inset_0_0_0_40px_rgb(0_0_0/0.06)]',
            )}
          >
            Desarrolladores
          </NavigationMenuTrigger>
          <NavigationMenuContent className="p-0">
            <div className="grid w-[min(640px,calc(100vw-48px))] grid-cols-2 divide-x divide-border">
              {columnas.map(({ titulo, items }) => (
                <div key={titulo} className="grid content-start gap-1 p-3">
                  <p className="px-3 pt-1 pb-2 text-sm text-muted-foreground">{titulo}</p>
                  {items.map((item) => (
                    <NavigationMenuLink
                      key={item.href}
                      render={<Link href={item.href} />}
                      className="flex-col items-start gap-0 rounded-xl px-3 py-2"
                    >
                      <span className="text-[15px] font-medium">{item.label}</span>
                      <span className="line-clamp-1 text-muted-foreground">{item.text}</span>
                    </NavigationMenuLink>
                  ))}
                </div>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
