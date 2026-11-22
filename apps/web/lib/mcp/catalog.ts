import { POST as congreso } from '../../app/mcp/congreso/route';
import { POST as renfe } from '../../app/mcp/renfe/route';
import { POST as boe } from '../../app/mcp/boe/route';
import { POST as carburantes } from '../../app/mcp/carburantes/route';
import { POST as ine } from '../../app/mcp/ine/route';
import { POST as tib } from '../../app/mcp/tib/route';
import type { StaticImageData } from 'next/image';
import type { Category } from './categorias';
import congresoEscena from './escenas/congreso.png';
import renfeEscena from './escenas/renfe.png';
import boeEscena from './escenas/boe.png';
import carburantesEscena from './escenas/carburantes.png';
import ineEscena from './escenas/ine.png';
import tibEscena from './escenas/tib.png';

/** Lo que el servidor no sabe de sí mismo; las herramientas se le preguntan a él (`servers()`). */
type Servidor = {
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
  {
    id: 'tib',
    name: 'TIB',
    category: 'transporte',
    logo: { src: '/organismos/tib.svg' },
    escena: tibEscena,
    summary:
      'Líneas, paradas y horarios del transporte público de Mallorca (bus, tren y metro de TIB), del GTFS abierto del Consorci de Transports de Mallorca.',
    examples: [
      '¿A qué hora sale el próximo bus de Port de Sóller a Palma?',
      '¿Qué paradas tiene la línea 204?',
      '¿Qué líneas pasan por Inca?',
    ],
  },
  {
    id: 'boe',
    name: 'BOE',
    category: 'normativa',
    logo: { src: '/organismos/boe-sello.png' },
    escena: boeEscena,
    summary:
      'El sumario de cada día y el texto vigente de leyes, reales decretos y demás normas consolidadas.',
    examples: [
      '¿Qué es un gran tenedor según la Ley de Vivienda?',
      '¿Qué se ha publicado hoy en el BOE sobre becas?',
      '¿Hay oposiciones nuevas en el BOE de hoy?',
    ],
  },
  {
    id: 'ine',
    name: 'INE',
    category: 'estadistica',
    logo: { src: '/organismos/ine.svg' },
    escena: ineEscena,
    summary:
      'Las estadísticas oficiales del INE: precios, empleo, población, vivienda y economía, con su último dato.',
    examples: [
      '¿Cuál es la última tasa de inflación?',
      '¿Cómo ha evolucionado el paro este año?',
      '¿Cuánto han subido los precios de la vivienda?',
    ],
  },
  {
    id: 'carburantes',
    name: 'Precios de carburantes',
    category: 'consumo',
    // Sin logo propio: un surtidor (Lucide).
    logo: { src: '/mcp/carburantes.svg' },
    escena: carburantesEscena,
    summary:
      'El precio de cada carburante en cada gasolinera de España, actualizado varias veces al día.',
    examples: [
      '¿Dónde está el diésel más barato en Madrid?',
      '¿Qué gasolinera de mi provincia tiene la gasolina 95 más barata?',
      '¿Cuánto cuesta el GLP en Zaragoza?',
    ],
  },
];

type Param = {
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
const handlers: Record<string, Entry['handler']> = { congreso, renfe, boe, ine, carburantes, tib };
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
