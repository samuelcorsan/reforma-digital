// Servidor MCP de los Presupuestos Generales del Estado de 2017 a 2026. No consulta a la SEPG ni a
// la IGAE en cada llamada: no tienen API y su robots.txt prohíbe rastrear, así que sirve una foto
// de sus datos oficiales (data/presupuestos/<año>.json, que genera scripts/presupuestos.ts). Los
// presupuestos cambian una vez al año como mucho; la ejecución, cada mes, y la foto dice hasta qué
// fecha llega.
import { z } from 'zod';
import { fold, matches, run, server, SourceError, words } from './comun';

const SOURCE =
  'Fuente: Secretaría de Estado de Presupuestos y Gastos (sepg.pap.hacienda.gob.es) e Intervención General de la Administración del Estado (igae.pap.hacienda.gob.es), Ministerio de Hacienda.';

const READ_ONLY_LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** Qué presupuesto rige cada año: la ley de ese año o la prórroga de una anterior. */
const ANIOS = {
  '2017': 'Ley 3/2017, de 27 de junio, de Presupuestos Generales del Estado para el año 2017.',
  '2018': 'Ley 6/2018, de 3 de julio, de Presupuestos Generales del Estado para el año 2018.',
  '2019': 'Presupuesto de 2018 prorrogado para 2019.',
  '2020': 'Presupuesto de 2018 prorrogado para 2020.',
  '2021': 'Ley 11/2020, de 30 de diciembre, de Presupuestos Generales del Estado para el año 2021.',
  '2022': 'Ley 22/2021, de 28 de diciembre, de Presupuestos Generales del Estado para el año 2022.',
  '2023': 'Ley 31/2022, de 23 de diciembre, de Presupuestos Generales del Estado para el año 2023.',
  '2024': 'Presupuesto de 2023 prorrogado para 2024.',
  '2025': 'Presupuesto de 2023 prorrogado para 2025.',
  '2026': 'Presupuesto de 2023 prorrogado para 2026.',
};
type Anio = keyof typeof ANIOS;
const LEY: Record<Anio, Anio> = {
  '2017': '2017',
  '2018': '2018',
  '2019': '2018',
  '2020': '2018',
  '2021': '2021',
  '2022': '2022',
  '2023': '2023',
  '2024': '2023',
  '2025': '2023',
  '2026': '2023',
};

const nombres = z.record(z.string(), z.string());
const s = z.string();
const n = z.number();
const presupuesto = z.object({
  // Avisos del año, como que una parte viene de la ley prorrogada.
  notas: z.array(s),
  secciones: nombres,
  organicas: nombres,
  programas: nombres,
  economicas: nombres,
  politicas: nombres,
  agentes: nombres,
  // Órgano, programa, artículo y euros: todo el gasto, consolidado.
  gastos: z.array(z.tuple([s, s, s, n])),
  // Órgano, programa, concepto o subconcepto, euros y nombre: solo lo que la ley desglosa.
  detalle: z.array(z.tuple([s, s, s, n, s])),
  // Órgano, económica (artículo, concepto o subconcepto), euros y nombre.
  ingresos: z.array(z.tuple([s, s, n, s])),
  // Órgano, programa, artículo, proyecto, nombre, comunidad, provincia, inicio, fin, coste total
  // y euros del año.
  inversiones: z.array(z.tuple([s, s, s, s, s, s, s, s, s, n, n])),
  // Entidad, proyecto, nombre, comunidad, provincia, inicio, fin, coste total y euros del año.
  empresas: z.array(z.tuple([s, s, s, s, s, s, s, n, n])),
  // Órgano, colectivo, grupo y efectivos.
  personal: z.array(z.tuple([s, s, s, n])),
  ejecucion: z.object({
    hasta: s,
    liquidacion: z.boolean(),
    // Órgano, programa, económica, créditos iniciales, definitivos, obligaciones y nombre.
    lineas: z.array(z.tuple([s, s, s, n, n, n, s])),
  }),
});
type Presupuesto = z.infer<typeof presupuesto>;

