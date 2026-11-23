// Servidor MCP de Open Data BCN, el portal de datos abiertos del Ajuntament de Barcelona: su API
// CKAN (https://opendata-ajuntament.barcelona.cat/data/api/3/action), sin clave. Cada conjunto
// tiene recursos (ficheros); los que están en el datastore se pueden consultar fila a fila.
import { z } from 'zod';
import { fold, READ_ONLY_EXTERNAL, run, server, SourceError, words, type Fetch } from './comun';

const API = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action';
const SOURCE =
  'Fuente: Open Data BCN, Ajuntament de Barcelona (opendata-ajuntament.barcelona.cat). Cita el conjunto y su licencia al usar los datos.';
const MAX_RECURSOS = 20;

const INSTRUCTIONS = `Los datos abiertos del Ajuntament de Barcelona: población, vivienda, movilidad, medio ambiente, equipamientos, accidentes, presupuestos y más, por barrio y distrito.
- Busca el conjunto con buscar_conjunto, mira sus recursos consultables con ver_conjunto y pide las filas de uno con consultar_datos.
- Los nombres de los campos y muchos valores están en catalán. Pide antes las filas con limite 0 para ver los campos.
- El periodo de los datos suele estar en el nombre del recurso (2025_accidents…, 2026_03_Marc…); «creado» es cuándo se publicó, y «metadatos_actualizados» no dice nada de los datos. Un conjunto que dice actualizarse cada hora puede tener su último recurso consultable de hace meses: da siempre el periodo del recurso con el dato.
- Un conjunto con frecuencia «serie_interrompuda» ya no se actualiza: dilo al dar sus datos.
- Al ordenar con «desc», las filas sin valor (null) salen primero: para los mayores valores, filtra o cuenta en vez de fiarte de las primeras filas.
${SOURCE}`;

type Translated = { es?: string; ca?: string };
type Resource = {
  id: string;
  name: string;
  format: string;
  created: string;
  datastore_active: boolean;
  token_required?: string;
};
type Package = {
  name: string;
  title: string;
  title_translated?: Translated;
  notes_translated?: Translated;
  metadata_modified: string;
  frequency?: string;
  license_title?: string;
  fuente?: string;
  token_required?: string;
  tags?: { name: string }[];
  organization?: { title: string };
  resources: Resource[];
};

// El portal rechaza con 503 las peticiones simultáneas (de cinco a la vez, tres o cuatro), y los
// asistentes llaman a las herramientas en paralelo: cada petición espera a que acabe la anterior.
let previous: Promise<unknown> = Promise.resolve();
function ckan<T>(fetchImpl: Fetch, action: string, params: Record<string, string>) {
  const request = () => ckanNow<T>(fetchImpl, action, params);
  // Tras un fallo, la siguiente sale igual: el error lo recibe quien hizo esa petición.
  const current = previous.then(request, request);
  previous = current;
  return current;
}

/**
 * Una acción de CKAN. Sus 409 dicen en JSON qué parámetro no vale («filters: invalid value "nope"»):
 * se le pasa al asistente para que corrija la llamada.
 */
