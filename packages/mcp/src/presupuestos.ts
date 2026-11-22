// Servidor MCP de los Presupuestos Generales del Estado. No consulta a la SEPG en cada llamada: su
// web no tiene API y su robots.txt prohíbe rastrear, así que sirve una foto de los datos oficiales
// (data/presupuestos.json, que genera scripts/presupuestos.ts). Los presupuestos cambian una vez al
// año como mucho: la foto solo se rehace cuando la SEPG publica uno nuevo o una prórroga.
import { z } from 'zod';
import bundle from '../data/presupuestos.json';
import { fold, matches, run, server, SourceError, words } from './comun';

const SOURCE =
  'Fuente: Secretaría de Estado de Presupuestos y Gastos, Ministerio de Hacienda (sepg.pap.hacienda.gob.es).';

const READ_ONLY_LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const nombres = z.record(z.string(), z.string());
const presupuesto = z.object({
  // Una línea por servicio u organismo, programa y artículo de gasto, en euros.
  lineas: z.array(z.tuple([z.string(), z.string(), z.string(), z.number()])),
  secciones: nombres,
  organicas: nombres,
  programas: nombres,
  economicas: nombres,
});
// La foto viaja con el código: si no tuviera esta forma, el fallo sale al arrancar y no en una
// respuesta al asistente.
const datos = z
  .object({
    politicas: nombres,
    2023: presupuesto.extend({
      ingresos: z.object({
        lineas: z.array(z.tuple([z.string(), z.string(), z.number()])),
        economicas: nombres,
      }),
    }),
    2026: presupuesto,
  })
  .parse(bundle);

const ANIOS = {
  '2023': 'Ley 31/2022, de 23 de diciembre, de Presupuestos Generales del Estado para el año 2023.',
  '2026':
    'Presupuesto de 2023 prorrogado para 2026 (artículo 134.4 de la Constitución), publicado por la SEPG el 2 de enero de 2026. La prórroga no vuelve a publicar la Seguridad Social: rige la de 2023.',
};
type Anio = keyof typeof ANIOS;

const INSTRUCTIONS = `Presupuestos Generales del Estado: cuánto prevé gastar el Estado, en qué y quién, y cuánto prevé ingresar.
- El último presupuesto aprobado es el de 2023. No hay presupuestos de 2024, 2025 ni 2026: el de 2023 se ha prorrogado cada año. Los datos de 2026 son esa prórroga, con los créditos ajustados que publica la SEPG. Dilo al responder.
- Son créditos iniciales (lo presupuestado), no lo gastado de verdad, y están consolidados: sin las transferencias entre el Estado, sus organismos y la Seguridad Social, así que se pueden sumar.
- resumen_presupuesto da el total y el reparto por políticas (pensiones, defensa, deuda…) y capítulos; buscar_programa y ver_programa bajan al detalle; ver_seccion da un ministerio u órgano; ingresos, las previsiones de 2023 por impuesto.
- Los números de sección cambian de ministerio entre 2023 y 2026 (la 25 era Presidencia y ahora es Vivienda): para comparar años, compara políticas o programas.
- Importes en euros.
${SOURCE}`;

// Texto y no número: así vale igual por GET (/mcp/presupuestos/<herramienta>?anio=2023).
const anio = z
  .enum(['2026', '2023'])
  .default('2026')
  .describe('2026 (la prórroga en vigor, por defecto) o 2023 (la ley aprobada).');

const total = (lineas: (typeof datos)[Anio]['lineas']) =>
  lineas.reduce((suma, [, , , euros]) => suma + euros, 0);

function reparto(
  lineas: (typeof datos)[Anio]['lineas'],
  by: (linea: (typeof lineas)[number]) => string,
  nombre: (codigo: string) => string,
) {
  const sumas = new Map<string, number>();
  for (const linea of lineas) sumas.set(by(linea), (sumas.get(by(linea)) ?? 0) + linea[3]);
  return [...sumas]
    .sort((a, b) => b[1] - a[1])
    .map(([codigo, euros]) => ({ codigo, nombre: nombre(codigo), euros }));
}

const politicaDe = (programa: string) => programa.slice(0, 2);
const capituloDe = (articulo: string) => articulo.slice(0, 1);

export function resumen(year: Anio) {
  const p = datos[year];
  return {
    presupuesto: ANIOS[year],
    total_euros: total(p.lineas),
    politicas: reparto(
      p.lineas,
      ([, programa]) => politicaDe(programa),
      (c) => datos.politicas[c]!,
    ),
    capitulos: reparto(
      p.lineas,
      ([, , articulo]) => capituloDe(articulo),
      (c) => p.economicas[c]!,
    ),
  };
}

export function buscarPrograma(year: Anio, q: string) {
  const p = datos[year];
  const w = words(q);
  const programas = reparto(
    p.lineas,
    ([, programa]) => programa,
    (c) => p.programas[c]!,
  ).filter(({ codigo, nombre }) => matches(`${codigo} ${nombre}`, w));
  return {
    presupuesto: ANIOS[year],
    total: programas.length,
    programas: programas.slice(0, 30).map((programa) => ({
      ...programa,
      politica: datos.politicas[politicaDe(programa.codigo)],
    })),
  };
}

export function verPrograma(year: Anio, programa: string) {
  const p = datos[year];
  const codigo = programa.toUpperCase();
  const lineas = p.lineas.filter(([, prog]) => prog === codigo);
  if (!lineas.length)
    throw new SourceError(`No hay programa ${codigo} en ${year}. Búscalo con buscar_programa.`);
  return {
    presupuesto: ANIOS[year],
    programa: {
      codigo,
      nombre: p.programas[codigo],
      politica: datos.politicas[politicaDe(codigo)],
    },
    total_euros: total(lineas),
    por_organo: reparto(
      lineas,
      ([organica]) => organica,
      (c) => p.organicas[c]!,
    ),
    por_articulo: reparto(
      lineas,
      ([, , articulo]) => articulo,
      (c) => p.economicas[c]!,
    ),
  };
}