const cargados = new Map<Anio, Promise<Presupuesto>>();
// Cada año pesa unos 3 MB: se lee la primera vez que se pide, no al arrancar.
function datos(anio: Anio) {
  let p = cargados.get(anio);
  if (!p) {
    p = import(`../data/presupuestos/${anio}.json`).then(
      (m: { default: unknown }) => presupuesto.parse(m.default),
      (error: unknown) => {
        // Un fallo de lectura no se queda guardado: la próxima llamada lo vuelve a intentar.
        cargados.delete(anio);
        throw error;
      },
    );
    cargados.set(anio, p);
  }
  return p;
}

const INSTRUCTIONS = `Presupuestos Generales del Estado de 2017 a 2026: lo presupuestado, lo gastado de verdad, los ingresos previstos, las inversiones por provincia y el personal.
- Rige el presupuesto de cada año (anio, 2026 por defecto). No hubo leyes para 2019, 2020, 2024, 2025 ni 2026: se prorrogaron la de 2018 y la de 2023. Dilo al responder.
- Importes en euros. Lo presupuestado son créditos iniciales consolidados (sin transferencias internas), así que se pueden sumar.
- Lo gastado de verdad está en ejecucion: es solo del Estado (sin organismos ni Seguridad Social), dice hasta qué fecha llega y si es la liquidación definitiva o provisional; el gasto son las obligaciones reconocidas. Compáralas con los créditos de la propia ejecución, no con el presupuesto consolidado: las transferencias internas (programa 000X) van aparte.
- Para bajar al detalle: resumen_presupuesto, luego ver_seccion o buscar_programa, luego ver_programa. buscar_partidas encuentra conceptos con nombre propio (una subvención, un complemento). inversiones da proyectos por comunidad, provincia, órgano o empresa pública (Adif, AENA…). ingresos y personal, lo que dicen.
- Las prórrogas no publican ingresos, inversiones ni personal nuevos: esas herramientas te dicen a qué año ir.
- Los números de sección cambian de ministerio entre años: para comparar años, compara políticas o programas.
${SOURCE}`;

const anio = z
  .enum(['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017'])
  .default('2026')
  .describe('Año, de 2017 a 2026. Por defecto 2026, el presupuesto de 2023 prorrogado.');
const limite = z.number().int().min(1).max(200).default(50).describe('Cuántas filas como mucho.');

function reparto<T>(filas: T[], by: (fila: T) => string, euros: (fila: T) => number) {
  const sumas = new Map<string, number>();
  for (const fila of filas) sumas.set(by(fila), (sumas.get(by(fila)) ?? 0) + euros(fila));
  return [...sumas].sort((a, b) => b[1] - a[1]);
}
// Al céntimo: la ejecución trae céntimos y sumar decimales arrastra error.
const suma = <T>(filas: T[], euros: (fila: T) => number) =>
  Math.round(filas.reduce((total, fila) => total + euros(fila), 0) * 100) / 100;
// Las listas largas no le caben al asistente: se cortan diciendo cuántas había.
const recorta = <T>(filas: T[], max: number) => ({
  total_filas: filas.length,
  aviso:
    filas.length > max
      ? `Solo las ${max} primeras de ${filas.length}: afina la búsqueda o sube limite.`
      : undefined,
  filas: filas.slice(0, max),
});

// Un reparto con el nombre de cada código.
const nombrado =
  (nombre: Record<string, string>) =>
  ([codigo, euros]: [string, number]) => ({ codigo, nombre: nombre[codigo], euros });

const etiqueta = (p: Presupuesto, year: Anio) => [ANIOS[year], ...p.notas].join(' ');
// Una búsqueda sin resultados no es un cero: se dice, para que el asistente no lo dé por dato.
const nada = (que: string) =>
  new SourceError(`Ninguna fila coincide con ${que}. Prueba con menos palabras u otro filtro.`);

const soloLey = (year: Anio, que: string) =>
  new SourceError(
    `La prórroga de ${year} no publica ${que}. El último publicado es el de la ley de ${LEY[year]}, con importes de ${LEY[year]}: pide anio=${LEY[year]} y preséntalos como cifras de ${LEY[year]}.`,
  );