async function ckanNow<T>(fetchImpl: Fetch, action: string, params: Record<string, string>) {
  let response: Response;
  try {
    // Un parámetro repetido hace que el portal responda 500: cada uno va una sola vez.
    response = await fetchImpl(`${API}/${action}?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La fuente no responde. Prueba más tarde.');
  }
  if (response.ok) return ((await response.json()) as { result: T }).result;
  if (response.status === 404)
    throw new SourceError(
      'No existe ese conjunto o recurso, o no se puede consultar fila a fila.',
      404,
    );
  if (response.status === 409) {
    const body = (await response.text()) || '{}';
    let error: Record<string, unknown> | undefined;
    try {
      ({ error } = JSON.parse(body) as { error?: Record<string, unknown> });
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
    if (!error) throw new SourceError('La fuente respondió 409.', 409);
    const why = Object.entries(error)
      .filter(([field]) => field !== '__type')
      .map(([field, value]) => `${field}: ${[value].flat().join(', ')}`)
      .join('; ');
    throw new SourceError(`Parámetro no válido: ${why}.`, 409);
  }
  throw new SourceError(`La fuente respondió ${response.status}.`, response.status);
}

const title = (p: Package) => p.title_translated?.es || p.title_translated?.ca || p.title;
const notes = (p: Package) => p.notes_translated?.es || p.notes_translated?.ca || '';
const short = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text.trim();
const queryable = (p: Package) =>
  p.token_required === 'Yes'
    ? []
    : p.resources.filter((r) => r.datastore_active && r.token_required !== 'Yes');

// Solo lo que da la búsqueda: el catálogo completo ocupa unos 13 MB.
const summary = (p: Package) => ({
  id: p.name,
  titulo: title(p),
  descripcion: short(notes(p), 300),
  frecuencia: p.frequency?.toLowerCase(),
  recursos_consultables: queryable(p).length,
  ...(p.token_required === 'Yes' && { nota: 'Solo se descarga con un token del portal.' }),
});
type Entry = {
  conjunto: ReturnType<typeof summary>;
  modified: string;
  titles: string;
  rest: string;
};
// El catálogo entero (unos 560 conjuntos) se pide una vez al día por proceso: la búsqueda del portal
// no encuentra los títulos en castellano («población» da 0) y exige todas las palabras.
let catalog: { at: number; entries: Promise<Entry[]> } | undefined;
const DAY = 24 * 60 * 60 * 1000;

const searchable = (...texts: (string | undefined)[]) =>
  ` ${fold(texts.join(' ')).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;

function loadCatalog(fetchImpl: Fetch) {
  if (catalog && Date.now() - catalog.at < DAY) return catalog.entries;
  const entries = ckan<{ count: number; results: Package[] }>(fetchImpl, 'package_search', {
    rows: '1000',
  }).then(({ count, results }) => {
    // Más conjuntos que una página: buscar sobre una parte los haría desaparecer sin aviso.
    if (results.length < count)
      throw new SourceError(
        `El catálogo tiene ${count} conjuntos y solo llegaron ${results.length}.`,
      );
    return results.map((p) => ({
      conjunto: summary(p),
      modified: p.metadata_modified,
      titles: searchable(p.title, p.title_translated?.es, p.title_translated?.ca, p.name),
      rest: searchable(
        p.notes_translated?.es,
        p.notes_translated?.ca,
        p.tags?.map((t) => t.name).join(' '),
      ),
    }));
  });
  catalog = { at: Date.now(), entries };
  entries.catch(() => {
    catalog = undefined;
  });
  return entries;
}

// «barrios» encuentra «barrio» y «barris»: se busca el principio de cada palabra.
const stem = (word: string) => (word.length > 4 ? word.replace(/(es|s)$/, '') : word);
// Sin ellas, «calidad del aire» da por buena cualquier descripción con «del».
// «barcelona» y «ciudad» están en casi todos los títulos («… de la ciudad de Barcelona»).
const STOPWORDS = new Set([
  ...['del', 'las', 'los', 'por', 'con', 'una', 'les', 'dels', 'per', 'amb'],
  ...['barcelona', 'ciudad', 'ciutat', 'city'],
]);

export async function buscarConjunto(fetchImpl: Fetch, q: string, limite: number) {
  const terms = words(q.replace(/[^\p{L}\p{N}\s]/gu, ' '))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => ` ${stem(w)}`);
  if (terms.length === 0)
    throw new SourceError(
      'Busca por el tema, como «accidentes» o «calidad del aire»: «Barcelona» o «ciudad» están en casi todos los conjuntos.',
    );
  const found = (await loadCatalog(fetchImpl))
    .map((e) => {
      const hits = terms.map((t) => (e.titles.includes(t) ? 2 : e.rest.includes(t) ? 1 : 0));
      return {
        e,
        matched: hits.filter(Boolean).length,
        score: hits.reduce<number>((a, b) => a + b, 0),
      };
    })
    .filter(({ matched }) => matched > 0)
    // Primero los que tienen más palabras de la búsqueda; luego, en el título mejor que en el texto.
    .sort(
      (a, b) =>
        b.matched - a.matched || b.score - a.score || b.e.modified.localeCompare(a.e.modified),
    );
  return {
    total: found.length,
    conjuntos: found.slice(0, limite).map(({ e }) => e.conjunto),
  };
}

const period = (r: Resource) => {
  const match = /((?:19|20)\d{2})(?:[_-](\d{2})(?!\d))?/.exec(r.name);
  return match ? `${match[1]}${match[2] ?? '00'}` : '';
};

export async function verConjunto(fetchImpl: Fetch, id: string, desde = 0) {
  const p = await ckan<Package>(fetchImpl, 'package_show', { id });
  // Las series largas tienen un recurso por año o por mes, sin orden; y la fecha de creación no es
  // la del periodo (un fichero de 2012 subido en 2026). El periodo va en el nombre: 2026_03_Marc….
  const recursos = queryable(p).sort(
    (a, b) => period(b).localeCompare(period(a)) || b.created.localeCompare(a.created),
  );
  return {
    id: p.name,
    titulo: title(p),
    descripcion: short(notes(p), 1500),
    organizacion: p.organization?.title,
    fuente: p.fuente,
    licencia: p.license_title,
    frecuencia: p.frequency?.toLowerCase(),
    metadatos_actualizados: p.metadata_modified.slice(0, 10),
    recursos_consultables: recursos.length,
    recursos: recursos.slice(desde, desde + MAX_RECURSOS).map((r) => ({
      id: r.id,
      nombre: r.name,
      formato: r.format,
      creado: r.created.slice(0, 10),
    })),
    ...(recursos.length === 0 && {
      nota:
        p.token_required === 'Yes'
          ? 'Este conjunto solo se descarga con un token del portal: no se puede consultar aquí.'
          : 'Este conjunto no tiene recursos consultables fila a fila; se descarga desde el portal.',
    }),
  };
}

export async function consultarDatos(
  fetchImpl: Fetch,
  args: {
    recurso: string;
    filtros?: Record<string, string | number | (string | number)[]>;
    q?: string;
    campos?: string[];
    orden?: string;
    limite: number;
    desde: number;
  },
) {
  const params: Record<string, string> = {
    resource_id: args.recurso,
    // Con limit=0 el portal no da el total: se pide una fila como mínimo y no se devuelve.
    limit: String(Math.max(args.limite, 1)),
    offset: String(args.desde),
  };
  if (args.filtros) params.filters = JSON.stringify(args.filtros);
  if (args.q) params.q = args.q;
  if (args.campos) params.fields = args.campos.join(',');
  if (args.orden) params.sort = args.orden;
  const result = await ckan<{
    total?: number;
    fields: { id: string; type: string }[];
    records: Record<string, unknown>[];
  }>(fetchImpl, 'datastore_search', params);
  // Columnas del datastore, no del recurso: `rank` y `_full_count` solo salen al buscar con `q`.
  const internal = new Set(args.q ? ['_id', 'rank', '_full_count'] : ['_id']);
  const campos = result.fields.filter((f) => !internal.has(f.id)).map((f) => `${f.id} (${f.type})`);
  const filas = result.records
    .slice(0, args.limite)
    .map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !internal.has(k))));
  if (result.total !== undefined) return { total: result.total, campos, filas };
  // Sin filas el portal tampoco da el total. Desde el principio, eso es que ninguna cumple la consulta.
  if (result.records.length > 0 || args.desde > 0)
    throw new SourceError(
      args.desde > 0
        ? `No hay filas a partir de la ${args.desde}: pide desde 0 para saber el total.`
        : 'La fuente no dio el total de filas.',
    );
  return {
    total: 0,
    campos,
    filas,
    nota: 'Ninguna fila cumple la consulta. Los filtros piden el valor exacto, con tildes y mayúsculas («Gràcia», no «Gracia»): mira los valores con unas pocas filas sin filtrar.',
  };
}

