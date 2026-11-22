// @vitest-environment node
// Valores esperados obtenidos con queguagua (Python, commit eb37f7c) sobre las mismas entradas, que son sintéticas
// (el viaje tiene la forma de una respuesta real de GetJourneyListResource, con valores inventados): el port debe
// coincidir donde es fácil divergir sin darse cuenta (la verdad de Python, las zonas horarias, difflib).
import { expect, it } from 'vitest';
import { isoLocal, journey, parseDate, voucher } from './search';
import { fold, search, suggestions } from './stops';

it('matches and suggests stops like queguagua', () => {
  expect(fold('Madrid (Todas las paradas) Àvila-Ñ')).toBe('madrid avila n');
  expect(search('granada', 3).map((s) => s.id)).toEqual(['99084', '9289', '9292']);
  expect(search('estacion sur', 5)).toEqual([
    {
      id: '155',
      name: 'Madrid Estación Sur',
      province: 'Madrid',
      country: 'España',
      group: false,
      in_group: '90155',
    },
  ]);
  expect(search('155').map((s) => s.id)).toEqual(['155']);
  expect(suggestions('barcelna')).toEqual([
    'Barcelona (Todas las paradas)',
    'Barcena (O)',
    'Aracena',
    'Baena',
    'Taracena',
  ]);
});

it('reads dates in Madrid, weekdays included', () => {
  const friday = Date.UTC(2026, 10, 27, 11); // viernes 27 de noviembre, 12:00 en Madrid
  const expected = {
    viernes: '2026-12-04',
    lunes: '2026-11-30',
    Sábado: '2026-11-28',
    friday: '2026-12-04',
    today: '2026-11-27',
    mañana: '2026-11-28',
    '04/12/2026': '2026-12-04',
    '4-12-2026': '2026-12-04',
    '2026-12-4': '2026-12-04',
  };
  for (const [text, day] of Object.entries(expected)) expect(parseDate(text, friday)).toBe(day);
  // 00:30 del sábado en Madrid es todavía viernes en UTC.
  expect(parseDate('today', Date.UTC(2026, 10, 27, 23, 30))).toBe('2026-11-28');
  expect(() => parseDate('31/02/2026', friday)).toThrow("bad date '31/02/2026'");
});

it("writes each stop's local time with its own offset", () => {
  expect(isoLocal(1796517000000, '06/12/2026 01:30')).toBe('2026-12-06T01:30:00+01:00');
  expect(isoLocal(1796520600000, '06/12/2026 01:30')).toBe('2026-12-06T01:30:00+00:00');
  expect(isoLocal(1782889020000, '01/07/2026 08:57')).toBe('2026-07-01T08:57:00+02:00');
  expect(isoLocal(null, '06/12/2026 01:30')).toBe('2026-12-06T01:30:00+01:00');
  expect(isoLocal(null, '01/07/2026 08:57')).toBe('2026-07-01T08:57:00+02:00');
  // Sin instante, en los cambios de hora gana el desfase de antes, como `fold=0`.
  expect(isoLocal(null, '25/10/2026 02:30')).toBe('2026-10-25T02:30:00+02:00');
  expect(isoLocal(null, '25/10/2026 03:00')).toBe('2026-10-25T03:00:00+01:00');
  expect(isoLocal(null, '29/03/2026 02:30')).toBe('2026-03-29T02:30:00+01:00');
  expect(isoLocal(1, '31/02/2026 01:30')).toBeNull();
  expect(isoLocal(1, null)).toBeNull();
});

