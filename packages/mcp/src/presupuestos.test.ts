// @vitest-environment node
// Contra la foto real (data/presupuestos.json): los totales oficiales salen de los resúmenes de la
// SEPG, que la foto no usa para calcularlos.
import { describe, expect, it } from 'vitest';
import { buscarPrograma, ingresos, resumen, verPrograma, verSeccion } from './presupuestos';
import { SourceError } from './comun';

describe('Presupuestos', () => {
  it('adds up to the official consolidated totals of the 2023 budget', () => {
    const { total_euros, politicas } = resumen('2023');
    // «Resumen general por políticas de gasto y secciones. Capítulos 1 a 9 consolidado».
    expect(total_euros).toBe(583_543_307_100);
    expect(politicas[0]).toEqual({ codigo: '21', nombre: 'PENSIONES', euros: 190_687_246_150 });
    expect(politicas.find((p) => p.codigo === '12')?.euros).toBe(12_316_829_070);
  });

  it('keeps the 2023 Social Security budget in 2026, which the extension does not republish', () => {
    expect(verPrograma('2026', '211a').total_euros).toBe(verPrograma('2023', '211A').total_euros);
    expect(resumen('2026').presupuesto).toMatch(/prorrogado para 2026/);
  });

  it('names each section as it was that year', () => {
    expect(verSeccion('2023', '25').seccion.nombre).toMatch(/PRESIDENCIA/);
    expect(verSeccion('2026', '25').seccion.nombre).toBe('MINISTERIO DE VIVIENDA Y AGENDA URBANA');
    expect(verSeccion('2026', '6').seccion.nombre).toBe('DEUDA PÚBLICA');
    expect(verSeccion('2026', 'Seguridad Social').seccion.codigo).toBe('60');
  });

  it('lists the sections when a name matches several or none', () => {
    expect(() => verSeccion('2026', 'ministerio')).toThrow(
      /Hay varias secciones.*14 MINISTERIO DE DEFENSA/,
    );
    expect(() => verSeccion('2026', 'marina')).toThrow(
      /No hay ninguna sección.*60 SEGURIDAD SOCIAL/,
    );
  });

  it('finds programmes without accents and sorts them by amount', () => {
    const { programas } = buscarPrograma('2026', 'becas');
    expect(programas.map((p) => p.codigo)).toEqual(['323M']);
    expect(programas[0]?.politica).toBe('EDUCACIÓN');
  });

  it('totals income by article, not by its concepts too', () => {
    const estado = ingresos('estado');
    // «Resumen general por capítulos del presupuesto de ingresos» del Estado.
    expect(estado.total_agente_euros).toBe(192_544_166_330);
    expect(ingresos('estado', 'valor anadido').lineas.map((l) => l.codigo)).toEqual(['21', '210']);
  });

  it('tells the assistant when a programme does not exist', () => {
    expect(() => verPrograma('2023', '999Z')).toThrow(
      new SourceError('No hay programa 999Z en 2023. Búscalo con buscar_programa.'),
    );
  });
});
