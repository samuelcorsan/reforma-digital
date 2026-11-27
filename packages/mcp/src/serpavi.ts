// Servidor MCP del alquiler de vivienda por municipio: el CSV abierto VDP001 del Ministerio de
// Vivienda y Agenda Urbana, el agregado municipal del sistema SERPAVI (2011–2024). El visor de
// SERPAVI por dirección está tras un CAPTCHA y no se consulta.
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const CSV = 'https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP001_01.csv';
const SOURCE = `Origen de los datos: Ministerio de Vivienda y Agenda Urbana (CSV abierto VDP001, ${CSV}). Servidor no oficial, sin relación con el Ministerio ni con SERPAVI.`;

const INSTRUCTIONS = `Alquiler de vivienda por municipio en España, del CSV abierto VDP001 del Ministerio de Vivienda y Agenda Urbana (el agregado municipal de SERPAVI), con datos anuales de 2011 a 2024; Navarra y el País Vasco empiezan más tarde.
- Busca el municipio con buscar_municipio y usa su código INE de 5 dígitos (28079 es Madrid) en alquiler_municipio o comparar_municipios. ranking_provincia ordena los municipios de una provincia.
- renta_eur_mes es la renta mensual en euros (€/mes), no €/m². superficie_m2 va en m². eur_m2_derivado no lo publica el Ministerio: es la renta mediana entre la superficie mediana, con 2 decimales; dilo así al usarlo.
- Vivienda colectiva son pisos; unifamiliar, casas.
- viviendas es cuántas viviendas en alquiler tienen datos ese año (la muestra del Ministerio), no cuántas viviendas tiene el municipio.
- Si un municipio solo trae el recuento de viviendas, no hay renta publicada: dilo y no la estimes.
- Cita el origen de los datos y la fecha de actualización del CSV. Si la respuesta trae un aviso, cuéntalo: los datos son de una copia anterior.
${SOURCE}`;

const TIPOS = ['colectiva', 'unifamiliar'] as const;
type Tipo = (typeof TIPOS)[number];
type Medidas = { mediana?: number; percentil25?: number; percentil75?: number };
type Serie = { renta?: Medidas; superficie?: Medidas; viviendas?: number };
type Municipio = {
  codigo: string;
  nombre: string;
  codigoProvincia: string;
  provincia: string;
  claves: string[];
  clavesProvincia: string[];
  /** Cada año con datos y dónde empieza su bloque en `Indice.valores`. */
  anios: Map<number, number>;
};
/**
 * Del CSV solo se guarda un objeto por municipio; las cifras van todas en un Float64Array, en un
 * bloque de BLOQUE huecos por municipio y año (NaN donde el CSV no trae el dato).
 */
type Indice = { municipios: Map<string, Municipio>; valores: Float64Array };
type Copia = { indice: Indice; publicado: string | null; descargado: string };

const CABECERA =
  'COD_PROVINCIA;PROVINCIA;COD_POSTAL;NOMBRE_MUNICIPIO;ELEMENTO;TIPO_VIVIENDA;TIPO_MEDIDA;AÑO;VALOR';
// COD_POSTAL no es un código postal: es el código INE del municipio.
const FILA =
  /^(\d{2});([^;]+);(\d{5});([^;]+);(PRECIO|SUPERFICIE|VIVIENDA);(COLECTIVA|UNIFAMILIAR);(MEDIANA|PERCENT25|PERCENT75|RECUENTO);(\d{4});(\d+(?:\.\d+)?)$/;
