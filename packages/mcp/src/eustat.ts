// Servidor MCP del Eustat (Instituto Vasco de Estadística): las tablas de su banco de datos por la
// API PX-Web (https://www.eustat.eus/bankupx/api/v1/es/DB), sin clave. Una misma estadística suele
// tener varias tablas por cambio de base o de serie, y las viejas siguen publicadas: por eso la
// búsqueda pone primero las actualizadas hace menos.
import type { IncomingMessage } from 'node:http';
import { request } from 'node:https';
import { text } from 'node:stream/consumers';
import { rootCertificates } from 'node:tls';
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

const API = 'https://www.eustat.eus/bankupx/api/v1/es/DB';
const SOURCE = 'Fuente: Eustat, Instituto Vasco de Estadística (eustat.eus).';
// Una tabla grande sin filtrar pasa de 100.000 datos: más que eso no le sirve al asistente.
const MAX_DATOS = 1000;

// El certificado de eustat.eus lo firma Izenpe, la autoridad de certificación del Gobierno Vasco.
// Node 24 ya no trae su raíz (Node 22 sí), y `fetch` no deja añadir una: sin esto, cada petición
// falla con SELF_SIGNED_CERT_IN_CHAIN. La raíz es la del almacén de Node 22 (SHA-256 25:30:CC:8E…
// D4:53:1F, válida hasta 2037) y solo se confía en ella para las peticiones al Eustat.
const IZENPE = `-----BEGIN CERTIFICATE-----
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
1V4tC5h9Pmzb/CaIxw==
-----END CERTIFICATE-----`;
const ca = [...rootCertificates, IZENPE];

const viaIzenpe: Fetch = async (input, init) => {
  const r = new Request(input, init);
  const body = await r.text();
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    request(r.url, {
      method: r.method,
      headers: Object.fromEntries(r.headers),
      // La señal de quien llama, no `r.signal`: esa copia deja de abortar si el recolector se
      // lleva el Request, y la petición se quedaría esperando sin límite.
      signal: init?.signal ?? undefined,
      ca,
    })
      .on('response', resolve)
      // Se queda escuchando tras la respuesta: un corte a mitad del cuerpo sin nadie escuchando
      // tiraría el proceso.
      .on('error', reject)
      .end(body);
  });
  return new Response(await text(response), { status: response.statusCode });
};

const INSTRUCTIONS = `Estadísticas oficiales del Eustat, el Instituto Vasco de Estadística: precios, empleo, población, economía, turismo… de la C.A. de Euskadi, sus territorios históricos (Araba/Álava, Bizkaia, Gipuzkoa) y, en algunas tablas, sus capitales o municipios.
Se llega a un dato en tres pasos: buscar_tabla (por palabras del tema, sin el lugar: los títulos dicen «por territorio histórico», no «Gipuzkoa»), ver_tabla (sus variables y valores) y datos_tabla (los datos, filtrando cada variable por palabras de sus valores).
Una estadística suele tener varias tablas de bases o series distintas, y las antiguas ya no se actualizan: mira la fecha «actualizada» y usa la más reciente.
El periodo va como «2026-10» (mes) o «2026» (año). Algunas tablas llevan el trimestre en una variable aparte, con el año como periodo. Di siempre a qué periodo corresponde cada dato; un valor null es un dato que aún no existe.
${SOURCE}`;

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
      if (Object.keys(filtros).some((nombre) => fold(nombre) === fold(v.code)))
        throw new SourceError(
          `«${v.code}» no se filtra: pide los últimos periodos con \`ultimos\` y elige entre ellos.`,
        );
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

export function createEustatMcp(fetchImpl: Fetch = viaIzenpe) {
  return server({ name: 'reforma-digital-eustat', title: 'Eustat' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'buscar_tabla',
      {
        title: 'Buscar tabla',
        description:
          'Las tablas del Eustat cuyo título contiene las palabras de `q`, de la actualizada más recientemente a la más antigua. Los títulos nombran el tema y las variables, no los lugares: busca «IPC territorio histórico» o «pernoctaciones», no «IPC Gipuzkoa», y elige el lugar con los filtros de datos_tabla.',
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
