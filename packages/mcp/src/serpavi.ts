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
  anios: Map<number, Partial<Record<Tipo, Serie>>>;
};
type Copia = { municipios: Map<string, Municipio>; publicado: string | null; descargado: string };

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
const MEDIDA = { MEDIANA: 'mediana', PERCENT25: 'percentil25', PERCENT75: 'percentil75' } as const;
const TIPO = { COLECTIVA: 'colectiva', UNIFAMILIAR: 'unifamiliar' } as const;

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

function leerCsv(texto: string) {
  const [cabecera, ...filas] = texto.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  if (cabecera !== CABECERA) throw formato('la cabecera no es la esperada');
  const municipios = new Map<string, Municipio>();
  for (const [i, linea] of filas.entries()) {
    const m = FILA.exec(linea);
    if (!m) throw formato(`línea ${i + 2}`);
    // FILA tiene 9 grupos obligatorios: si casa, están todos.
    const [codigoProvincia, provincia, codigo, nombre, elemento, tipo, medida, anio, valor] =
      m.slice(1) as Campos;
    if ((elemento === 'VIVIENDA') !== (medida === 'RECUENTO')) throw formato(`línea ${i + 2}`);
    let municipio = municipios.get(codigo);
    if (!municipio) {
      municipio = {
        codigo,
        nombre,
        codigoProvincia,
        provincia,
        claves: claves(nombre),
        clavesProvincia: claves(provincia),
        anios: new Map(),
      };
      municipios.set(codigo, municipio);
    }
    let delAnio = municipio.anios.get(Number(anio));
    if (!delAnio) municipio.anios.set(Number(anio), (delAnio = {}));
    const serie = (delAnio[TIPO[tipo]] ??= {});
    if (medida === 'RECUENTO') serie.viviendas = Number(valor);
    else
      (serie[elemento === 'PRECIO' ? 'renta' : 'superficie'] ??= {})[MEDIDA[medida]] =
        Number(valor);
  }
  return municipios;
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
      let response: Response;
      let texto: string;
      try {
        response = await get(condicional, CSV, 'text/csv');
        texto = await response.text();
      } catch (error) {
        // Un corte a mitad de los 37 MB no es un SourceError, pero es la misma caída de la fuente.
        if (error instanceof SourceError) throw error;
        throw new SourceError('La descarga del CSV se ha cortado. Prueba más tarde.');
      }
      copia = {
        municipios: leerCsv(texto),
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

function porTipo(m: Municipio, anio: number, tipos: readonly Tipo[]) {
  const delAnio = m.anios.get(anio);
  return Object.fromEntries(
    tipos.map((t) => {
      const serie = delAnio?.[t];
      return [t, serie ? cifras(serie) : `Sin datos de vivienda ${t} en ${anio}.`];
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

function alquilerMunicipio(
  municipios: Map<string, Municipio>,
  codigo: string,
  anio?: number,
  tipo?: Tipo,
) {
  const m = municipio(municipios, codigo);
  const elegido = anio ?? Math.max(...m.anios.keys());
  if (!m.anios.has(elegido))
    throw new SourceError(`${m.nombre} no tiene datos de ${elegido}. Años con datos: ${rango(m)}.`);
  return {
    municipio: m.nombre,
    codigo: m.codigo,
    provincia: m.provincia,
    anio: elegido,
    ...porTipo(m, elegido, tipo ? [tipo] : TIPOS),
  };
}

function compararMunicipios(
  municipios: Map<string, Municipio>,
  codigos: string[],
  anio?: number,
  tipo?: Tipo,
) {
  if (new Set(codigos).size !== codigos.length)
    throw new SourceError('Hay un código repetido: indica municipios distintos.');
  const lista = codigos.map((c) => municipio(municipios, c));
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
      ...porTipo(m, elegido, tipo ? [tipo] : TIPOS),
    })),
  };
}

function rankingProvincia(
  municipios: Map<string, Municipio>,
  provincia: string,
  tipo: Tipo,
  orden: 'renta' | 'eur_m2',
  limite: number,
  anio?: number,
) {
  const { nombre, lista } = deProvincia(municipios, provincia);
  // Solo los municipios con el dato por el que se ordena: los que solo traen recuento no entran.
  const puestos = (a: number) =>
    lista.flatMap((m) => {
      const s = m.anios.get(a)?.[tipo];
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
    nota: 'Solo entran los municipios con renta publicada ese año; del resto no se estima nada.',
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
  const consulta = (f: (municipios: Map<string, Municipio>) => object) =>
    run(SOURCE, async () => {
      const { copia, aviso } = await leer();
      return {
        aviso,
        ...f(copia.municipios),
        csv_actualizado: copia.publicado ?? 'El Ministerio no indica la fecha.',
      };
    });

  return server(
    { name: 'reforma-digital-serpavi', title: 'Alquiler de vivienda (SERPAVI)' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_municipio',
        {
          title: 'Buscar municipio',
          description:
            'Municipios cuyo nombre contiene el texto (sin distinguir tildes; entiende «L’Hospitalet», «El Molar» y cada lengua de «Donostia / San Sebastián»), con su código INE, provincia y años con datos. Los homónimos salen todos.',
          inputSchema: z.object({
            nombre: z.string().min(2).max(80),
            provincia: z
              .string()
              .max(40)
              .optional()
              .describe('Para acotar: código de 2 cifras (30) o nombre (Murcia, A Coruña).'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ nombre, provincia }) =>
          consulta((municipios) => buscarMunicipio(municipios, nombre, provincia)),
      );
      s.registerTool(
        'alquiler_municipio',
        {
          title: 'Alquiler de un municipio',
          description:
            'Renta mensual (€/mes) mediana y percentiles 25 y 75, superficie (m²), €/m² derivado y número de viviendas de un municipio en un año, por tipo de vivienda.',
          inputSchema: z.object({ codigo, anio, tipo_vivienda: tipoVivienda }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ codigo, anio, tipo_vivienda }) =>
          consulta((municipios) => alquilerMunicipio(municipios, codigo, anio, tipo_vivienda)),
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
          consulta((municipios) =>
            compararMunicipios(municipios, codigos.split(','), anio, tipo_vivienda),
          ),
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
            tipo_vivienda: z.enum(TIPOS).default('colectiva'),
            orden: z.enum(['renta', 'eur_m2']).default('renta'),
            limite: z.number().int().min(1).max(50).default(10),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ provincia, anio, tipo_vivienda, orden, limite }) =>
          consulta((municipios) =>
            rankingProvincia(municipios, provincia, tipo_vivienda, orden, limite, anio),
          ),
      );
    },
  );
}
