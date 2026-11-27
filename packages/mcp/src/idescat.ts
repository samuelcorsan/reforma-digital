// Servidor MCP del Idescat (Institut d'Estadística de Catalunya): las tablas de la API Taules v2
// (https://api.idescat.cat/taules/v2), sin clave, en JSON-stat. Cada tabla cuelga de un nodo de una
// estadística y se publica por divisiones territoriales (Cataluña, comarcas, municipios…). La API
// ignora en silencio los filtros con códigos que no existen: aquí se traducen los textos a códigos
// de los metadatos y se comprueba el tamaño de lo que vuelve.
import { z } from 'zod';
import {
  fold,
  get,
  matches,
  READ_ONLY_EXTERNAL,
  run,
  server,
  SourceError,
  words,
  type Fetch,
} from './comun';

const API = 'https://api.idescat.cat/taules/v2';
const SOURCE = "Fuente: Idescat, Institut d'Estadística de Catalunya (idescat.cat).";
// La API admite 20.000 datos por petición: más de 1.000 no le sirven al asistente.
const MAX_DATOS = 1000;

const INSTRUCTIONS = `Estadísticas oficiales del Idescat, el Institut d'Estadística de Catalunya: población, empleo, afiliación, nacimientos, PIB, renta… de Cataluña, sus provincias, comarcas y municipios.
Se llega a un dato en tres pasos: buscar_tabla (por palabras del tema, sin el lugar: «población sexo», no «población Girona»), ver_tabla (las tablas de ese tema, sus divisiones territoriales y sus dimensiones) y datos_tabla (los datos de una tabla en una división, con el lugar por su nombre y cada dimensión filtrada por palabras de sus valores).
Un tema puede tener varias tablas de periodos o revisiones distintas, y las antiguas ya no se actualizan: mira la fecha «actualizada» y usa la más reciente.
La población está en dos estadísticas: el Censo de población y viviendas (censph, anual) y el Padrón municipal de habitantes (pmh, a 1 de enero; búscalo con «población 1 enero»). Sus cifras difieren un poco: di de cuál es la tuya. Las proyecciones (proj…) llegan a años futuros.
Los lugares van en catalán: «Catalunya», «Girona», «Lleida».
Di siempre a qué periodo corresponde cada dato y si es provisional o avanzado (campo «estado»); un valor null es un dato que no existe o no se publica.
${SOURCE}`;

type Coleccion = { label: string; link: { item: { href: string; label: string }[] } };
const items = async (fetchImpl: Fetch, path: string) =>
  ((await (await get(fetchImpl, `${API}${path}?lang=es`)).json()) as Coleccion).link.item.map(
    (i) => ({ id: new URL(i.href).pathname.replace('/taules/v2/', ''), nombre: i.label }),
  );

type Nodo = { id: string; nombre: string; estadistica: string };
// Las 35 estadísticas y sus 2.200 nodos llegan en 36 peticiones de menos de un segundo: el índice
// se hace una vez por proceso. Las tablas de cada nodo se piden en ver_tabla.
let nodos: Promise<Nodo[]> | undefined;

export async function buscarTabla(fetchImpl: Fetch, q: string) {
  nodos ??= items(fetchImpl, '')
    .then((stats) =>
      Promise.all(
        stats.map(async (s) =>
          (await items(fetchImpl, `/${s.id}`)).map((n) => ({ ...n, estadistica: s.nombre })),
        ),
      ),
    )
    .then((all) => all.flat())
    .catch((error: unknown) => {
      nodos = undefined;
      throw error;
    });
  const w = words(q);
  const found = (await nodos).filter((n) => matches(`${n.estadistica} ${n.nombre}`, w));
  return { total: found.length, nodos: found.slice(0, 30) };
}

type Dimension = { label: string; category: { index: string[]; label: Record<string, string> } };
type JsonStat = {
  label: string;
  updated: string;
  id: string[];
  size: number[];
  role: { time?: string[]; geo?: string[] };
  dimension: Record<string, Dimension>;
  value: (number | null)[];
  // El Idescat da el símbolo de cada dato por su posición; JSON-stat también admite una lista.
  status?: Record<string, string>;
  extension?: { status?: { label: Record<string, string> } };
};

// Las dimensiones jerárquicas repiten nombres (la rama F y su detalle F41-F43 son «construcción»):
// el código los distingue, o dos series distintas acabarían en una.
function nombres({ category: { index, label } }: Dimension) {
  const veces = new Map<string, number>();
  for (const c of index) veces.set(label[c]!, (veces.get(label[c]!) ?? 0) + 1);
  return index.map((c) => (veces.get(label[c]!)! > 1 ? `${label[c]} (${c})` : label[c]!));
}

