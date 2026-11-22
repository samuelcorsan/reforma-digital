// Pruebas de las funciones puras del servidor TIB: CSV, índice, calendario y las cuatro consultas.
// El fixture imita la estructura del GTFS real de TIB (sin tocar la red).

import { describe, it, expect } from 'vitest';
import { buildIndex, parseCsv, activeServicesOn } from './gtfs';
import { findRoutes, findStops, routeStops, stopTimes, resolveDate, parseTime } from './tools';

const files: Record<string, string> = {
  'agency.txt': 'agency_id,agency_name\nCTMR4,CONSORCI DE TRANSPORTS DE MALLORCA\n',
  'routes.txt': [
    'route_id,agency_id,route_short_name,route_long_name,route_type,route_color',
    '204,CTMR4,204,Port de Sóller - Palma,3,ea2423',
    'T1,CTMR4,T1,Palma - Inca,2,0097a7',
  ].join('\n'),
  'stops.txt': [
    'stop_id,stop_code,stop_name,stop_lat,stop_lon',
    "1,101,Plaça d'Espanya,39.576,2.654",
    '2,102,Port de Sóller,39.798,2.693',
    '3,103,Inca,39.720,2.911',
  ].join('\n'),
  'calendar.txt': [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'S1,1,1,1,1,1,0,0,20260101,20271231',
  ].join('\n'),
  'trips.txt': [
    'route_id,service_id,trip_id,trip_headsign,direction_id',
    '204,S1,T1,Palma,0',
    '204,S1,T2,Port de Sóller,1',
  ].join('\n'),
  'stop_times.txt': [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
    'T1,06:00:00,06:00:00,2,1',
    'T1,06:40:00,06:40:00,1,2',
    'T2,07:00:00,07:00:00,1,1',
    'T2,07:40:00,07:40:00,2,2',
  ].join('\n'),
  'feed_info.txt': 'feed_version\n2026.11.19\n',
};

const index = buildIndex(files);

describe('parseCsv', () => {
  it('lee comillas, comas y comillas escapadas dentro de celdas', () => {
    expect(parseCsv('a,"b,c",d\n"x""y",z\n')).toEqual([
      ['a', 'b,c', 'd'],
      ['x"y', 'z'],
    ]);
  });
});

describe('buildIndex', () => {
  it('indexa rutas, paradas, viajes y paradas por viaje', () => {
    expect(index.routes.length).toBe(2);
    expect(index.stops.length).toBe(3);
    expect(index.tripsById.size).toBe(2);
    expect(index.departuresByStop.get('1')?.length).toBe(2);
    expect(index.stopTimesByTrip.get('T1')?.map((s) => s.stopId)).toEqual(['2', '1']);
  });
});

describe('activeServicesOn', () => {
  it('respeta el día de la semana y el rango de fechas', () => {
    // 2026-01-05 es lunes (monday=1).
    expect(activeServicesOn(index, '2026-01-05').has('S1')).toBe(true);
    // 2026-01-10 es sábado (saturday=0).
    expect(activeServicesOn(index, '2026-01-10').has('S1')).toBe(false);
  });
});

describe('activeServicesOn con calendar_dates', () => {
  const withOverrides = {
    ...files,
    'calendar_dates.txt': 'service_id,date,exception_type\nS1,20260110,1\nS1,20260111,2\n',
  };
  const idx = buildIndex(withOverrides);

  it('añade un servicio en una fecha excepcional (tipo 1)', () => {
    // 2026-01-10 es sábado (saturday=0), pero calendar_dates lo añade.
    expect(activeServicesOn(idx, '2026-01-10').has('S1')).toBe(true);
  });

  it('suprime un servicio en una fecha excepcional (tipo 2)', () => {
    // 2026-01-11 es domingo (sunday=0) y además calendar_dates lo suprime.
    expect(activeServicesOn(idx, '2026-01-11').has('S1')).toBe(false);
  });
});

describe('findRoutes y findStops', () => {
  it('busca líneas por número y por nombre', () => {
    expect(findRoutes(index, '204').lineas[0]?.linea).toBe('204');
    expect(findRoutes(index, 'soller').lineas[0]?.linea).toBe('204');
  });
  it('busca paradas por nombre sin distinguir tildes', () => {
    expect(findStops(index, 'inca').paradas[0]?.nombre).toBe('Inca');
  });
});

describe('routeStops', () => {
  it('devuelve las paradas en orden por sentido', () => {
    const r = routeStops(index, '204');
    expect(r.direcciones.length).toBe(2);
    expect(r.direcciones[0]?.cabecera).toBe('Palma');
    expect(r.direcciones[0]?.paradas.map((p) => p.id)).toEqual(['2', '1']);
  });
});

describe('stopTimes', () => {
  it('lista las salidas de una parada en una fecha activa', () => {
    const s = stopTimes(index, '1', { date: '2026-01-05', limit: 10 });
    expect(s.salidas.map((x) => x.hora)).toEqual(['06:40', '07:00']);
  });
  it('filtra por hora (after)', () => {
    const s = stopTimes(index, '1', { date: '2026-01-05', after: parseTime('07:00'), limit: 10 });
    expect(s.salidas.map((x) => x.hora)).toEqual(['07:00']);
  });
});

describe('resolveDate y parseTime', () => {
  it('valida AAAA-MM-DD y rechaza formatos inválidos', () => {
    expect(resolveDate('2026-03-15')).toBe('2026-03-15');
    expect(() => resolveDate('15/03/2026')).toThrow();
  });
  it('parsea HH:MM a segundos', () => {
    expect(parseTime('07:00')).toBe(7 * 3600);
  });
});
