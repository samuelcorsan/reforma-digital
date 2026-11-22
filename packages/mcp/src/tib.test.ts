// @vitest-environment node
// GTFS sin red: feeds sintéticos con la forma de los reales, para lo que se puede romper al leerlos.
// TIB: estación con andenes, viajes que pasan de medianoche, paradas donde solo se baja. EMT:
// plantillas con frecuencias, paradas sin hora, celdas con un espacio y sin feed_info.txt.
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import {
  buildIndex,
  findRoutes,
  findStops,
  madrid,
  parseCsv,
  readCsv,
  resolveDate,
  routeStops,
  runsOn,
  stopTimes,
} from './gtfs';
import { createTibMcp } from './tib';

const tib: Record<string, string> = {
  'agency.txt': '﻿agency_id,agency_name\nA1,Grupo Ruiz\n',
  'routes.txt': [
    'route_id,agency_id,route_short_name,route_long_name,route_type',
    '3014,A1,204,Port de Sóller - Palma,3',
    'T1,A1,T1,Palma - Inca,2',
  ].join('\n'),
  'stops.txt': [
    'stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station',
    'ST,40036,Estació Intermodal,39.57,2.65,1,',
    '984,40036,Estació Intermodal (bus),39.57,2.65,0,ST',
    '1023,301,Estació Intermodal (tren i metro),39.57,2.65,0,ST',
    'ST_ENTRANCE,,Ascensor planta 0,39.57,2.65,2,ST',
    '1490,61027,Port de Sóller (61027),39.79,2.70,,',
    '3,51003,Inca (51003),39.72,2.91,,',
  ].join('\n'),
  'calendar.txt': [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'LAB,1,1,1,1,1,0,0,20260101,20271231',
  ].join('\n'),
  'calendar_dates.txt': 'service_id,date,exception_type\nLAB,20260110,1\nLAB,20260106,2\n',
  'trips.txt': [
    'route_id,service_id,trip_id,trip_headsign,direction_id',
    // Sin direction_id, como uno de cada siete viajes de TIB.
    '3014,LAB,a,Palma,',
    '3014,LAB,b,Port de Sóller,',
    '3014,LAB,night,Port de Sóller,1',
    'T1,LAB,t,Inca,0',
  ].join('\n'),
  'stop_times.txt': [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type',
    'a,06:00:00,06:00:00,1490,1,0',
    'a,06:40:00,06:40:00,984,2,1',
    'b,07:00:00,07:00:00,984,1,0',
    'b,07:40:00,07:40:00,1490,2,1',
    'night,24:10:00,24:10:00,984,1,0',
    'night,24:50:00,24:50:00,1490,2,0',
    't,08:00:00,08:00:00,1023,1,0',
    't,08:30:00,08:30:00,3,2,1',
  ].join('\n'),
  'feed_info.txt':
    'feed_publisher_name,feed_start_date,feed_end_date,feed_version\nCTM,20260101,20271231,2026.11\n',
};
const files = (texts: Record<string, string>) =>
  new Map(Object.entries(texts).map(([name, text]) => [name, readCsv(text)]));
const index = buildIndex(files(tib), 'GTFS de TIB');
const salidas = (stop: string, date: string, extra: { route?: string; after?: number } = {}) =>
  stopTimes(index, stop, { date, limit: 20, ...extra }).salidas.map(
    (s) => `${s.hora} ${s.linea}${s.diaSiguiente ? ' +1' : ''}`,
  );

