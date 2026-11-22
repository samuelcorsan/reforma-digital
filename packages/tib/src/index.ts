// Servidor MCP de TIB (Transports de les Illes Balears / Consorci de Transports de Mallorca):
// líneas de bus, tren y metro, paradas y horarios. Usa el GTFS abierto de TIB (CC BY 4.0), que se
// descarga una vez por proceso y se indexa en memoria. Horarios programados, no tiempo real.

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { UsageError, SourceError } from './errors';
import { loadGtfs, type Fetch, type Index } from './gtfs';
import { findRoutes, findStops, routeStops, stopTimes, parseTime, resolveDate, madridDate, madridTime } from './tools';

const SOURCE =
  'Fuente: Consorci de Transports de Mallorca (TIB), GTFS abierto, licencia CC BY 4.0.';

const INSTRUCTIONS = `Transporte público de Mallorca (TIB): líneas de bus, tren y metro, sus paradas y los horarios.
${SOURCE}

- Busca líneas por número («204», «T1») o nombre («Port de Sóller») con find_routes.
- Busca paradas por nombre («Palma», «Inca») o código con find_stops; usa su id en stop_times.
- Para ver el recorrido de una línea usa route_stops con su número o id.
- Para saber cuándo sale, usa stop_times con la parada (id, código o nombre) y, si quieres, filtra por línea y hora.
- Las fechas son AAAA-MM-DD, «today» o «tomorrow», en hora de Madrid. Por defecto, hoy.
- Los horarios son los publicados en el GTFS: pueden cambiar y no incluyen retrasos en tiempo real.`;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

type ToolOutput =
  | ReturnType<typeof findRoutes>
  | ReturnType<typeof findStops>
  | ReturnType<typeof routeStops>
  | ReturnType<typeof stopTimes>;

async function run(produce: () => Promise<ToolOutput>) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(await produce(), null, 2) }] };
  } catch (err) {
    const body =
      err instanceof UsageError || err instanceof SourceError
        ? { tipo: err instanceof UsageError ? 'uso' : 'fuente', mensaje: err.message }
        : {
            tipo: 'interno',
            mensaje: `error interno: ${err instanceof Error ? err.name : 'Error'}`,
          };
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], isError: true };
  }
}

// El GTFS es estático (cambia con los horarios): se pide una vez por proceso, como el resto de
// catálogos del proyecto.
let loaded: Promise<Index> | undefined;
function gtfs(fetchImpl: Fetch): Promise<Index> {
  loaded ??= loadGtfs(fetchImpl).catch((error: unknown) => {
    loaded = undefined;
    throw error;
  });
  return loaded;
}

export function createTibMcp(fetchImpl: Fetch = fetch) {
  return createMcpHandler(
    () => {
      const server = new McpServer(
        { name: 'reforma-digital-tib', title: 'TIB · Transport de les Illes Balears', version: '0.1.0' },
        { instructions: INSTRUCTIONS },
      );

      server.registerTool(
        'find_routes',
        {
          title: 'Buscar líneas',
          description:
            'Líneas de bus, tren y metro de TIB (Mallorca) que coinciden con un número o nombre, la mejor primero. Sin consulta, lista todas.',
          inputSchema: z.object({
            query: z
              .string()
              .optional()
              .describe('Número («204», «T1») o parte del nombre («Port de Sóller»).'),
            limit: z.number().int().min(1).max(100).default(10).describe('Máximo de líneas.'),
          }),
          annotations: READ_ONLY,
        },
        ({ query, limit }) => run(async () => findRoutes(await gtfs(fetchImpl), query, limit)),
      );

      server.registerTool(
        'find_stops',
        {
          title: 'Buscar paradas',
          description:
            'Paradas de TIB que coinciden con un nombre o código, la mejor primero, con su id para usar en stop_times.',
          inputSchema: z.object({
            query: z.string().min(1).max(120).describe('Parte del nombre o código de una parada.'),
            limit: z.number().int().min(1).max(100).default(10).describe('Máximo de paradas.'),
          }),
          annotations: READ_ONLY,
        },
        ({ query, limit }) => run(async () => findStops(await gtfs(fetchImpl), query, limit)),
      );

      server.registerTool(
        'route_stops',
        {
          title: 'Paradas de una línea',
          description:
            'Las paradas de una línea en orden, por sentido (ida y vuelta), con la cabecera de cada sentido y el número de viajes.',
          inputSchema: z.object({
            route: z.string().min(1).describe('Número de línea («204») o id de find_routes.'),
          }),
          annotations: READ_ONLY,
        },
        ({ route }) => run(async () => routeStops(await gtfs(fetchImpl), route)),
      );

      server.registerTool(
        'stop_times',
        {
          title: 'Salidas de una parada',
          description:
            'Salidas programadas de una parada en una fecha: línea, cabecera y hora. Hoy, por defecto, desde ahora. Horarios GTFS, no tiempo real.',
          inputSchema: z.object({
            stop: z.string().min(1).describe('Parada: id, código o nombre (de find_stops).'),
            date: z
              .string()
              .default('today')
              .describe('Fecha: AAAA-MM-DD, today o tomorrow (hora de Madrid).'),
            route: z
              .string()
              .optional()
              .describe('Solo esta línea, por su número («204») o id.'),
            after: z.string().optional().describe('Solo salidas a partir de HH:MM, hora local.'),
            limit: z.number().int().min(1).max(100).default(20).describe('Máximo de salidas.'),
          }),
          annotations: READ_ONLY,
        },
        ({ stop, date, route, after, limit }) =>
          run(async () => {
            const index = await gtfs(fetchImpl);
            const day = resolveDate(date);
            const afterSec =
              after !== undefined
                ? parseTime(after)
                : day === madridDate()
                  ? parseTime(madridTime())
                  : undefined;
            return stopTimes(index, stop, { date: day, route, after: afterSec, limit });
          }),
      );

      return server;
    },
    { responseMode: 'json' },
  );
}
