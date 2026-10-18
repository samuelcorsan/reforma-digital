import { officialHref, requireElements, textOf } from '@reforma-digital/bridge';
import config from '../../../site.config.json';
import { linkText, type OfficialLink } from '../../components/official';

/** Selectores de la página informativa de la Sede, verificados el 2026-09-27. */
export const LANDING = {
  header: '#mainWindow .mf-window-header',
  content: '#mainWindow .mf-layout--main-content > .mf-main--content',
  form: 'form#formulario',
  submit: 'form#formulario input[type="submit"]',
} as const;
const SECTION_HEADINGS = '#mainWindow .mf-main--content h3.mf-paragraph-header';

export interface LandingBindings {
  header: HTMLElement;
  content: HTMLElement;
  /** Botón oficial «Acceder al Procedimiento». */
  submit: HTMLInputElement;
  /** Host al que envía el formulario oficial; debe ser uno de los del portal. */
  destinationHost: string;
  summary: string | null;
  responsible: string[];
  whoRequests: { title: string; text: string }[];
  technicalRequirements: OfficialLink | null;
}

export function landingBindings(document: Document): LandingBindings | null {
  const els = requireElements(document, LANDING);
  if (!els || !(els.submit instanceof HTMLInputElement) || !(els.form instanceof HTMLFormElement))
    return null;
  let destinationHost: string;
  try {
    destinationHost = new URL(els.form.getAttribute('action') ?? '', document.baseURI).hostname;
  } catch {
    return null;
  }
  const officialHosts = config.routes.map((route) => new URL(route.origin).hostname);
  if (!officialHosts.includes(destinationHost)) return null;

  const sections = readSections(document);
  const technical = (sections.get('REQUISITOS TÉCNICOS DEL PROCEDIMIENTO') ?? [])
    .flatMap((el) => Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')))
    .at(0);
  const technicalHref = technical && officialHref(technical, 'administracionespublicas.gob.es');
  return {
    header: els.header,
    content: els.content,
    submit: els.submit,
    destinationHost,
    summary: textOf(sections.get('SUMARIO')?.[0]) || null,
    responsible: (sections.get('ÓRGANO RESPONSABLE') ?? []).map(textOf).filter(Boolean),
    whoRequests: (sections.get('INSTRUCCIONES DEL PROCEDIMIENTO') ?? [])
      .flatMap((el) => Array.from(el.querySelectorAll('li')))
      .map((li) => {
        const title = textOf(li.querySelector('strong'));
        return {
          title,
          text: textOf(li)
            .slice(title.length)
            .replace(/^[\s:]+/, ''),
        };
      })
      .filter((item) => item.title || item.text),
    technicalRequirements:
      technical && technicalHref ? { text: linkText(technical), href: technicalHref } : null,
  };
}

/** <h3 class="mf-paragraph-header">TÍTULO:</h3> seguido de párrafos, hasta el siguiente título. */
function readSections(document: Document): Map<string, Element[]> {
  const map = new Map<string, Element[]>();
  for (const heading of Array.from(document.querySelectorAll(SECTION_HEADINGS))) {
    const els: Element[] = [];
    let el = heading.nextElementSibling;
    while (el && !(el.tagName === 'H3' && el.classList.contains('mf-paragraph-header'))) {
      els.push(el);
      el = el.nextElementSibling;
    }
    map.set(textOf(heading).replace(/:$/, '').toUpperCase(), els);
  }
  return map;
}
