// Servidor MCP del Eustat (Instituto Vasco de Estadística): las tablas de su banco de datos por la
// API PX-Web (https://www.eustat.eus/bankupx/api/v1/es/DB), sin clave. Una misma estadística suele
// tener varias tablas por cambio de base o de serie, y las viejas siguen publicadas: por eso la
// búsqueda pone primero las actualizadas hace menos.
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const API = 'https://www.eustat.eus/bankupx/api/v1/es/DB';
const SOURCE = 'Fuente: Eustat, Instituto Vasco de Estadística (eustat.eus).';
// Una tabla grande sin filtrar pasa de 100.000 datos: más que eso no le sirve al asistente.
const MAX_DATOS = 1000;

const INSTRUCTIONS = `Estadísticas oficiales del Eustat, el Instituto Vasco de Estadística: precios, empleo, población, economía, turismo… de la C.A. de Euskadi, sus territorios históricos (Araba/Álava, Bizkaia, Gipuzkoa) y, en algunas tablas, sus capitales o municipios.
Se llega a un dato en tres pasos: buscar_tabla (por palabras del título), ver_tabla (sus variables y valores) y datos_tabla (los datos, filtrando cada variable por palabras de sus valores).
Una estadística suele tener varias tablas de bases o series distintas, y las antiguas ya no se actualizan: mira la fecha «actualizada» y usa la más reciente.
El periodo va como «2026-10» (mes) o «2026» (año). Algunas tablas llevan el trimestre en una variable aparte, con el año como periodo. Di siempre a qué periodo corresponde cada dato; un valor null es un dato que aún no existe.
${SOURCE}`;

const words = (q: string | undefined) =>
  fold(q ?? '')
    .split(/\s+/)
    .filter(Boolean);
const matches = (text: string, q: string[]) => q.every((w) => fold(text).includes(w));

type Tabla = { id: string; text: string; updated: string };
let tablas: Promise<Tabla[]> | undefined;

export async function buscarTabla(fetchImpl: Fetch, q: string) {
  tablas ??= get(fetchImpl, API)
    .then((r) => r.json() as Promise<Tabla[]>)
    .catch((error: unknown) => {
      tablas = undefined;
      throw error;
    });
  const w = words(q);
  const found = (await tablas)
    .filter((t) => matches(t.text, w))
    .sort((a, b) => b.updated.localeCompare(a.updated));
  return {
    total: found.length,
    tablas: found
      .slice(0, 30)
      .map((t) => ({ id: t.id, nombre: t.text, actualizada: t.updated.slice(0, 10) })),
  };
}

type Variable = {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
};
type Meta = { title: string; variables: Variable[] };

const tabla = z
  .string()
  .regex(/^PX_\w+\.px$/)
  .max(80)
  .describe('Id de la tabla, de buscar_tabla, como PX_INEIPC_fe_pc02cm.px.');

const meta = async (fetchImpl: Fetch, id: string) =>
  (await (await get(fetchImpl, `${API}/${encodeURIComponent(id)}`)).json()) as Meta;

async function verTabla(fetchImpl: Fetch, id: string) {
  const { title, variables } = await meta(fetchImpl, id);
  return {
    titulo: title,
    variables: variables.map((v) => ({
      nombre: v.code,
      periodo: v.time ? true : undefined,
      total: v.valueTexts.length,
      // Del periodo bastan los últimos; de los municipios, una muestra: datos_tabla filtra por texto.
      valores: v.time ? v.valueTexts.slice(-12) : v.valueTexts.slice(0, 60),
    })),
  };
}

type JsonStat = {
  label: string;
  id: string[];
  size: number[];
  value: (number | null)[];
  note?: string[];
  role: { time?: string[]; metric?: string[] };
  dimension: Record<
    string,
    { category: { index: Record<string, number>; label: Record<string, string> } }
  >;
};