type Campos = [
  string,
  string,
  string,
  string,
  'PRECIO' | 'SUPERFICIE' | 'VIVIENDA',
  'COLECTIVA' | 'UNIFAMILIAR',
  'MEDIANA' | 'PERCENT25' | 'PERCENT75' | 'RECUENTO',
  string,
  string,
];
// Dentro de cada tipo: renta (mediana, P25, P75), superficie (mediana, P25, P75) y recuento.
const ELEMENTO = { PRECIO: 0, SUPERFICIE: 3, VIVIENDA: 6 } as const;
const MEDIDA = { MEDIANA: 0, PERCENT25: 1, PERCENT75: 2, RECUENTO: 0 } as const;
const TIPO = { COLECTIVA: 'colectiva', UNIFAMILIAR: 'unifamiliar' } as const;
const HUECO: Record<Tipo, number> = { colectiva: 0, unifamiliar: 7 };
const BLOQUE = 14;

/** «Hospitalet de Llobregat, L'» → «L'Hospitalet de Llobregat»; «Molar, El» → «El Molar». */
const hablado = (nombre: string) =>
  nombre.replace(/^(.+),\s*(\S+)$/u, (_, resto: string, articulo: string) =>
    articulo.endsWith("'") ? articulo + resto : `${articulo} ${resto}`,
  );
const clave = (texto: string) => fold(texto).replaceAll('’', "'");
/** Cada forma con la que se busca un nombre INE: tal cual, con el artículo delante y cada lengua. */
const claves = (nombre: string) => [
  ...new Set(
    [nombre, ...nombre.split(/\s*\/\s*/)].flatMap((n) => [n, hablado(n)]).map((n) => clave(n)),
  ),
];

const formato = (motivo: string) =>
  new SourceError(`El CSV del Ministerio ha cambiado de formato (${motivo}): no se puede leer.`);

const sinCr = (linea: string) => (linea.endsWith('\r') ? linea.slice(0, -1) : linea);

/**
 * Copia que no comparte memoria con el trozo del que sale: V8 hace de un slice una vista del
 * string original, y un nombre guardado en el índice retendría el trozo entero del CSV.
 */
const suelto = (s: string) => (' ' + s).slice(1);

/** Las líneas del cuerpo según llegan, sin juntar nunca el CSV entero. */
async function* lineas(body: ReadableStream<Uint8Array>) {
  // Se lee en bytes para que la descarga espere al parseo y no se encole el fichero entero.
  const reader = body.getReader();
  // Con stream: true, TextDecoder quita el BOM y junta los caracteres partidos entre trozos.
  const decoder = new TextDecoder();
  let resto = '';
  let terminada = false;
  try {
    for (;;) {
      let trozo: ReadableStreamReadResult<Uint8Array>;
      try {
        trozo = await reader.read();
      } catch {
        terminada = true;
        // Un corte a mitad de los 37 MB no es un SourceError, pero es la misma caída de la fuente.
        throw new SourceError('La descarga del CSV se ha cortado. Prueba más tarde.');
      }
      if (trozo.done) {
        terminada = true;
        break;
      }
      const texto = resto + decoder.decode(trozo.value, { stream: true });
      let desde = 0;
      for (let fin = texto.indexOf('\n'); fin !== -1; fin = texto.indexOf('\n', desde)) {
        yield sinCr(texto.slice(desde, fin));
        desde = fin + 1;
      }
      resto = texto.slice(desde);
    }
  } finally {
    // Si el formato falla a mitad, se corta la descarga en vez de dejarla colgada.
    if (!terminada) await reader.cancel();
  }
  yield sinCr(resto + decoder.decode());
}

