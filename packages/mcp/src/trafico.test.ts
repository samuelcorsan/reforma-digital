// @vitest-environment node
// Tráfico DGT sin red: el feed DATEX II v3.7 recortado (testdata/situations.xml, CC BY) con el
// fetch mockeado, para el parser, la normalización, los filtros y la caché.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SourceError } from './comun';
import {
  buscar,
  cercanas,
  descargaConCache,
  leerFeed,
  mismaProvincia,
  normalizarCarretera,
  parsearSituaciones,
  type Incidencia,
} from './trafico';

const fixture = readFileSync(new URL('../testdata/situations.xml', import.meta.url), 'utf8');
// 12:30 UTC del día del feed: después del inicio de los cinco registros, así que todos activos.
const AHORA = Date.parse('2026-10-28T12:30:00Z');

// Incidencias construidas a mano para los filtros cuando el fixture no tiene el caso.
const incidencia = (campos: Partial<Incidencia> = {}): Incidencia => ({
  id: 'dgt:1',
  situacion: '1',
  tipo: 'obras',
  subtipo: 'roadworks',
  severidad: 'desconocida',
  estado: 'activo',
  carretera: 'A-52',
  sentido: 'ambos',
  pk: { desde: 95, hasta: 105 },
  ubicacion: { inicio: null, fin: null, provincia: '', municipio: '' },
  carriles_afectados: [],
  inicio: '2026-10-28T07:49:39.000Z',
  fin: null,
  actualizado: '2026-10-28T07:49:39.000Z',
  ...campos,
});