const meta = async (fetchImpl: Fetch, tabla: string, division: string) =>
  (await (await get(fetchImpl, `${API}/${tabla}/${division}?lang=es`)).json()) as JsonStat;

async function verTabla(fetchImpl: Fetch, nodo: string) {
  const tablas = await Promise.all(
    (await items(fetchImpl, `/${nodo}`)).map(async (t) => {
      const divisiones = await items(fetchImpl, `/${t.id}`);
      // Pedir los metadatos de cada división multiplicaría las peticiones: se describe la primera,
      // y datos_tabla lee la elegida, que puede tener más periodos.
      const primera = divisiones[0]!.id.split('/').at(-1)!;
      const m = await meta(fetchImpl, t.id, primera);
      const time = m.role.time?.[0];
      return {
        id: t.id,
        nombre: t.nombre,
        actualizada: m.updated,
        divisiones: divisiones.map((d) => ({ id: d.id.split('/').at(-1)!, nombre: d.nombre })),
        dimensiones_en: primera,
        dimensiones: m.id
          .filter((id) => !m.role.geo?.includes(id))
          .map((id) => {
            const d = m.dimension[id]!;
            const labels = nombres(d);
            return {
              id,
              nombre: d.label,
              periodo: id === time ? true : undefined,
              total: labels.length,
              // Del periodo bastan los últimos; de lo demás, una muestra: datos_tabla filtra por texto.
              valores: id === time ? labels.slice(-12) : labels.slice(0, 60),
            };
          }),
      };
    }),
  );
  return { tablas: tablas.sort((a, b) => b.actualizada.localeCompare(a.actualizada)) };
}

// Los códigos de la dimensión cuyos nombres contienen las palabras del filtro, o solo el que
// coincide entero: «total» es «total», no también «total extranjeros».
function select(id: string, d: Dimension, filtro: string) {
  const all = d.category.index;
  const labels = nombres(d);
  const exact = all.filter((_, i) => fold(labels[i]!) === fold(filtro));
  const w = words(filtro);
  const found = exact.length ? exact : all.filter((_, i) => matches(labels[i]!, w));
  if (!found.length)
    throw new SourceError(
      `Ningún valor de «${id}» (${d.label}) contiene «${filtro}». Mira ver_tabla.`,
    );
  return found;
}

// Una serie por combinación de valores, con sus datos del periodo más reciente al más antiguo.
function series(data: JsonStat) {
  const time = data.role.time?.[0];
  const labels = data.id.map((id) => nombres(data.dimension[id]!));
  const estados = data.extension?.status?.label ?? {};
  // Los datos de cada serie, en la posición de su periodo (de más antiguo a más reciente).
  const byName = new Map<
    string,
    { periodo: string | undefined; valor: number | null; estado?: string }[]
  >();
  data.value.forEach((valor, cell) => {
    let rest = cell;
    const name: string[] = [];
    let periodo: string | undefined;
    let orden = 0;
    for (let d = data.id.length - 1; d >= 0; d--) {
      const size = data.size[d]!;
      const pos = rest % size;
      rest = Math.floor(rest / size);
      if (data.id[d] === time) [periodo, orden] = [labels[d]![pos]!, pos];
      else name.unshift(labels[d]![pos]!);
    }
    const key = name.join(' · ');
    const simbolo = data.status?.[cell];
    const datos = byName.get(key) ?? [];
    datos[orden] = { periodo, valor, estado: simbolo && (estados[simbolo] ?? simbolo) };
    byName.set(key, datos);
  });
  return {
    tabla: data.label,
    actualizada: data.updated,
    series: [...byName].map(([nombre, datos]) => ({
      nombre,
      datos: Object.values(datos).reverse(),
    })),
  };
}

