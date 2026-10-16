import { describe, expect, it } from 'vitest';
import { redactQuery } from '../apps/web/lib/redact';

describe('redaction rules', () => {
  it.each([
    ['00000000T', '[DNI omitido]'],
    ['00000000t', '[DNI omitido]'],
    ['00000000-T', '[DNI omitido]'],
    ['00.000.000-T', '[DNI omitido]'],
    ['00000000 T', '[DNI omitido]'],
    ['X0000000T', '[NIE omitido]'],
    ['x-0000000-t', '[NIE omitido]'],
    ['ES0000000000000000000000', '[IBAN omitido]'],
    ['ES00 0000 0000 0000 0000 0000', '[IBAN omitido]'],
    ['ES00-0000-0000-0000-0000-0000', '[IBAN omitido]'],
    ['ana@example.com', '[correo omitido]'],
    ['600000000', '[teléfono omitido]'],
    ['600 000 000', '[teléfono omitido]'],
    ['600 00 00 00', '[teléfono omitido]'],
    ['600-000-000', '[teléfono omitido]'],
    ['+34600000000', '[teléfono omitido]'],
    ['+34 600 000 000', '[teléfono omitido]'],
    ['0034600000000', '[teléfono omitido]'],
    ['91 000 00 00', '[teléfono omitido]'],
  ])('hides %s', (value, marker) => {
    expect(redactQuery(`Mi dato es ${value}, gracias`)).toBe(`Mi dato es ${marker}, gracias`);
  });

  it.each([
    'Facturo 600 000 000 euros al año',
    'Son 600 000 000 €',
    'Ingresé 12000000 y lo declaré',
    'Cita el 9-10-2026 12:30',
    'Modelo 303 del 4T de 2026',
    'Real Decreto 1065/2007',
    'Cuota de 950,98 euros durante 12 meses',
  ])('leaves "%s" alone', (text) => {
    expect(redactQuery(text)).toBe(text);
  });
});
