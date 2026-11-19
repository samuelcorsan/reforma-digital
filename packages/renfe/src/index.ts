// Servidor MCP de Renfe: un port a TypeScript de lo que usan sus herramientas de renfe-cli
// (https://github.com/luisgonzaleznf/renfe-cli, MIT, commit ac226de). Cada herramienta devuelve el mismo JSON que
// el comando `renfe` equivalente.

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { RenfeError } from './errors';
import { findStations, listDelays, searchTrains, trainStatus } from './tools';

const INSTRUCTIONS = `Trenes de Renfe: busca estaciones, lista trenes con horarios y precios en una fecha y consulta retrasos en directo.
No oficial: usa la API pública de la web de Renfe, que puede cambiar o rechazar peticiones sin aviso.

- Las estaciones aceptan un nombre («Madrid», «Atocha», «Sevilla») o un código de Renfe («MADRI», «60000»); los grupos de ciudad como «Madrid (Todas)» incluyen todas sus estaciones. Usa find_stations si hay dudas.
- Las fechas son AAAA-MM-DD, «today» o «tomorrow», en hora de Madrid, hasta un año vista.
- Los precios son para un adulto, del más barato al más caro. Cada resultado trae un enlace \`shop\` para comprar en Renfe; este servidor no compra billetes.
- Los retrasos en directo cubren larga y media distancia, solo mientras el tren circula.
- Un error de tipo «blocked» significa que Renfe rechazó o limitó la petición: no reintentes enseguida.`;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Un RenfeError se devuelve con su JSON; cualquier otro error, solo con su tipo (el mensaje podría llevar URLs,
 * cabeceras o tokens). */
async function run(produce: () => Promise<unknown>) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await produce(), null, 2) }] };
  } catch (err) {
    const body =
      err instanceof RenfeError
        ? err.toDict()
        : {
            type: 'internal',
            message: `unexpected internal error: ${(err as Error)?.name ?? 'Error'}`,
            exit_code: 1,
          };
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], isError: true };
  }
}

export function createRenfeMcp() {
  return createMcpHandler(
    () => {
      const server = new McpServer(
        { name: 'renfe', title: 'Trenes de Renfe', version: '0.1.0' },
        { instructions: INSTRUCTIONS },
      );
      server.registerTool(
        'find_stations',
        {
          title: 'Buscar estaciones',
          description:
            'Estaciones y grupos de ciudad que coinciden con un nombre o código, la mejor primero, con sugerencias si hay una errata.',
          inputSchema: z.object({
            query: z
              .string()
              .describe('Parte del nombre de una estación o ciudad, o un código de Renfe.'),
            limit: z.number().int().min(1).max(100).default(10).describe('Máximo de estaciones.'),
          }),
          annotations: READ_ONLY,
        },
        ({ query, limit }) => run(() => findStations(query, limit)),
      );
      server.registerTool(
        'search_trains',
        {
          title: 'Buscar trenes',
          description:
            'Trenes entre dos estaciones en una fecha: salida y llegada, duración, transbordos, tipo de tren y precios para un adulto. Para hoy, también el retraso en directo de cada tren. Incluye un enlace para comprar.',
          inputSchema: z.object({
            origin: z.string().describe('Origen: nombre (Madrid, Atocha) o código (MADRI, 60000).'),
            destination: z.string().describe('Destino: nombre o código de estación.'),
            date: z
              .string()
              .default('today')
              .describe('Fecha del viaje: AAAA-MM-DD, today o tomorrow (hora de Madrid).'),
            after: z
              .string()
              .optional()
              .describe(
                'Solo trenes que salen a partir de HH:MM, hora local. Hoy, por defecto, desde ahora.',
              ),
            arrive_by: z
              .string()
              .optional()
              .describe(
                'Solo trenes que llegan antes de HH:MM en la fecha del viaje, hora de Madrid.',
              ),
            include_fares: z
              .boolean()
              .default(true)
              .describe(
                'Incluir precios para un adulto (una petición más a Renfe por cada 3 trenes).',
              ),
            limit: z
              .number()
              .int()
              .min(1)
              .max(50)
              .default(10)
              .describe('Máximo de trenes, por hora de salida.'),
          }),
          annotations: READ_ONLY,
        },
        (args) => run(() => searchTrains(args)),
      );
      server.registerTool(
        'train_status',
        {
          title: 'Estado de un tren',
          description:
            'Retraso en directo de un tren que circula, su próxima estación y la llegada prevista a ella (larga y media distancia).',
          inputSchema: z.object({
            train: z
              .string()
              .describe('Número de tren como en el billete o el mapa, por ejemplo 03081.'),
          }),
          annotations: READ_ONLY,
        },
        ({ train }) => run(() => trainStatus(train)),
      );
      server.registerTool(
        'list_delays',
        {
          title: 'Trenes con retraso',
          description:
            'Todos los trenes con retraso ahora en el mapa en directo de Renfe, con sus horas previstas de salida y llegada y los números de tren de cada tramo.',
          inputSchema: z.object({
            train: z
              .string()
              .optional()
              .describe(
                'Solo este tren: su número en directo o uno de billete verificado. Sin él, todos.',
              ),
          }),
          annotations: READ_ONLY,
        },
        ({ train }) => run(() => listDelays(train)),
      );
      return server;
    },
    { responseMode: 'json' },
  );
}