export async function datosTabla(
  fetchImpl: Fetch,
  tabla: string,
  division: string,
  ultimos: number,
  lugar?: string,
  filtros: Record<string, string> = {},
) {
  const m = await meta(fetchImpl, tabla, division);
  const geo = m.role.geo?.[0];
  const time = m.role.time?.[0];
  const key = (nombre: string) => m.id.find((id) => fold(id) === fold(nombre));
  for (const nombre of Object.keys(filtros))
    if (!key(nombre) || key(nombre) === geo)
      throw new SourceError(
        `La tabla no tiene la dimensión «${nombre}»; el lugar va en \`lugar\`. Sus dimensiones: ${m.id.filter((id) => id !== geo).join(', ')}.`,
      );
  const elegidos = Object.fromEntries(
    Object.entries(filtros).map(([nombre, filtro]) => {
      const id = key(nombre)!;
      return [id, select(id, m.dimension[id]!, filtro)];
    }),
  );
  if (lugar) {
    if (!geo) throw new SourceError('Esta tabla no tiene dimensión territorial: quita `lugar`.');
    elegidos[geo] = select(geo, m.dimension[geo]!, lugar);
  }
  // Un periodo filtrado («2024») va entero; si no, los últimos.
  if (time) elegidos[time] ??= m.dimension[time]!.category.index.slice(-ultimos);
  const total = m.id.reduce((n, id, i) => n * (elegidos[id]?.length ?? m.size[i]!), 1);
  if (total > MAX_DATOS)
    throw new SourceError(
      `La consulta pide ${total} datos y el máximo es ${MAX_DATOS}: filtra más dimensiones con \`filtros\` o \`lugar\`, o pide menos periodos.`,
    );
  const params = new URLSearchParams({ lang: 'es' });
  for (const [id, values] of Object.entries(elegidos)) params.set(id, values.join(','));
  const data = (await (
    await get(fetchImpl, `${API}/${tabla}/${division}/data?${params}`)
  ).json()) as JsonStat;
  // Un filtro que la API no aplicara devolvería más datos de los pedidos, con aspecto de buenos.
  if (data.size.reduce((n, s) => n * s, 1) !== total)
    throw new SourceError('La fuente devolvió otros datos que los pedidos. Prueba más tarde.');
  return series(data);
}

const nodo = z
  .string()
  .regex(/^[a-z0-9]+\/\d+$/)
  .describe('Id del tema, de buscar_tabla, como pmh/446.');

export function createIdescatMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-idescat', title: 'Idescat' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'buscar_tabla',
      {
        title: 'Buscar tabla',
        description:
          'Los temas del Idescat (cada uno con una o más tablas) cuyo título o estadística contiene las palabras de `q`. Los títulos nombran el tema y las variables, no los lugares: busca «población sexo» o «afiliados», no «población Girona», y elige el lugar con `lugar` en datos_tabla.',
        inputSchema: z.object({ q: z.string().min(2).max(100) }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ q }) => run(SOURCE, () => buscarTabla(fetchImpl, q)),
    );
    s.registerTool(
      'ver_tabla',
      {
        title: 'Ver las tablas de un tema',
        description:
          'Las tablas de un tema, de la actualizada más recientemente a la más antigua, con sus divisiones territoriales (cat, prov, com, mun…) y sus dimensiones con sus valores (los 60 primeros; del periodo, los 12 últimos) en la división de `dimensiones_en`: otra división puede tener más periodos.',
        inputSchema: z.object({ nodo }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ nodo }) => run(SOURCE, () => verTabla(fetchImpl, nodo)),
    );
    s.registerTool(
      'datos_tabla',
      {
        title: 'Datos de una tabla',
        description: `Los datos de una tabla en una división territorial. \`lugar\` elige el territorio por su nombre («Girona», «Baix Llobregat»); sin él van todos. \`filtros\` elige, por cada dimensión, los valores que contienen esas palabras, como {"SEX": "total"}; el periodo también se puede filtrar («2024» da todos los meses de 2024). Sin filtro de periodo se dan los \`ultimos\`. Como mucho ${MAX_DATOS} datos.`,
        inputSchema: z.object({
          tabla: z
            .string()
            .regex(/^[a-z0-9]+\/\d+\/\d+$/)
            .describe('Id de la tabla, de ver_tabla, como pmh/446/477.'),
          division: z
            .string()
            .regex(/^[a-z]+$/)
            .describe('División territorial, de ver_tabla, como cat, com o mun.'),
          // Sin palabras, el filtro casaría con todo y la respuesta parecería filtrada.
          lugar: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe(
              "Nombre del territorio en catalán («Catalunya», «Lleida»). Los municipios llevan el artículo detrás («Hospitalet de Llobregat, l'»): búscalos sin él.",
            ),
          filtros: z
            .record(z.string().max(40), z.string().trim().min(1).max(100))
            .optional()
            .describe('Id de la dimensión (como lo da ver_tabla) → palabras de los valores.'),
          ultimos: z
            .number()
            .int()
            .min(1)
            .max(60)
            .default(1)
            .describe('Sin filtro de periodo, cuántos periodos, del más reciente hacia atrás.'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ tabla, division, lugar, filtros, ultimos }) =>
        run(SOURCE, () => datosTabla(fetchImpl, tabla, division, ultimos, lugar, filtros)),
    );
  });
}
