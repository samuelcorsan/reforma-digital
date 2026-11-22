// Servidor MCP de TIB (Consorci de Transports de Mallorca): líneas, paradas y horarios de bus, tren
// y metro de Mallorca, de su GTFS abierto.
import type { Fetch } from './comun';
import { transporteMcp } from './transporte';

const ABOUT = `Transporte público de Mallorca (TIB): líneas de bus interurbano, tren y metro, sus paradas y los horarios publicados.
- No incluye los autobuses urbanos de Palma (EMT, como el A1 al aeropuerto) ni el tren histórico de Sóller y su tranvía, que son de otras empresas.`;

export const createTibMcp = (fetchImpl: Fetch = fetch) =>
  transporteMcp({
    info: { name: 'reforma-digital-tib', title: 'TIB · Transporte público de Mallorca' },
    about: ABOUT,
    feed: {
      label: 'GTFS de TIB',
      url: 'https://www.tib.org/documents/20124/478141/ctm-mallorca-es.zip',
      source:
        'Fuente: Consorci de Transports de Mallorca (TIB), GTFS abierto (tib.org), licencia CC BY 4.0.',
    },
    examples: { line: '«204», «T1»', name: '«Port de Sóller»' },
    fetchImpl,
  });