async function leerCsv(body: ReadableStream<Uint8Array>): Promise<Indice> {
  const municipios = new Map<string, Municipio>();
  const provincias = new Map<string, string[]>();
  let valores = new Float64Array(16_384 * BLOQUE).fill(Number.NaN);
  let bloques = 0;
  let n = 0;
  for await (const linea of lineas(body)) {
    if (!linea) continue;
    if (++n === 1) {
      if (linea !== CABECERA) throw formato('la cabecera no es la esperada');
      continue;
    }
    const m = FILA.exec(linea);
    if (!m) throw formato(`línea ${n}`);
    // FILA tiene 9 grupos obligatorios: si casa, están todos.
    const [codigoProvincia, provincia, codigo, nombre, elemento, tipo, medida, anio, valor] =
      m.slice(1) as Campos;
    if ((elemento === 'VIVIENDA') !== (medida === 'RECUENTO')) throw formato(`línea ${n}`);
    let municipio = municipios.get(codigo);
    if (!municipio) {
      let clavesProvincia = provincias.get(provincia);
      if (!clavesProvincia)
        provincias.set(suelto(provincia), (clavesProvincia = claves(suelto(provincia))));
      municipio = {
        codigo: suelto(codigo),
        nombre: suelto(nombre),
        codigoProvincia: suelto(codigoProvincia),
        provincia: suelto(provincia),
        claves: claves(suelto(nombre)),
        clavesProvincia,
        anios: new Map(),
      };
      municipios.set(municipio.codigo, municipio);
    }
    let bloque = municipio.anios.get(Number(anio));
    if (bloque === undefined) {
      bloque = bloques++ * BLOQUE;
      if (bloque === valores.length) {
        const mayor = new Float64Array(valores.length * 2).fill(Number.NaN);
        mayor.set(valores);
        valores = mayor;
      }
      municipio.anios.set(Number(anio), bloque);
    }
    valores[bloque + HUECO[TIPO[tipo]] + ELEMENTO[elemento] + MEDIDA[medida]] = Number(valor);
  }
  if (n === 0) throw formato('la cabecera no es la esperada');
  // Un CSV sin filas sustituiría una copia buena por un índice vacío.
  if (!municipios.size) throw formato('no trae ningún municipio');
  return { municipios, valores };
}

const dato = (x: number) => (Number.isNaN(x) ? undefined : x);
const medidas = (mediana?: number, percentil25?: number, percentil75?: number) =>
  mediana === undefined && percentil25 === undefined && percentil75 === undefined
    ? undefined
    : { mediana, percentil25, percentil75 };

/** Las cifras de un municipio en un año y tipo, o nada si el CSV no trae ninguna. */
function serie(indice: Indice, m: Municipio, anio: number, tipo: Tipo): Serie | undefined {
  const bloque = m.anios.get(anio);
  if (bloque === undefined) return undefined;
  const desde = bloque + HUECO[tipo];
  const [rm, r25, r75, sm, s25, s75, viviendas] = Array.from(
    indice.valores.subarray(desde, desde + 7),
    dato,
  );
  const renta = medidas(rm, r25, r75);
  const superficie = medidas(sm, s25, s75);
  return renta || superficie || viviendas !== undefined
    ? { renta, superficie, viviendas }
    : undefined;
}

/**
 * El CSV entero (unos 37 MB, 531.000 filas) se descarga del Ministerio la primera vez y se guarda
 * leído en memoria; después, cada consulta solo pregunta si ha cambiado (If-Modified-Since, que
 * responde 304 sin cuerpo). Así los datos son los publicados ahora sin bajar el fichero cada vez.
 * Si el Ministerio no responde y ya hay una copia, se usa con un aviso; sin copia, es un error.
 */
function fuente(fetchImpl: Fetch) {
  let copia: Copia | undefined;
  let enCurso: Promise<{ copia: Copia; aviso?: string }> | undefined;

  async function refrescar(): Promise<{ copia: Copia; aviso?: string }> {
    const anterior = copia;
    const desde = anterior?.publicado;
    const condicional: Fetch = desde
      ? (url, init) => {
          const headers = new Headers(init?.headers);
          headers.set('If-Modified-Since', desde);
          return fetchImpl(url, { ...init, headers });
        }
      : fetchImpl;
    try {
      const response = await get(condicional, CSV, 'text/csv');
      if (!response.body) throw formato('la respuesta llega vacía');
      copia = {
        indice: await leerCsv(response.body),
        publicado: response.headers.get('last-modified'),
        descargado: new Date().toISOString(),
      };
      return { copia };
    } catch (error) {
      if (!(error instanceof SourceError) || !anterior) throw error;
      if (error.status === 304) return { copia: anterior };
      return {
        copia: anterior,
        aviso: `No se ha podido comprobar ahora el CSV del Ministerio (${error.message}) Estos datos son de la copia descargada el ${anterior.descargado}${anterior.publicado ? `, publicada el ${anterior.publicado}` : ''}; puede haber una versión más reciente.`,
      };
    }
  }

  return () => {
    enCurso ??= refrescar().finally(() => {
      enCurso = undefined;
    });
    return enCurso;
  };
}

