// @vitest-environment node
// Contra la foto real (data/presupuestos): las cifras esperadas salen de los resúmenes oficiales
// de la SEPG y de la IGAE, que la foto no usa para calcularlas.
import { describe, expect, it } from 'vitest';
import { SourceError } from './comun';
import {
  buscarPartidas,
  buscarPrograma,
  ejecucion,
  ingresos,
  inversiones,
  personal,
  resumen,
  verPrograma,
  verSeccion,
} from './presupuestos';

describe('Presupuestos', () => {
  it('adds up to the official consolidated totals of the 2023 budget', async () => {
    const { total_euros, politicas } = await resumen('2023');
    // «Resumen general por políticas de gasto y secciones. Capítulos 1 a 9 consolidado».
    expect(total_euros).toBe(583_543_307_100);
    expect(politicas[0]).toEqual({ codigo: '21', nombre: 'PENSIONES', euros: 190_687_246_150 });
    expect(politicas.find((p) => p.codigo === '12')?.euros).toBe(12_316_829_070);
  });

  it('keeps the Social Security of the extended law when an extension does not republish it', async () => {
    const ley = await verPrograma('2023', '211A');
    expect((await verPrograma('2026', '211a')).total_euros).toBe(ley.total_euros);
    expect((await resumen('2026')).presupuesto).toBe(
      'Presupuesto de 2023 prorrogado para 2026. La Seguridad Social es la de la ley de 2023: la prórroga no la vuelve a publicar.',
    );
  });

  it('names each section as it was that year, and prefers the whole name', async () => {
    expect((await verSeccion('2023', '25')).seccion.nombre).toMatch(/PRESIDENCIA/);
    expect((await verSeccion('2026', '25')).seccion.nombre).toBe(
      'MINISTERIO DE VIVIENDA Y AGENDA URBANA',
    );
    expect((await verSeccion('2026', 'Seguridad Social')).seccion.codigo).toBe('60');
    await expect(verSeccion('2026', 'ministerio')).rejects.toThrow(/Hay varias secciones/);
  });

  it('opens programmes with letter codes, which buscar_programa lists', async () => {
    const { filas } = await buscarPrograma('2023', undefined, '26');
    expect(filas.map((p) => p.codigo)).toContain('26BA');
    await expect(verPrograma('2023', '999Z')).rejects.toThrow(
      new SourceError('No hay programa 999Z en 2023. Búscalo con buscar_programa.'),
    );
  });

  it('finds named items and counts a subconcept once when its concept is also found', async () => {
    const productividad = await buscarPartidas('2023', 'productividad', { organo: '16.04' }, 10);
    expect(productividad.filas).toEqual([
      expect.objectContaining({ economica: '150', euros: 197_631_520 }),
    ]);
    // El concepto 481 y su único subconcepto, la Fundación CEI, valen lo mismo.
    const cei = await buscarPartidas(
      '2023',
      undefined,
      { organo: '12.01', programa: '141M', economica: '481' },
      10,
    );
    expect(cei.filas.map((f) => f.economica)).toEqual(['481', '48110']);
    expect(cei.total_euros).toBe(24_310);
  });

  it('lists investment by province with state companies, and only the law publishes it', async () => {
    const malaga = await inversiones('2023', undefined, 'malaga', {}, false, 5);
    expect(malaga.por_titular[0]?.titular).toMatch(/ADIF/);
    const administracion = await inversiones('2023', undefined, 'malaga', {}, true, 5);
    expect(administracion.total_euros).toBeLessThan(malaga.total_euros);
    // La Administración dice «VIZCAYA» y las empresas «BIZKAIA»: suman juntas con cualquier nombre.
    const vizcaya = await inversiones('2023', undefined, 'vizcaya', {}, false, 5);
    expect((await inversiones('2023', undefined, 'bizkaia', {}, false, 5)).total_euros).toBe(
      vizcaya.total_euros,
    );
    expect(vizcaya.por_provincia).toHaveLength(1);
    expect(vizcaya.por_titular.map((t) => t.titular).join()).toMatch(/ADIF/);
    await expect(
      inversiones('2023', undefined, undefined, { economica: '620' }, false, 5),
    ).rejects.toThrow(/Ninguna fila coincide/);
    await expect(inversiones('2026', undefined, undefined, {}, false, 5)).rejects.toThrow(
      'La prórroga de 2026 no publica anexo de inversiones: rige el de la ley de 2023. Pide anio=2023.',
    );
  });

  it('gives income per entity with its total by article', async () => {
    const { entidades, filas } = await ingresos('2023', 'estado', 'valor anadido', 10);
    // «Resumen general por capítulos del presupuesto de ingresos» del Estado.
    expect(entidades.find((e) => e.codigo === '98.01')?.total_euros).toBe(192_544_166_330);
    expect(filas.map((f) => f.economica)).toEqual(['21', '210']);
  });

  it('counts staff by body', async () => {
    expect((await personal('2023', undefined, 'guardia civil')).efectivos).toBe(78_733);
  });

  it('says how far execution goes, whether it is final, and keeps internal transfers apart', async () => {
    const becas = await ejecucion('2023', undefined, { programa: '323M' }, 5);
    expect(becas).toMatchObject({ hasta: '31 de diciembre de 2023', definitiva: true });
    const año = await ejecucion('2025', undefined, {}, 5);
    expect(año).toMatchObject({ hasta: '31 de diciembre de 2025', definitiva: false });
    expect(año.transferencias_internas_obligaciones_euros).toBeGreaterThan(0);
    expect(año.filas.some((f) => f.programa === '000X')).toBe(false);
    expect((await ejecucion('2026', undefined, {}, 1)).hasta).toBe('30 de septiembre de 2026');
  });

  it('opens a programme created during the year from its execution alone', async () => {
    const nuevo = await verPrograma('2025', '46ÑE');
    expect(nuevo.total_euros).toBe(0);
    expect(nuevo.nota).toMatch(/creado durante el año/);
    expect(nuevo.programa.nombre).toBeTruthy();
    expect(nuevo.ejecucion?.obligaciones_reconocidas_euros).toBeGreaterThan(0);
  });
});
