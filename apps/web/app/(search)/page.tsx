import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '../../components/brand/icon';
import { Header } from '../../components/brand/header';
import { Footer } from '../../components/brand/footer';
import { DesktopScene } from '../../components/brand/desktop-scene';
import { ProjectScene } from '../../components/brand/project-scene';
import { links } from '../../lib/site';
import { congressBase } from '../../lib/congreso/routes';
import { semicircle } from '../../lib/elecciones/hemicycle';
import { electionsBase } from '../../lib/elecciones/pages';
import {
  absolute,
  organization,
  organizationId,
  pageMetadata,
  siteName,
  websiteId,
} from '../../lib/seo';
import { JsonLd } from '../../components/json-ld';

const title = 'Reforma Digital · Lo público, a la altura de las personas';
const description =
  'Iniciativa abierta para hacer más sencillos los trámites con la Administración: extensión para Chrome, actividad del Congreso y código abierto.';

export const metadata: Metadata = pageMetadata({ title, description, path: '/', og: 'portada' });

const free = { '@type': 'Offer', price: '0', priceCurrency: 'EUR' };

const graph = [
  {
    '@type': 'WebSite',
    '@id': websiteId,
    url: absolute('/'),
    name: siteName,
    description,
    inLanguage: 'es-ES',
    publisher: { '@id': organizationId },
  },
  organization,
  {
    '@type': 'SoftwareApplication',
    name: 'Reforma Digital para Chrome',
    description:
      'Extensión que propone otra interfaz en pantallas de DNI, Extranjería, Hacienda y Registro de asociaciones. Los formularios y los envíos siguen en la sede oficial.',
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Google Chrome',
    downloadUrl: links.install,
    license: links.license,
    isAccessibleForFree: true,
    offers: free,
    publisher: { '@id': organizationId },
  },
];

const mejoras = [
  [
    'Encontrar el camino.',
    'Partir de lo que necesitas para llegar al organismo, los requisitos y el trámite que te corresponden, con fuentes oficiales que puedas consultar.',
  ],
  [
    'Entender cada paso.',
    'Dar contexto a los formularios, ordenar las opciones y mostrar los avisos donde hacen falta, conservando la información y las validaciones oficiales.',
  ],
  [
    'Aprender una vez.',
    'Compartir criterios de diseño entre sedes para que lo aprendido en un trámite sirva en el siguiente.',
  ],
  [
    'Poder participar.',
    'Hacer públicas las propuestas, las decisiones de diseño y las comprobaciones, para que cualquiera pueda discutirlas y mejorarlas.',
  ],
] as const;

const titularSeccion = 'm-0 font-heading text-[clamp(32px,4vw,52px)] leading-[1.05] font-normal';
const entradilla = 'm-0 text-[clamp(17px,1.4vw,19px)] leading-[1.6]';
const enlaceTexto = 'flex min-h-11 w-fit items-center gap-2 underline underline-offset-[0.25em]';
const aire = 'scroll-mt-20 pt-24 max-[480px]:pt-16';
const contenedor = 'mx-auto max-w-(--container-content) px-(--page-gutter)';
const seccion = `${aire} ${contenedor}`;
// Rejilla de celdas con bordes compartidos: las líneas son el fondo que asoma por los huecos de 1 px.
const celdas = 'm-0 grid list-none gap-px border border-border bg-border p-0';
const celda = 'flex flex-col items-start gap-3 bg-background p-8 max-lg:p-6';
// Fondos de la imagen de cada proyecto.
const amarillo =
  'bg-[radial-gradient(100%_100%_at_100%_0%,color-mix(in_oklch,var(--brand-yellow),var(--background)_60%)_0%,transparent_70%),linear-gradient(150deg,var(--brand-yellow)_35%,color-mix(in_oklch,var(--brand-yellow),var(--brand-orange)_55%)_100%)]';
const rojo = '[background:var(--brand-gradient)] text-background';

/**
 * La tarjeta de un proyecto: su imagen arriba, decorativa, y el texto debajo. Toda la tarjeta es
 * el enlace.
 */
function Proyecto({
  titulo,
  texto,
  enlace,
  fondo,
  children,
}: {
  titulo: string;
  texto: string;
  enlace: { href: string; texto: string };
  fondo: string;
  children: ReactNode;
}) {
  const Enlace = enlace.href.startsWith('/') ? Link : 'a';
  return (
    <li className="relative flex w-[min(80vw,344px)] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-border">
      <div className={cn('aspect-4/3 overflow-hidden select-none', fondo)} aria-hidden="true">
        {children}
      </div>
      <div className="flex flex-1 flex-col items-start gap-2 p-6">
        <h3 className="m-0 font-heading text-2xl leading-[1.15] font-normal">{titulo}</h3>
        <p className="m-0 text-(--text-secondary)">{texto}</p>
        <Enlace
          href={enlace.href}
          className={cn(
            enlaceTexto,
            'mt-auto outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:shadow-[inset_0_0_0_4px_var(--background)] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-foreground',
          )}
        >
          {enlace.texto}
          {Enlace === 'a' && <Icon name="externo" size={16} />}
        </Enlace>
      </div>
    </li>
  );
}

