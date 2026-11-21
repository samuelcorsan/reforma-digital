import { POST as congreso } from '../../app/mcp/congreso/route';
import { POST as renfe } from '../../app/mcp/renfe/route';
import type { StaticImageData } from 'next/image';
import type { Category } from './categorias';
import congresoEscena from './escenas/congreso.png';
import renfeEscena from './escenas/renfe.png';

/** Lo que el servidor no sabe de sí mismo; las herramientas se le preguntan a él (`servers()`). */
export type Servidor = {
  id: string;
  name: string;
  category: Category;
  summary: string;
  /** Imagen de `public/`. */
  logo: { src: string };
  /** Un asistente usando el servidor. Es una imagen, no código: los datos son ilustrativos. */
  escena: StaticImageData;
  examples: string[];
};

const servidores: Servidor[] = [
  {
    id: 'congreso',
    name: 'Congreso de los Diputados',
    category: 'parlamento',
    // El hemiciclo de la portada, como un sol que sale.
    logo: { src: '/congreso/hemiciclo.svg' },
    escena: congresoEscena,
    summary:
      'Votaciones del Pleno con el voto de cada diputado, preguntas parlamentarias y Diarios de Sesiones.',
    examples: [
      '¿Qué votó cada grupo en la última votación sobre vivienda?',
      'Busca las preguntas parlamentarias sobre sanidad de este año.',
      'Resume el último Diario de Sesiones del Pleno.',
    ],
  },
  {
    id: 'renfe',
    name: 'RENFE',
    category: 'transporte',
    logo: { src: '/organismos/renfe.png' },
    escena: renfeEscena,
    summary:
      'Estaciones, horarios y precios de los trenes de Renfe, el estado de un tren en directo y los retrasos.',
    examples: [
      '¿Qué trenes hay mañana de Madrid a Valencia por la mañana y cuánto cuestan?',
      '¿Va con retraso el AVE 3071?',
      '¿Qué trenes llevan ahora más de 15 minutos de retraso?',
    ],
  },
];

export type Param = {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  default?: string;
};
export type Tool = {
  name: string;
  title: string;
  description: string;
  params: Param[];
};
export type McpServer = Servidor & { tools: Tool[] };

type Entry = Servidor & { handler: (request: Request) => Promise<Response> };

// Las herramientas se le piden al propio servidor (`servers()`), así la ficha no puede quedarse atrás.
const handlers: Record<string, Entry['handler']> = { congreso, renfe };
const entries: Entry[] = servidores.map((s) => {
  const handler = handlers[s.id];
  if (!handler) throw new Error(`Falta el handler del servidor MCP ${s.id}`);
  return { ...s, handler };
});

/** Ids de los servidores reales, para el sitemap y las rutas estáticas. */
export const serverIds = entries.map(({ id }) => id);

// Llamada JSON-RPC al handler en el mismo proceso: no sale a internet ni toca la base de datos.
async function rpc(handler: Entry['handler'], method: string) {
  const response = await handler(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method }),
    }),
  );
  const text = await response.text();
  // Sin sesión el SDK puede responder como evento SSE: el JSON va en la línea `data:`.
  const body = JSON.parse(/^data: (.*)$/m.exec(text)?.[1] ?? text) as {
    result?: unknown;
    error?: { message: string };
  };
  if (!response.ok || !body.result) throw new Error(`MCP ${method}: ${body.error?.message}`);
  return body.result;
}

type JsonSchema = {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
};

const typeNames: Record<string, string> = {
  string: 'texto',
  integer: 'entero',
  number: 'número',
  boolean: 'sí/no',
  array: 'lista',
  object: 'objeto',
};

function params(schema: JsonSchema | undefined): Param[] {
  return Object.entries(schema?.properties ?? {}).map(([name, prop]) => ({
    name,
    type: prop.enum
      ? prop.enum.join(' | ')
      : prop.format === 'date'
        ? 'fecha'
        : (typeNames[prop.type ?? ''] ?? prop.type ?? '—'),
    description: prop.description,
    required: schema?.required?.includes(name) ?? false,
    default: prop.default === undefined ? undefined : JSON.stringify(prop.default),
  }));
}

async function inspect({ handler, ...entry }: Entry): Promise<McpServer> {
  const { tools } = (await rpc(handler, 'tools/list')) as {
    tools: { name: string; title?: string; description?: string; inputSchema?: JsonSchema }[];
  };
  return {
    ...entry,
    tools: tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? tool.name,
      description: tool.description ?? '',
      params: params(tool.inputSchema),
    })),
  };
}

let loaded: Promise<McpServer[]> | undefined;

/** Servidores con sus herramientas. */
export function servers(): Promise<McpServer[]> {
  // Si falla, no se guarda el error: la próxima petición vuelve a intentarlo.
  loaded ??= Promise.all(entries.map(inspect)).catch((error: unknown) => {
    loaded = undefined;
    throw error;
  });
  return loaded;
}
