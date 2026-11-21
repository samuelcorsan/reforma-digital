// Servidor MCP del INE: operaciones, tablas y series de la API Tempus3
// (https://servicios.ine.es/wstempus), sin clave. Los códigos de serie cambian con cada cambio de
// base, así que no se fijan: el asistente llega a los datos como en la web, por operación y tabla.
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, type Fetch } from './comun';

const API = 'https://servicios.ine.es/wstempus/js/ES';
const SOURCE = 'Fuente: Instituto Nacional de Estadística (ine.es).';

const INSTRUCTIONS = `Estadísticas oficiales del Instituto Nacional de Estadística (INE): precios, empleo, población, economía…
Se llega a un dato en tres pasos: buscar_operacion (la estadística, como IPC, EPA o ECP), buscar_tabla (sus tablas) y datos_tabla (las series de una tabla con sus últimos valores, filtradas por texto). Si ya conoces el código de una serie, usa datos_serie.
Operaciones habituales: IPC (precios de consumo), EPA (población activa y paro), ECP (población residente), CNTR2010 (PIB trimestral), ETDP (compraventa de viviendas), IPV (precios de vivienda).
Di siempre a qué periodo corresponde cada dato.
${SOURCE}`;

const words = (q: string | undefined) =>
  fold(q ?? '')
    .split(/\s+/)
    .filter(Boolean);
const matches = (text: string, q: string[]) => q.every((w) => fold(text).includes(w));

type Operacion = { Id: number; Codigo: string; Nombre: string; Url?: string };
let operaciones: Promise<Operacion[]> | undefined;

async function buscarOperacion(fetchImpl: Fetch, q: string) {
  operaciones ??= get(fetchImpl, `${API}/OPERACIONES_DISPONIBLES`)
    .then((r) => r.json() as Promise<Operacion[]>)
    .catch((error: unknown) => {
      operaciones = undefined;
      throw error;
    });
  const w = words(q);
  return (await operaciones)
    .filter((o) => matches(`${o.Codigo} ${o.Nombre}`, w))
    .slice(0, 20)
    .map((o) => ({
      codigo: o.Codigo,
      nombre: o.Nombre,
      url: o.Url && new URL(o.Url, 'https://www.ine.es').href,
    }));
}

async function buscarTabla(fetchImpl: Fetch, operacion: string, q?: string) {
  const tablas = (await (
    await get(fetchImpl, `${API}/TABLAS_OPERACION/${encodeURIComponent(operacion)}`)
  ).json()) as { Id: number; Nombre: string; Ultima_Modificacion?: string }[];
  const w = words(q);
  const found = tablas.filter((t) => matches(t.Nombre, w));
  return {
    total: found.length,
    tablas: found.slice(0, 30).map((t) => ({ id: t.Id, nombre: t.Nombre })),
  };
}

type Serie = {
  COD: string;
  Nombre: string;
  Data?: { Fecha: number; Anyo: number; Valor: number | null; Secreto?: boolean }[];
};

// La fecha del INE es la medianoche de Madrid del inicio del periodo.
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const serie = (s: Serie) => ({
  codigo: s.COD,
  nombre: s.Nombre.trim(),
  datos: (s.Data ?? []).map((d) => ({ periodo: day(d.Fecha), valor: d.Secreto ? null : d.Valor })),
});

export async function datosTabla(fetchImpl: Fetch, tabla: number, ultimos: number, q?: string) {
  const series = (await (
    await get(fetchImpl, `${API}/DATOS_TABLA/${tabla}?nult=${ultimos}`)
  ).json()) as Serie[];
  const w = words(q);
  const found = series.filter((s) => matches(s.Nombre, w));
  return {
    total: found.length,
    nota: found.length > 40 ? 'Solo las 40 primeras: afina con `q` para ver otras.' : undefined,
    series: found.slice(0, 40).map(serie),
  };
}

async function datosSerie(fetchImpl: Fetch, codigo: string, ultimos: number) {
  return serie(
    (await (
      await get(fetchImpl, `${API}/DATOS_SERIE/${encodeURIComponent(codigo)}?nult=${ultimos}`)
    ).json()) as Serie,
  );
}

const ultimos = z
  .number()
  .int()
  .min(1)
  .max(60)
  .default(1)
  .describe('Cuántos periodos, del más reciente hacia atrás.');

export function createIneMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-ine', title: 'INE' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'buscar_operacion',
      {
        title: 'Buscar estadística',
        description:
          'Las operaciones estadísticas del INE (IPC, EPA, padrón…) cuyo código o nombre contiene las palabras de `q`.',
        inputSchema: z.object({ q: z.string().min(2).max(100) }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ q }) => run(SOURCE, () => buscarOperacion(fetchImpl, q)),
    );
    s.registerTool(
      'buscar_tabla',
      {
        title: 'Buscar tabla',
        description:
          'Las tablas de una operación (por su código, como IPC o EPA), filtradas por palabras del nombre.',
        inputSchema: z.object({
          operacion: z
            .string()
            .regex(/^[\w:]+$/)
            .max(20),
          q: z.string().max(100).optional(),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ operacion, q }) => run(SOURCE, () => buscarTabla(fetchImpl, operacion, q)),
    );
    s.registerTool(
      'datos_tabla',
      {
        title: 'Datos de una tabla',
        description:
          'Las series de una tabla con sus últimos valores. `q` filtra por palabras del nombre de la serie, como «nacional variación anual».',
        inputSchema: z.object({
          tabla: z.number().int().positive().describe('Id de la tabla, de buscar_tabla.'),
          q: z.string().max(200).optional(),
          ultimos,
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ tabla, q, ultimos }) => run(SOURCE, () => datosTabla(fetchImpl, tabla, ultimos, q)),
    );
    s.registerTool(
      'datos_serie',
      {
        title: 'Datos de una serie',
        description: 'Los últimos valores de una serie por su código, como IPC290751.',
        inputSchema: z.object({ codigo: z.string().regex(/^\w+$/).max(30), ultimos }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ codigo, ultimos }) => run(SOURCE, () => datosSerie(fetchImpl, codigo, ultimos)),
    );
  });
}