const redondear = (x: number) => Math.round(x * 100) / 100;

function cifras(s: Serie) {
  return {
    renta_eur_mes: s.renta,
    superficie_m2: s.superficie,
    eur_m2_derivado:
      s.renta?.mediana !== undefined && s.superficie?.mediana
        ? redondear(s.renta.mediana / s.superficie.mediana)
        : undefined,
    viviendas: s.viviendas,
    nota: s.renta
      ? undefined
      : 'Solo hay recuento de viviendas: el CSV no publica la renta de este tipo y año. No se estima.',
  };
}

function porTipo(indice: Indice, m: Municipio, anio: number, tipos: readonly Tipo[]) {
  return Object.fromEntries(
    tipos.map((t) => {
      const s = serie(indice, m, anio, t);
      return [t, s ? cifras(s) : `Sin datos de vivienda ${t} en ${anio}.`];
    }),
  );
}

/** Los años con datos en tramos, como «2011–2015, 2017–2024»: hay municipios con huecos. */
const rango = (m: Municipio) =>
  [...m.anios.keys()]
    .sort((a, b) => a - b)
    .reduce<[number, number][]>((tramos, a) => {
      const ultimo = tramos.at(-1);
      if (ultimo && ultimo[1] === a - 1) ultimo[1] = a;
      else tramos.push([a, a]);
      return tramos;
    }, [])
    .map(([desde, hasta]) => (desde === hasta ? String(desde) : `${desde}–${hasta}`))
    .join(', ');

function municipio(municipios: Map<string, Municipio>, codigo: string) {
  const m = municipios.get(codigo);
  if (!m)
    throw new SourceError(
      `No hay ningún municipio con código INE ${codigo} en el CSV. Búscalo con buscar_municipio.`,
    );
  return m;
}

function deProvincia(municipios: Map<string, Municipio>, provincia: string) {
  const todos = [...municipios.values()];
  const lista = /^\d{1,2}$/.test(provincia)
    ? todos.filter((m) => m.codigoProvincia === provincia.padStart(2, '0'))
    : todos.filter((m) => m.clavesProvincia.includes(clave(provincia)));
  const [primero] = lista;
  if (!primero)
    throw new SourceError(
      `No hay ninguna provincia «${provincia}» en el CSV. Usa su código de 2 cifras (28 Madrid, 08 Barcelona) o el nombre (A Coruña, Bizkaia).`,
    );
  return { nombre: primero.provincia, lista };
}

function buscarMunicipio(municipios: Map<string, Municipio>, nombre: string, provincia?: string) {
  const q = clave(nombre);
  const donde =
    provincia === undefined ? [...municipios.values()] : deProvincia(municipios, provincia).lista;
  // Primero el nombre exacto, luego los que empiezan así y al final los que lo contienen.
  const nivel = (m: Municipio) =>
    m.claves.includes(q) ? 0 : m.claves.some((c) => c.startsWith(q)) ? 1 : 2;
  const encontrados = donde
    .filter((m) => m.claves.some((c) => c.includes(q)))
    .sort((a, b) => nivel(a) - nivel(b));
  return {
    total: encontrados.length,
    municipios: encontrados.slice(0, 20).map((m) => ({
      codigo: m.codigo,
      nombre: m.nombre,
      provincia: m.provincia,
      anios: rango(m),
    })),
  };
}