const hemiciclo = semicircle();
// El radio de fuera, que es también el centro en x y la base en y; la fila de dentro está al 40 %.
const radio = hemiciclo.label.x;

/**
 * Los 350 escaños como un sol que sale: rojo, naranja y amarillo de dentro afuera. El color va por
 * filas, no por cuñas, para que no parezca el reparto de nadie.
 */
function Hemiciclo() {
  return (
    <svg viewBox={hemiciclo.box} className="block w-full">
      {hemiciclo.points.map(([x, y]) => {
        const fila = (Math.hypot(x - radio, y - radio) / radio - 0.4) / 0.6;
        const tono =
          fila < 0.5
            ? `color-mix(in oklch, var(--brand-orange) ${Math.round(fila * 200)}%, var(--brand))`
            : `color-mix(in oklch, var(--brand-yellow) ${Math.round(fila * 200 - 100)}%, var(--brand-orange))`;
        return <circle key={`${x} ${y}`} cx={x} cy={y} r="6.5" fill={tono} />;
      })}
    </svg>
  );
}

/** Una papeleta del 29N: la fecha y, sin nombres, tres casillas con una marcada. */
function Papeleta() {
  return (
    <div className="grid h-full place-items-center">
      <div className="relative h-39 w-58">
        <div className="absolute inset-0 translate-x-3 -translate-y-2 rotate-6 rounded-xl bg-background/60" />
        <div className="absolute inset-0 flex -rotate-3 items-center gap-5 rounded-xl bg-background p-5 text-foreground shadow-(--shadow-overlay)">
          <p className="m-0 font-heading text-6xl leading-none">29N</p>
          <div className="grid flex-1 gap-3">
            {[1, 2, 3].map((casilla) => (
              <span key={casilla} className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-[4px] border border-foreground/30',
                    casilla === 2 && 'border-brand bg-brand text-background',
                  )}
                >
                  {casilla === 2 && <Icon name="hecho" size={10} />}
                </span>
                <span className="h-1.5 flex-1 rounded-full bg-foreground/15" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** La raíz de la API, resumida: los campos que faltan van como «…». */
function Peticion() {
  return (
    <pre className="m-0 h-full overflow-hidden rounded-t-2xl bg-foreground p-4 font-mono text-xs leading-[1.7] text-background">
      <span className="text-brand-yellow">GET</span> /api/congreso
      {`

{
  "version": 1,
  "atribucion": {
    "origen": "Escaño Abierto",
    "licencia": "CC BY 4.0", …
  },
  "endpoints": [
    "votaciones",
    "preguntas",
    "sesiones", …
  ], …
}`}
    </pre>
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd graph={graph} />
      <Header />
      <main id="main" tabIndex={-1} className="pb-24 max-[480px]:pb-16">
        <section
          className={cn(
            rojo,
            'relative m-2 flex min-h-152 flex-col items-center justify-center gap-6 rounded-[28px] px-(--page-gutter) pt-12 pb-31 text-center [--ring:var(--foreground)] max-[480px]:bg-size-[100%_560px] max-[480px]:bg-bottom max-[480px]:bg-no-repeat',
          )}
          aria-labelledby="in-titulo"
        >
          <h1
            id="in-titulo"
            className="m-0 max-w-[18ch] font-heading text-[clamp(36px,6vw,72px)] leading-[1.06] font-normal"
          >
            Lo público, a la altura de las personas.
          </h1>
          <p className={cn(entradilla, 'max-w-[62ch]')}>
            Herramientas gratuitas y de código abierto: un asistente que te ayuda a hacer tus
            trámites, una extensión que hace más fáciles de usar las webs oficiales, y la actividad
            del Congreso y las elecciones con datos oficiales.
          </p>
          <a
            href="#proyectos"
            data-slot="button"
            data-variant="secondary"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'xl' }),
              'absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full',
            )}
          >
            Conoce los proyectos <Icon name="abajo" size={16} />
          </a>
        </section>

        <section id="proyectos" className={aire} aria-labelledby="in-proyectos-titulo">
          <header className={cn(contenedor, 'mb-12 grid justify-items-center gap-5 text-center')}>
            <h2 id="in-proyectos-titulo" className={titularSeccion}>
              Los proyectos
            </h2>
            <p className={cn(entradilla, 'max-w-[60ch] text-(--text-secondary)')}>
              Son experimentales: las probamos y las mejoramos en comunidad.
            </p>
          </header>
          {/* Una fila con scroll horizontal nativo; la siguiente tarjeta asoma. Hasta 1280 px llega a
              los bordes de la ventana. Desde ahí se corta en el ancho de la retícula: la fila mide
              48 px más por cada lado y en ese margen las tarjetas se funden. */}
          <ul className="m-0 flex snap-x snap-mandatory list-none gap-6 overflow-x-auto [padding:0_max(var(--page-gutter),_calc((100%_-_var(--container-content))_/_2_+_var(--page-gutter)))_16px] [scroll-padding-inline:max(var(--page-gutter),_calc((100%_-_var(--container-content))_/_2_+_var(--page-gutter)))] xl:mx-auto xl:max-w-[calc(var(--container-content)+48px)] xl:scroll-px-12 xl:px-12 xl:[mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%_-_48px),transparent)]">
            <Proyecto
              titulo="App de escritorio"
              texto="Le dices qué necesitas: busca el trámite en las webs oficiales, te explica los pasos y rellena el formulario contigo. Tus datos personales no llegan a la IA."
              enlace={{ href: '/escritorio', texto: 'Ver la app' }}
              fondo={amarillo}
            >
              <div className="px-6 pt-6">
                <DesktopScene height={800} />
              </div>
            </Proyecto>
            <Proyecto
              titulo="El Congreso"
              texto="Consulta qué se debate, cómo se vota y quién te representa, con enlaces a las fuentes oficiales."
              enlace={{ href: congressBase, texto: 'Abrir El Congreso' }}
              fondo="border-b border-border"
            >
              <div className="flex h-full items-end px-5">
                <Hemiciclo />
              </div>
            </Proyecto>
            <Proyecto
              titulo="Elecciones"
              texto="Las generales con datos oficiales: lo que deja la legislatura, cómo se reparten los 350 escaños, cuarenta y nueve años de elecciones y las encuestas."
              enlace={{ href: electionsBase, texto: 'Ver las elecciones' }}
              fondo={rojo}
            >
              <Papeleta />
            </Proyecto>
            <Proyecto
              titulo="API"
              texto="Votaciones, preguntas, Diarios de Sesiones y datasets del Congreso, en abierto."
              enlace={{ href: '/api', texto: 'Leer la documentación' }}
              fondo={amarillo}
            >
              <div className="h-full px-6 pt-6">
                <Peticion />
              </div>
            </Proyecto>
            <Proyecto
              titulo="Extensión para Chrome"
              texto="Prueba otra interfaz en pantallas de DNI, Extranjería, Hacienda y Registro de asociaciones. Los formularios y los envíos siguen en la sede oficial."
              enlace={{ href: links.install, texto: 'Descargar la extensión' }}
              fondo="bg-muted"
            >
              <div className="h-full px-6 pt-6">
                <ProjectScene />
              </div>
            </Proyecto>
          </ul>
        </section>

        <section id="iniciativa" className={seccion} aria-labelledby="in-idea">
          <div className="grid grid-cols-2 gap-16 max-[800px]:grid-cols-1 max-[800px]:gap-8">
            <div className="grid content-start justify-items-start gap-5">
              <h2 id="in-idea" className={titularSeccion}>
                La iniciativa
              </h2>
              <Link className={enlaceTexto} href="/equipo">
                Conoce al equipo
              </Link>
            </div>
            <div className="grid content-start gap-6 text-(--text-secondary)">
              <p className={entradilla}>
                Pedir una cita, buscar una ayuda o responder a una notificación empieza, muchas
                veces, con una pantalla que cuesta entender. Queremos que las webs públicas
                acompañen a quien las usa: qué necesitas, dónde estás y cuál es el siguiente paso.
              </p>
              <p className={entradilla}>
                Empezamos con herramientas que podemos probar y mejorar en comunidad. El horizonte
                es llevar esas mejoras a las propias sedes, con un sistema de diseño público y
                abierto que sus equipos puedan reutilizar. Somos un proyecto independiente, sin
                vinculación con la Administración.
              </p>
            </div>
          </div>
          <ul
            className={cn(celdas, 'mt-12 grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1')}
            aria-label="Qué queremos mejorar"
          >
            {mejoras.map(([titulo, texto]) => (
              <li key={titulo} className={celda}>
                <h3 className="m-0 font-heading text-xl leading-[1.2] font-normal">{titulo}</h3>
                <p className="m-0 text-(--text-secondary)">{texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="participar"
          className={cn(seccion, 'grid justify-items-center gap-5 text-center')}
          aria-labelledby="in-comunidad-titulo"
        >
          <h2 id="in-comunidad-titulo" className={titularSeccion}>
            Cómo contribuir
          </h2>
          <p className={cn(entradilla, 'max-w-[60ch] text-(--text-secondary)')}>
            Cuéntanos dónde te atascaste o qué cambiarías abriendo una issue en GitHub. No hace
            falta programar. Es pública: no incluyas datos personales.
          </p>
          <a
            href={`${links.repo}/issues/new`}
            data-slot="button"
            data-variant="sunset"
            className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }), 'mt-3')}
          >
            Abrir una issue <Icon name="externo" size={16} />
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
