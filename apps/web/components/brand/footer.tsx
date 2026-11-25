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
  ['Equipo', '/equipo'],
] as const;

export function Footer() {
  return (
    <footer className={'max-w-none p-2 border-t-0'} aria-labelledby="pie-titulo">
      <div
        className={
          'flex flex-col gap-10 pt-fluid-48-112 px-(--page-gutter-wide) pb-10 rounded-28 bg-(image:--footer-gradient) text-foreground [@media(max-width:_720px)]:gap-8'
        }
      >
        <h2 id="pie-titulo" className={'m-0 [max-width:20ch] text-fluid-32-56 leading-none'}>
          Lo público es de todos. Su web, también.
        </h2>
        <div
          className={
            'flex flex-wrap gap-3 [@media(max-width:_720px)]:[&_:is([data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline])]:w-full'
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
            'grid [grid-template-columns:1fr_auto] items-center gap-y-2 gap-x-8 pt-6 border-t border-t-tinta-sol/18 text-15 [&_ul]:flex [&_ul]:flex-wrap [&_ul]:[justify-content:flex-end] [&_ul]:gap-y-0 [&_ul]:gap-x-1 [&_ul]:[margin:0_calc(-1_*_8px)] [&_ul]:p-0 [&_ul]:list-none [&_a]:inline-flex [&_a]:items-center [&_a]:min-h-11 [&_a]:px-2 [&_a]:rounded-12 [&_a]:text-foreground [&_a]:underline [&_a]:decoration-tinta-sol/35 [&_a]:decoration-from-font [&_a]:underline-offset-em-25 [@media(hover:_hover)_and_(pointer:_fine)]:[&_a:hover]:decoration-current [@media(max-width:_720px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_720px)]:[&_ul]:justify-start'
          }
        >
          <span role="img" aria-label="Reforma Digital" className={'inline-flex'}>
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
          <p className={'m-0 text-sm'}>
            Proyecto independiente. Las adaptaciones son experimentales.
          </p>
          <nav className={'m-0 text-sm'} aria-label="Información legal">
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
