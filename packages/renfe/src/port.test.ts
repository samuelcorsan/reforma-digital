// @vitest-environment node
// Valores esperados obtenidos con renfe-cli (Python, commit ac226de) sobre las mismas entradas: el port debe
// coincidir donde es fácil divergir sin darse cuenta (difflib, zonas horarias, el literal de la tienda antigua).
import { expect, it } from 'vitest';
import { matchingBlocks, ratio } from './difflib';
import { readLiteral } from './legacy';
import * as live from './live';
import * as stations from './stations';
import { iso, wallPlus, zoned } from './time';

it('matches difflib ratios and matching blocks', () => {
  expect(ratio('sevila', 'sevilla')).toBe(0.9230769230769231);
  expect(ratio('madri', 'madrid')).toBe(0.9090909090909091);
  expect(ratio('barcelona', 'barna')).toBe(0.7142857142857143);
  expect(ratio('valencia', 'valladolid')).toBe(0.4444444444444444);
  expect(ratio('abc', 'xyz')).toBe(0);
  expect(ratio('', '')).toBe(1);
  expect(matchingBlocks([...'abxcdyef'], [...'abcdzef'])).toEqual([
    [0, 0, 2],
    [3, 2, 2],
    [6, 5, 2],
    [8, 7, 0],
  ]);
});

it('writes Madrid times like Python, across daylight saving changes', () => {
  expect(iso(zoned(2026, 7, 1, 8, 57))).toBe('2026-07-01T08:57:00+02:00');
  expect(iso(zoned(2027, 1, 29, 8, 57))).toBe('2027-01-29T08:57:00+01:00');
  expect(iso(wallPlus('2027-03-28', 3 * 3600))).toBe('2027-03-28T03:00:00+02:00');
  expect(iso(wallPlus('2026-10-25', 3 * 3600))).toBe('2026-10-25T03:00:00+01:00');
});

it('reads the legacy shop literal as data', () => {
  const text = `{a:1, "b":[true,null,-2.5e1], c:"x\\'y", d:{e:"é"}});`;
  expect(readLiteral(text, 0)).toEqual([
    { a: 1, b: [true, null, -25], c: "x'y", d: { e: 'é' } },
    50,
  ]);
  expect(() => readLiteral('{a:alert(1)}', 0)).toThrow('unreadable answer');
});

it('ranks and suggests stations like renfe-cli', () => {
  const every = stations.bundled();
  expect(stations.norm('Madrid-Puerta de Atocha (Todas) Àvila')).toBe(
    'madrid puerta de atocha avila',
  );
  expect(stations.find('sevilla', every, 5).map((s) => s.code)).toEqual(['51003']);
  expect(stations.find('atocha', every, 5).map((s) => s.code)).toEqual(['60000', '18000', '98000']);
  expect(stations.suggestions('barcelna').map((s) => s.code)).toEqual([
    'BARCE',
    '71801',
    '97007',
    '97008',
    '79009',
  ]);
});

it('reads the live map and explains a held train', () => {
  const board = live.parse({
    fechaActualizacion: '2026-11-19T18:00:00',
    trenes: [
      {
        codComercial: '03081',
        ultRetraso: '12',
        codOrigen: '60000',
        codDestino: '71801',
        codEstAnt: '04040',
        codEstSig: '04040',
        horaLlegadaSigEst: '2026-11-19T17:40:00',
        time: 1795107600,
      },
      {
        codComercial: '00190',
        ultRetraso: '-3',
        codOrigen: '17000',
        codDestino: '37606',
        codEstAnt: '17000',
        codEstSig: '18000',
        horaLlegadaSigEst: '2026-11-20T18:10:00', // un día por delante: se corrige
        time: 1795107600,
      },
    ],
  });
  const held = live.status(board, '3081', new Map([['04040', 'Zaragoza']]));
  expect(held).toMatchObject({
    train: '03081',
    delay_minutes: 12,
    overdue: true,
    reported_at: '2026-11-19T18:00:00+01:00',
    next_station: {
      code: '04040',
      name: 'Zaragoza',
      expected_arrival: '2026-11-19T17:40:00+01:00',
    },
    notice:
      'The train is probably stopped at Zaragoza, since about 17:40, longer than a stop: its delay is the last one Renfe recorded.',
  });
  expect(live.status(board, '190', new Map())).toMatchObject({
    delay_minutes: -3,
    overdue: false,
    notice: null,
    next_station: { expected_arrival: '2026-11-19T18:10:00+01:00' },
  });
  expect(live.status(board, '99999', new Map())).toMatchObject({
    train: '99999',
    on_map: false,
    delay_minutes: null,
  });
});