export function createBarcelonaMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-barcelona', title: 'Open Data BCN' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_conjunto',
        {
          title: 'Buscar conjunto de datos',
          description:
            'Los conjuntos de datos del Ajuntament de Barcelona cuyo título, descripción o etiquetas contienen alguna de las palabras de `q` (en castellano o catalán, sin distinguir tildes), primero los que más coinciden, con cuántos recursos se pueden consultar fila a fila.',
          inputSchema: z.object({
            q: z.string().min(2).max(100),
            limite: z.number().int().min(1).max(30).default(10),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ q, limite }) => run(SOURCE, () => buscarConjunto(fetchImpl, q, limite)),
      );
      s.registerTool(
        'ver_conjunto',
        {
          title: 'Ver un conjunto de datos',
          description: `Descripción, organismo, licencia y frecuencia de un conjunto, y sus recursos consultables del periodo más reciente al más antiguo (por el año y mes de su nombre), de ${MAX_RECURSOS} en ${MAX_RECURSOS} (\`desde\` salta los más recientes, para llegar a los años antiguos), con el id que usa consultar_datos.`,
          inputSchema: z.object({
            id: z.string().min(1).max(120).describe('Id del conjunto, de buscar_conjunto.'),
            desde: z.number().int().min(0).default(0).describe('Recursos que saltar.'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ id, desde }) => run(SOURCE, () => verConjunto(fetchImpl, id, desde)),
      );
      s.registerTool(
        'consultar_datos',
        {
          title: 'Consultar datos',
          description:
            'Las filas de un recurso, con sus campos y el total de filas que cumplen la consulta. Con limite 0 da solo los campos. Los números llegan como texto.',
          inputSchema: z.object({
            recurso: z.uuid().describe('Id del recurso, de ver_conjunto.'),
            filtros: z
              .record(
                z.string().max(80),
                z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
              )
              .optional()
              .describe(
                'Campo → valor exacto, con tildes y mayúsculas, o lista de valores, como {"Nom_districte": "Gràcia"}.',
              ),
            q: z.string().max(100).optional().describe('Texto que buscar en todas las columnas.'),
            campos: z.array(z.string().max(80)).max(30).optional().describe('Solo estos campos.'),
            orden: z
              .string()
              .max(120)
              .optional()
              .describe('Campo y sentido, como «Any desc» o «Valor asc».'),
            limite: z.number().int().min(0).max(100).default(20),
            desde: z.number().int().min(0).default(0).describe('Filas que saltar, para paginar.'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        (args) => run(SOURCE, () => consultarDatos(fetchImpl, args)),
      );
    },
  );
}
