// Servidor MCP del BOE: el sumario de cada día y la legislación consolidada, de la API de datos
// abiertos del BOE (https://www.boe.es/datosabiertos/), sin clave.
import { z } from 'zod';
import {
  decode,
  get,
  list,
  READ_ONLY_EXTERNAL,
  run,
  server,
  SourceError,
  type Fetch,
} from './comun';

const API = 'https://www.boe.es/datosabiertos/api';
const SOURCE =
  'Fuente: Agencia Estatal Boletín Oficial del Estado (boe.es), datos abiertos. El texto con valor jurídico es el publicado en el BOE.';

const INSTRUCTIONS = `El Boletín Oficial del Estado: lo que se publica cada día y el texto vigente de las leyes y reales decretos.
- sumario_boe lista las disposiciones de un día; filtra por sección o por palabras del título.
- Para saber qué dice una norma: buscar_legislacion (por palabras del título), indice_norma (sus artículos y disposiciones) y ver_bloque (el texto vigente de uno).
- La legislación consolidada incluye normas autonómicas, entre ellas las leyes forales de Navarra. La mayoría llevan identificador BOE-A-…; algunas, el de su boletín (BON-n-…, DOGC-f-…). Las normas forales de Álava, Bizkaia y Gipuzkoa no están.
- Las fechas son AAAA-MM-DD. Cita siempre el identificador (BOE-A-…, BON-n-…) y el enlace.
${SOURCE}`;

type Item = { identificador: string; titulo: string; url_html?: string };
type Grupo = { nombre: string; item?: Item | Item[]; epigrafe?: Grupo | Grupo[] };
type Seccion = { codigo: string; nombre: string; departamento?: Grupo | Grupo[] };

export async function sumario(fetchImpl: Fetch, fecha: string, seccion?: string, q?: string) {
  const day = fecha.replaceAll('-', '');
  const response = await fetchImpl(`${API}/boe/sumario/${day}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => {
    throw new SourceError('El BOE no responde. Prueba más tarde.');
  });
  // Los domingos y festivos no hay BOE: la API responde 404.
  if (response.status === 404) return { fecha, disposiciones: [], nota: 'No hay BOE ese día.' };
  if (!response.ok) throw new SourceError(`El BOE respondió ${response.status}.`);
  const body = (await response.json()) as {
    data: { sumario: { diario: { numero: string; seccion: Seccion | Seccion[] }[] } };
  };
  const words = (q ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.normalize('NFD').replace(/\p{M}/gu, ''));
  const disposiciones = body.data.sumario.diario.flatMap((diario) =>
    list(diario.seccion)
      .filter((s) => !seccion || s.codigo.toLowerCase() === seccion.toLowerCase())
      .flatMap((s) =>
        list(s.departamento).flatMap((d) => {
          const items = (grupo: Grupo, epigrafe?: string): object[] => [
            ...list(grupo.item).map((item) => ({
              id: item.identificador,
              titulo: item.titulo,
              seccion: s.nombre,
              departamento: d.nombre,
              epigrafe,
              url: item.url_html,
            })),
            ...list(grupo.epigrafe).flatMap((e) => items(e, e.nombre)),
          ];
          return items(d);
        }),
      )
      .filter((item) => {
        const titulo = (item as { titulo: string }).titulo
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '');
        return words.every((w) => titulo.includes(w));
      }),
  );
  return { fecha, numero: body.data.sumario.diario[0]?.numero, disposiciones };
}

// Caracteres especiales de la sintaxis de búsqueda (query_string) que hay que escapar.
const escape = (word: string) => word.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');

export async function buscarLegislacion(
  fetchImpl: Fetch,
  q: string,
  pagina: number,
  limite: number,
) {
  const words = q.split(/\s+/).filter(Boolean).map(escape);
  const query = {
    query: { query_string: { query: words.map((w) => `titulo:${w}`).join(' AND ') } },
  };
  const url = `${API}/legislacion-consolidada?${new URLSearchParams({
    query: JSON.stringify(query),
    offset: String((pagina - 1) * limite),
    limit: String(limite),
  })}`;
  // Sin resultados, la API responde `"data": ""` en vez de una lista vacía.
  const body = (await (await get(fetchImpl, url)).json()) as {
    data?:
      | {
          identificador: string;
          titulo: string;
          rango: { texto: string };
          ambito: { texto: string };
          departamento: { texto: string };
          fecha_disposicion: string;
          vigencia_agotada: string;
          estado_consolidacion: { texto: string };
          url_html_consolidada: string;
        }[]
      | '';
  };
  return {
    pagina,
    resultados: (body.data || []).map((n) => ({
      id: n.identificador,
      titulo: n.titulo,
      rango: n.rango.texto,
      ambito: n.ambito.texto,
      departamento: n.departamento.texto,
      fecha: n.fecha_disposicion.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      vigente: n.vigencia_agotada !== 'S',
      consolidacion: n.estado_consolidacion.texto,
      url: n.url_html_consolidada,
    })),
  };
}

// Algunas normas autonómicas llevan el prefijo de su boletín (BON-n, DOGC-f, BOJA-b…), y
// buscar_legislacion las devuelve así.
const norma = z
  .string()
  .regex(/^[A-Z]{2,5}-[A-Za-z]-\d{4}-\d+$/)
  .describe('Identificador de la norma, como BOE-A-2023-12203 o BON-n-2008-90013.');

const notFound = (error: unknown) => error instanceof SourceError && error.status === 404;

async function metadatos(fetchImpl: Fetch, id: string) {
  try {
    return await (await get(fetchImpl, `${API}/legislacion-consolidada/id/${id}/metadatos`)).json();
  } catch (error) {
    // Hay disposiciones del BOE que no se consolidan (nombramientos, condecoraciones…): que el id
    // no esté aquí no prueba que no exista, y buscar_legislacion tampoco las encuentra.
    if (notFound(error))
      throw new SourceError(
        `${id} no está en la legislación consolidada del BOE: el identificador no existe o es de una disposición que no se consolida. Busca la norma consolidada por su título con buscar_legislacion. El texto publicado de cualquier disposición del BOE está en https://www.boe.es/buscar/doc.php?id=${id}.`,
      );
    throw error;
  }
}