describe('TIB', () => {
  it('reads quoted CSV cells', () => {
    expect(parseCsv('a,"b,c",d\n"x""y",z\n')).toEqual([
      ['a', 'b,c', 'd'],
      ['x"y', 'z'],
    ]);
  });

  it('takes the only agency when a route leaves agency_id blank', () => {
    const blank = files({
      ...tib,
      'routes.txt':
        'route_id,agency_id,route_short_name,route_long_name,route_type\n3014,,204,Port de Sóller - Palma,3\nT1,,T1,Palma - Inca,2',
    });
    expect(findRoutes(buildIndex(blank, 'GTFS de TIB'), '204', 1).lineas[0]?.agencia).toBe(
      'Grupo Ruiz',
    );
  });

  it('fails loudly when a required table or column is missing', () => {
    const broken = files(tib);
    broken.set('trips.txt', readCsv('route_id,trip_id\n3014,a\n'));
    expect(() => buildIndex(broken, 'GTFS de TIB')).toThrow(/service_id/);
    broken.delete('stops.txt');
    expect(() => buildIndex(broken, 'GTFS de TIB')).toThrow(/GTFS de TIB le falta stops\.txt/);
  });

  it('applies the weekly calendar and its exceptions', () => {
    expect(runsOn(index, 'LAB', '2026-01-05')).toBe(true); // lunes
    expect(runsOn(index, 'LAB', '2026-01-06')).toBe(false); // festivo suprimido
    expect(runsOn(index, 'LAB', '2026-01-10')).toBe(true); // sábado añadido
    expect(runsOn(index, 'LAB', '2026-01-11')).toBe(false); // domingo
  });

  it('finds lines and stops without accents, codes or stop entrances', () => {
    expect(findRoutes(index, 'soller', 10).lineas.map((r) => r.linea)).toEqual(['204']);
    expect(findRoutes(index, undefined, 10).lineas.map((r) => r.modo)).toEqual(['Autobús', 'Tren']);
    expect(findStops(index, 'inca', 10).paradas.map((s) => s.id)).toEqual(['3']);
    expect(findStops(index, 'intermodal', 10).paradas.map((s) => s.id)).toEqual([
      'ST',
      '984',
      '1023',
    ]);
  });

  it('lists one route per destination, even without direction_id', () => {
    const r = routeStops(index, '204');
    expect(r.recorridos.map((s) => [s.cabecera, s.paradas.map((p) => p.id)])).toEqual([
      ['Palma', ['1490', '984']],
      ['Port de Sóller', ['984', '1490']],
    ]);
  });

  it('gives only departures you can board, after midnight on the next day', () => {
    // Lunes: el 204 de las 07:00 sale; la llegada de las 06:40 no. El de las 24:10 va al final,
    // marcado, para que a las 23:50 no parezca que ya no hay nada.
    expect(salidas('984', '2026-01-05')).toEqual(['07:00 204', '00:10 204 +1']);
    expect(salidas('984', '2026-01-06')).toEqual(['00:10 204']); // del lunes; el martes es festivo
    expect(salidas('984', '2026-01-07', { after: 3600 })).toEqual(['07:00 204', '00:10 204 +1']);
    expect(salidas('1490', '2026-01-05')).toEqual(['06:00 204']);
    // El nocturno acaba en Port de Sóller: el feed deja subir, pero ahí no sale hacia ningún sitio.
    expect(salidas('1490', '2026-01-06')).toEqual([]);
  });

  it('takes a station or its code as all its platforms', () => {
    expect(salidas('ST', '2026-01-05')).toEqual(['07:00 204', '08:00 T1', '00:10 204 +1']);
    // 40036 es el código de la estación y del andén de bus: manda el andén.
    expect(salidas('40036', '2026-01-05')).toEqual(['07:00 204', '00:10 204 +1']);
    expect(salidas('Inca', '2026-01-05')).toEqual([]);
    expect(salidas('estacio intermodal', '2026-01-05', { route: 'T1' })).toEqual(['08:00 T1']);
  });

  it('takes the dates from the calendar when feed_info.txt leaves them out', () => {
    const partial = files(tib);
    partial.set('feed_info.txt', readCsv('feed_version,feed_end_date\n1,\n'));
    expect(buildIndex(partial, 'GTFS de TIB').end).toBe('2027-12-31');
  });

  it('refuses dates the feed does not cover instead of answering with a partial timetable', () => {
    expect(() => salidas('984', '2028-06-01')).toThrow(/del 2026-01-01 al 2027-12-31/);
    // El día después del último aún tiene su nocturno (el 31 de diciembre de 2027 es viernes).
    expect(salidas('984', '2028-01-01')).toEqual(['00:10 204']);
    expect(() => salidas('nowhere', '2026-01-05')).toThrow(/find_stops/);
  });

  it('resolves dates in Madrid time and rejects impossible ones', () => {
    // 23:30 UTC del 31 de diciembre ya es 1 de enero en Madrid.
    const now = Date.UTC(2026, 11, 31, 23, 30);
    expect(madrid(now)).toEqual({ date: '2027-01-01', seconds: 30 * 60 });
    expect(resolveDate('today', now)).toBe('2027-01-01');
    expect(resolveDate('mañana', now)).toBe('2027-01-02');
    expect(() => resolveDate('2026-02-31', now)).toThrow(/no válida/);
    expect(() => resolveDate('2026-13-45', now)).toThrow(/no válida/);
    expect(() => resolveDate('15/03/2026', now)).toThrow(/no válida/);
  });
});

