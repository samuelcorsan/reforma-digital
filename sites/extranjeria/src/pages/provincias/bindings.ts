import { requireElements, textOf } from '@reforma-digital/bridge';
import { officialLinks, type OfficialLink } from '../../components/official';

/** Selectores de la selección de provincia (<app>/index.html), verificados el 2026-09-27. */
const PROVINCIAS = {
  header: '#mainWindow .mf-window-header',
  content: '#mainWindow .mf-layout--main-content > .mf-main--content',
  select: '#divProvincias select#form',
  accept: '#btnAceptar',
} as const;
export const PROVINCIAS_ERROR = '#formError';
const BACK = '#btnVolver';
const NOTICES = '#mainWindow .mf-main--content > div';

export interface ProvinciasBindings {
  header: HTMLElement;
  content: HTMLElement;
  select: HTMLSelectElement;
  accept: HTMLInputElement;
  back: HTMLInputElement | null;
  /** Bloque «ATENCIÓN, LEA ATENTAMENTE ANTES DE ACEPTAR UNA CITA». */
  notices: Element | null;
  noticeLinks: OfficialLink[];
}

export function provinciasBindings(document: Document): ProvinciasBindings | null {
  const els = requireElements(document, PROVINCIAS);
  if (
    !els ||
    !(els.select instanceof HTMLSelectElement) ||
    !(els.accept instanceof HTMLInputElement)
  )
    return null;
  if (!Array.from(els.select.options).some((option) => option.value)) return null;
  const back = document.querySelector(BACK);
  const notices =
    Array.from(document.querySelectorAll(NOTICES)).find((el) =>
      /ATENCI[ÓO]N/i.test(textOf(el.querySelector('.mf-paragraph-header'))),
    ) ?? null;
  return {
    header: els.header,
    content: els.content,
    select: els.select,
    accept: els.accept,
    back: back instanceof HTMLInputElement ? back : null,
    notices,
    noticeLinks: officialLinks(notices),
  };
}