// Las transferencias del Estado a sus organismos y a la Seguridad Social (programa 000X) no son
// gasto final: el presupuesto consolidado las quita, así que la ejecución las da aparte.
const INTERNAS = '000X';
function totalesEjecucion(p: Presupuesto, year: Anio, lineas: Presupuesto['ejecucion']['lineas']) {
  const propias = lineas.filter(([, prog]) => prog !== INTERNAS);
  const internas = lineas.filter(([, prog]) => prog === INTERNAS);
  return {
    ambito: 'Estado, sin organismos autónomos ni Seguridad Social.',
    hasta: `${p.ejecucion.hasta} de ${year}`,
    definitiva: p.ejecucion.liquidacion,
    creditos_iniciales_euros: suma(propias, (l) => l[3]),
    creditos_definitivos_euros: suma(propias, (l) => l[4]),
    obligaciones_reconocidas_euros: suma(propias, (l) => l[5]),
    transferencias_internas_obligaciones_euros: internas.length
      ? suma(internas, (l) => l[5])
      : undefined,
  };
}

export async function resumen(year: Anio) {
  const p = await datos(year);
  return {
    presupuesto: etiqueta(p, year),
    total_euros: suma(p.gastos, (l) => l[3]),
    politicas: reparto(
      p.gastos,
      ([, prog]) => prog.slice(0, 2),
      (l) => l[3],
    ).map(nombrado(p.politicas)),
    capitulos: reparto(
      p.gastos,
      ([, , art]) => art.slice(0, 1),
      (l) => l[3],
    ).map(nombrado(p.economicas)),
    secciones: reparto(
      p.gastos,
      ([org]) => org.slice(0, 2),
      (l) => l[3],
    ).map(nombrado(p.secciones)),
    ejecucion: totalesEjecucion(p, year, p.ejecucion.lineas),
  };
}

export async function buscarPrograma(year: Anio, q?: string, politica?: string) {
  const p = await datos(year);
  const w = words(q);
  const programas = reparto(
    p.gastos,
    ([, prog]) => prog,
    (l) => l[3],
  )
    .filter(([c]) => (!politica || c.startsWith(politica)) && matches(`${c} ${p.programas[c]}`, w))
    .map(([codigo, euros]) => ({
      codigo,
      nombre: p.programas[codigo],
      politica: p.politicas[codigo.slice(0, 2)],
      euros,
    }));
  if (!programas.length) throw nada('esa búsqueda de programas');
  return { presupuesto: etiqueta(p, year), ...recorta(programas, 60) };
}

export async function verPrograma(year: Anio, programa: string) {
  const p = await datos(year);
  const codigo = programa.toUpperCase();
  const lineas = p.gastos.filter(([, prog]) => prog === codigo);
  const ejecutado = p.ejecucion.lineas.filter(([, prog]) => prog === codigo);
  if (!lineas.length && !ejecutado.length)
    throw new SourceError(`No hay programa ${codigo} en ${year}. Búscalo con buscar_programa.`);
  return {
    presupuesto: etiqueta(p, year),
    programa: {
      codigo,
      nombre: p.programas[codigo],
      politica: p.politicas[codigo.slice(0, 2)],
    },
    total_euros: suma(lineas, (l) => l[3]),
    nota: lineas.length
      ? undefined
      : 'Programa creado durante el año: no tiene crédito en el presupuesto inicial, solo ejecución.',
    // Quién gasta y en qué: cada órgano con sus artículos.
    por_organo: reparto(
      lineas,
      ([org]) => org,
      (l) => l[3],
    ).map(([org, euros]) => ({
      codigo: org,
      nombre: p.organicas[org],
      euros,
      articulos: lineas
        .filter(([o]) => o === org)
        .sort((a, b) => b[3] - a[3])
        .map(([, , art, e]) => ({ codigo: art, nombre: p.economicas[art], euros: e })),
    })),
    detalle: p.detalle
      .filter(([, prog]) => prog === codigo)
      .map(([organo, , economica, euros, nombre]) => ({ organo, economica, nombre, euros })),
    ejecucion: ejecutado.length ? totalesEjecucion(p, year, ejecutado) : undefined,
  };
}

