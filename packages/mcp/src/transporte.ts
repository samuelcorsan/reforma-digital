// Lo que comparten los servidores MCP de transporte con horarios en GTFS (tib.ts y los de las demás
// empresas): las cuatro herramientas sobre el feed de una empresa.
import { z } from 'zod';
import { READ_ONLY_EXTERNAL, run, server, type Fetch } from './comun';
import {
  findRoutes,
  findStops,
  indexCache,
  madrid,
  resolveDate,
  routeStops,
  stopTimes,
  type Feed,
  type Index,
} from './gtfs';

const USO = `- Busca líneas por número o nombre con find_routes, y su recorrido con route_stops.
- Busca paradas por nombre o código con find_stops y usa su id en stop_times. Una estación (tipo «estacion») junta las salidas de todos sus andenes, y un nombre las de todas las paradas que lo llevan (cada salida dice su andén).
- stop_times da las salidas en las que se puede subir, de hoy y desde ahora si no indicas fecha ni hora. Fechas AAAA-MM-DD, today o tomorrow, en hora de Madrid. Sus avisos dicen lo que el operador advierte de cada línea, como los cierres.
- Son horarios programados: no incluyen retrasos ni incidencias en tiempo real. Las salidas que pasan de medianoche llevan diaSiguiente, y las que el operador no publica a esa hora exacta (calculadas por distancia o «cada N minutos») llevan estimada.`;

const query = z.string().trim().min(1).max(120);
const limit = (n: number) => z.number().int().min(1).max(100).default(n);

export function transporteMcp(opts: {
  info: { name: string; title: string };
  /** Qué cubre el servidor y lo propio del operador; el uso de las herramientas va detrás. */
  about: string;
  feed: Feed;
  /** Cómo se piden sus líneas y sus paradas, para las descripciones: «204», «Port de Sóller». */
  examples: { line: string; name: string };
  fetchImpl: Fetch;
}) {
  const { feed, examples } = opts;
  const cache = indexCache(opts.fetchImpl);
  const use = (answer: (index: Index) => object) =>
    run(feed.source, async () => answer(await cache(feed)));
  return server(opts.info, `${opts.about}\n${USO}\n${feed.source}`, (s) => {
    s.registerTool(
      'find_routes',
      {
        title: 'Buscar líneas',
        description: 'Líneas por número o nombre, la mejor primero. Sin consulta, todas.',
        inputSchema: z.object({
          query: query
            .optional()
            .describe(`Número (${examples.line}) o parte del nombre (${examples.name}).`),
          limit: limit(10),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      (a) => use((index) => findRoutes(index, a.query, a.limit)),
    );
    s.registerTool(
      'find_stops',
      {
        title: 'Buscar paradas',
        description:
          'Paradas y estaciones por nombre o código, la mejor primero, con el id para stop_times.',
        inputSchema: z.object({
          query: query.describe('Parte del nombre o el código.'),
          limit: limit(10),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      (a) => use((index) => findStops(index, a.query, a.limit)),
    );
    s.registerTool(
      'route_stops',
      {
        title: 'Recorrido de una línea',
        description:
          'Las paradas de una línea en orden, un recorrido por cabecera (destino), y el número de viajes.',
        inputSchema: z.object({
          route: query.describe(`Número de línea (${examples.line}) o id de find_routes.`),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      (a) => use((index) => routeStops(index, a.route)),
    );
    s.registerTool(
      'stop_times',
      {
        title: 'Salidas de una parada',
        description:
          'Salidas programadas de una parada o estación en una fecha, en las que se puede subir: hora, línea y cabecera. Sin fecha ni hora, las de hoy desde ahora. No es tiempo real.',
        inputSchema: z.object({
          stop: query.describe('Id, código o nombre de la parada (de find_stops).'),
          date: z
            .string()
            .default('today')
            .describe('AAAA-MM-DD, today o tomorrow (hora de Madrid).'),
          route: query.optional().describe('Solo esta línea, por número o id.'),
          after: z
            .string()
            .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
            .optional()
            .describe('Solo salidas desde esta hora, HH:MM.'),
          limit: limit(20),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      (a) =>
        use((index) => {
          // Un solo instante: a medianoche, dos lecturas del reloj podrían caer en días distintos.
          const instant = Date.now();
          const now = madrid(instant);
          const date = resolveDate(a.date, instant);
          const [h = 0, m = 0] = a.after === undefined ? [] : a.after.split(':').map(Number);
          const after =
            a.after !== undefined ? h * 3600 + m * 60 : date === now.date ? now.seconds : undefined;
          return stopTimes(index, a.stop, { date, route: a.route, after, limit: a.limit });
        }),
    );
  });
}