// Como lo publica la EMT: celdas vacías con un espacio, sin feed_info.txt, la hora solo en la
// cabecera y el final, y la salida real en frequencies.txt (la plantilla dice 08:00). A1DUP es el
// mismo bus de las 08:00 con otro trip_id, como repite la EMT el N1. 20 y 21 son las dos aceras de
// «Pl. Espanya», y la supresión de 2027 cae fuera del calendario.
const emt = buildIndex(
  files({
    'agency.txt': 'agency_id,agency_name\nEMT-Palma,EMT Palma\n',
    'routes.txt':
      'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type\nL017,EMT-Palma,A1,Aeroport - Palma Centre,,3\n',
    'stops.txt': [
      'stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station',
      '10,10,10-Sindicat,39.57,2.65,0, ',
      '20,20,20-Pl. Espanya,39.57,2.65,0, ',
      '21,21,21-Pl. Espanya,39.57,2.65,0, ',
      '30,30,30-Son Sant Joan,39.56,2.70,0, ',
      '40,40,40-Aeroport,39.55,2.73,0, ',
    ].join('\n'),
    'calendar.txt': [
      'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
      'LAB,1,1,1,1,1,0,0,20261110,20261231',
    ].join('\n'),
    'calendar_dates.txt': 'service_id,date,exception_type\nLAB,20261208,2\nLAB,20270106,2\n',
    'trips.txt':
      'route_id,service_id,trip_id,trip_headsign\nL017,LAB,A1LAB,Aeroport\nL017,LAB,A1DUP,Aeroport\nL017,LAB,A1BACK,Sindicat\n',
    'stop_times.txt': [
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence,shape_dist_traveled',
      'A1LAB,08:00:00,08:00:00,10,1,',
      'A1LAB, , ,20,2,2.000',
      'A1LAB, , ,30,3,8.000',
      'A1LAB,08:20:00,08:25:00,40,4,10.000',
      'A1DUP,08:00:00,08:00:00,10,1,',
      'A1DUP,08:20:00,08:20:00,40,2,10.000',
      'A1BACK,09:00:00,09:00:00,21,1,',
      'A1BACK,09:10:00,09:10:00,10,2,2.000',
    ].join('\n'),
    'frequencies.txt': [
      'trip_id,start_time,end_time,headway_secs,exact_times',
      'A1LAB,07:00:00,07:30:00,900,1',
      'A1LAB,07:30:00,08:00:01,1800,1',
    ].join('\n'),
  }),
  'GTFS de la EMT',
);
const opts = { date: '2026-11-23', limit: 20 };
const emtSalidas = (stop: string, date = opts.date) =>
  stopTimes(emt, stop, { date, limit: 20 }).salidas.map((s) => s.hora);

describe('frecuencias y paradas sin hora', () => {
  it('takes the feed dates from the calendar when there is no feed_info.txt', () => {
    expect([emt.start, emt.end, emt.version]).toEqual(['2026-11-10', '2026-12-31', undefined]);
    expect(() => emtSalidas('10', '2027-02-01')).toThrow(/del 2026-11-10 al 2026-12-31/);
  });

  it('repeats a frequencies.txt template at each start time, once per bus', () => {
    expect(emtSalidas('10')).toEqual(['07:00', '07:15', '07:30', '08:00']);
    // Las cuatro salidas de A1LAB (A1DUP es la de las 08:00) y A1BACK.
    expect(routeStops(emt, 'A1').viajes).toBe(5);
    expect(emtSalidas('10', '2026-12-08')).toEqual([]); // festivo
  });

  it('estimates untimed stops by distance travelled, up to the arrival at the next timed stop', () => {
    // 2 km de 10 en 20 min: 4 min; 8 km: 16 min.
    expect(emtSalidas('20')).toEqual(['07:04', '07:19', '07:34', '08:04']);
    expect(emtSalidas('30')).toEqual(['07:16', '07:31', '07:46', '08:16']);
    expect(emtSalidas('40')).toEqual([]); // final del recorrido
    expect(stopTimes(emt, '20', opts).salidas.every((s) => s.estimada)).toBe(true);
    expect(stopTimes(emt, '10', opts).salidas.some((s) => s.estimada)).toBe(false);
  });

  it('takes a name shared by several stops as all of them, saying which one', () => {
    expect(findStops(emt, 'sindicat', 10).paradas.map((s) => s.id)).toEqual(['10']);
    const r = stopTimes(emt, 'pl. espanya', opts);
    expect(r.salidas.map((s) => `${s.hora} ${s.anden}`)).toEqual([
      '07:04 20-Pl. Espanya',
      '07:19 20-Pl. Espanya',
      '07:34 20-Pl. Espanya',
      '08:04 20-Pl. Espanya',
      '09:00 21-Pl. Espanya',
    ]);
  });
});

describe('servidor', () => {
  it('downloads the zip and answers with its source', async () => {
    const zip = zipSync({
      ...Object.fromEntries(Object.entries(tib).map(([name, text]) => [name, strToU8(text)])),
      'shapes.txt': strToU8('shape_id\nnot,valid,"csv'),
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(zip));
    const response = await createTibMcp(fetchImpl).fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'find_routes', arguments: { query: '204' } },
        }),
      }),
    );
    const data = (await response.text()).match(/^data: (.*)$/m)?.[1];
    const { result } = JSON.parse(data ?? 'null') as { result: { content: { text: string }[] } };
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('tib.org'), expect.anything());
    expect(JSON.parse(result.content[0]?.text ?? '').lineas[0].agencia).toBe('Grupo Ruiz');
    expect(result.content[1]?.text).toContain('Consorci de Transports de Mallorca');
  });
});