export function verSeccion(year: Anio, seccion: string) {
  const p = datos[year];
  const w = words(seccion);
  const todas = Object.entries(p.secciones);
  // El nombre entero gana a las coincidencias por palabras: «seguridad social» es la 60, no
  // también el Ministerio de Inclusión, Seguridad Social y Migraciones.
  const exacta = todas.filter(([, nombre]) => fold(nombre) === fold(seccion));
  const encontradas = exacta.length
    ? exacta
    : todas.filter(([codigo, nombre]) => codigo === seccion.padStart(2, '0') || matches(nombre, w));
  if (encontradas.length !== 1) {
    const opciones = encontradas.length ? encontradas : todas;
    throw new SourceError(
      `${encontradas.length ? 'Hay varias secciones' : 'No hay ninguna sección'} con «${seccion}» en ${year}. Usa el código de una de estas: ${opciones.map(([c, n]) => `${c} ${n}`).join('; ')}.`,
    );
  }
  const [codigo, nombre] = encontradas[0]!;
  const lineas = p.lineas.filter(([organica]) => organica.slice(0, 2) === codigo);
  return {
    presupuesto: ANIOS[year],
    seccion: { codigo, nombre },
    total_euros: total(lineas),
    por_programa: reparto(
      lineas,
      ([, programa]) => programa,
      (c) => p.programas[c]!,
    ),
    por_organo: reparto(
      lineas,
      ([organica]) => organica,
      (c) => p.organicas[c]!,
    ),
    por_capitulo: reparto(
      lineas,
      ([, , articulo]) => capituloDe(articulo),
      (c) => p.economicas[c]!,
    ),
  };
}

const AGENTES = {
  estado: 'Estado',
  organismos: 'Organismos autónomos',
  resto: 'Resto de entidades del sector público administrativo',
  seguridad_social: 'Seguridad Social',
};

export function ingresos(agente: keyof typeof AGENTES, q?: string) {
  const { lineas, economicas } = datos[2023].ingresos;
  const w = words(q);
  const propias = lineas.filter(([a]) => a === agente);
  return {
    presupuesto: `${ANIOS['2023']} La prórroga no publica nuevas previsiones de ingresos.`,
    agente: AGENTES[agente],
    // El total del agente, no de las líneas filtradas: los artículos (dos cifras) lo suman y los
    // conceptos (tres) son su detalle.
    total_agente_euros: propias.reduce(
      (suma, [, codigo, euros]) => suma + (codigo.length === 2 ? euros : 0),
      0,
    ),
    lineas: propias
      .filter(([, codigo]) => matches(`${codigo} ${economicas[codigo]}`, w))
      .map(([, codigo, euros]) => ({
        codigo,
        nivel: codigo.length === 2 ? 'artículo' : 'concepto',
        nombre: economicas[codigo],
        euros,
      })),
  };
}

export function createPresupuestosMcp() {
  return server(
    { name: 'reforma-digital-presupuestos', title: 'Presupuestos Generales del Estado' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'resumen_presupuesto',
        {
          title: 'Resumen del presupuesto',
          description:
            'El gasto total del año y su reparto por políticas de gasto (pensiones, defensa, deuda pública…) y por capítulos (personal, inversiones…).',
          inputSchema: z.object({ anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ anio }) => run(SOURCE, async () => resumen(anio)),
      );
      s.registerTool(
        'buscar_programa',
        {
          title: 'Buscar programa',
          description:
            'Los programas de gasto cuyo código o nombre contiene las palabras de `q` (por ejemplo «becas» o «carreteras»), con su importe, de mayor a menor.',
          inputSchema: z.object({ q: z.string().min(2).max(100), anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ q, anio }) => run(SOURCE, async () => buscarPrograma(anio, q)),
      );
      s.registerTool(
        'ver_programa',
        {
          title: 'Ver programa',
          description:
            'Un programa de gasto por su código (como 211A o 121M): su total, qué órganos lo gastan y en qué artículos (personal, transferencias, inversiones…).',
          inputSchema: z.object({
            programa: z
              .string()
              .regex(/^\d{2}[A-Za-z0-9]{2}$/)
              .describe('Código del programa, de buscar_programa.'),
            anio,
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ programa, anio }) => run(SOURCE, async () => verPrograma(anio, programa)),
      );
      s.registerTool(
        'ver_seccion',
        {
          title: 'Ver sección',
          description:
            'Un ministerio u órgano del presupuesto (sección), por su código («14») o palabras de su nombre («defensa»): su total y su reparto por programas, órganos y capítulos.',
          inputSchema: z.object({ seccion: z.string().min(1).max(100), anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ seccion, anio }) => run(SOURCE, async () => verSeccion(anio, seccion)),
      );
      s.registerTool(
        'ingresos',
        {
          title: 'Previsión de ingresos',
          description:
            'Lo que se prevé ingresar en 2023 por artículo y, en el Estado, por concepto (IRPF, IVA, Sociedades…). `q` filtra por palabras del nombre. Los ingresos del Estado por impuestos son su parte, sin la que se cede a las comunidades autónomas. Sumar agentes cuenta dos veces las transferencias entre ellos.',
          inputSchema: z.object({
            agente: z.enum(['estado', 'organismos', 'resto', 'seguridad_social']).default('estado'),
            q: z.string().max(100).optional(),
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ agente, q }) => run(SOURCE, async () => ingresos(agente, q)),
      );
    },
  );
}
