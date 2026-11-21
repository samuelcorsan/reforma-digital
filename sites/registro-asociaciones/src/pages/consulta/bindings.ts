import { requireElements, textOf } from '@reforma-digital/bridge';

/** Selectores de «Consulta asociaciones» (sede.interior.gob.es), verificados el 2026-09-27. */
const CONSULTA = {
  title: 'main#main-content > .container-fluid > h2',
  content: 'main#main-content > .container-components',
  denominacion: 'main#main-content form input#denominacion',
  buscar: 'main#main-content form button#buscar',
} as const;
export const RESULTS_TABLE = 'main#main-content table.custom-table';
const RESULT_ROWS = `${RESULTS_TABLE} tr:not(.table-header):not(#no-data-row)`;
const ACTIVE_PAGE = 'main#main-content .pagination .page-item.active .page-link';

export interface ConsultaBindings {
  title: HTMLElement;
  content: HTMLElement;
  denominacion: HTMLInputElement;
  buscar: HTMLButtonElement;
  /** Etiqueta oficial sin el marcador «(*)» (el campo conectado ya indica que es obligatorio). */
  label: string;
  minLength: number;
}

export function consultaBindings(document: Document): ConsultaBindings | null {
  const els = requireElements(document, CONSULTA);
  if (
    !els ||
    !(els.denominacion instanceof HTMLInputElement) ||
    els.denominacion.type !== 'text' ||
    !(els.buscar instanceof HTMLButtonElement) ||
    els.buscar.form !== els.denominacion.form
  )
    return null;
  const label = textOf(els.denominacion.labels?.[0]).replace(/\s*\(\*\)\s*$/, '');
  if (!label) return null;
  return {
    title: els.title,
    content: els.content,
    denominacion: els.denominacion,
    buscar: els.buscar,
    label,
    minLength: els.denominacion.minLength,
  };
}

export interface ConsultaState {
  kind: 'form' | 'results' | 'empty';
  rows: number;
  page: string | null;
  /** Mensaje oficial cuando no hay resultados, tal cual. */
  message: string | null;
}

/** Estado de la página oficial después de una búsqueda (se recarga entera en cada consulta). */
export function consultaState(document: Document): ConsultaState {
  const table = document.querySelector(RESULTS_TABLE);
  if (table) {
    return {
      kind: 'results',
      rows: document.querySelectorAll(RESULT_ROWS).length,
      page: textOf(document.querySelector(ACTIVE_PAGE)) || null,
      message: null,
    };
  }
  const message = Array.from(document.querySelectorAll('main#main-content .card-body p'))
    .map(textOf)
    .find((text) => /^No existen asociaciones/.test(text));
  return message
    ? { kind: 'empty', rows: 0, page: null, message }
    : { kind: 'form', rows: 0, page: null, message: null };
}