function alquilerMunicipio(indice: Indice, codigo: string, anio?: number, tipo?: Tipo) {
  const m = municipio(indice.municipios, codigo);
  const elegido = anio ?? Math.max(...m.anios.keys());
  if (!m.anios.has(elegido))
    throw new SourceError(`${m.nombre} no tiene datos de ${elegido}. Años con datos: ${rango(m)}.`);
  return {
    municipio: m.nombre,
    codigo: m.codigo,
    provincia: m.provincia,
    anio: elegido,
    ...porTipo(indice, m, elegido, tipo ? [tipo] : TIPOS),
  };
}

function compararMunicipios(indice: Indice, codigos: string[], anio?: number, tipo?: Tipo) {
  if (new Set(codigos).size !== codigos.length)
    throw new SourceError('Hay un código repetido: indica municipios distintos.');
  const lista = codigos.map((c) => municipio(indice.municipios, c));
  const comunes = [...new Set(lista.flatMap((m) => [...m.anios.keys()]))]
    .filter((a) => lista.every((m) => m.anios.has(a)))
    .sort((a, b) => a - b);
  const elegido = anio ?? comunes.at(-1);
  if (elegido === undefined)
    throw new SourceError(
      `Estos municipios no tienen ningún año con datos en común (${lista.map((m) => `${m.nombre}: ${rango(m)}`).join('; ')}). Indica \`anio\`.`,
    );
  return {
    anio: elegido,
    municipios: lista.map((m) => ({
      municipio: m.nombre,
      codigo: m.codigo,
      provincia: m.provincia,
      ...porTipo(indice, m, elegido, tipo ? [tipo] : TIPOS),
    })),
  };
}

function rankingProvincia(
  indice: Indice,
  provincia: string,
  tipo: Tipo,
  orden: 'renta' | 'eur_m2',
  limite: number,
  anio?: number,
) {
  const { nombre, lista } = deProvincia(indice.municipios, provincia);
  // Solo los municipios con el dato por el que se ordena: los que solo traen recuento no entran.
  const puestos = (a: number) =>
    lista.flatMap((m) => {
      const s = serie(indice, m, a, tipo);
      if (!s) return [];
      const fila = { municipio: m.nombre, codigo: m.codigo, ...cifras(s) };
      const valor = orden === 'renta' ? fila.renta_eur_mes?.mediana : fila.eur_m2_derivado;
      return valor === undefined ? [] : [{ fila, valor }];
    });
  const anios = [...new Set(lista.flatMap((m) => [...m.anios.keys()]))].sort((a, b) => b - a);
  const elegido = anio ?? anios.find((a) => puestos(a).length > 0);
  if (elegido === undefined)
    throw new SourceError(
      `Ningún municipio de ${nombre} tiene renta publicada de vivienda ${tipo} en el CSV.`,
    );
  const ordenados = puestos(elegido).sort((a, b) => b.valor - a.valor);
  if (!ordenados.length)
    throw new SourceError(
      `Ningún municipio de ${nombre} tiene ${orden === 'renta' ? 'renta publicada' : 'renta y superficie publicadas'} de vivienda ${tipo} en ${elegido}. Años con renta: ${
        anios
          .filter((a) => puestos(a).length > 0)
          .sort((a, b) => a - b)
          .join(', ') || 'ninguno'
      }.`,
    );
  return {
    provincia: nombre,
    anio: elegido,
    tipo_vivienda: tipo,
    orden: orden === 'renta' ? 'renta mediana (€/mes)' : '€/m² derivado',
    con_dato: ordenados.length,
    municipios_en_csv: lista.length,
    ranking: ordenados.slice(0, limite).map(({ fila }) => fila),
    nota: 'Solo entran los municipios con renta publicada ese año; del resto no se estima nada. Un municipio con pocas viviendas con datos (mira `viviendas`) tiene una mediana mucho más volátil que uno con miles: dilo al comparar.',
  };
}

const codigo = z
  .string()
  .regex(/^\d{5}$/)
  .describe('Código INE del municipio, 5 cifras, de buscar_municipio: 28079 es Madrid.');
