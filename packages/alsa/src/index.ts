// Servidor MCP de ALSA: un port a TypeScript de la parte anónima de queguagua
// (https://github.com/joseluissaorin/queguagua, MIT, commit eb37f7c). Cada herramienta devuelve el mismo JSON que el
// comando `queguagua alsa` equivalente.

import { READ_ONLY_EXTERNAL, server } from '@reforma-digital/mcp/comun';
import { z } from 'zod';
import { AlsaClient } from './client';
import { AlsaError } from './errors';
import { run as searchBuses, searchInput, stopName } from './search';
import { search, suggestions } from './stops';

const INSTRUCTIONS = `Autobuses de ALSA: busca paradas y lista los viajes de una fecha con horarios, servicio, plazas a la venta y todas las tarifas para los viajeros indicados.
No oficial: usa la web pública de ALSA, que puede cambiar o rechazar peticiones sin aviso.

- Las paradas aceptan un nombre («Granada», «Madrid Estación Sur», sin importar tildes ni mayúsculas) o un identificador de ALSA («155»). Los grupos como «Madrid (Todas las paradas)» incluyen todas las paradas de la ciudad. Usa find_stops si hay dudas.
- Las fechas son AAAA-MM-DD, DD/MM/AAAA, today, tomorrow o un día de la semana (friday, viernes: el próximo), en hora de Madrid. Las horas de cada viaje llevan el desfase horario de su parada.
- Este servidor no compra billetes ni entra en ninguna cuenta: no aplica el Abono Único ni códigos promocionales. Para comprar, la web o la app de ALSA.
- Un error de tipo «blocked» significa que ALSA rechazó la petición o tiene activa una sala de espera: no reintentes enseguida. «maintenance» es que su web está en mantenimiento.`;

// Python da None por una clave que falta; JSON.stringify las quitaría.
const missingAsNull = (_key: string, value: unknown) => (value === undefined ? null : value);

/** Una herramienta con su sesión anónima. Un AlsaError se devuelve con su JSON y las peticiones reintentadas, como
 * en la CLI; cualquier otro error, solo con su tipo (el mensaje podría llevar URLs o cookies). */
async function run(produce: (client: AlsaClient) => Promise<Record<string, unknown>>) {
  const client = new AlsaClient();
  try {
    const text = JSON.stringify(await produce(client), missingAsNull, 2);
    return { content: [{ type: 'text' as const, text }] };
  } catch (err) {
    let body;
    if (err instanceof AlsaError) {
      err.retries = client.retries;
      body = err.toDict();
    } else
      body = {
        type: 'internal',
        message: `unexpected internal error: ${err instanceof Error ? err.name : 'Error'}`,
        exit_code: 1,
      };
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], isError: true };
  }
}

export function createAlsaMcp() {
  return server({ name: 'alsa', title: 'Autobuses de ALSA' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'find_stops',
      {
        title: 'Buscar paradas',
        description:
          'Paradas y grupos de ciudad de ALSA que coinciden con un nombre o identificador, la mejor primero, con sugerencias si hay una errata.',
        inputSchema: z.object({
          query: stopName.describe(
            'Parte del nombre de una parada o ciudad, o un identificador de ALSA.',
          ),
          limit: z.number().int().min(1).max(100).default(10).describe('Máximo de paradas.'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ query, limit }) =>
        run(async () => {
          const stops = search(query, limit);
          return {
            query,
            count: stops.length,
            stations: stops,
            ...(stops.length ? {} : { suggestions: suggestions(query) }),
          };
        }),
    );
    s.registerTool(
      'search_buses',
      {
        title: 'Buscar autobuses',
        description:
          'Autobuses de ALSA entre dos paradas en una fecha: salida y llegada, duración, transbordos, servicio (Comfort, Supra, Premium...), si quedan plazas y todas las tarifas para los viajeros indicados. Con return_date, también la vuelta. Trae los bonos que ALSA vende para esa ruta.',
        inputSchema: searchInput,
        annotations: READ_ONLY_EXTERNAL,
      },
      (args) => run((client) => searchBuses(client, args)),
    );
  });
}
