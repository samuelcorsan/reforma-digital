import { requireElements, textOf } from '@reforma-digital/bridge';

/** Selectores de oficina y trámite (<app>/citar?p=NN y <app>/selectSede), verificados el 2026-09-27. */
const TRAMITES = {
  header: '#mainWindow .mf-window-header',
  content: '#mainWindow .mf-layout--main-content > .mf-main--content',
  form: 'form#portadaForm',
  province: '#prov_selecc',
  office: 'select#sede',
  accept: '#btnAceptar',
} as const;
const GROUPS = '#divGrupoTramites select[id^="tramiteGrupo["]';
const BACK = '#btnVolver';
const OFFICE_HINT = '#divListaDeSedes fieldset > p';
export const TRAMITE_MESSAGES = '#divMensajesTramite';
export const SUB_TRAMITES = '#divSubTramites';
export const PROVINCE_MESSAGES = '#divMensajesProv';
export const TRAMITE_ERRORS = [
  '#mensajeErrorTramite',
  '#alert_seleccion_provincia_sede',
  '#mensajeError',
] as const;
/** Valor del placeholder «Despliega para ver trámites disponibles…». */
export const EMPTY = '-1';

export interface TramitesBindings {
  header: HTMLElement;
  content: HTMLElement;
  form: HTMLFormElement;
  province: string;
  office: HTMLSelectElement;
  officeHint: string | null;
  /** Un desplegable oficial por organismo (Oficinas de Extranjería, Policía Nacional…). */
  groups: { select: HTMLSelectElement; label: string }[];
  accept: HTMLInputElement;
  back: HTMLInputElement | null;
}

export function tramitesBindings(document: Document): TramitesBindings | null {
  const els = requireElements(document, TRAMITES);
  if (
    !els ||
    !(els.form instanceof HTMLFormElement) ||
    !(els.province instanceof HTMLInputElement) ||
    !(els.office instanceof HTMLSelectElement) ||
    !(els.accept instanceof HTMLInputElement)
  )
    return null;
  const groups = Array.from(document.querySelectorAll<HTMLSelectElement>(GROUPS)).map((select) => ({
    select,
    label: textOf(select.labels[0]) || 'Trámites',
  }));
  if (!groups.length || groups.some(({ select }) => select.form !== els.form)) return null;
  const back = document.querySelector(BACK);
  return {
    header: els.header,
    content: els.content,
    form: els.form,
    province: els.province.value.trim(),
    office: els.office,
    officeHint: textOf(document.querySelector(OFFICE_HINT)) || null,
    groups,
    accept: els.accept,
    back: back instanceof HTMLInputElement ? back : null,
  };
}
