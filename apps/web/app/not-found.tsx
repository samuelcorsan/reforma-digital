import type { Metadata } from 'next';
import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { InfoPage } from '../components/brand/info-page';
export const metadata: Metadata = { title: 'Página no encontrada · Reforma Digital' };
export default function NotFound() {
  return (
    <InfoPage narrow>
      <p
        data-part="t-etiqueta"
        className={
          'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase block mb-4 text-(--text-secondary)'
        }
      >
        Página no encontrada
      </p>
      <h1>Por aquí no era.</h1>
      <p
        data-part="info-entradilla"
        className={'[max-width:65ch] mb-10 text-(--text-secondary) text-lg leading-1.6'}
      >
        No encontramos esta página. Vuelve a la portada para conocer los proyectos.
      </p>
      <Link
        className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
        data-slot="button"
        data-variant="sunset"
        href="/"
      >
        Ir a la portada
      </Link>
    </InfoPage>
  );
}
