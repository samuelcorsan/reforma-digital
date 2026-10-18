import { cn } from '@reforma-digital/design/lib/utils';
import { Badge } from '@reforma-digital/design/ui/badge';
import { buttonVariants } from '@reforma-digital/design/ui/button';

import type { Metadata } from 'next';

import { Icon } from '../../../components/brand/icon';
import { Header } from '../../../components/brand/header';
import { DesktopScene } from '../../../components/brand/desktop-scene';
import { Footer } from '../../../components/brand/footer';
import { JsonLd } from '../../../components/json-ld';
import { breadcrumbs, organizationId, pageMetadata, webPage } from '../../../lib/seo';
import { links } from '../../../lib/site';
import { Marcadores } from './marcadores';

const title = 'Reforma Digital para escritorio';
const description =
  'Un asistente de trámites para macOS, Windows y Linux. Busca el trámite en las webs oficiales, te explica los pasos y rellena contigo el formulario de la sede electrónica. Tus datos personales no llegan a la IA.';

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: '/escritorio',
  og: 'escritorio',
});

const graph = [
  webPage({ name: title, description, path: '/escritorio' }),
  breadcrumbs('Escritorio', '/escritorio'),
  {
    '@type': 'SoftwareApplication',
    name: title,
    description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'macOS, Windows, Linux',
    license: links.license,
    isAccessibleForFree: true,
    publisher: { '@id': organizationId },
  },
];

const readme = `${links.repo}/tree/main/apps/desktop#readme`;

const etiqueta = 'text-sm font-medium text-brand';
const titularSeccion =
  'm-0 font-heading font-normal text-balance text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-0.02em]';
const titularTarjeta =
  'm-0 font-heading font-normal text-balance text-[clamp(24px,2.4vw,30px)] leading-[1.15] tracking-[-0.01em]';
const entradilla = 'text-[clamp(17px,1.4vw,19px)] leading-[1.6] text-pretty';
const seccion = 'mx-auto max-w-(--container-content) px-(--page-gutter)';

const pasos = [
  {
    titulo: 'Le dices qué necesitas.',
    texto:
      'Con tus palabras: «Quiero renovar el DNI en Sevilla». Si le falta un dato, te lo pregunta.',
  },
  {
    titulo: 'Busca cómo se hace.',
    texto:
      'Lee las sedes electrónicas y el BOE, te explica los pasos y te enseña qué webs ha consultado. Marca como «sin verificar» las que no son de la Administración.',
  },
  {
    titulo: 'Rellena la sede contigo.',
    texto:
      'Abre la sede en un navegador dentro de la app y rellena el formulario mientras lo ves. Antes de enviar, pagar o firmar, te pide permiso.',
  },
];

const tuyo = ['Contraseñas', 'CAPTCHA', 'Certificados', 'Firmas', 'Pagos'];

const plataformas = [
  { nombre: 'macOS', detalle: 'Apple silicon e Intel', formatos: '.dmg' },
  { nombre: 'Windows', detalle: 'Windows 10 y 11', formatos: '.exe' },
  { nombre: 'Linux', detalle: 'x64', formatos: '.deb · .AppImage' },
];