const anio = z
  .number()
  .int()
  .min(2011)
  .max(2100)
  .optional()
  .describe('Año de los datos (2011–2024). Por defecto, el último con datos.');
const tipoVivienda = z
  .enum(TIPOS)
  .optional()
  .describe('«colectiva» (pisos) o «unifamiliar» (casas). Por defecto, los dos.');

export function createSerpaviMcp(fetchImpl: Fetch = fetch) {
  const leer = fuente(fetchImpl);
  const consulta = (f: (indice: Indice) => object) =>
    run(SOURCE, async () => {
      const { copia, aviso } = await leer();
      return {
        aviso,
        ...f(copia.indice),
        csv_actualizado: copia.publicado ?? 'El Ministerio no indica la fecha.',
      };
    });

  return server(
    { name: 'reforma-digital-serpavi', title: 'Precio del alquiler (SERPAVI)' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_municipio',
        {
          title: 'Buscar municipio',
          description:
            'Municipios cuyo nombre contiene el texto (sin distinguir tildes; entiende «L’Hospitalet», «El Molar» y cada lengua de «Donostia / San Sebastián»), con su código INE, provincia y años con datos. Los homónimos salen todos.',
          inputSchema: z.object({
            nombre: z.string().trim().min(2).max(80),
            provincia: z
              .string()
              .max(40)
              .optional()
              .describe('Para acotar: código de 2 cifras (30) o nombre (Murcia, A Coruña).'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ nombre, provincia }) =>
          consulta((indice) => buscarMunicipio(indice.municipios, nombre, provincia)),
      );
      s.registerTool(
        'alquiler_municipio',
        {
          title: 'Alquiler de un municipio',
          description:
            'Renta mensual (€/mes) mediana y percentiles 25 y 75, superficie (m²), €/m² derivado y número de viviendas en alquiler con datos de un municipio en un año, por tipo de vivienda.',
          inputSchema: z.object({ codigo, anio, tipo_vivienda: tipoVivienda }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ codigo, anio, tipo_vivienda }) =>
          consulta((indice) => alquilerMunicipio(indice, codigo, anio, tipo_vivienda)),
      );
      s.registerTool(
        'comparar_municipios',
        {
          title: 'Comparar municipios',
          description:
            'Las mismas cifras que alquiler_municipio para 2 a 5 municipios en el mismo año (por defecto, el último que tienen todos).',
          inputSchema: z.object({
            codigos: z
              .string()
              .regex(/^\d{5}(,\d{5}){1,4}$/)
              .describe('Códigos INE separados por comas, como 28079,08019 (Madrid y Barcelona).'),
            anio: anio.describe('Año de los datos. Por defecto, el último que tienen todos.'),
            tipo_vivienda: tipoVivienda,
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ codigos, anio, tipo_vivienda }) =>
          consulta((indice) => compararMunicipios(indice, codigos.split(','), anio, tipo_vivienda)),
      );
      s.registerTool(
        'ranking_provincia',
        {
          title: 'Ranking de una provincia',
          description:
            'Los municipios de una provincia de mayor a menor renta mediana (€/mes) o €/m² derivado. Solo entran los que tienen renta publicada ese año.',
          inputSchema: z.object({
            provincia: z
              .string()
              .min(1)
              .max(40)
              .describe('Código de 2 cifras (28) o nombre (Madrid, A Coruña, Bizkaia).'),
            anio: anio.describe('Año de los datos. Por defecto, el último con renta publicada.'),
            tipo_vivienda: z
              .enum(TIPOS)
              .default('colectiva')
              .describe('«colectiva» (pisos) o «unifamiliar» (casas). Por defecto, colectiva.'),
            orden: z.enum(['renta', 'eur_m2']).default('renta'),
            limite: z.number().int().min(1).max(50).default(10),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ provincia, anio, tipo_vivienda, orden, limite }) =>
          consulta((indice) =>
            rankingProvincia(indice, provincia, tipo_vivienda, orden, limite, anio),
          ),
      );
    },
  );
}
