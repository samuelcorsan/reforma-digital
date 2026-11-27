// Servidor MCP del BORME (Boletín Oficial del Registro Mercantil): el sumario de cada día y los
// actos inscritos de cada provincia, de la API de datos abiertos del BOE
// (https://www.boe.es/datosabiertos/), sin clave. Los actos se leen de la versión XML de cada
// documento provincial, que trae una inscripción por empresa sin tener que leer el PDF.
import { z } from 'zod';
import {
  decode,
  fold,
  get,
  list,
  matches,
  READ_ONLY_EXTERNAL,
  run,
  server,
  SourceError,
  words,
  type Fetch,
} from './comun';

const API = 'https://www.boe.es/datosabiertos/api/borme';
const SOURCE =
  'Fuente: Agencia Estatal Boletín Oficial del Estado (boe.es), datos abiertos del BORME. El texto con valor jurídico es el publicado en el BORME.';
// Cada día de búsqueda son hasta dos peticiones al BOE: más de un mes no cabe en una llamada.
const MAX_DIAS = 31;
const MAX_RESULTADOS = 50;
// Antes de 2009 la API responde 404 también los días que sí hubo BORME.
const DESDE = '2009-01-01';

/** Las palabras de un filtro; uno sin ninguna de tres letras lo aceptaría casi todo. */
function filtro(text: string | undefined, nombre: string) {
  const q = words(text);
  // Un filtro dado pero vacío no filtraría nada y la respuesta parecería filtrada.
  if (text !== undefined && !q.some((w) => w.length >= 3))
    throw new SourceError(`${nombre} necesita al menos una palabra de tres letras o más.`);
  return q;
}

const INSTRUCTIONS = `El Boletín Oficial del Registro Mercantil: los actos que inscriben cada día los registros mercantiles (constituciones, nombramientos, ceses, cambios de domicilio, ampliaciones de capital, disoluciones, concursos…) y los anuncios de las empresas.
- sumario_borme da los documentos de un día: uno por provincia con los actos inscritos y los anuncios (convocatorias de juntas, fusiones…).
- actos_provincia da las inscripciones de una provincia en un día, separadas por empresa y por acto; filtra por empresa o por tipo de acto.
- buscar_empresa busca una empresa por su nombre en una provincia durante los últimos días (como mucho ${MAX_DIAS}).
- La provincia es la del registro mercantil donde está inscrita la empresa, que es la de su domicilio social.
- El BORME sale de lunes a viernes salvo algunos festivos: los días sin BORME, las herramientas lo dicen.
- Las fechas son AAAA-MM-DD. Cita siempre el identificador (BORME-A-…) y el enlace.
${SOURCE}`;

// El número es el código de provincia del INE, que es el final del identificador de su documento
// (BORME-A-2026-223-20 es Gipuzkoa). Tras el nombre, otros con que se la conoce.
const PROVINCIAS: [string, string, ...string[]][] = [
  ['01', 'Araba/Álava'],
  ['02', 'Albacete'],
  ['03', 'Alicante/Alacant'],
  ['04', 'Almería'],
  ['05', 'Ávila'],
  ['06', 'Badajoz'],
  ['07', 'Illes Balears', 'Baleares', 'Islas Baleares'],
  ['08', 'Barcelona'],
  ['09', 'Burgos'],
  ['10', 'Cáceres'],
  ['11', 'Cádiz'],
  ['12', 'Castellón/Castelló'],
  ['13', 'Ciudad Real'],
  ['14', 'Córdoba'],
  ['15', 'A Coruña', 'La Coruña', 'Coruña'],
  ['16', 'Cuenca'],
  ['17', 'Girona', 'Gerona'],
  ['18', 'Granada'],
  ['19', 'Guadalajara'],
  ['20', 'Gipuzkoa', 'Guipúzcoa'],
  ['21', 'Huelva'],
  ['22', 'Huesca'],
  ['23', 'Jaén'],
  ['24', 'León'],
  ['25', 'Lleida', 'Lérida'],
  ['26', 'La Rioja', 'Rioja'],
  ['27', 'Lugo'],
  ['28', 'Madrid'],
  ['29', 'Málaga'],
  ['30', 'Murcia'],
  ['31', 'Navarra', 'Nafarroa'],
  ['32', 'Ourense', 'Orense'],
  ['33', 'Asturias'],
  ['34', 'Palencia'],
  ['35', 'Las Palmas'],
  ['36', 'Pontevedra'],
  ['37', 'Salamanca'],
  ['38', 'Santa Cruz de Tenerife', 'Tenerife'],
  ['39', 'Cantabria'],
  ['40', 'Segovia'],
  ['41', 'Sevilla'],
  ['42', 'Soria'],
  ['43', 'Tarragona'],
  ['44', 'Teruel'],
  ['45', 'Toledo'],
  ['46', 'Valencia/València'],
  ['47', 'Valladolid'],
  ['48', 'Bizkaia', 'Vizcaya'],
  ['49', 'Zamora'],
  ['50', 'Zaragoza'],
  ['51', 'Ceuta'],
  ['52', 'Melilla'],
];