export async function verSeccion(year: Anio, seccion: string) {
  const p = await datos(year);
  const todas = Object.entries(p.secciones);
  // El nombre entero gana a las coincidencias por palabras: «seguridad social» es la 60, no
  // también el ministerio que la lleva en el nombre.
  const exacta = todas.filter(([, nombre]) => fold(nombre) === fold(seccion));
  const w = words(seccion);
  // Un código solo se busca como código: «20» no es también «…AGENDA 2030».
  const pedido = /^\d{1,2}$/.test(seccion.trim()) ? seccion.trim().padStart(2, '0') : undefined;
  const encontradas = pedido
    ? todas.filter(([c]) => c === pedido)
    : exacta.length
      ? exacta
      : todas.filter(([, nombre]) => matches(nombre, w));
  if (encontradas.length !== 1) {
    const opciones = encontradas.length ? encontradas : todas;
    throw new SourceError(
      `${encontradas.length ? 'Hay varias secciones' : 'No hay ninguna sección'} con «${seccion}» en ${year}. Usa el código de una de estas: ${opciones.map(([c, nombre]) => `${c} ${nombre}`).join('; ')}.`,
    );
  }
  const [codigo, nombre] = encontradas[0]!;
  const lineas = p.gastos.filter(([org]) => org.slice(0, 2) === codigo);
  const ejecutado = p.ejecucion.lineas.filter(([org]) => org.slice(0, 2) === codigo);
  return {
    presupuesto: etiqueta(p, year),
    seccion: { codigo, nombre },
    total_euros: suma(lineas, (l) => l[3]),
    por_programa: reparto(
      lineas,
      ([, prog]) => prog,
      (l) => l[3],
    ).map(nombrado(p.programas)),
    por_organo: reparto(
      lineas,
      ([org]) => org,
      (l) => l[3],
    ).map(nombrado(p.organicas)),
    por_capitulo: reparto(
      lineas,
      ([, , art]) => art.slice(0, 1),
      (l) => l[3],
    ).map(nombrado(p.economicas)),
    ejecucion: ejecutado.length ? totalesEjecucion(p, year, ejecutado) : undefined,
  };
}

const filtros = {
  seccion: z
    .string()
    .regex(/^\d{1,2}$/)
    .optional()
    .describe('Código de sección, como 14.'),
  organo: z
    .string()
    .regex(/^\d{2}\.\d{2,3}$/)
    .optional()
    .describe('Código de órgano, como 16.04.'),
  programa: z
    .string()
    .regex(/^\d{2}[A-Za-zÑñ0-9]{2}$/)
    .optional()
    .describe('Código de programa, como 211A o 26BA.'),
  economica: z
    .string()
    .regex(/^\d{1,7}$/)
    .optional()
    .describe('Clasificación económica por prefijo: 1 (personal), 48, 480…'),
};
type Filtros = { seccion?: string; organo?: string; programa?: string; economica?: string };
const pasa = (f: Filtros, org: string, prog?: string, eco?: string) =>
  (!f.seccion || org.slice(0, 2) === f.seccion.padStart(2, '0')) &&
  (!f.organo || org === f.organo) &&
  (!f.programa || prog === f.programa.toUpperCase()) &&
  (!f.economica || (eco ?? '').startsWith(f.economica));

export async function buscarPartidas(year: Anio, q: string | undefined, f: Filtros, max: number) {
  const p = await datos(year);
  const w = words(q);
  const filas = p.detalle
    .filter(([org, prog, eco, , nombre]) => pasa(f, org, prog, eco) && matches(nombre, w))
    .sort((a, b) => b[3] - a[3]);
  if (!filas.length) throw nada('esa búsqueda de partidas (solo están las que la ley desglosa)');
  // Un subconcepto ya cuenta en su concepto: el total solo suma las filas sin un padre entre ellas.
  const salen = new Set(filas.map(([org, prog, eco]) => `${org}|${prog}|${eco}`));
  const sinPadre = filas.filter(
    ([org, prog, eco]) =>
      ![3, 4].some((len) => len < eco.length && salen.has(`${org}|${prog}|${eco.slice(0, len)}`)),
  );
  return {
    presupuesto: etiqueta(p, year),
    total_euros: suma(sinPadre, (l) => l[3]),
    ...recorta(
      filas.map(([org, prog, economica, euros, nombre]) => ({
        organo: `${org} ${p.organicas[org]}`,
        programa: `${prog} ${p.programas[prog]}`,
        economica,
        nombre,
        euros,
      })),
      max,
    ),
  };
}