export default function DesktopPage() {
  return (
    <>
      <JsonLd graph={graph} />
      <Header current="/escritorio" />
      <main id="main" tabIndex={-1}>
        <section
          className={cn(seccion, 'pt-12 text-center max-[600px]:pt-8')}
          aria-labelledby="es-titulo"
        >
          <p className={cn(etiqueta, 'mb-5')}>App de escritorio para macOS, Windows y Linux</p>
          <h1
            id="es-titulo"
            className="mx-auto mb-6 max-w-[28ch] font-heading text-[clamp(36px,5vw,60px)] leading-[1.08] font-normal tracking-[-0.02em] text-balance"
          >
            Haz tus trámites sin perderte en la sede electrónica.
          </h1>
          <p className={cn(entradilla, 'mx-auto mb-8 max-w-[60ch] text-(--text-secondary)')}>
            Le dices qué necesitas. Busca el trámite en las webs oficiales, te explica los pasos y
            rellena el formulario contigo, a la vista. Antes de enviar, pagar o firmar, te pide
            permiso.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <a
              href="#descargar"
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'lg' }))}
            >
              Ver cuándo sale <Icon name="abajo" size={16} />
            </a>
            <a
              href={readme}
              className="flex min-h-11 items-center gap-2 underline underline-offset-[0.25em]"
            >
              Ver el código <Icon name="externo" size={16} />
            </a>
          </div>
        </section>

        <div className={cn(seccion, 'mt-12 max-[600px]:mt-8')}>
          <Escaparate />
        </div>

        <section className={cn(seccion, 'pt-24 max-[480px]:pt-16')} aria-labelledby="es-como">
          <p className={cn(etiqueta, 'mb-5')}>Cómo funciona</p>
          <h2 id="es-como" className={cn(titularSeccion, 'mb-12 max-w-[17ch]')}>
            Le dices qué trámite necesitas y te ayuda a hacerlo.
          </h2>
          <ol className="m-0 grid list-none grid-cols-3 border border-border p-0 max-[800px]:grid-cols-1">
            {pasos.map((paso, i) => (
              <li
                key={paso.titulo}
                className="grid content-start gap-4 p-8 not-first:border-l not-first:border-border max-[800px]:p-6 max-[800px]:not-first:border-t max-[800px]:not-first:border-l-0"
              >
                <span className="font-mono text-muted-foreground tabular-nums" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={titularTarjeta}>{paso.titulo}</h3>
                <p className="m-0 text-(--text-secondary)">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className={cn(
            seccion,
            'grid grid-cols-2 items-center gap-16 pt-24 max-[800px]:grid-cols-1 max-[800px]:gap-10 max-[480px]:pt-16',
          )}
          aria-labelledby="es-datos"
        >
          <div>
            <p className={cn(etiqueta, 'mb-5')}>Tus datos</p>
            <h2 id="es-datos" className={cn(titularSeccion, 'max-w-[16ch]')}>
              Tus datos se quedan en tu ordenador.
            </h2>
            <div className={cn(entradilla, 'mt-6 grid gap-4 text-(--text-secondary)')}>
              <p className="m-0">
                Antes de enviar tu petición, la app cambia tu nombre, tu DNI o tu dirección por
                marcadores. La IA trabaja con los marcadores y la app escribe tus datos reales solo
                en la sede oficial.
              </p>
              <p className="m-0">
                La app lo guarda todo cifrado, con la clave en el llavero del sistema. El servidor
                no guarda tus peticiones.
              </p>
            </div>
            <p className="mt-8 mb-3 text-sm text-(--text-secondary)">Siempre lo haces tú:</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {tuyo.map((cosa) => (
                <li
                  key={cosa}
                  className="flex min-h-9 items-center gap-2 rounded-full border border-border px-3.5 text-sm"
                >
                  <Icon name="candado" size={16} /> {cosa}
                </li>
              ))}
            </ul>
          </div>
          <Marcadores />
        </section>

        <section
          id="descargar"
          className={cn(seccion, 'scroll-mt-24 py-24 max-[480px]:py-16')}
          aria-labelledby="es-descargar"
        >
          <div className="mb-10 grid justify-items-center gap-5 text-center">
            <p className={etiqueta}>Descargar</p>
            <h2 id="es-descargar" className={cn(titularSeccion, 'max-w-[18ch]')}>
              Sale pronto para macOS, Windows y Linux.
            </h2>
            <p className={cn(entradilla, 'm-0 max-w-[60ch] text-(--text-secondary)')}>
              Está en pre-alpha: aún no hay instaladores y todavía no ha completado ningún trámite
              de principio a fin en una sede real.
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-3 border border-border p-0 max-[800px]:grid-cols-1">
            {plataformas.map((p) => (
              <li
                key={p.nombre}
                className="flex items-start justify-between gap-4 p-8 not-first:border-l not-first:border-border max-[800px]:p-6 max-[800px]:not-first:border-t max-[800px]:not-first:border-l-0"
              >
                <div>
                  <h3 className={titularTarjeta}>{p.nombre}</h3>
                  <p className="mt-2 mb-0 text-(--text-secondary)">{p.detalle}</p>
                  <p className="mt-4 mb-0 font-mono text-sm text-muted-foreground">{p.formatos}</p>
                </div>
                <Badge variant="outline">Próximamente</Badge>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** La app sobre la pieza amarilla de Sol. */
function Escaparate() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(100%_100%_at_100%_0%,color-mix(in_oklch,var(--brand-yellow),var(--background)_60%)_0%,transparent_70%),linear-gradient(150deg,var(--brand-yellow)_35%,color-mix(in_oklch,var(--brand-yellow),var(--brand-orange)_55%)_100%)] px-[clamp(12px,5vw,64px)] pt-[clamp(24px,5vw,64px)] select-none"
    >
      <DesktopScene height={560} />
    </div>
  );
}
