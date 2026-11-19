// Enlace que continúa una búsqueda en la web de Renfe, donde se elige el tren y se paga (port de renfe-cli
// `shop.py`). Un enlace no puede elegir el tren: la página abre la búsqueda del día.

import * as config from './config';
import type { Station } from './stations';

export function link(origin: Station, destination: Station, day: string) {
  if (day < config.NSV_FIRST_SALE_DATE) {
    const query = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      'departure-date': day,
    });
    return {
      url: `${config.WWW_SEARCH_URL}?${query}`,
      prefilled: ['origin', 'destination', 'date'],
      next: "Mark 'Solo ida' (or pick a return date), press 'Buscar billetes' and pick your train.",
    };
  }
  const query = new URLSearchParams({
    originUicStationCode: origin.code,
    destinationUicStationCode: destination.code,
    isOneWay: 'true',
  });
  return {
    url: `${config.SHOP_SEARCH_URL}?${query}`,
    prefilled: ['origin', 'destination', 'one_way'],
    next: `Pick ${day} as the date (Renfe's new shop doesn't take one in a link), press 'Buscar billetes' and pick your train.`,
  };
}