type Inversion = {
  titular: string;
  programa?: string;
  proyecto: string;
  nombre: string;
  comunidad: string;
  provincia: string;
  inicio: string;
  fin: string;
  coste_total_euros: number;
  euros: number;
};

export async function inversiones(
  year: Anio,
  q: string | undefined,
  territorio: string | undefined,
  f: Filtros,
  soloAdministracion: boolean,
  max: number,
) {
  const p = await datos(year);
  if (!p.inversiones.length) throw soloLey(year, 'anexo de inversiones');
  const w = words(q);
  const t = words(territorio);
  // «León» es la provincia, no también Castilla y León: el nombre entero (o una mitad de «A/B»)
  // gana a las palabras sueltas, que solo se usan si ningún lugar se llama así.
  const nombreEntero = (lugar: string) =>
    territorio !== undefined && [fold(lugar), ...fold(lugar).split('/')].includes(fold(territorio));
  const exacto = [
    ...p.inversiones.flatMap((r) => [r[5], r[6]]),
    ...p.empresas.flatMap((r) => [r[3], r[4]]),
  ].some(nombreEntero);
  const enTerritorio = (com: string, prov: string) =>
    exacto ? nombreEntero(com) || nombreEntero(prov) : matches(`${com} ${prov}`, t);
  // Las empresas no tienen sección, órgano ni programa: un filtro por código las deja fuera.
  const conEmpresas = !soloAdministracion && !f.seccion && !f.organo && !f.programa && !f.economica;
  const filas: Inversion[] = [
    ...p.inversiones
      .filter(
        ([org, prog, art, , nombre, com, prov]) =>
          pasa(f, org, prog, art) &&
          matches(`${nombre} ${p.organicas[org] ?? ''}`, w) &&
          enTerritorio(com, prov),
      )
      .map(
        ([org, programa, , proyecto, nombre, comunidad, provincia, inicio, fin, coste, euros]) => ({
          titular: `${org} ${p.organicas[org] ?? ''}`.trim(),
          programa,
          proyecto,
          nombre,
          comunidad,
          provincia,
          inicio,
          fin,
          coste_total_euros: coste,
          euros,
        }),
      ),
    ...(conEmpresas ? p.empresas : [])
      .filter(
        ([entidad, , nombre, com, prov]) =>
          matches(`${entidad} ${nombre}`, w) && enTerritorio(com, prov),
      )
      .map(([titular, proyecto, nombre, comunidad, provincia, inicio, fin, coste, euros]) => ({
        titular,
        proyecto,
        nombre,
        comunidad,
        provincia,
        inicio,
        fin,
        coste_total_euros: coste,
        euros,
      })),
  ].sort((a, b) => b.euros - a.euros);
  if (!filas.length)
    throw nada('esa búsqueda de inversiones (sus artículos tienen dos cifras, como 62)');
  const titulares = reparto(
    filas,
    (r) => r.titular,
    (r) => r.euros,
  );
  return {
    presupuesto: etiqueta(p, year),
    nota: 'Un proyecto que abarca varias provincias sale una vez en cada una con su parte. Las empresas y fundaciones públicas entran salvo que se filtre por código o por solo_administracion.',
    total_euros: suma(filas, (r) => r.euros),
    por_provincia: reparto(
      filas,
      (r) => `${r.provincia} (${r.comunidad})`,
      (r) => r.euros,
    ).map(([provincia, euros]) => ({ provincia, euros })),
    total_titulares: titulares.length,
    por_titular: titulares.slice(0, 30).map(([titular, euros]) => ({ titular, euros })),
    ...recorta(filas, max),
  };
}

