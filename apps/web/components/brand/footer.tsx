import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import Link from 'next/link';

import { links } from '../../lib/site';
import { congressBase } from '../../lib/congreso/routes';
import { electionsBase } from '../../lib/elecciones/pages';
import { Icon } from './icon';
import { Logo } from './logo';
import { LogoPuzle } from './logo-puzle';

const secciones = [
  ['La iniciativa', '/#iniciativa'],
  ['El Congreso', congressBase],
  ['Elecciones', electionsBase],
  ['App de escritorio', '/escritorio'],
  ['Equipo', '/equipo'],
] as const;

export function Footer() {
  return (
    <footer className={'pie max-w-none p-2 [border-top:0]'} aria-labelledby="pie-titulo">
      <div
        className={
          'pie-sol flex flex-col gap-10 [padding:clamp(48px,_8vw,_112px)_max(var(--page-gutter),_(100%_-_var(--container-content))_/_2_+_var(--page-gutter))_40px] [border-radius:28px] [background:radial-gradient(80%_70%_at_50%_-12%,_#ffe58f_0%,_rgba(255,_229,_143,_0)_70%),_linear-gradient(180deg,_#ffd34d_0%,_var(--brand-yellow)_46%,_var(--brand-orange)_100%)] [color:var(--foreground)] [@media(max-width:_720px)]:gap-8'
        }
      >
        <h2
          id="pie-titulo"
          className={
            'pie-titulo m-0 [max-width:20ch] [font-size:clamp(32px,_4vw,_56px)] [line-height:1]'
          }
        >
          Lo público es de todos. Su web, también.
        </h2>
        <div
          className={
            'pie-acciones flex flex-wrap gap-3 [@media(max-width:_720px)]:[&_:is([data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline])]:w-full'
          }
        >
          <a
            href={links.contributing}
            data-slot="button"
            data-variant="sunset"
            className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
          >
            <Icon name="contacto" /> Cuéntanos dónde te atascaste
          </a>
          <a
            href={links.repo}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
          >
            Ver el código en GitHub <Icon name="externo" size={16} />
          </a>
        </div>
        <div
          className={
            'pie-legal grid [grid-template-columns:1fr_auto] items-center [gap:8px_32px] pt-6 [border-top:1px_solid_rgba(34,_34,_34,_0.18)] [font-size:15px] [&_ul]:flex [&_ul]:flex-wrap [&_ul]:[justify-content:flex-end] [&_ul]:[gap:0_4px] [&_ul]:[margin:0_calc(-1_*_8px)] [&_ul]:p-0 [&_ul]:list-none [&_a]:inline-flex [&_a]:items-center [&_a]:min-h-11 [&_a]:px-2 [&_a]:[border-radius:12px] [&_a]:[color:var(--foreground)] [&_a]:[text-decoration-line:underline] [&_a]:[text-decoration-color:rgba(34,_34,_34,_0.35)] [&_a]:[text-decoration-thickness:from-font] [&_a]:[text-underline-offset:0.25em] [@media(hover:_hover)_and_(pointer:_fine)]:[&_a:hover]:[text-decoration-color:currentColor] [@media(max-width:_720px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_720px)]:[&_ul]:justify-start'
          }
        >
          <span role="img" aria-label="Reforma Digital" className={'pie-marca inline-flex'}>
            <Logo size={48} mark={<LogoPuzle size={48} />} />
          </span>
          <nav aria-label="Secciones">
            <ul>
              {secciones.map(([texto, href]) => (
                <li key={href}>
                  <Link href={href} prefetch={false}>
                    {texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className={'pie-nota m-0 text-sm'}>
            Proyecto independiente. Las adaptaciones son experimentales.
          </p>
          <nav className={'pie-nota m-0 text-sm'} aria-label="Información legal">
            <ul>
              <li>
                <Link href="/privacy" prefetch={false}>
                  Privacidad
                </Link>
              </li>
              <li>
                <a href={links.license}>Licencia MIT</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
