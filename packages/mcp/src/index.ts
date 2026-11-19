import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

/**
 * Responde como `/api/congreso/<path>?<query>`. Quien monta el servidor decide cómo: la web llama
 * a su propia ruta en el mismo proceso, así la validación, la veda de encuestas y la caché de
 * consultas siguen en un solo sitio.
 */
export type CongresoApi = (path: string[], query: URLSearchParams) => Promise<Response>;

const SOURCE =
  'Fuente: Escaño Abierto vía reforma-digital.es, licencia CC BY 4.0 (encuestas, CC BY-SA 4.0). Cítala al usar los datos.';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const legislatura = z
  .string()
  .regex(/^[IVX]+$/)
  .optional()
  .describe('Legislatura en números romanos. Por defecto, la actual (XV).');
const list = {
  q: z.string().max(200).optional(),
  legislatura,
  desde: z.iso.date().optional().describe('Fecha mínima, AAAA-MM-DD.'),
  hasta: z.iso.date().optional().describe('Fecha máxima, AAAA-MM-DD.'),
  pagina: z.number().int().min(1).optional().describe('Página, empezando por 1.'),
  limite: z.number().int().min(1).max(100).optional().describe('Resultados por página (24).'),
};

export function createCongresoMcp(api: CongresoApi) {
  async function call(path: string[], params: Record<string, string | number | undefined> = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (value !== undefined) query.set(key, String(value));
    const response = await api(path, query);
    return {
      content: [
        { type: 'text' as const, text: await response.text() },
        { type: 'text' as const, text: SOURCE },
      ],
      isError: !response.ok,
    };
  }

  return createMcpHandler(
    () => {
      const server = new McpServer(
        { name: 'reforma-digital-congreso', title: 'Congreso de los Diputados', version: '0.1.0' },
        {
          instructions:
            'Datos abiertos del Congreso de los Diputados: votaciones del Pleno con el voto de cada diputado, preguntas parlamentarias y Diarios de Sesiones. Las búsquedas filtran por título y devuelven páginas; usa los identificadores de los resultados para pedir el detalle. Un error 451 significa que las encuestas están ocultas por la veda electoral. ' +
            SOURCE,
        },
      );

      server.registerTool(
        'indice_congreso',
        {
          title: 'Índice de datos',
          description:
            'Última publicación de los datos, conjuntos disponibles (por ejemplo leyes.json) y atribución.',
          annotations: READ_ONLY,
        },
        () => call([]),
      );
      server.registerTool(
        'buscar_votaciones',
        {
          title: 'Buscar votaciones',
          description:
            'Votaciones del Pleno, de la más reciente a la más antigua, con el recuento de votos. `q` filtra por el título (por ejemplo «vivienda»).',
          inputSchema: z.object(list),
          annotations: READ_ONLY,
        },
        (args) => call(['votaciones'], args),
      );
      server.registerTool(
        'ver_votacion',
        {
          title: 'Ver una votación',
          description: 'Una votación con el voto de cada diputado y su grupo parlamentario.',
          inputSchema: z.object({ id: z.string().max(80), legislatura }),
          annotations: READ_ONLY,
        },
        ({ id, legislatura }) => call(['votaciones', id], { legislatura }),
      );
      server.registerTool(
        'buscar_preguntas',
        {
          title: 'Buscar preguntas',
          description:
            'Preguntas parlamentarias, de la más reciente a la más antigua. `q` filtra por el título.',
          inputSchema: z.object({ ...list, estado: z.string().max(50).optional() }),
          annotations: READ_ONLY,
        },
        (args) => call(['preguntas'], args),
      );
      server.registerTool(
        'buscar_sesiones',
        {
          title: 'Buscar sesiones',
          description:
            'Diarios de Sesiones, del más reciente al más antiguo, con su número de intervenciones. `q` filtra por el órgano (por ejemplo «Pleno»).',
          inputSchema: z.object(list),
          annotations: READ_ONLY,
        },
        (args) => call(['sesiones'], args),
      );
      server.registerTool(
        'ver_sesion',
        {
          title: 'Ver una sesión',
          description: 'Un Diario de Sesiones completo, con todas sus intervenciones.',
          inputSchema: z.object({
            id: z.string().describe('Identificador como DSCD-15-PL-123.'),
            legislatura,
          }),
          annotations: READ_ONLY,
        },
        ({ id, legislatura }) => call(['sesiones', id], { legislatura }),
      );
      server.registerTool(
        'ver_conjunto',
        {
          title: 'Ver un conjunto de datos',
          description:
            'Un conjunto JSON del índice por su ruta, por ejemplo leyes.json. Las encuestas pueden estar ocultas por la veda.',
          inputSchema: z.object({ ruta: z.string().max(160) }),
          annotations: READ_ONLY,
        },
        ({ ruta }) => call(['datasets', ...ruta.split('/')]),
      );
      return server;
    },
    // Sin notificaciones a mitad de llamada: cada respuesta es un JSON, como la API.
    { responseMode: 'json' },
  );
}