function provincia(nombre: string) {
  const buscada = fold(nombre);
  const p = PROVINCIAS.find(([codigo, oficial, ...otros]) =>
    [codigo, oficial, ...oficial.split('/'), ...otros].some((n) => fold(n) === buscada),
  );
  if (!p)
    throw new SourceError(
      `«${nombre}» no es una provincia. Escribe su nombre, como Gipuzkoa, Bizkaia, Madrid o Illes Balears.`,
    );
  return { codigo: p[0], nombre: p[1] };
}

// Los actos que el registro publica, en el orden en que pueden aparecer en una inscripción. Lo que
// sigue a uno hasta el siguiente es su detalle; los que tienen variantes llevan su patrón.
const ACTOS: [string, string?][] = [
  ['Constitución'],
  ['Empresario Individual'],
  ['Primera inscripción', String.raw`Primera inscripción(?: \([^)]*\))?`],
  ['Primera sucursal de sociedad extranjera'],
  ['Nombramientos'],
  ['Ceses/Dimisiones'],
  ['Revocaciones'],
  ['Reelecciones'],
  ['Cancelaciones de oficio de nombramientos'],
  ['Modificación de poderes'],
  ['Cambio de domicilio social'],
  ['Cambio de objeto social'],
  ['Ampliación del objeto social'],
  ['Cambio de denominación social'],
  ['Página web de la sociedad'],
  ['Ampliación de capital'],
  ['Reducción de capital'],
  ['Desembolso de dividendos pasivos'],
  ['Emisión de obligaciones'],
  ['Modificaciones estatutarias'],
  [
    'Adaptación',
    String.raw`Adaptación (?:de sociedad|Ley [\d/]+|a la Ley de Sociedades de Capital[^.]*)`,
  ],
  ['Declaración de unipersonalidad'],
  ['Pérdida del carácter de unipersonalidad'],
  ['Sociedad unipersonal'],
  ['Cambio de identidad del socio único'],
  ['Transformación de sociedad'],
  ['Fusión por absorción'],
  ['Fusión por unión'],
  ['Escisión parcial'],
  ['Escisión total'],
  ['Segregación'],
  ['Cesión global de activo y pasivo'],
  ['Sucursal'],
  ['Disolución'],
  ['Extinción'],
  ['Reactivación de la sociedad', String.raw`Reactivación de la sociedad(?: \([^)]*\))?`],
  ['Situación concursal'],
  ['Crédito incobrable'],
  ['Anotación preventiva'],
  [
    'Cierre provisional de la hoja registral',
    String.raw`Cierre provisional (?:de la )?hoja registral(?: Art\.\s?\d+ TRLC| por [^.]+)?`,
  ],
  ['Reapertura hoja registral'],
  ['Articulo 378.5 del Reglamento del Registro Mercantil'],
  ['Depósito de libros'],
  ['Fe de erratas'],
  ['Otros conceptos'],
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Los BORME antiguos escriben muchos actos sin tilde («Ampliacion del objeto social»).
const sinTilde = (patron: string) => patron.replace(/[áéíóú]/g, (c) => `[${c}${fold(c)}]`);
// Un acto empieza la inscripción o una frase (a veces tras «.-»), y acaba en punto o dos puntos:
// así «Constitución» dentro del objeto social («…constitución de sociedades») no corta el texto.
// Un grupo por acto, para saber cuál es aunque el boletín use una variante.
const ACTO = new RegExp(
  String.raw`(?<=^|\.-?\s+)(?:${ACTOS.map(([nombre, patron]) => `(${sinTilde(patron ?? escape(nombre))})`).join('|')})(?=\s*[.:])`,
  'g',
);

type Acto = { acto: string; detalle?: string };
export type Inscripcion = {
  numero: string;
  empresa: string;
  actos: Acto[];
  datos_registrales?: string;
};

const limpio = (text: string) =>
  text
    .replace(/^[\s.:]+/, '')
    .replace(/[\s.-]+$/, '')
    .replace(/\s+/g, ' ');

/** Un título en una línea: los de fusiones y escisiones traen saltos entre las sociedades. */
const unaLinea = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Una inscripción por empresa: «524236 - EMPRESA SL.» y el párrafo con sus actos. */
export function inscripciones(xml: string): Inscripcion[] {
  const parrafos = [...xml.matchAll(/<p class="(articulo|parrafo)">([\s\S]*?)<\/p>/g)];
  const result: Inscripcion[] = [];
  for (const [, clase, html] of parrafos) {
    const text = decode((html ?? '').replace(/<[^>]+>/g, '')).trim();
    if (clase === 'articulo') {
      const cabecera = /^(\d+) - (.+?)\.?$/.exec(text);
      if (!cabecera) throw new SourceError(`El BORME trae una inscripción sin número: «${text}».`);
      result.push({ numero: cabecera[1] ?? '', empresa: cabecera[2] ?? '', actos: [] });
      continue;
    }
    const inscripcion = result.at(-1);
    if (!inscripcion) throw new SourceError('El BORME trae actos antes de la primera empresa.');
    // Los datos registrales cierran el párrafo, a veces sin punto antes.
    const registro = /\s+Datos registrales\.\s*([\s\S]*)$/.exec(text);
    if (registro) inscripcion.datos_registrales = limpio(registro[1] ?? '');
    const actos = registro ? text.slice(0, registro.index) : text;
    const cortes = [...actos.matchAll(ACTO)];
    // Lo que no empieza por un acto conocido se guarda igual: no se pierde texto del boletín.
    const antes = limpio(actos.slice(0, cortes[0]?.index ?? actos.length));
    if (antes) inscripcion.actos.push({ acto: 'Sin clasificar', detalle: antes });
    cortes.forEach((corte, i) => {
      const grupo = corte.slice(1).findIndex(Boolean);
      const acto = ACTOS[grupo]?.[0] ?? '';
      const encabezado = corte[0];
      const resto = limpio(actos.slice(corte.index + encabezado.length, cortes[i + 1]?.index));
      // La variante del boletín («hoja registral Art.485 TRLC») va al detalle; el acto, con su nombre.
      // Sin tilde es el mismo acto, no una variante.
      const detalle = [fold(encabezado) === fold(acto) ? '' : encabezado, resto]
        .filter(Boolean)
        .join('. ');
      inscripcion.actos.push(detalle ? { acto, detalle } : { acto });
    });
  }
  return result;
}

type Item = {
  identificador: string;
  titulo: string;
  url_html: string;
  url_xml: string;
  url_pdf: { texto: string };
};
type Apartado = { nombre: string; item: Item | Item[] };
type Seccion = {
  codigo: string;
  nombre: string;
  item?: Item | Item[];
  apartado?: Apartado | Apartado[];
};
type Diario = {
  numero: string;
  sumario_diario: { identificador: string; url_pdf: { texto: string } };
  seccion: Seccion | Seccion[];
};

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

/** Los diarios del día, o `undefined` si ese día no hay BORME. */
async function diarios(fetchImpl: Fetch, fecha: string) {
  try {
    const response = await get(fetchImpl, `${API}/sumario/${fecha.replaceAll('-', '')}`);
    const body = (await response.json()) as { data: { sumario: { diario: Diario[] } } };
    return body.data.sumario.diario;
  } catch (error) {
    // Los fines de semana y festivos no hay BORME: la API responde 404.
    if (error instanceof SourceError && error.status === 404) return undefined;
    throw error;
  }
}

function sinBorme(fecha: string) {
  if (fecha < DESDE)
    return new SourceError(
      `Los datos abiertos del BORME empiezan en ${DESDE}: el del ${fecha} está en https://www.boe.es/borme/.`,
    );
  if (fecha > hoy()) return new SourceError(`No hay BORME del ${fecha}: es una fecha futura.`);
  return new SourceError(
    `No hay BORME del ${fecha}. Se publica de lunes a viernes salvo algunos festivos${fecha === hoy() ? ', y el del día sale por la mañana' : ''}.`,
  );
}

export async function sumarioBorme(fetchImpl: Fetch, fecha: string) {
  const dias = await diarios(fetchImpl, fecha);
  if (!dias) throw sinBorme(fecha);
  return {
    fecha,
    diarios: dias.map((d) => ({
      numero: d.numero,
      id: d.sumario_diario.identificador,
      pdf: d.sumario_diario.url_pdf.texto,
      secciones: list(d.seccion).map((s) => ({
        seccion: s.nombre,
        documentos: [
          ...list(s.item).map((i) => ({
            id: i.identificador,
            titulo: unaLinea(i.titulo),
            url: i.url_html,
          })),
          ...list(s.apartado).flatMap((a) =>
            list(a.item).map((i) => ({
              id: i.identificador,
              titulo: unaLinea(i.titulo),
              apartado: a.nombre,
              url: i.url_html,
            })),
          ),
        ],
      })),
    })),
  };
}

/** El documento de actos inscritos de la provincia ese día, si lo hay. */
function documento(dias: Diario[], codigo: string) {
  const items = dias
    .flatMap((d) => list(d.seccion))
    .filter((s) => s.codigo === 'A')
    .flatMap((s) => list(s.item));
  // Un día con BORME siempre trae la sección primera: sin ella, el formato ha cambiado.
  if (items.length === 0)
    throw new SourceError('El sumario del BORME no trae la sección de actos inscritos.');
  return items.find((i) => i.identificador.endsWith(`-${codigo}`));
}

/** Los tipos de acto que pide el filtro: si uno se llama exactamente así, solo ese. */
function tiposDeActo(acto: string[]) {
  const nombres = ACTOS.map(([n]) => n).filter((n) => matches(n, acto));
  const exacto = nombres.filter((n) => words(n).join(' ') === acto.join(' '));
  return new Set(exacto.length > 0 ? exacto : nombres);
}

async function leer(fetchImpl: Fetch, item: Item) {
  const xml = await (await get(fetchImpl, item.url_xml, 'application/xml')).text();
  const result = inscripciones(xml);
  // Un documento sin inscripciones es que el formato ha cambiado, no que no haya actos.
  if (result.length === 0)
    throw new SourceError(`No se han podido leer las inscripciones de ${item.identificador}.`);
  return result;
}

/** Las palabras de un nombre de empresa, sin puntos ni comas: «S.L.» es «SL». */
const nombreEmpresa = (text: string) => text.replace(/[.,]/g, '');

// El BORME escribe la forma jurídica de varias maneras («SL», «SOCIEDAD LIMITADA»): buscarla daría
// cero resultados que parecen reales, así que la búsqueda va sin ella.
const FORMAS = new Set([
  'sl',
  'slu',
  'sll',
  'slp',
  'sa',
  'sau',
  'sociedad',
  'limitada',
  'anonima',
  'unipersonal',
]);
function filtroEmpresa(text: string | undefined) {
  const q = filtro(text === undefined ? undefined : nombreEmpresa(text), 'El nombre de la empresa');
  const sinForma = q.filter((w) => !FORMAS.has(w));
  if (text !== undefined && !sinForma.some((w) => w.length >= 3))
    throw new SourceError(
      'El nombre de la empresa necesita al menos una palabra de tres letras o más, sin contar la forma jurídica.',
    );
  return sinForma;
}

export async function actosProvincia(
  fetchImpl: Fetch,
  fecha: string,
  nombre: string,
  filtros: { empresa?: string; acto?: string; pagina: number; limite: number },
) {
  const p = provincia(nombre);
  const acto = filtro(filtros.acto, 'El tipo de acto');
  const tipos = tiposDeActo(acto);
  // Un tipo de acto que no existe daría cero resultados como si no hubiera ninguno ese día.
  if (acto.length > 0 && tipos.size === 0)
    throw new SourceError(
      `«${filtros.acto}» no es un tipo de acto del BORME. Los tipos son: ${ACTOS.map(([n]) => n).join(', ')}.`,
    );
  const dias = await diarios(fetchImpl, fecha);
  if (!dias) throw sinBorme(fecha);
  const item = documento(dias, p.codigo);
  if (!item)
    return {
      fecha,
      provincia: p.nombre,
      total: 0,
      inscripciones: [],
      nota: `El BORME del ${fecha} no publica actos inscritos de ${p.nombre}.`,
    };
  const empresa = filtroEmpresa(filtros.empresa);
  const todas = (await leer(fetchImpl, item)).filter(
    (i) =>
      matches(nombreEmpresa(i.empresa), empresa) &&
      (acto.length === 0 || i.actos.some((a) => tipos.has(a.acto))),
  );
  const desde = (filtros.pagina - 1) * filtros.limite;
  return {
    fecha,
    provincia: p.nombre,
    id: item.identificador,
    url: item.url_html,
    pdf: item.url_pdf.texto,
    total: todas.length,
    pagina: filtros.pagina,
    inscripciones: todas.slice(desde, desde + filtros.limite),
  };
}

/** Los días de `hasta` hacia atrás, del más reciente al más antiguo. */
function fechas(hasta: string, dias: number) {
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  return Array.from({ length: dias }, (_, i) =>
    new Date(fin - i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** `f` para cada día, de cuatro en cuatro para no saturar al BOE. */
async function porDias<T>(dias: string[], f: (fecha: string) => Promise<T>) {
  const result: T[] = [];
  for (let i = 0; i < dias.length; i += 4)
    result.push(...(await Promise.all(dias.slice(i, i + 4).map(f))));
  return result;
}

export async function buscarEmpresa(
  fetchImpl: Fetch,
  nombre: string,
  nombreProvincia: string,
  dias: number,
  hasta = hoy(),
) {
  const p = provincia(nombreProvincia);
  const q = filtroEmpresa(nombre);
  // Un día futuro saldría como día sin BORME.
  if (hasta > hoy())
    throw new SourceError(`${hasta} es una fecha futura: busca hasta hoy como mucho.`);
  const lista = fechas(hasta, dias);
  // Antes de 2009 la API no tiene datos: esos días saldrían como días sin BORME.
  if (lista.at(-1)! < DESDE)
    throw new SourceError(`La API del BORME empieza el ${DESDE}: busca desde esa fecha.`);
  const porDia = await porDias(lista, async (fecha) => {
    const d = await diarios(fetchImpl, fecha);
    if (!d) return { fecha, publicado: false, inscripciones: [], anuncios: [] };
    const item = documento(d, p.codigo);
    const inscripciones = item
      ? (await leer(fetchImpl, item))
          .filter((i) => matches(nombreEmpresa(i.empresa), q))
          .map((i) => ({ fecha, id: item.identificador, url: item.url_html, ...i }))
      : [];
    // Los anuncios (sección segunda) son de toda España y su título es el nombre de la empresa.
    const anuncios = d
      .flatMap((x) => list(x.seccion))
      .flatMap((s) => list(s.apartado))
      .flatMap((a) =>
        list(a.item)
          .filter((i) => matches(nombreEmpresa(i.titulo), q))
          .map((i) => ({
            fecha,
            id: i.identificador,
            empresa: unaLinea(i.titulo),
            apartado: a.nombre,
            url: i.url_html,
          })),
      );
    return { fecha, publicado: true, inscripciones, anuncios };
  });
  const inscripciones = porDia.flatMap((d) => d.inscripciones);
  const anuncios = porDia.flatMap((d) => d.anuncios);
  const recortado = inscripciones.length > MAX_RESULTADOS || anuncios.length > MAX_RESULTADOS;
  return {
    nombre,
    provincia: p.nombre,
    desde: porDia.at(-1)?.fecha,
    hasta,
    dias_con_borme: porDia.filter((d) => d.publicado).length,
    dias_sin_borme: porDia.filter((d) => !d.publicado).map((d) => d.fecha),
    total_inscripciones: inscripciones.length,
    inscripciones: inscripciones.slice(0, MAX_RESULTADOS),
    total_anuncios: anuncios.length,
    anuncios: anuncios.slice(0, MAX_RESULTADOS),
    ...(hasta === hoy() && {
      hoy: 'El BORME de hoy sale por la mañana: si hoy está en dias_sin_borme, puede que aún no haya salido.',
    }),
    ...(recortado && {
      nota: `Hay más de ${MAX_RESULTADOS} resultados y solo van los ${MAX_RESULTADOS} más recientes: escribe el nombre completo de la empresa o busca menos días.`,
    }),
  };
}

const fecha = z.iso.date().describe('Día del BORME, AAAA-MM-DD.');
const nombreProvincia = z
  .string()
  .min(2)
  .max(40)
  .describe('Provincia del registro mercantil, como Gipuzkoa, Bizkaia, Madrid o Illes Balears.');

export function createBormeMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-borme', title: 'BORME' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'sumario_borme',
      {
        title: 'Sumario del BORME',
        description:
          'Los documentos del BORME de un día: los actos inscritos y otros actos, uno por provincia, y los anuncios de empresas (convocatorias de juntas, fusiones, escisiones…), con su identificador y enlace.',
        inputSchema: z.object({ fecha }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ fecha }) => run(SOURCE, () => sumarioBorme(fetchImpl, fecha)),
    );
    s.registerTool(
      'actos_provincia',
      {
        title: 'Actos inscritos de una provincia',
        description:
          'Las inscripciones del registro mercantil de una provincia publicadas en el BORME de un día: por cada empresa, sus actos (constitución, nombramientos, ceses, cambio de domicilio, ampliación de capital, disolución, situación concursal…) con su detalle. Filtra por empresa o por tipo de acto.',
        inputSchema: z.object({
          fecha,
          provincia: nombreProvincia,
          empresa: z
            .string()
            .max(200)
            .optional()
            .describe('Palabras que deben aparecer en el nombre de la empresa.'),
          acto: z
            .string()
            .max(80)
            .optional()
            .describe(
              'Tipo de acto, como «constitución», «nombramientos», «ceses», «disolución» o «concursal».',
            ),
          pagina: z.number().int().min(1).default(1),
          limite: z.number().int().min(1).max(100).default(25),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ fecha, provincia, ...filtros }) =>
        run(SOURCE, () => actosProvincia(fetchImpl, fecha, provincia, filtros)),
    );
    s.registerTool(
      'buscar_empresa',
      {
        title: 'Buscar una empresa',
        description: `Los actos inscritos de una empresa en el BORME de una provincia durante los últimos días (sección primera, actos inscritos), y sus anuncios en toda España (sección segunda), del más reciente al más antiguo. Como mucho ${MAX_DIAS} días. No mira los «otros actos» de la sección primera (depósitos de proyectos de fusión), que están en sumario_borme.`,
        inputSchema: z.object({
          nombre: z
            .string()
            .min(3)
            .max(200)
            .describe('Nombre de la empresa, o palabras de él, como «Construcciones Ejemplo».'),
          provincia: nombreProvincia,
          dias: z
            .number()
            .int()
            .min(1)
            .max(MAX_DIAS)
            .default(7)
            .describe(
              `Días naturales hacia atrás desde \`hasta\`, incluido; como mucho ${MAX_DIAS}.`,
            ),
          hasta: z.iso.date().optional().describe('Último día, AAAA-MM-DD. Por defecto, hoy.'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ nombre, provincia, dias, hasta }) =>
        run(SOURCE, () => buscarEmpresa(fetchImpl, nombre, provincia, dias, hasta)),
    );
  });
}
