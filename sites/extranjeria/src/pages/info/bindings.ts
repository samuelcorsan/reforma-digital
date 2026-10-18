import { officialHref, requireElements, textOf } from '@reforma-digital/bridge';
import { linkText, type OfficialLink } from '../../components/official';

/** Selectores de la información del trámite (<app>/acInfo), verificados el 2026-09-27. */
export const INFO = {
  header: '#mainWindow .mf-window-header',
  content: '#mainWindow .mf-layout--main-content > .mf-main--content',
  form: 'form[name="info"]',
} as const;
const TRAMITE_NAME = '#mainWindow .mf-window-header .mf-app-subtitle';
const OFFICIAL_INFO = 'form[name="info"] .show_code';
const WITH_CLAVE = '#btnAccesoClave';
const WITHOUT_CLAVE = '#btnEntrar';
const OPTION_TEXT = '.tjus';
const CLAVE_INFO = 'a[href*="clave.gob.es"]';
const BACK = '#btnVolver';

export interface AccessOption {
  /** Opción oficial: un <div> clicable (con onclick o manejador de la propia web). */
  element: HTMLElement;
  title: string;
  description: string;
}

export interface InfoBindings {
  header: HTMLElement;
  content: HTMLElement;
  tramiteName: string | null;
  officialInfo: Element | null;
  withClave: AccessOption | null;
  withoutClave: AccessOption | null;
  claveInfoLink: OfficialLink | null;
  back: HTMLInputElement | null;
}

export function infoBindings(document: Document): InfoBindings | null {
  const els = requireElements(document, INFO);
  if (!els) return null;
  const option = (selector: string, fallback: string): AccessOption | null => {
    const element = els.form.querySelector(selector);
    if (!(element instanceof HTMLElement)) return null;
    return {
      element,
      title: textOf(element.querySelector('.mf-paragraph-header')) || fallback,
      description: textOf(element.querySelector(OPTION_TEXT)),
    };
  };
  const withClave = option(WITH_CLAVE, 'Presentación con Cl@ve');
  const withoutClave = option(WITHOUT_CLAVE, 'Presentación sin Cl@ve');
  if (!withClave && !withoutClave) return null;
  const clave = document.querySelector<HTMLAnchorElement>(CLAVE_INFO);
  const claveHref = clave && officialHref(clave, 'clave.gob.es');
  const back = els.form.querySelector(BACK);
  return {
    header: els.header,
    content: els.content,
    tramiteName: textOf(document.querySelector(TRAMITE_NAME)) || null,
    officialInfo: document.querySelector(OFFICIAL_INFO),
    withClave,
    withoutClave,
    claveInfoLink: clave && claveHref ? { text: linkText(clave), href: claveHref } : null,
    back: back instanceof HTMLInputElement ? back : null,
  };
}