describe('Tráfico DGT', () => {
  it('reads the publication time in UTC and one incident per record', () => {
    const feed = parsearSituaciones(fixture, AHORA);
    // 13:12:17.098 en +01:00 son las 12:12:17.098 UTC del mismo instante.
    expect(feed.publicado).toBe('2026-10-28T12:12:17.098Z');
    expect(feed.incidencias).toHaveLength(5);
    for (const i of feed.incidencias) expect(i.id).toMatch(/^dgt:/);
  });

  it('places a point incident with its kilometre point and keeps the raw cause', () => {
    // Situación 13054089 / registro 16676270, un punto suelto en la HU-883.
    const punto = parsearSituaciones(fixture, AHORA).incidencias.find(
      (i) => i.situacion === '13054089',
    )!;
    expect(punto.id).toBe('dgt:16676270');
    expect(punto.ubicacion.inicio).toEqual({ lat: 41.705166, lon: -0.025548847 });
    expect(punto.ubicacion.fin).toBeNull();
    expect(punto.pk).toEqual({ desde: 1.2, hasta: null });
    expect(punto.ubicacion.provincia).toBe('Huesca');
    expect(punto.ubicacion.municipio).toBe('Villanueva de Sigena');
    expect(punto.carretera).toBe('HU-883');
    expect(punto.sentido).toBe('ambos');
    // «highest» es alta, no una severidad inventada por debajo.
    expect(punto.severidad).toBe('alta');
    expect(punto.tipo).toBe('obstaculo');
    // El valor DATEX II original viaja junto al tipo normalizado (S8).
    expect(punto.subtipo).toBe('damagedRoadSurface');
  });

  it('leaves an unknown severity unknown instead of calling it low', () => {
    // El registro de la N-400 no trae severidad ni en el registro ni en la situación (S5).
    const sinSeveridad = parsearSituaciones(fixture, AHORA).incidencias.find(
      (i) => i.situacion === '2816645',
    )!;
    expect(sinSeveridad.severidad).toBe('desconocida');
    // En cambio el registro de la A-52 sí la trae, y sale baja.
    const baja = parsearSituaciones(fixture, AHORA).incidencias.find(
      (i) => i.situacion === '25085953',
    )!;
    expect(baja.severidad).toBe('baja');
  });

  it('places a linear incident with both ends', () => {
    const tramo = parsearSituaciones(fixture, AHORA).incidencias.find(
      (i) => i.situacion === '2816645',
    )!;
    expect(tramo.ubicacion.inicio).toEqual({ lat: 39.993732, lon: -3.6074991 });
    expect(tramo.ubicacion.fin).toEqual({ lat: 39.994446, lon: -3.6054852 });
    expect(tramo.pk).toEqual({ desde: 37.1, hasta: 37.3 });
  });

  it('derives the state from the validity window against the clock passed in', () => {
    // XML mínimo con un registro que abre a las 10:00 y cierra a las 12:00 UTC.
    const ventana = `<d2:payload xmlns:com="http://e" xmlns:sit="http://s">
      <com:publicationTime>2026-10-28T13:00:00.000+01:00</com:publicationTime>
      <sit:situation id="1"><sit:situationRecord id="r1">
        <sit:validity><com:validityTimeSpecification>
          <com:overallStartTime>2026-10-28T10:00:00.000Z</com:overallStartTime>
          <com:overallEndTime>2026-10-28T12:00:00.000Z</com:overallEndTime>
        </com:validityTimeSpecification></sit:validity>
        <sit:cause><sit:causeType>accident</sit:causeType></sit:cause>
        <sit:locationReference/>
      </sit:situationRecord></sit:situation>
    </d2:payload>`;
    expect(
      parsearSituaciones(ventana, Date.parse('2026-10-28T09:00:00Z')).incidencias[0]?.estado,
    ).toBe('previsto');
    expect(
      parsearSituaciones(ventana, Date.parse('2026-10-28T11:00:00Z')).incidencias[0]?.estado,
    ).toBe('activo');
    expect(
      parsearSituaciones(ventana, Date.parse('2026-10-28T13:00:00Z')).incidencias[0]?.estado,
    ).toBe('terminado');
  });

  it('rejects a body that is not the DGT feed with a source error', () => {
    // parsearSituaciones es sincrónica cuando falla: el error se coge con try, no con catch.
    let errorNoXml: unknown;
    try {
      parsearSituaciones('esto no es XML', AHORA);
    } catch (e) {
      errorNoXml = e;
    }
    expect(errorNoXml).toBeInstanceOf(SourceError);
    // El mensaje habla del feed, no cuela el cuerpo ni la URL de la fuente.
    expect(errorNoXml).not.toMatchObject({ message: expect.stringContaining('esto no es XML') });
    expect(() => parsearSituaciones('<d2:payload><otro>x</otro></d2:payload>', AHORA)).toThrow(
      SourceError,
    );
    expect(() => parsearSituaciones(fixture.slice(0, 400), AHORA)).toThrow(SourceError);
  });

  it('normalises road names without inventing a hyphen', () => {
    expect(normalizarCarretera('a7')).toBe('A-7');
    expect(normalizarCarretera('A 7')).toBe('A-7');
    expect(normalizarCarretera('a-7')).toBe('A-7');
    expect(normalizarCarretera('  a7  ')).toBe('A-7');
    expect(normalizarCarretera('N-332a')).toBe('N-332A');
    expect(normalizarCarretera('CG-1.5')).toBe('CG-1.5');
    expect(normalizarCarretera('GC-1  AM')).toBe('GC-1 AM');
    expect(normalizarCarretera('CV privado Iberdrola')).toBe('CV PRIVADO IBERDROLA');
    expect(normalizarCarretera('Avda. Andalucía ')).toBe('AVDA. ANDALUCÍA');
    expect(normalizarCarretera('')).toBe('');
  });

  it('matches a province with or without accents and either half of a bilingual name', () => {
    expect(mismaProvincia('Alacant/Alicante', 'alicante')).toBe(true);
    expect(mismaProvincia('Alacant/Alicante', 'Alacant')).toBe(true);
    expect(mismaProvincia('Álava', 'alava')).toBe(true);
    expect(mismaProvincia('Madrid', 'Barcelona')).toBe(false);
  });

  it('refuses a kilometre range without a road, or an inverted one', () => {
    expect(() => buscar([], { pkDesde: 5 }, 10)).toThrow(SourceError);
    expect(() => buscar([], { carretera: 'A-52', pkDesde: 105, pkHasta: 95 }, 10)).toThrow(
      SourceError,
    );
  });

  it('matches a kilometre range by overlap, not containment', () => {
    // La incidencia va del 95 al 105 y la consulta pide del 100 al 140: se tocan.
    const incidenciaAmplia = incidencia();
    expect(
      buscar([incidenciaAmplia], { carretera: 'a 52', pkDesde: 100, pkHasta: 140 }, 10),
    ).toEqual({ incidencias: [incidenciaAmplia], total: 1, sinUbicacion: 0 });
  });

  it('filters by direction, province and state, and cuts by the limit', () => {
    // El sentido que corta los dos también afecta al que se pidió.
    expect(buscar([incidencia({ sentido: 'ambos' })], { sentido: 'positivo' }, 10).total).toBe(1);
    expect(buscar([incidencia({ sentido: null })], { sentido: 'positivo' }, 10).total).toBe(0);

    // La provincia cuenta «sin ubicación» solo por las filas que encajarían y no tienen dato:
    // la de Barcelona se descarta por no encajar, no por falta de dato.
    const enMadrid = incidencia({
      ubicacion: { inicio: null, fin: null, provincia: 'Madrid', municipio: '' },
    });
    const sinProvincia = incidencia();
    const enBarcelona = incidencia({
      ubicacion: { inicio: null, fin: null, provincia: 'Barcelona', municipio: '' },
    });
    expect(buscar([enMadrid, sinProvincia, enBarcelona], { provincia: 'madrid' }, 10)).toEqual({
      incidencias: [enMadrid],
      total: 1,
      sinUbicacion: 1,
    });

    // Solo la activa sale, aunque las otras también encajarían.
    const activa = incidencia();
    expect(buscar([incidencia({ id: 'dgt:2', estado: 'previsto' }), activa], {}, 10)).toEqual({
      incidencias: [activa],
      total: 1,
      sinUbicacion: 0,
    });

    // total cuenta antes del límite; la lista queda recortada.
    const tres = [1, 2, 3].map((n) => incidencia({ id: `dgt:${n}` }));
    expect(buscar(tres, {}, 2)).toEqual({
      incidencias: tres.slice(0, 2),
      total: 3,
      sinUbicacion: 0,
    });
  });

  it('keeps an incident on the radius boundary and counts the ones it cannot place', () => {
    const enElPunto = incidencia({
      ubicacion: {
        inicio: { lat: 41.705166, lon: -0.025548847 },
        fin: null,
        provincia: '',
        municipio: '',
      },
    });
    // Radio 0 en las coordenadas exactas la incluye: el borde cuenta.
    expect(cercanas([enElPunto], { lat: 41.705166, lon: -0.025548847 }, 0, 10)).toEqual({
      incidencias: [{ ...enElPunto, distancia_km: 0 }],
      total: 1,
      sinUbicacion: 0,
    });
    // Un punto a unos 100 km cae fuera del radio; el que no tiene coordenadas cuenta como sin ubicación.
    const aCienKm = incidencia({
      id: 'dgt:2',
      ubicacion: {
        inicio: { lat: 42.6, lon: -0.025548847 },
        fin: null,
        provincia: '',
        municipio: '',
      },
    });
    const sinCoordenadas = incidencia({ id: 'dgt:3' });
    expect(
      cercanas([aCienKm, sinCoordenadas], { lat: 41.705166, lon: -0.025548847 }, 10, 10),
    ).toEqual({
      incidencias: [],
      total: 0,
      sinUbicacion: 1,
    });
  });

  it('returns the nearest incidents first, with their distance, when the limit cuts the list', () => {
    const centro = { lat: 41.705166, lon: -0.025548847 };
    const a = (id: string, lat: number) =>
      incidencia({
        id,
        ubicacion: { inicio: { lat, lon: centro.lon }, fin: null, provincia: '', municipio: '' },
      });
    const { incidencias, total } = cercanas([a('lejos', 41.75), a('cerca', 41.71)], centro, 10, 1);
    expect(total).toBe(2);
    expect(incidencias).toEqual([expect.objectContaining({ id: 'cerca', distancia_km: 0.5 })]);
  });

  it('caches the download for the TTL and fetches again once it is over', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(fixture));
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-28T13:00:00Z'));
      const descargar = descargaConCache(fetchImpl);
      const primera = await descargar();
      expect(primera.desdeCache).toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      // Medio minuto después el feed es el mismo: una sola descarga y se dice que vino de caché.
      vi.setSystemTime(new Date('2026-10-28T13:00:30Z'));
      const segunda = await descargar();
      expect(segunda.desdeCache).toBe(true);
      expect(segunda.feed.publicado).toBe('2026-10-28T12:12:17.098Z');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      // Pasado el TTL se vuelve a bajar.
      vi.setSystemTime(new Date('2026-10-28T13:02:00Z'));
      const tercera = await descargar();
      expect(tercera.desdeCache).toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('requests the DGT feed as XML and reports a failed download', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(fixture));
    const { feed } = await leerFeed(fetchImpl);
    expect(feed.publicado).toBe('2026-10-28T12:12:17.098Z');
    expect(feed.incidencias).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml',
      expect.objectContaining({ headers: { Accept: 'application/xml' } }),
    );
    const caida = vi.fn<typeof fetch>(async () => new Response('caída', { status: 503 }));
    await expect(leerFeed(caida)).rejects.toThrow(SourceError);
    await expect(leerFeed(caida)).rejects.toThrow('La fuente respondió 503.');
  });
});
