import { fieldByLabel, type FieldSpec } from '@reforma-digital/bridge';

export const knownLabels = [
  ['document', 'Número de Documento', ''],
  ['letter', 'Letra', ''],
  ['team', 'Equipo de Expedición', ''],
  ['expiry', 'Fecha de Validez', 'dd/mm/aaaa o PERMANENTE'],
  ['support', 'Número de Soporte', ''],
] as const;

export function identificationBindings(document: Document): Record<string, FieldSpec> | null {
  const fields: Record<string, FieldSpec> = {};
  for (const [id, label, help] of knownLabels) {
    const element = fieldByLabel(document, label);
    if (
      !element ||
      !(element instanceof HTMLInputElement) ||
      element.type !== 'text' ||
      !element.form
    )
      return null;
    if (
      ['onkeydown', 'onkeyup', 'onkeypress', 'onblur', 'onfocus', 'onpaste', 'onbeforeinput'].some(
        (attribute) => element.hasAttribute(attribute),
      )
    )
      return null;
    fields[id] = { element, label, help: officialHelp(element) || help };
  }
  const form = fields.document!.element.form;
  return Object.values(fields).every(({ element }) => element.form === form) ? fields : null;
}

/**
 * Help text the official page shows next to the input (e.g. «(Ej. AAA000000, solo para DNI
 * Electrónico)»), read from the label that wraps it, so the connected field repeats it verbatim.
 */
function officialHelp(element: HTMLInputElement): string {
  const note = element.closest('label')?.querySelector('.notas');
  return (note?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\((.*)\)$/, '$1');
}