export async function ingresos(
  year: Anio,
  entidad: string | undefined,
  q: string | undefined,
  max: number,
) {
  const p = await datos(year);
  if (!p.ingresos.length) throw soloLey(year, 'previsiones de ingresos');
  const e = words(entidad);
  const w = words(q);
  const deEntidad = p.ingresos.filter(([org]) =>
    matches(`${org} ${p.organicas[org]} ${p.agentes[org]}`, e),
  );
  const filas = deEntidad.filter(([, eco, , nombre]) => matches(`${eco} ${nombre}`, w));
  if (!filas.length) throw nada('esa entidad y esa búsqueda de ingresos');
  const entidades = reparto(
    deEntidad.filter(([, eco]) => eco.length === 2),
    ([org]) => org,
    (l) => l[2],
  );
  return {
    presupuesto: etiqueta(p, year),
    nota: 'Sin consolidar: sumar entidades cuenta dos veces lo que se transfieren. Los impuestos del Estado son su parte, sin la cedida a las comunidades autónomas.',
    // El total de cada entidad son sus artículos; conceptos y subconceptos son su detalle.
    total_entidades: entidades.length,
    entidades: entidades.slice(0, 30).map(([org, euros]) => ({
      codigo: org,
      nombre: p.organicas[org],
      agente: p.agentes[org],
      total_euros: euros,
    })),
    ...recorta(
      filas.map(([org, economica, euros, nombre]) => ({
        entidad: org,
        economica,
        nivel:
          economica.length === 2 ? 'artículo' : economica.length === 3 ? 'concepto' : 'subconcepto',
        nombre,
        euros,
      })),
      max,
    ),
  };
}

export async function personal(
  year: Anio,
  seccion: string | undefined,
  organo: string | undefined,
) {
  const p = await datos(year);
  if (!p.personal.length) throw soloLey(year, 'anexo de personal');
  const w = words(organo);
  const filas = p.personal.filter(
    ([org]) => pasa({ seccion }, org) && matches(`${org} ${p.organicas[org]}`, w),
  );
  if (!filas.length) throw nada('ese órgano');
  const organos = reparto(
    filas,
    ([org]) => org,
    (l) => l[3],
  );
  return {
    presupuesto: etiqueta(p, year),
    nota: 'Efectivos presupuestados del anexo de personal. La Seguridad Social no está en este anexo.',
    efectivos: suma(filas, (l) => l[3]),
    por_colectivo: reparto(
      filas,
      ([, colectivo]) => colectivo,
      (l) => l[3],
    ).map(([colectivo, efectivos]) => ({ colectivo, efectivos })),
    total_organos: organos.length,
    por_organo: organos.slice(0, 60).map(([org, efectivos]) => ({
      codigo: org,
      nombre: p.organicas[org],
      efectivos,
      grupos: filas
        .filter(([o]) => o === org)
        .map(([, colectivo, grupo, e]) => ({ colectivo, grupo, efectivos: e })),
    })),
  };
}

