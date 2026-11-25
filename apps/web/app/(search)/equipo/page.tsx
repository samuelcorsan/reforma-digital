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
        <div className={'[--ct-mov:1] [@media(prefers-reduced-motion:_reduce)]:[--ct-mov:0]'}>
          <JsonLd graph={graph} />
          <main id="main" tabIndex={-1}>
            <section
              className={
                '[max-width:var(--container-content)] [margin-inline:auto] px-(--page-gutter) pt-12 [&_>_h1]:mb-8 [@media(max-width:_600px)]:pt-8'
              }
              aria-labelledby="ct-titulo"
            >
              <h1
                id="ct-titulo"
                className={
                  'm-0 font-heading font-normal font-kerning-normal text-balance text-fluid-32-52 leading-1.05'
                }
              >
                Core team
              </h1>
              <ul
                className={
                  'grid [grid-template-columns:repeat(4,_minmax(0,_1fr))] p-0 m-0 border border-border list-none [&_>_li_+_li]:border-l [&_>_li_+_li]:border-l-border [&_>_li:nth-child(3n_+_2)_[data-part=ct-retrato]]:bg-(image:--retrato-gradient-yellow) [&_>_li:nth-child(3n_+_2)_[data-part=ct-retrato]]:bg-brand-yellow [&_>_li:nth-child(3n_+_2)_[data-part=ct-retrato]]:text-foreground [&_>_li:nth-child(3n)_[data-part=ct-retrato]]:bg-(image:--retrato-gradient-ink) [&_>_li:nth-child(3n)_[data-part=ct-retrato]]:bg-foreground [@media(max-width:_600px)]:[grid-template-columns:minmax(0,_1fr)] [@media(max-width:_600px)]:[&_>_li_+_li]:border-l-0 [@media(max-width:_600px)]:[&_>_li_+_li]:border-t [@media(max-width:_600px)]:[&_>_li_+_li]:border-t-border'
                }
              >
                {coreTeam.map(({ name, login, id }, index) => (
                  <li key={login}>
                    <a
                      className={
                        'block p-6 [&:focus-visible_[data-part=ct-retrato]]:[transform:translateY(calc(-4px_*_var(--ct-mov)))] [&:focus-visible_[data-part=ct-persona-flecha]_svg]:[transform:rotate(calc(-15deg_*_var(--ct-mov)))] [&:focus-visible_h2]:underline [&:focus-visible_h2]:decoration-1 [&:focus-visible_h2]:underline-offset-em-15 [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_[data-part=ct-retrato]]:[transform:translateY(calc(-4px_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_[data-part=ct-persona-flecha]_svg]:[transform:rotate(calc(-15deg_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_h2]:underline [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_h2]:decoration-1 [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_h2]:underline-offset-em-15 [@media(max-width:_800px)]:p-4 [@media(max-width:_600px)]:p-5 '
                      }
                      href={`https://github.com/${login}`}
                      aria-label={`Conoce a ${name} en GitHub`}
                    >
                      <div
                        data-part="ct-retrato"
                        className={
                          'relative grid [place-items:center] [aspect-ratio:4_/_5] overflow-hidden gradient-brand text-background transition-transform duration-200 ease-(--ease-brand) [&_img]:absolute [&_img]:[inset:16px] [&_img]:[width:calc(100%_-_32px)] [&_img]:[height:calc(100%_-_32px)] [&_img]:[object-fit:cover]'
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
                          'flex items-center justify-between gap-4 pt-6 [&_h2]:font-heading [&_p]:mt-2 [&_p]:text-(--text-secondary) [@media(max-width:_800px)]:items-start [@media(max-width:_800px)]:flex-col [@media(max-width:_600px)]:[flex-direction:row] [@media(max-width:_600px)]:items-center'
                        }
                      >
                        <div>
                          <h2
                            className={
                              'm-0 font-heading font-normal font-kerning-normal text-balance text-fluid-24-30 leading-1.15'
                            }
                          >
                            {name}
                          </h2>
                          <p className={'text-base leading-1.55 text-pretty'}>@{login}</p>
                        </div>
                        <span
                          data-part="ct-persona-flecha"
                          className={
                            'ring ring-border [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-(--ease-brand)'
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
                '[max-width:var(--container-content)] [margin-inline:auto] px-(--page-gutter) pt-12 pb-16'
              }
              aria-labelledby="ct-contributors-titulo"
            >
              <header
                className={
                  'flex items-center justify-between flex-wrap gap-y-2 gap-x-6 mb-5 [&_a]:text-sm [&_a]:text-(--text-secondary)'
                }
              >
                <h2
                  id="ct-contributors-titulo"
                  className={
                    'm-0 font-heading font-normal font-kerning-normal text-balance text-fluid-24-30 leading-1.15'
                  }
                >
                  Contributors
                </h2>
                <a
                  className={
                    'flex items-center gap-2 min-h-11 [width:fit-content] underline underline-offset-em-25'
                  }
                  href={`${links.repo}/graphs/contributors`}
                >
                  Ver en GitHub <Icon name="externo" size={16} />
                </a>
              </header>
              {contributors === null ? (
                <p className={'text-sm text-(--text-secondary)'}>
                  Ahora mismo no podemos cargar los contributors de GitHub.
                </p>
              ) : contributors.length === 0 ? (
                <p className={'text-sm text-(--text-secondary)'}>
                  GitHub todavía no muestra contributors.
                </p>
              ) : (
                <ul
                  className={
                    'grid [grid-template-columns:repeat(6,_minmax(0,_1fr))] gap-0 m-0 p-0 border-t border-t-border border-l border-l-border list-none [&_>_li]:border-r [&_>_li]:border-r-border [&_>_li]:border-b [&_>_li]:border-b-border [@media(max-width:_800px)]:[grid-template-columns:repeat(4,_minmax(0,_1fr))] [@media(max-width:_480px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))]'
                  }
                >
                  {contributors.map(({ id, login }) => (
                    <li key={login}>
                      <a
                        className={
                          'flex flex-col items-center gap-3 h-full p-6 text-sm text-center [overflow-wrap:anywhere] [&:focus-visible]:bg-muted [&:focus-visible_img]:[transform:translateY(calc(-2px_*_var(--ct-mov)))] [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover]:bg-muted [@media(hover:_hover)_and_(pointer:_fine)]:[&:hover_img]:[transform:translateY(calc(-2px_*_var(--ct-mov)))] [&_img]:block [&_img]:w-20 [&_img]:[max-width:100%] [&_img]:h-auto [&_img]:[aspect-ratio:1] [&_img]:[object-fit:cover] [&_img]:rounded-12 [&_img]:bg-muted [&_img]:transition-transform [&_img]:duration-200 [&_img]:ease-(--ease-brand) [@media(max-width:_480px)]:p-5'
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
