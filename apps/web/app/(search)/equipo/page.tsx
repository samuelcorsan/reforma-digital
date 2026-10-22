import type { Metadata } from 'next';
import Image from 'next/image';
import { ViewTransition } from 'react';
import { Icon } from '../../../components/brand/icon';
import { Header } from '../../../components/brand/header';
import { links } from '../../../lib/site';
import { breadcrumbs, organization, pageMetadata, webPage } from '../../../lib/seo';
import { JsonLd } from '../../../components/json-ld';
import { coreTeam, getContributors } from './contributors';

const title = 'Equipo · Reforma Digital';
const description =
  'Conoce al core team y a las personas que contribuyen a Reforma Digital, una iniciativa abierta para mejorar nuestra relación con lo público.';

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: '/equipo',
  og: 'equipo',
});

const graph = [
  webPage({
    type: 'AboutPage',
    name: title,
    description,
    path: '/equipo',
    about: {
      ...organization,
      member: coreTeam.map(({ name, login }) => ({
        '@type': 'Person',
        name,
        url: `https://github.com/${login}`,
      })),
    },
  }),
  breadcrumbs('Equipo', '/equipo'),
];

export default async function CoreTeamPage() {
  const contributors = await getContributors();
  return (
    <>
      <Header current="/equipo" />
      <ViewTransition enter="equipo-entra" exit="equipo-sale" default="none">
        <div
          className={'core-team [--ct-mov:1] [@media(prefers-reduced-motion:_reduce)]:[--ct-mov:0]'}
        >
          <JsonLd graph={graph} />
          <main id="main" tabIndex={-1}>
            <section
              className={
                'ct-equipo [max-width:var(--container-content)] [margin-inline:auto] [padding-inline:var(--page-gutter)] pt-12 [&_>_h1]:mb-8 [@media(max-width:_600px)]:pt-8'
              }
              aria-labelledby="ct-titulo"
            >
              <h1
                id="ct-titulo"
                className={
                  't-titular-m m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(32px,_4vw,_52px)] [line-height:1.05]'
                }
              >
                Core team
              </h1>
              <ul
                className={
                  'ct-personas grid [grid-template-columns:repeat(4,_minmax(0,_1fr))] p-0 m-0 [border:1px_solid_var(--border)] list-none [&_>_li_+_li]:[border-left:1px_solid_var(--border)] [&_>_li:nth-child(3n_+_2)_.ct-retrato]:[background:radial-gradient(100%_90%_at_0%_100%,_var(--brand-orange),_transparent_80%),_var(--brand-yellow)] [&_>_li:nth-child(3n_+_2)_.ct-retrato]:[color:var(--foreground)] [&_>_li:nth-child(3n)_.ct-retrato]:[background:radial-gradient(110%_85%_at_50%_120%,_var(--brand),_transparent_85%),_var(--foreground)] [@media(max-width:_600px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_600px)]:[&_>_li_+_li]:[border-left:0] [@media(max-width:_600px)]:[&_>_li_+_li]:[border-top:1px_solid_var(--border)]'
                }
              >
                {coreTeam.map(({ name, login, id }, index) => (
                  <li key={login}>
                    <a
                      className={
                        'ct-persona block p-6 [&:focus-visible_.ct-retrato]:[transform:translateY(calc(-4px_*_var(--ct-mov)))] [&:focus-visible_.ct-persona-flecha_svg]:[transform:rotate(calc(-15deg_*_var(--ct-mov)))] [&:focus-visible_h2]:[text-decoration:underline_1px] [&:focus-visible_h2]:[text-underline-offset:0.15em] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_.ct-retrato]:[transform:translateY(calc(-4px_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_.ct-persona-flecha_svg]:[transform:rotate(calc(-15deg_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_h2]:[text-decoration:underline_1px] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_h2]:[text-underline-offset:0.15em] [@media(max-width:_800px)]:p-4 [@media(max-width:_600px)]:p-5 tarjeta-enlace'
                      }
                      href={`https://github.com/${login}`}
                      aria-label={`Conoce a ${name} en GitHub`}
                    >
                      <div
                        className={
                          'ct-retrato relative grid [place-items:center] [aspect-ratio:4_/_5] overflow-hidden [background:var(--brand-gradient)] [color:var(--background)] [transition:transform_200ms_var(--ease-brand)] [&_img]:absolute [&_img]:[inset:16px] [&_img]:[width:calc(100%_-_32px)] [&_img]:[height:calc(100%_-_32px)] [&_img]:[object-fit:cover]'
                        }
                      >
                        <Image
                          src={`https://avatars.githubusercontent.com/u/${id}?s=640`}
                          width={640}
                          height={640}
                          sizes="(max-width: 600px) 100vw, (max-width: 1200px) 25vw, 300px"
                          alt=""
                          loading="eager"
                          fetchPriority={index === 0 ? 'high' : undefined}
                        />
                      </div>
                      <div
                        className={
                          'ct-persona-info flex items-center justify-between gap-4 pt-6 [&_h2]:[font-family:var(--font-brand-heading)] [&_p]:mt-2 [&_p]:[color:var(--text-secondary)] [@media(max-width:_800px)]:items-start [@media(max-width:_800px)]:flex-col [@media(max-width:_600px)]:[flex-direction:row] [@media(max-width:_600px)]:items-center'
                        }
                      >
                        <div>
                          <h2
                            className={
                              't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15]'
                            }
                          >
                            {name}
                          </h2>
                          <p className={'t-texto text-base [line-height:1.55] text-pretty'}>
                            @{login}
                          </p>
                        </div>
                        <span
                          className={
                            'boton-icono ct-persona-flecha [box-shadow:0_0_0_1px_var(--border)] [&_svg]:[transition:transform_200ms_var(--ease-brand)]'
                          }
                        >
                          <Icon name="externo" size={20} />
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className={
                'ct-contributors [max-width:var(--container-content)] [margin-inline:auto] [padding-inline:var(--page-gutter)] [padding-block:48px_64px]'
              }
              aria-labelledby="ct-contributors-titulo"
            >
              <header
                className={
                  'ct-contributors-cabecera flex items-center justify-between flex-wrap [gap:8px_24px] mb-5 [&_a]:text-sm [&_a]:[color:var(--text-secondary)]'
                }
              >
                <h2
                  id="ct-contributors-titulo"
                  className={
                    't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15]'
                  }
                >
                  Contributors
                </h2>
                <a
                  className={
                    'in-enlace flex items-center gap-2 min-h-11 [width:fit-content] [text-decoration:underline] [text-underline-offset:0.25em]'
                  }
                  href={`${links.repo}/graphs/contributors`}
                >
                  Ver en GitHub <Icon name="externo" size={16} />
                </a>
              </header>
              {contributors === null ? (
                <p className={'ct-contributors-aviso text-sm [color:var(--text-secondary)]'}>
                  Ahora mismo no podemos cargar los contributors de GitHub.
                </p>
              ) : contributors.length === 0 ? (
                <p className={'ct-contributors-aviso text-sm [color:var(--text-secondary)]'}>
                  GitHub todavía no muestra contributors.
                </p>
              ) : (
                <ul
                  className={
                    'ct-contributors-lista grid [grid-template-columns:repeat(6,_minmax(0,_1fr))] [gap:0] m-0 p-0 [border-top:1px_solid_var(--border)] [border-left:1px_solid_var(--border)] list-none [&_>_li]:[border-right:1px_solid_var(--border)] [&_>_li]:[border-bottom:1px_solid_var(--border)] [@media(max-width:_800px)]:[grid-template-columns:repeat(4,_minmax(0,_1fr))] [@media(max-width:_480px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))]'
                  }
                >
                  {contributors.map(({ id, login }) => (
                    <li key={login}>
                      <a
                        className={
                          'ct-contributor flex flex-col items-center gap-3 h-full p-6 text-sm text-center [overflow-wrap:anywhere] [&:focus-visible]:[background:var(--muted)] [&:focus-visible_img]:[transform:translateY(calc(-2px_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover]:[background:var(--muted)] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_img]:[transform:translateY(calc(-2px_*_var(--ct-mov)))] [&_img]:block [&_img]:w-20 [&_img]:[max-width:100%] [&_img]:h-auto [&_img]:[aspect-ratio:1] [&_img]:[object-fit:cover] [&_img]:[border-radius:12px] [&_img]:[background:var(--muted)] [&_img]:[transition:transform_200ms_var(--ease-brand)] [@media(max-width:_480px)]:p-5'
                        }
                        href={`https://github.com/${encodeURIComponent(login)}`}
                      >
                        <Image
                          src={`https://avatars.githubusercontent.com/u/${id}?s=160`}
                          width={80}
                          height={80}
                          alt=""
                        />
                        <span>@{login}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        </div>
      </ViewTransition>
    </>
  );
}
