import { officialHref, requireElements, textOf } from '@reforma-digital/bridge';

/** Selectores de «Asistencia y Cita» en la Sede (GC29), verificados el 2026-09-27. */
export const ASISTENCIA = {
  title: 'main#acc-main h1#js-nombre-canal',
  description: '#js-descripcion-canal',
  gestiones: '.js-gestiones-destacadas',
  catalogo: 'main#acc-main a[href*="/wlpl/TOCP-MUTE/ServiciosAsocCat"]',
} as const;

export interface AsistenciaOption {
  /** Enlace oficial de la gestión (lleva a la aplicación de cita). */
  element: HTMLAnchorElement;
  label: string;
  /** Tipo de acceso declarado por la web oficial (data-acceso). */
  access: 'SinCert' | 'Cert' | null;
  /** Tutorial oficial de la gestión, si lo hay. */
  help: { href: string; title: string } | null;
}

export interface AsistenciaBindings {
  title: HTMLElement;
  description: HTMLElement;
  /** Párrafos destacados de la descripción oficial (p. ej. el aviso sobre la Renta). */
  notices: string[];
  options: AsistenciaOption[];
  catalogo: HTMLAnchorElement;
  /** Otras vías de la sección oficial «Información», tal cual. */
  otherChannels: string[];
}

export function asistenciaBindings(document: Document): AsistenciaBindings | null {
  const els = requireElements(document, ASISTENCIA);
  if (!els || !(els.catalogo instanceof HTMLAnchorElement)) return null;
  const options = Array.from(
    els.gestiones.querySelectorAll<HTMLAnchorElement>('a.js-componente-enlace-tramite'),
  ).map((element) => {
    const help = element.parentElement?.querySelector<HTMLAnchorElement>(
      'a.componente-enlace-ayuda',
    );
    const helpHref = help && officialHref(help, 'agenciatributaria.gob.es');
    const access = element.dataset.acceso;
    return {
      element,
      label: textOf(element),
      access: access === 'SinCert' || access === 'Cert' ? access : null,
      help: help && helpHref ? { href: helpHref, title: textOf(help) || 'Ayuda' } : null,
    } satisfies AsistenciaOption;
  });
  if (!options.length || options.some((o) => !o.label)) return null;
  return {
    title: els.title,
    description: els.description,
    notices: Array.from(els.description.querySelectorAll('p')).map(textOf).filter(Boolean),
    options,
    catalogo: els.catalogo,
    otherChannels: otherChannels(document),
  };
}

/** Lista que sigue al encabezado oficial «Información». */
function otherChannels(document: Document): string[] {
  const heading = Array.from(document.querySelectorAll('main#acc-main h2')).find(
    (h) => textOf(h) === 'Información',
  );
  let el = heading?.nextElementSibling ?? null;
  while (el && el.tagName !== 'UL' && el.tagName !== 'H2') el = el.nextElementSibling;
  return el?.tagName === 'UL' ? Array.from(el.querySelectorAll('li')).map(textOf) : [];
}
