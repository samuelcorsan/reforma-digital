'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

type TourStep = {
  title: string;
  label: ReactNode;
  text: ReactNode;
  scene: ReactNode;
};

const dosCifras = (n: number) => String(n).padStart(2, '0');

export function ProjectTour({
  header,
  titleId,
  steps,
  unit = 'Paso',
}: {
  header: ReactNode;
  titleId: string;
  steps: readonly TourStep[];
  unit?: string;
}) {
  const [activo, setActivo] = useState(0);
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const items = lista.current?.querySelectorAll<HTMLElement>('[data-paso]');
    if (!items) return;
    // El paso que cruza el centro de la pantalla, donde queda el centro del escenario, acompaña
    // la lectura sin controlar el scroll.
    // root: document, porque dentro de un iframe de otro origen el navegador ignora rootMargin
    // con la raíz implícita y el paso activo saltaría al que asoma por el borde.
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting && e.target instanceof HTMLElement) {
            setActivo(Number(e.target.dataset.paso));
          }
        }
      },
      { root: document, rootMargin: '-50% 0px -50% 0px' },
    );
    items.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [steps]);

  return (
    <section
      className={
        'rc [max-width:1200px] [margin-inline:auto] [padding:96px_24px] [@media(max-width:_959px)]:py-16'
      }
      aria-labelledby={titleId}
    >
      {header}
      <div
        className={
          'rc-cuerpo [@media(min-width:_960px)]:[--rc-alto:min((100cqi_-_64px)_*_7_/_12_*_4_/_5,_100svh_-_80px_-_2_*_24px_-_32px)] [@media(min-width:_960px)]:[container-type:inline-size] [@media(min-width:_960px)]:grid [@media(min-width:_960px)]:[grid-template-columns:minmax(0,_5fr)_minmax(0,_7fr)] [@media(min-width:_960px)]:gap-16 [@media(min-width:_960px)]:pt-10'
        }
      >
        {/* El escenario va antes que los pasos en el DOM y CSS lo pinta a la derecha: así, si una escena
            es interactiva, es la primera parada del teclado cuando está activa. */}
        <div
          className={
            'rc-fijo [@media(max-width:_959px)]:hidden [@media(min-width:_960px)]:[grid-area:1_/_2] [@media(min-width:_960px)]:sticky [@media(min-width:_960px)]:[top:calc(80px_+_(100svh_-_80px_-_var(--rc-alto)_-_32px)_/_2)] [@media(min-width:_960px)]:[align-self:start] [@media(min-width:_960px)]:grid [@media(min-width:_960px)]:gap-4'
          }
        >
          <div
            className={
              "rc-marco relative isolate overflow-hidden w-full [aspect-ratio:5_/_4] [border-radius:28px] [background:var(--muted)] [contain:strict] [container-type:size] [user-select:none] pointer-events-none [&::before]:[content:''] [&::before]:absolute [&::before]:[left:50%] [&::before]:[top:44%] [&::before]:[width:84cqi] [&::before]:[aspect-ratio:1] [&::before]:[border-radius:50%] [&::before]:[background:radial-gradient(_circle_at_50%_22%,_#ffd34d_0%,_var(--brand-yellow)_36%,_var(--brand-orange)_100%_)] [&::before]:[transform:translateX(-50%)] rc-escenario [@media(min-width:_960px)]:[width:calc(var(--rc-alto)_*_5_/_4)] [@media(min-width:_960px)]:[max-width:100%]"
            }
          >
            {steps.map((p, i) => (
              <div
                key={p.title}
                className={
                  'rc-escena absolute [inset:0] [@media(min-width:_960px)]:[opacity:0] [@media(min-width:_960px)]:[transform:translateY(10px)_scale(0.985)] [@media(min-width:_960px)]:[transition:opacity_280ms_var(--ease-brand),_transform_360ms_var(--ease-brand)] [@media(min-width:_960px)]:[&[data-activa]]:[opacity:1] [@media(min-width:_960px)]:[&[data-activa]]:[transform:none] [@media(prefers-reduced-motion:_reduce)]:[transition:none] [@media(prefers-reduced-motion:_reduce)]:[transform:none]'
                }
                data-activa={activo === i ? '' : undefined}
                inert={activo !== i}
              >
                {p.scene}
              </div>
            ))}
          </div>
          <div
            className={
              'rc-progreso flex items-center justify-between gap-4 [color:var(--text-secondary)] [@media(min-width:_960px)]:[width:calc(var(--rc-alto)_*_5_/_4)] [@media(min-width:_960px)]:[max-width:100%]'
            }
            aria-hidden="true"
          >
            <span
              className={
                't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase'
              }
            >
              {unit} {dosCifras(activo + 1)} de {dosCifras(steps.length)}
            </span>
            <span
              className={
                "rc-progreso-barras flex [gap:6px] [&_i]:relative [&_i]:w-7 [&_i]:h-1 [&_i]:overflow-hidden [&_i]:[border-radius:2px] [&_i]:[background:var(--disabled)] [&_i::after]:[content:''] [&_i::after]:absolute [&_i::after]:[inset:0] [&_i::after]:[background:var(--foreground)] [&_i::after]:[transform:scaleX(0)] [&_i::after]:[transform-origin:left] [&_i::after]:[transition:transform_320ms_var(--ease-brand)] [&_i[data-lleno]::after]:[transform:none] [@media(prefers-reduced-motion:_reduce)]:[&_i::after]:[transition:none]"
              }
            >
              {steps.map((p, i) => (
                <i key={p.title} data-lleno={i <= activo ? '' : undefined} />
              ))}
            </span>
          </div>
        </div>
        <ol
          className={
            'rc-pasos m-0 p-0 list-none [@media(max-width:_959px)]:grid [@media(max-width:_959px)]:gap-16 [@media(min-width:_960px)]:[grid-area:1_/_1]'
          }
          ref={lista}
        >
          {steps.map((p, i) => (
            <li
              key={p.title}
              className={
                'rc-paso [@media(min-width:_960px)]:[padding-block:20svh] [@media(min-width:_960px)]:[opacity:0.64] [@media(min-width:_960px)]:[transition:opacity_200ms_var(--ease-brand)] [@media(min-width:_960px)]:[&:first-child]:[padding-top:0] [@media(min-width:_960px)]:[&[data-activo]]:[opacity:1] [@media(min-width:_960px)]:[&[data-activo]_.rc-paso-texto::before]:[transform:none] [@media(prefers-reduced-motion:_reduce)]:[transition:none]'
              }
              data-paso={i}
              data-activo={activo === i ? '' : undefined}
            >
              <div
                className={
                  "rc-paso-texto relative grid gap-3 [max-width:30rem] [&_h3]:m-0 [&_p]:m-0 [@media(min-width:_960px)]:pl-6 [@media(min-width:_960px)]:[&::before]:[content:''] [@media(min-width:_960px)]:[&::before]:absolute [@media(min-width:_960px)]:[&::before]:[left:0] [@media(min-width:_960px)]:[&::before]:[top:2px] [@media(min-width:_960px)]:[&::before]:[bottom:2px] [@media(min-width:_960px)]:[&::before]:[width:3px] [@media(min-width:_960px)]:[&::before]:[border-radius:2px] [@media(min-width:_960px)]:[&::before]:[background:var(--brand)] [@media(min-width:_960px)]:[&::before]:[transform:scaleY(0)] [@media(min-width:_960px)]:[&::before]:[transform-origin:top] [@media(min-width:_960px)]:[&::before]:[transition:transform_320ms_var(--ease-brand)] [@media(prefers-reduced-motion:_reduce)]:[&::before]:[transition:none]"
                }
              >
                {/* Elementos creados en un componente de servidor: sin clave, React avisa al ponerlos entre hermanos. */}
                <Fragment key="label">{p.label}</Fragment>
                <h3
                  className={
                    't-titular-s m-0 [font-family:var(--font-brand-heading)] font-normal [font-kerning:normal] text-balance [font-size:clamp(24px,_2.4vw,_30px)] [line-height:1.15]'
                  }
                >
                  {p.title}
                </h3>
                <Fragment key="text">{p.text}</Fragment>
              </div>
              {/* Cada escena marca como decorativo lo que lo es.
                  En cada ancho solo se muestra una de las dos copias; la otra, con display: none, no recibe foco. */}
              <div
                className={
                  "rc-marco relative isolate overflow-hidden w-full [aspect-ratio:5_/_4] [border-radius:28px] [background:var(--muted)] [contain:strict] [container-type:size] [user-select:none] pointer-events-none [&::before]:[content:''] [&::before]:absolute [&::before]:[left:50%] [&::before]:[top:44%] [&::before]:[width:84cqi] [&::before]:[aspect-ratio:1] [&::before]:[border-radius:50%] [&::before]:[background:radial-gradient(_circle_at_50%_22%,_#ffd34d_0%,_var(--brand-yellow)_36%,_var(--brand-orange)_100%_)] [&::before]:[transform:translateX(-50%)] rc-marco-movil [@media(max-width:_959px)]:mt-6 [@media(max-width:_959px)]:[aspect-ratio:3_/_4] [@media(min-width:_640px)_and_(max-width:_959px)]:[aspect-ratio:5_/_4] [@media(min-width:_960px)]:hidden"
                }
              >
                {p.scene}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