export async function indiceNorma(fetchImpl: Fetch, id: string) {
  const pedido = metadatos(fetchImpl, id);
  const [meta, indice] = await Promise.all([
    pedido,
    // Si falla también el índice, manda el error de los metadatos, que es el que se entiende.
    get(fetchImpl, `${API}/legislacion-consolidada/id/${id}/texto/indice`)
      .then((r) => r.json())
      .catch(async (error: unknown) => {
        await pedido;
        throw error;
      }),
  ]);
  const m = (meta as { data: { titulo: string; url_html_consolidada: string }[] }).data[0];
  const bloques = (indice as { data: { bloque: { id: string; titulo: string }[] }[] }).data[0]
    ?.bloque;
  return {
    id,
    titulo: m?.titulo,
    url: m?.url_html_consolidada,
    bloques: (bloques ?? []).map(({ id, titulo }) => ({ id, titulo })),
  };
}

/** El texto vigente de un bloque: la última de sus versiones, un párrafo por línea. */
export function textoBloque(xml: string) {
  const versions = [...xml.matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)];
  const last = versions.at(-1);
  if (!last) return undefined;
  const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(last[1] ?? '')?.[1];
  const parrafos = [...(last[2] ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map((p) => decode((p[1] ?? '').replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean);
  return {
    vigente_desde: attr('fecha_vigencia')?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
    texto: parrafos.join('\n'),
  };
}

export async function verBloque(fetchImpl: Fetch, id: string, bloque: string) {
  let response: Response;
  try {
    response = await get(
      fetchImpl,
      `${API}/legislacion-consolidada/id/${id}/texto/bloque/${bloque}`,
      'application/xml',
    );
  } catch (error) {
    if (!notFound(error)) throw error;
    // El 404 es el mismo si falta la norma o si falta el bloque: los metadatos lo distinguen.
    await metadatos(fetchImpl, id);
    throw new SourceError(
      `La norma ${id} no tiene el bloque ${bloque}. Consulta los ids de sus bloques con indice_norma.`,
    );
  }
  const xml = await response.text();
  const texto = textoBloque(xml);
  if (!texto) throw new SourceError('Ese bloque no tiene texto. Revisa el índice de la norma.');
  return { id, bloque, ...texto };
}

export function createBoeMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-boe', title: 'BOE' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'sumario_boe',
      {
        title: 'Sumario del BOE',
        description:
          'Las disposiciones publicadas en el BOE de un día: identificador, título, sección, departamento y enlace.',
        inputSchema: z.object({
          fecha: z.iso.date().describe('Día del BOE, AAAA-MM-DD.'),
          seccion: z
            .enum(['1', '2A', '2B', '3', '4', '5A', '5B', '5C', 'T'])
            .optional()
            .describe(
              'Sección: 1 disposiciones generales, 2A nombramientos, 2B oposiciones, 3 otras disposiciones, 4 justicia, 5 anuncios, T Tribunal Constitucional.',
            ),
          q: z.string().max(200).optional().describe('Palabras que deben aparecer en el título.'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ fecha, seccion, q }) => run(SOURCE, () => sumario(fetchImpl, fecha, seccion, q)),
    );
    s.registerTool(
      'buscar_legislacion',
      {
        title: 'Buscar legislación',
        description:
          'Leyes, reales decretos y otras normas consolidadas cuyo título contiene todas las palabras de `q`, con su estado de vigencia.',
        inputSchema: z.object({
          q: z.string().min(2).max(200).describe('Palabras del título, como «vivienda».'),
          pagina: z.number().int().min(1).default(1),
          limite: z.number().int().min(1).max(50).default(10),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ q, pagina, limite }) => run(SOURCE, () => buscarLegislacion(fetchImpl, q, pagina, limite)),
    );
    s.registerTool(
      'indice_norma',
      {
        title: 'Índice de una norma',
        description:
          'El título de una norma consolidada y la lista de sus bloques (preámbulo, títulos, artículos, disposiciones), con el id de cada uno.',
        inputSchema: z.object({ id: norma }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ id }) => run(SOURCE, () => indiceNorma(fetchImpl, id)),
    );
    s.registerTool(
      'ver_bloque',
      {
        title: 'Ver un artículo',
        description:
          'El texto vigente de un bloque de una norma consolidada (un artículo, una disposición o el preámbulo), según el índice.',
        inputSchema: z.object({
          id: norma,
          bloque: z
            .string()
            .regex(/^[\w-]+$/)
            .max(40)
            .describe('Id del bloque en el índice, como a3 (artículo 3) o pr (preámbulo).'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ id, bloque }) => run(SOURCE, () => verBloque(fetchImpl, id, bloque)),
    );
  });
}