it('normalizes a journey and a bono like queguagua', () => {
  const raw = {
    index: 4,
    departureDate: 1796517000000,
    arrivalDate: 1796535000000,
    departureDataToFilter: '06/12/2026 01:30',
    arrivalDataToFilter: '06/12/2026 06:30',
    originId: '9084',
    originName: 'Granada Estación De Autobuses',
    destinationId: '155',
    destinationName: 'Madrid Estación Sur',
    serviceTypeDescList: ['Supra'],
    serviceTypeList: ['S'],
    lineName: '',
    transfersNumber: 1,
    transfersTown: [{ name: 'Jaén' }, 'Bailén'],
    totalNumberOfStops: '0',
    canBeSold: 'F',
    fares: [
      {
        index: 1,
        fareName: 'SUPRA',
        price: 47.35,
        fareType: 'BASE',
        fareConditions: '',
        fareTypeDescription: 'Tarifa base',
        openReturnPrice: 0,
        isPromoted: false,
        promotionCodeList: [{ code: '' }, { code: 'X1' }],
        outwardReturnRequired: 'N',
        travellersData: [
          { passengerType: 'ADULT', amount: 1, price: 47.35, promotionDescription: '' },
        ],
      },
      { index: 2, fareName: 'SIN PRECIO', price: null, fareType: 'PROMO' },
      {
        index: 0,
        fareName: 'PROMO',
        price: 30.5,
        fareType: 'PROMO',
        isPromoted: true,
        priceOriginal: 47.35,
        outwardReturnRequired: 'S',
      },
    ],
    busCharacteristic: {
      characteristicList: [{ description: 'Wifi' }, { description: '' }],
      isNightBus: true,
      isFreeVoucherApplyable: true,
    },
    petAvailability: 'NO_AVAILABLE',
    sportAvailability: '',
    handicappedAvailability: 'AVAILABLE',
    contiguousPaxAvailability: null,
    warning: '<p>Obras en la&nbsp;estación:</p>\n<b>suplemento</b> de 1&euro;',
    observations: '<br>',
    serviceCodes: '3224',
    companyService: '203',
    isTrainTrip: false,
    numberPMRSeats: 2,
  };
  expect(journey(raw, 'V')).toEqual({
    index: 4,
    direction: 'return',
    departure: '2026-12-06T01:30:00+01:00',
    arrival: '2026-12-06T06:30:00+01:00',
    duration_minutes: 300,
    origin: { id: '9084', name: 'Granada Estación De Autobuses' },
    destination: { id: '155', name: 'Madrid Estación Sur' },
    service: ['Supra'],
    service_codes: ['S'],
    line: null,
    changes: 1,
    change_at: ['Jaén', 'Bailén'],
    stops: 0,
    available: false,
    sale_status: 'sold_out_or_closed',
    fares: [
      {
        index: 0,
        name: 'PROMO',
        price: 30.5,
        currency: 'EUR',
        type: 'PROMO',
        conditions: null,
        open_return_price: null,
        promoted: true,
        promo_codes: [],
        requires_return: true,
        per_passenger: [],
        price_without_promo: 47.35,
      },
      {
        index: 1,
        name: 'SUPRA',
        price: 47.35,
        currency: 'EUR',
        type: 'BASE',
        conditions: 'Tarifa base',
        open_return_price: null,
        promoted: false,
        promo_codes: ['X1'],
        requires_return: false,
        per_passenger: [{ type: 'ADULT', count: 1, price: 47.35, promotion: null }],
      },
      {
        index: 2,
        name: 'SIN PRECIO',
        price: null,
        currency: 'EUR',
        type: 'PROMO',
        conditions: null,
        open_return_price: null,
        promoted: false,
        promo_codes: [],
        requires_return: false,
        per_passenger: [],
      },
    ],
    cheapest: 30.5,
    features: ['Wifi'],
    night_bus: true,
    non_stop: false,
    double_decker: false,
    abono_unico_ok: true,
    pets: 'no_available',
    sport_equipment: null,
    wheelchair: 'available',
    block_adjacent_seat: null,
    warning: 'Obras en la estación: suplemento de 1€',
    observations: null,
    service_code: '3224',
    company: '203',
    train: false,
    wheelchair_places: 2,
  });
  expect(
    voucher({
      voucherName: '',
      digitalVoucherName: 'Abono Único JOVEN',
      voucherType: '5627',
      amount: 30,
      voucherTripsNumber: 0,
      validDays: '30',
      serviceNameType: 'Comfort',
      isUnifiedVoucher: true,
      minDateFrom: '22/11/2026',
      maxDateFrom: '21/12/2026',
      observations: '',
    }),
  ).toEqual({
    name: 'Abono Único JOVEN',
    type: '5627',
    price: 30,
    trips: null,
    validity_days: 30,
    service: 'Comfort',
    abono_unico: true,
    start_between: ['22/11/2026', '21/12/2026'],
    observations: null,
  });
});