export async function ejecucion(year: Anio, q: string | undefined, f: Filtros, max: number) {
  const p = await datos(year);
  const w = words(q);
  const todas = p.ejecucion.lineas
    .filter(([org, prog, eco, , , , nombre]) => pasa(f, org, prog, eco) && matches(nombre, w))
    .sort((a, b) => b[4] - a[4]);
  if (!todas.length) throw nada('esa búsqueda en la ejecución');
  const totales = totalesEjecucion(p, year, todas);
  // Las transferencias internas solo salen como filas si se pide su programa.
  const filas = f.programa ? todas : todas.filter(([, prog]) => prog !== INTERNAS);
  return {
    presupuesto: etiqueta(p, year),
    ...totales,
    ejecutado_pct: totales.creditos_definitivos_euros
      ? Math.round(
          (totales.obligaciones_reconocidas_euros / totales.creditos_definitivos_euros) * 1000,
        ) / 10
      : undefined,
    ...recorta(
      filas.map(([org, programa, economica, ini, def, obl, nombre]) => ({
        organo: `${org} ${p.organicas[org] ?? ''}`.trim(),
        programa,
        economica,
        nombre,
        creditos_iniciales_euros: ini,
        creditos_definitivos_euros: def,
        obligaciones_reconocidas_euros: obl,
      })),
      max,
    ),
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
            'El gasto total del año y su reparto por políticas (pensiones, defensa, deuda…), capítulos y secciones, con lo que lleva gastado el Estado.',
          inputSchema: z.object({ anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ anio }) => run(SOURCE, () => resumen(anio)),
      );
      s.registerTool(
        'buscar_programa',
        {
          title: 'Buscar programa',
          description:
            'Programas de gasto por palabras del nombre o del código («becas», «carreteras», «211A») o por política (21 pensiones, 12 defensa…), con su importe.',
          inputSchema: z.object({
            q: z.string().max(100).optional(),
            politica: z
              .string()
              .regex(/^\d{2}$/)
              .optional()
              .describe('Código de política, como 21.'),
            anio,
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ q, politica, anio }) => run(SOURCE, () => buscarPrograma(anio, q, politica)),
      );
      s.registerTool(
        'ver_programa',
        {
          title: 'Ver programa',
          description:
            'Un programa por su código: total, cada órgano con sus artículos de gasto, el detalle por concepto que da la ley y, si es del Estado, lo gastado.',
          inputSchema: z.object({ programa: filtros.programa.unwrap(), anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ programa, anio }) => run(SOURCE, () => verPrograma(anio, programa)),
      );
      s.registerTool(
        'ver_seccion',
        {
          title: 'Ver sección',
          description:
            'Un ministerio u órgano constitucional (sección), por código («14») o nombre («defensa»): total, programas, órganos, capítulos y lo gastado.',
          inputSchema: z.object({ seccion: z.string().min(1).max(100), anio }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ seccion, anio }) => run(SOURCE, () => verSeccion(anio, seccion)),
      );
      s.registerTool(
        'buscar_partidas',
        {
          title: 'Buscar partidas',
          description:
            'Conceptos y subconceptos de gasto con nombre propio: una subvención a una entidad, un complemento, un convenio («Federación Española de Municipios», «productividad»). Solo lo que la ley desglosa.',
          inputSchema: z.object({ q: z.string().max(100).optional(), ...filtros, anio, limite }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ q, anio, limite, ...f }) => run(SOURCE, () => buscarPartidas(anio, q, f, limite)),
      );
      s.registerTool(
        'inversiones',
        {
          title: 'Inversiones',
          description:
            'Proyectos de inversión del año por comunidad o provincia, órgano, programa o empresa pública (Adif, AENA, Puertos…), con su coste total y lo previsto para el año.',
          inputSchema: z.object({
            q: z
              .string()
              .max(100)
              .optional()
              .describe('Palabras del proyecto o del titular, como «adif» o «autovía».'),
            territorio: z
              .string()
              .max(60)
              .optional()
              .describe('Comunidad o provincia, como «Málaga».'),
            ...filtros,
            solo_administracion: z
              .boolean()
              .default(false)
              .describe('Sin las empresas ni fundaciones públicas.'),
            anio,
            limite,
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ q, territorio, solo_administracion, anio, limite, ...f }) =>
          run(SOURCE, () => inversiones(anio, q, territorio, f, solo_administracion, limite)),
      );
      s.registerTool(
        'ingresos',
        {
          title: 'Ingresos previstos',
          description:
            'Ingresos previstos por entidad (Estado, Seguridad Social, un organismo) y por artículo, concepto o subconcepto (IRPF, IVA, cotizaciones…).',
          inputSchema: z.object({
            entidad: z
              .string()
              .max(100)
              .optional()
              .describe('Como «estado», «seguridad social» o un organismo.'),
            q: z.string().max(100).optional(),
            anio,
            limite,
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ entidad, q, anio, limite }) => run(SOURCE, () => ingresos(anio, entidad, q, limite)),
      );
      s.registerTool(
        'personal',
        {
          title: 'Personal',
          description:
            'Efectivos presupuestados por órgano, colectivo (funcionarios, laborales, personal vario…) y grupo.',
          inputSchema: z.object({
            organo: z
              .string()
              .max(100)
              .optional()
              .describe('Palabras o código del órgano, como «guardia civil».'),
            seccion: filtros.seccion,
            anio,
          }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ organo, seccion, anio }) => run(SOURCE, () => personal(anio, seccion, organo)),
      );
      s.registerTool(
        'ejecucion',
        {
          title: 'Ejecución',
          description:
            'Lo gastado de verdad por el Estado: créditos iniciales, definitivos y obligaciones reconocidas por aplicación, hasta la fecha que indica. Filtra por sección, órgano, programa, económica o palabras.',
          inputSchema: z.object({ q: z.string().max(100).optional(), ...filtros, anio, limite }),
          annotations: READ_ONLY_LOCAL,
        },
        ({ q, anio, limite, ...f }) => run(SOURCE, () => ejecucion(anio, q, f, limite)),
      );
    },
  );
}