// Una serie por combinación de valores, con sus datos del periodo más reciente al más antiguo. La
// dimensión de contenido (`metric`) repite el título de la tabla: no entra en el nombre.
function series(data: JsonStat) {
  const time = data.role.time?.[0];
  const metric = data.role.metric ?? [];
  const labels = data.id.map((id) => {
    const { index, label } = data.dimension[id]!.category;
    const out: string[] = [];
    for (const [code, pos] of Object.entries(index)) out[pos] = label[code]!;
    return out;
  });
  const byName = new Map<string, { periodo: string | undefined; valor: number | null }[]>();
  data.value.forEach((valor, cell) => {
    let rest = cell;
    const name: string[] = [];
    let periodo: string | undefined;
    for (let d = data.id.length - 1; d >= 0; d--) {
      const size = data.size[d]!;
      const label = labels[d]![rest % size]!;
      rest = Math.floor(rest / size);
      if (data.id[d] === time) periodo = label;
      else if (!metric.includes(data.id[d]!)) name.unshift(label);
    }
    const key = name.join(' · ') || data.label;
    const datos = byName.get(key) ?? [];
    datos.push({ periodo, valor });
    byName.set(key, datos);
  });
  return {
    tabla: data.label,
    notas: data.note,
    series: [...byName].map(([nombre, datos]) => ({
      nombre,
      datos: datos.sort((a, b) => (b.periodo ?? '').localeCompare(a.periodo ?? '')),
    })),
  };
}

export async function datosTabla(
  fetchImpl: Fetch,
  id: string,
  ultimos: number,
  filtros: Record<string, string> = {},
) {
  const { variables } = await meta(fetchImpl, id);
  for (const nombre of Object.keys(filtros))
    if (!variables.some((v) => fold(v.code) === fold(nombre)))
      throw new SourceError(
        `La tabla no tiene la variable «${nombre}». Sus variables: ${variables.map((v) => v.code).join(', ')}.`,
      );
  let total = 1;
  const query = variables.map((v) => {
    if (v.time) {
      total *= Math.min(ultimos, v.values.length);
      return { code: v.code, selection: { filter: 'top', values: [String(ultimos)] } };
    }
    const filtro = Object.entries(filtros).find(([nombre]) => fold(nombre) === fold(v.code))?.[1];
    // «total» es «TOTAL», no también «-TOTAL ESTADO»: si un valor coincide entero, solo ese.
    const exact = v.values.filter((_, i) => filtro && fold(v.valueTexts[i]!) === fold(filtro));
    const w = words(filtro);
    const values = exact.length ? exact : v.values.filter((_, i) => matches(v.valueTexts[i]!, w));
    if (!values.length)
      throw new SourceError(`Ningún valor de «${v.code}» contiene «${filtro}». Mira ver_tabla.`);
    total *= values.length;
    return { code: v.code, selection: { filter: 'item', values } };
  });
  if (total > MAX_DATOS)
    throw new SourceError(
      `La consulta pide ${total} datos y el máximo es ${MAX_DATOS}: filtra más variables con \`filtros\` o pide menos periodos.`,
    );
  const response = await get(fetchImpl, `${API}/${encodeURIComponent(id)}`, undefined, {
    query,
    response: { format: 'json-stat2' },
  });
  return series((await response.json()) as JsonStat);
}

export function createEustatMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-eustat', title: 'Eustat' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'buscar_tabla',
      {
        title: 'Buscar tabla',
        description:
          'Las tablas del Eustat cuyo título contiene las palabras de `q`, como «IPC Gipuzkoa» o «paro municipio», de la actualizada más recientemente a la más antigua.',
        inputSchema: z.object({ q: z.string().min(2).max(100) }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ q }) => run(SOURCE, () => buscarTabla(fetchImpl, q)),
    );
    s.registerTool(
      'ver_tabla',
      {
        title: 'Ver una tabla',
        description:
          'Las variables de una tabla y sus valores (los 60 primeros; del periodo, los 12 últimos), para saber cómo filtrar datos_tabla.',
        inputSchema: z.object({ tabla }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ tabla }) => run(SOURCE, () => verTabla(fetchImpl, tabla)),
    );
    s.registerTool(
      'datos_tabla',
      {
        title: 'Datos de una tabla',
        description: `Los datos de una tabla en sus últimos periodos. \`filtros\` elige, por cada variable, los valores que contienen esas palabras, como {"territorio histórico": "gipuzkoa", "índice": "interanual"}; una variable sin filtro va entera. Como mucho ${MAX_DATOS} datos.`,
        inputSchema: z.object({
          tabla,
          filtros: z
            .record(z.string().max(80), z.string().max(100))
            .optional()
            .describe(
              'Variable (como la nombra ver_tabla) → palabras de los valores que se quieren.',
            ),
          ultimos: z
            .number()
            .int()
            .min(1)
            .max(60)
            .default(1)
            .describe('Cuántos periodos, del más reciente hacia atrás.'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ tabla, filtros, ultimos }) =>
        run(SOURCE, () => datosTabla(fetchImpl, tabla, ultimos, filtros)),
    );
  });
}
