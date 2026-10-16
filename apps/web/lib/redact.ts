// Separators are optional: people write "12.345.678-Z" and "612 34 56 78". A DNI letter after
// a space must be upper case, so "12345678 y" is left alone. No capture groups: pii-display
// reads each match offset from the replace callback.
export const REDACTION_RULES = [
  [/\b\d{2}\.?\d{3}\.?\d{3}(?:-?[A-Za-z]| [A-Z])\b/g, '[DNI omitido]'],
  [/\b[XYZ]-?\d{7}-?[A-Z]\b/gi, '[NIE omitido]'],
  [/\bES\d{2}(?:[ -]?\d{4}){5}\b/gi, '[IBAN omitido]'],
  [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[correo omitido]'],
  // 612 345 678, 612 34 56 78 or 91 123 45 67, with an optional +34 or 0034. Not an amount.
  [
    /(?:\+34[ -]?|\b(?:0034[ -]?)?)(?:[6789]\d{2}(?:[ -]?\d{3}){2}|[6789]\d{2}(?:[ -]?\d{2}){3}|[89]\d[ -]\d{3}(?:[ -]\d{2}){2})\b(?! ?(?:€|euros?\b))/g,
    '[teléfono omitido]',
  ],
] as const;
export function redactQuery(q: string): string {
  return REDACTION_RULES.reduce((text, [pattern, marker]) => text.replace(pattern, marker), q);
}
