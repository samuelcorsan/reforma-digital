// Constantes observadas en la web de Renfe (port de renfe-cli `config.py`, commit ac226de).

export const WEB_ORIGIN = 'https://venta.rsv.renfe.com';
export const WEB_CONFIG_URL = `${WEB_ORIGIN}/config/arch-config.json`;
export const API_BASE = 'https://api.rsv.renfe.com';
export const CHANNEL = 'VLP';
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
export const ACCEPT_LANGUAGE = 'es-ES';
export const TIMEZONE = 'Europe/Madrid';
export const REQUEST_TIMEOUT = 25_000;

export const PUBLIC_TOKEN_PATH = '/user/external-users-login/v1/tokens/public';
export const STATIONS_PATH = '/catalog/masterdata/v1/stations';
export const SEARCH_TRAVEL_PATH = '/browsing/traveloptions/v1/search-travel';
export const JOURNEY_SEARCH_PATH = '/browsing/journey/v1/orientations/journey-search';

// Hasta esta fecha vende la tienda antigua (legacy.ts); desde ella, la API nueva.
export const NSV_FIRST_SALE_DATE = '2027-01-25';
export const LEGACY_SHOP_URL = 'https://venta.renfe.com/vol/';
export const WWW_SEARCH_URL = 'https://www.renfe.com/es/es/buscador-billetes';
export const SHOP_SEARCH_URL = `${WEB_ORIGIN}/coext/search`;

export const FARE_BATCH = 3;
export const FARE_WORKERS = 3;
export const EXCLUDED_PRODUCT_TYPES = ['DG', 'BK'];

export const LIVE_MAP_URL = 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json';
export const LIVE_TIMEOUT = 10_000;
export const LIVE_SEARCH_BUDGET = 2_500;
export const STATIONS_TTL = 24 * 3600_000;
