import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';

import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '../../components/brand/icon';
import { Header } from '../../components/brand/header';
import { Footer } from '../../components/brand/footer';
import { ProjectScene } from '../../components/brand/project-scene';
import { DesktopScene } from '../../components/brand/desktop-scene';
import { ProjectTour } from '../../components/brand/project-tour';
import { links } from '../../lib/site';
import { congressBase } from '../../lib/congreso/routes';
import {
  absolute,
  organization,
  organizationId,
  pageMetadata,
  siteName,
  websiteId,
} from '../../lib/seo';
import { JsonLd } from '../../components/json-ld';
import { Contribution } from '../../components/brand/contribution';

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

export default function HomePage() {
  return (
    <div className="iniciativa">
      <JsonLd graph={graph} />
      <Header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md" />
      <main id="main" tabIndex={-1}>
        <section
          className={
            'in-hero relative flex flex-col min-h-152 m-2 [border-radius:28px] [background:var(--brand-gradient)] [color:var(--background)] [--logo-color:currentColor] [--ring:var(--background)] [&_h1]:[max-width:25ch] [&_h1]:[margin:0_auto_32px] [&_h1]:[font-family:var(--font-brand-heading)] [&_h1]:[font-size:clamp(36px,_5vw,_72px)] [&_h1]:font-normal [&_h1]:[line-height:1.08] [@media(max-width:_480px)]:[background-size:100%_560px] [@media(max-width:_480px)]:[background-position:center_bottom] [@media(max-width:_480px)]:[background-repeat:no-repeat]'
          }
          aria-labelledby="in-titulo"
        >
          <div
            className={
              'in-hero-interior [max-width:var(--container-content)] [margin-inline:auto] [padding-inline:var(--page-gutter)] flex flex-col justify-center [flex:1] w-full pt-10 [padding-bottom:calc(80px_+_44px)] text-center'
            }
          >
            <h1
              id="in-titulo"
              className={
                't-titular-xl m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(44px,_6.4vw,_92px)] [line-height:1] [letter-spacing:-0.03em]'
              }
            >
              Lo público, a la altura de las personas.
            </h1>
            <p
              className={
                't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty in-hero-texto [max-width:64ch] [margin:0_auto_16px] [font-size:clamp(16px,_1.2vw,_17px)]'
              }
            >
              Hacer un trámite no debería exigir entender cómo funciona toda la Administración.
              Creamos herramientas y propuestas para que relacionarnos con ella sea más claro,
              accesible y sencillo. Lo hacemos en comunidad y con código abierto.
            </p>
            <a
              href="#proyectos"
              data-slot="button"
              data-variant="secondary"
              className={cn(
                buttonVariants({
                  variant: 'secondary',
                  size: 'lg',
                  className:
                    'in-hero-enlace absolute bottom-6 w-fit rounded-full px-5 [inset-inline:0] [margin-inline:auto] [--ring:var(--foreground)]',
                }),
              )}
            >
              Conoce los proyectos <Icon name="abajo" size={16} />
            </a>
          </div>
        </section>

        <section
          id="iniciativa"
          className={
            'in-seccion [max-width:var(--container-content)] [margin-inline:auto] [padding-inline:var(--page-gutter)] [padding-block:96px_0] scroll-mt-24 [@media(max-width:_480px)]:pt-16 in-manifiesto grid [grid-template-columns:1fr_1fr] gap-16 [&_h2]:[max-width:17ch] [&_.in-enlace]:[width:fit-content] [&_.in-enlace]:mt-6 [@media(max-width:_800px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_800px)]:gap-8'
          }
          aria-labelledby="in-idea"
        >
          <div>
            <p
              className={
                't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase in-etiqueta mb-5 [color:var(--brand)]'
              }
            >
              La iniciativa
            </p>
            <h2
              id="in-idea"
              className={
                't-titular-m m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(32px,_4vw,_52px)] [line-height:1.05] [letter-spacing:-0.02em]'
              }
            >
              Que hacer un trámite no sea otro trámite.
            </h2>
            <Link
              className={
                'in-enlace flex items-center gap-2 min-h-11 [width:fit-content] [text-decoration:underline] [text-underline-offset:0.25em]'
              }
              href="/equipo"
            >
              Conoce al equipo <Icon name="derecha" size={16} />
            </Link>
          </div>
          <div
            className={
              'in-lectura grid gap-6 [color:var(--text-secondary)] t-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
            }
          >
            <p>
              Pedir una cita, buscar una ayuda o responder a una notificación empieza, muchas veces,
              con una pantalla que cuesta entender. Queremos que las webs públicas acompañen a quien
              las usa: qué necesitas, dónde estás y cuál es el siguiente paso.
            </p>
            <p>
              Empezamos con herramientas que podemos probar y mejorar en comunidad. El horizonte es
              llevar esas mejoras a las propias sedes, con un sistema de diseño público y abierto
              que sus equipos puedan reutilizar.
            </p>
          </div>
        </section>

        <div
          id="proyectos"
          className={
            'in-proyectos scroll-mt-24 [&_.rc]:[padding-bottom:0] [&_.rc]:scroll-mt-24 [&_.rc-paso-texto]:gap-5 [&_.rc-paso-texto_>_:is([data-slot=button][data-variant=sunset],_.in-enlace)]:[justify-self:start] [@media(max-width:_959px)]:[&_.rc-paso-texto]:gap-3 [@media(max-width:_959px)]:[&_.rc-paso-texto_>_p_+_*]:mt-2'
          }
        >
          <ProjectTour
            titleId="in-proyectos-titulo"
            unit="Proyecto"
            header={
              <header
                className={
                  'in-seccion-cabecera grid [justify-items:center] gap-6 mb-10 text-center [&_>_p]:[max-width:64ch] [&_>_p]:[color:var(--text-secondary)]'
                }
              >
                <div>
                  <p
                    className={
                      't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase in-etiqueta mb-5 [color:var(--brand)]'
                    }
                  >
                    Los proyectos
                  </p>
                  <h2
                    id="in-proyectos-titulo"
                    className={
                      't-titular-m m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(32px,_4vw,_52px)] [line-height:1.05] [letter-spacing:-0.02em]'
                    }
                  >
                    La idea, puesta en práctica.
                  </h2>
                </div>
                <p
                  className={
                    't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
                  }
                >
                  Creamos proyectos para hacer más clara, accesible y sencilla nuestra relación con
                  lo público. Estas son algunas de las herramientas que estamos construyendo, y un
                  adelanto de lo que viene.
                </p>
              </header>
            }
            steps={[
              {
                title: 'Tus trámites, con un asistente.',
                label: (
                  <span
                    className={
                      'in-proyecto-tipo [justify-self:start] [color:var(--brand)] [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
                    }
                  >
                    01 · App de escritorio
                  </span>
                ),
                text: (
                  <>
                    <p
                      className={
                        't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
                      }
                    >
                      Le dices qué necesitas: busca el trámite en las webs oficiales, te explica los
                      pasos y rellena el formulario contigo. Tus datos personales no llegan a la IA.
                    </p>
                    <Link
                      className={cn(buttonVariants({ variant: 'sunset' }))}
                      data-slot="button"
                      data-variant="sunset"
                      href="/escritorio"
                    >
                      Ver la app <Icon name="derecha" size={16} />
                    </Link>
                  </>
                ),
                scene: (
                  <div
                    className={
                      'rc-pieza absolute [inset:0] [padding:7cqi_7cqi_0] [background:radial-gradient(_100%_100%_at_100%_0%,_color-mix(in_oklch,_var(--brand-yellow),_var(--background)_60%)_0%,_transparent_70%_),_linear-gradient(_150deg,_var(--brand-yellow)_35%,_color-mix(in_oklch,_var(--brand-yellow),_var(--brand-orange)_55%)_100%_)]'
                    }
                    aria-hidden="true"
                  >
                    <DesktopScene height={850} />
                  </div>
                ),
              },
              {
                title: 'La web oficial, más fácil de usar.',
                label: (
                  <span
                    className={
                      'in-proyecto-tipo [justify-self:start] [color:var(--brand)] [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
                    }
                  >
                    02 · Extensión para Chrome
                  </span>
                ),
                text: (
                  <>
                    <p
                      className={
                        't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
                      }
                    >
                      Prueba otra interfaz en pantallas de DNI, Extranjería, Hacienda y Registro de
                      asociaciones. Los formularios y los envíos siguen en la sede oficial.
                    </p>
                    <div className={'in-acciones flex items-center flex-wrap [gap:8px_24px]'}>
                      <a
                        href={links.install}
                        data-slot="button"
                        data-variant="sunset"
                        className={cn(buttonVariants({ variant: 'sunset' }))}
                      >
                        Descargar la extensión <Icon name="descargar" size={16} />
                      </a>
                    </div>
                  </>
                ),
                scene: (
                  <div
                    className={
                      'rc-pieza absolute [inset:0] in-proyecto-sol [background:radial-gradient(_100%_100%_at_100%_0%,_color-mix(in_oklch,_var(--brand-yellow),_var(--background)_60%)_0%,_transparent_70%_),_linear-gradient(_150deg,_var(--brand-yellow)_35%,_color-mix(in_oklch,_var(--brand-yellow),_var(--brand-orange)_55%)_100%_)]'
                    }
                  >
                    <ProjectScene />
                  </div>
                ),
              },
              {
                title: 'Participar empieza por entender.',
                label: (
                  <span
                    className={
                      'in-proyecto-tipo [justify-self:start] [color:var(--brand)] [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
                    }
                  >
                    03 · El Congreso
                  </span>
                ),
                text: (
                  <>
                    <p
                      className={
                        't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
                      }
                    >
                      Consulta qué se debate, cómo se vota y quién te representa. Actividad del
                      Congreso y datos electorales con enlaces a las fuentes oficiales.
                    </p>
                    <Link
                      className={cn(buttonVariants({ variant: 'sunset' }))}
                      data-slot="button"
                      data-variant="sunset"
                      href={congressBase}
                    >
                      Abrir El Congreso <Icon name="derecha" size={16} />
                    </Link>
                  </>
                ),
                scene: (
                  <div
                    className={
                      'rc-pieza absolute [inset:0] in-elecciones [background:var(--brand-gradient)] [color:var(--background)] [&_svg]:absolute [&_svg]:[bottom:0] [&_svg]:w-full [&_svg]:[height:80%]'
                    }
                    aria-hidden="true"
                  >
                    <p
                      className={
                        'in-elecciones-lema absolute [top:7cqi] [inset-inline:6cqi] m-0 [font-family:var(--font-brand-heading)] [font-size:clamp(28px,_6cqi,_42px)] [line-height:1.1] text-center'
                      }
                    >
                      Lo público también se elige.
                    </p>
                    <svg viewBox="120 40 390 430" fill="none" aria-hidden="true">
                      <ellipse
                        cx="315"
                        cy="438"
                        rx="148"
                        ry="18"
                        fill={'var(--brand-dark)'}
                        opacity=".2"
                      />
                      <path
                        d="M170 245 330 200 460 265 300 315Z"
                        fill={'var(--background)'}
                        fillOpacity=".9"
                      />
                      <path
                        d="M170 245 300 315V445L170 375Z"
                        fill={'var(--background)'}
                        fillOpacity=".7"
                      />
                      <path
                        d="M300 315 460 265V392L300 445Z"
                        fill={'var(--background)'}
                        fillOpacity=".4"
                      />
                      <path
                        d="M170 245 300 315 460 265M300 315V445"
                        stroke={'var(--background)'}
                        strokeOpacity=".6"
                        strokeWidth="2"
                      />
                      <path d="M246 261 353 232 372 242 265 272Z" fill={'var(--brand-dark)'} />
                      <path d="M250 90 368 120 338 238 220 208Z" fill={'var(--background)'} />
                      <path d="M250 90 368 120 309 153Z" fill={'var(--muted)'} />
                      <path d="M220 208 285 174 338 238" stroke={'var(--border)'} strokeWidth="2" />
                      <circle cx="292" cy="174" r="24" fill={'var(--brand)'} />
                      <path
                        d="m281 173 8 9 16-16"
                        stroke={'var(--background)'}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="m352 342 15 8v24l-15-8Z"
                        fill={'var(--background)'}
                        fillOpacity=".6"
                      />
                      <path
                        d="m376 331 15 8v24l-15-8Z"
                        fill={'var(--background)'}
                        fillOpacity=".3"
                      />
                      <path
                        d="m400 320 15 8v24l-15-8Z"
                        fill={'var(--background)'}
                        fillOpacity=".3"
                      />
                    </svg>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <section
          id="participar"
          className={
            'in-seccion [max-width:var(--container-content)] [margin-inline:auto] [padding-inline:var(--page-gutter)] [padding-block:96px_0] scroll-mt-24 [@media(max-width:_480px)]:pt-16 in-comunidad pb-24 text-center [&_h2]:[max-width:24ch] [&_h2]:[margin-inline:auto] [&_>_.t-texto-l]:[max-width:60ch] [&_>_.t-texto-l]:[margin:24px_auto] [&_>_.t-texto-l]:[color:var(--text-secondary)] [@media(max-width:_480px)]:pb-16'
          }
          aria-labelledby="in-comunidad-titulo"
        >
          <p
            className={
              't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase in-etiqueta mb-5 [color:var(--brand)]'
            }
          >
            Cómo contribuir
          </p>
          <h2
            id="in-comunidad-titulo"
            className={
              't-titular-m m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(32px,_4vw,_52px)] [line-height:1.05] [letter-spacing:-0.02em]'
            }
          >
            Tu experiencia puede ser el próximo cambio.
          </h2>
          <p
            className={
              't-texto-l [font-family:var(--font-brand-text)] [font-size:clamp(17px,_1.4vw,_19px)] [line-height:1.6] text-pretty'
            }
          >
            No necesitas programar para aportar. Una idea, un texto más claro o una revisión de
            accesibilidad también ayudan. Nos organizamos en GitHub: ahí compartimos propuestas y
            construimos las mejoras en comunidad.
          </p>
          <div
            className={
              'in-contribuir grid [grid-template-columns:minmax(0,_5fr)_minmax(0,_7fr)] items-center gap-16 mt-12 text-left [@media(max-width:_800px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_800px)]:gap-10'
            }
          >
            <ol
              className={
                'in-contribuir-pasos grid gap-8 m-0 p-0 list-none [&_li]:grid [&_li]:[grid-template-columns:auto_1fr] [&_li]:gap-5 [&_li_>_span]:pt-2 [&_li_>_span]:[color:var(--muted-foreground)] [&_p]:[margin-block:12px_8px] [&_p]:[color:var(--text-secondary)]'
              }
              role="list"
            >
              <li>
                <span
                  className={
                    't-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
                  }
                  aria-hidden="true"
                >
                  01
                </span>
                <div>
                  <h3
                    className={
                      't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15] [letter-spacing:-0.01em]'
                    }
                  >
                    Entra en GitHub.
                  </h3>
                  <p>
                    Crea una cuenta o inicia sesión y abre el repositorio. En el README puedes
                    conocer los proyectos y cómo se organizan.
                  </p>
                  <a
                    className={
                      'in-enlace flex items-center gap-2 min-h-11 [width:fit-content] [text-decoration:underline] [text-underline-offset:0.25em]'
                    }
                    href={links.repo}
                  >
                    Abrir el repositorio <Icon name="externo" size={16} />
                  </a>
                </div>
              </li>
              <li>
                <span
                  className={
                    't-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
                  }
                  aria-hidden="true"
                >
                  02
                </span>
                <div>
                  <h3
                    className={
                      't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15] [letter-spacing:-0.01em]'
                    }
                  >
                    Comparte lo que mejorarías.
                  </h3>
                  <p>
                    Busca en Issues si alguien ya ha planteado tu idea. Si no, abre una issue:
                    cuenta qué ocurre, dónde y qué te gustaría que cambiara.
                  </p>
                  <a
                    className={
                      'in-enlace flex items-center gap-2 min-h-11 [width:fit-content] [text-decoration:underline] [text-underline-offset:0.25em]'
                    }
                    href={`${links.repo}/issues`}
                  >
                    Ver ideas y propuestas <Icon name="externo" size={16} />
                  </a>
                </div>
              </li>
              <li>
                <span
                  className={
                    't-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
                  }
                  aria-hidden="true"
                >
                  03
                </span>
                <div>
                  <h3
                    className={
                      't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15] [letter-spacing:-0.01em]'
                    }
                  >
                    Dale forma a una propuesta.
                  </h3>
                  <p>
                    Aporta diseño, textos, accesibilidad o código. Para cambiar el código, lee la
                    guía, haz un fork, crea una rama y envía una pull request para revisarla en
                    comunidad.
                  </p>
                  <a
                    className={
                      'in-enlace flex items-center gap-2 min-h-11 [width:fit-content] [text-decoration:underline] [text-underline-offset:0.25em]'
                    }
                    href={links.contributing}
                  >
                    Leer la guía de contribución <Icon name="externo" size={16} />
                  </a>
                </div>
              </li>
            </ol>
            <Contribution />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
