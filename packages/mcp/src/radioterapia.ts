// Servidor MCP de las licitaciones de radioterapia de España, con cada una clasificada por lo que compra. Junta la
// Plataforma de Contratación del Sector Público (lo reciente, también los contratos pequeños; el lector es el de
// contratacion.ts) y TED (los armonizados, con el histórico, los adjudicatarios y las ofertas). La clasificación es
// vocabulario de la especialidad; los nombres comerciales de equipos y programas solo sirven para reconocer qué se
// compra cuando el pliego lo nombra así.
import { z } from 'zod';
import {
  fold,
  matches,
  READ_ONLY_EXTERNAL,
  run,
  server,
  SourceError,
  words,
  type Fetch,
} from './comun';
import { leer, verLicitacion, type Licitacion } from './contratacion';
import { buscarTed, frase, SOURCE_TED, TIPOS, verAviso, type AvisoTed, type Tipo } from './ted';

const SOURCE = `Fuentes: Plataforma de Contratación del Sector Público, Ministerio de Hacienda (contrataciondelestado.es), datos abiertos; y ${SOURCE_TED}`;

// Lo que basta para que sea de radioterapia: palabras que solo usa la especialidad.
const PALABRAS = [
  'radioterapia',
  'radioterapico',
  'radioterapica',
  'radioterapeutico',
  'radioterapeutica',
  'acelerador lineal',
  'linac',
  'braquiterapia',
  'radiocirugia',
  'protonterapia',
  'terapia de protones',
  'tomoterapia',
  // El TC de simulación solo lo compra radioterapia, aunque el título no lo diga.
  'tc de simulacion',
  'tac de simulacion',
  'ct de simulacion',
  'tomografo de simulacion',
  'tc simulador',
  'tac simulador',
  'tc simulacion',
  'tac simulacion',
];
// Lo que también basta: el CPV (el 31643100 es el de los aceleradores, que no cuelga del 33151) y los nombres de
// equipos y programas que no son palabras corrientes.
const CPV = ['33151', '31643100'];
const MARCAS = [
  'alignrt',
  'exactrac',
  'truebeam',
  'vitalbeam',
  'clinac',
  'halcyon',
  'versa hd',
  'cyberknife',
  'gamma knife',
  'tomotherapy',
  'radixact',
  'raystation',
  'mosaiq',
  'microselectron',
  'flexitron',
  'gammamed',
];
// Lo que comparte CPV, nombre o palabras y no compra un servicio de radioterapia: la radioembolización con itrio-90
// (que su descripción llama «radioterapia interna selectiva»), los radiofármacos y la terapia metabólica son de
// medicina nuclear, y los aceleradores de investigación no tratan pacientes. Manda sobre todo lo demás; por eso «luz
// de sincrotrón» y no «sincrotrón», que también es un tipo de acelerador de protonterapia. «Radiofármaco» sí va a
// secas: los suministros de medicina nuclear que dicen «radioterapia metabólica» son muchos más que los
// mantenimientos que junten radioterapia y radiofarmacia, que se pierden.
const OTRA_COSA = [
  'radioembolizacion',
  'microesferas',
  'itrio',
  'ytrio',
  'radiofarmaco',
  'radiofarmacia',
  'radioterapia metabolica',
  'terapia metabolica',
  'ifmif',
  'luz de sincrotron',
  'luz del sincrotron',
  'luz sincrotron',
  'sincrotron alba',
];

type Categoria = { nombre: string; cpv?: string[]; terminos: string[] };
// Cada licitación de radioterapia puede tener varias (un mantenimiento de SGRT es las dos cosas) o ninguna. Aquí sí
// valen marcas que son palabras corrientes (Catalyst, Ethos, Monaco…): solo se miran en lo que ya es radioterapia.
const CATEGORIAS = {
  aceleradores: {
    nombre: 'Aceleradores y equipos de tratamiento',
    cpv: ['31643100'],
    terminos: [
      'acelerador lineal',
      'linac',
      'tomoterapia',
      'truebeam',
      'vitalbeam',
      'clinac',
      'halcyon',
      'ethos',
      'versa hd',
      'harmony',
      'infinity',
      'synergy',
      'unity',
      'tomotherapy',
      'radixact',
      'mr linac',
    ],
  },
  sgrt: {
    nombre: 'Radioterapia guiada por superficie (SGRT)',
    terminos: [
      'sgrt',
      'guiada por superficie',
      'guiado por superficie',
      'guiada por la superficie',
      'superficie del paciente',
      'superficie corporal',
      'posicionamiento optico',
      'seguimiento optico',
      'monitorizacion de superficie',
      'monitorizacion optica',
      'dibh',
      'inspiracion profunda',
      'alignrt',
      'catalyst',
      'sentinel',
      'identify',
      'exactrac',
    ],
  },
  simulacion: {
    nombre: 'Simulación (TC y RM de planificación)',
    terminos: [
      'tc de simulacion',
      'tac de simulacion',
      'ct de simulacion',
      'tc simulador',
      'tac simulador',
      'tc de planificacion',
      'tac de planificacion',
      // En radioterapia, el tomógrafo es el de simular (el de imagen del acelerador es «cone beam»).
      'tomografo',
      'tomografia computarizada',
      'tomografia computerizada',
      'simulacion',
      'rm de simulacion',
      'resonancia magnetica de simulacion',
      'simulador',
      'gran apertura',
      'big bore',
    ],
  },
  braquiterapia: {
    nombre: 'Braquiterapia',
    terminos: [
      'braquiterapia',
      'alta tasa',
      'carga diferida',
      'semillas de yodo',
      'yodo-125',
      'i-125',
      'iridio',
      'ir-192',
      'microselectron',
      'flexitron',
      'gammamed',
    ],
  },
  dosimetria: {
    nombre: 'Dosimetría y control de calidad',
    terminos: [
      'dosimetria',
      'dosimetrico',
      'dosimetro',
      'control de calidad',
      'garantia de calidad',
      'maniqui',
      'fantoma',
      'camara de ionizacion',
      'electrometro',
      'detector de radiacion',
      'matriz de detectores',
      'diodo',
      'in vivo',
      'radiofisica',
      'octavius',
      'arccheck',
      'mapcheck',
      'delta4',
    ],
  },
  planificacion: {
    nombre: 'Planificación, registro y verificación (software)',
    terminos: [
      'sistema de planificacion',
      'planificador',
      'planificacion de tratamientos',
      'planificacion de radioterapia',
      'tps',
      'registro y verificacion',
      'record and verify',
      'contorneo',
      'autocontorneo',
      'software de planificacion',
      'licencia de software',
      'eclipse',
      'monaco',
      'raystation',
      'pinnacle',
      'aria',
      'mosaiq',
      'oncentra',
    ],
  },
  inmovilizacion: {
    nombre: 'Inmovilización y accesorios de posicionamiento',
    terminos: [
      'inmovilizacion',
      'inmovilizador',
      'mascara termoplastica',
      'termoplastico',
      'termoplastica',
      'colchon de vacio',
      'cojin de vacio',
      'bolus',
      'sistema de fijacion',
    ],
  },
  mantenimiento: {
    nombre: 'Mantenimiento y reparación',
    cpv: ['5042'],
    terminos: [
      'mantenimiento',
      'reparacion',
      'asistencia tecnica',
      'servicio tecnico',
      'soporte tecnico',
      'postventa',
      'postgarantia',
    ],
  },
  // Junto a «mantenimiento», avisa de que el servicio puede traer equipos o funciones nuevas que el título no nombra.
  actualizacion: {
    nombre: 'Actualización, renovación o sustitución de equipos',
    terminos: [
      'actualizacion',
      'upgrade',
      'renovacion tecnologica',
      'evolucion tecnologica',
      'renovacion de equipo',
      'renovacion del equipo',
      'sustitucion de equipo',
      'sustitucion del equipo',
    ],
  },
  concertada: {
    nombre: 'Radioterapia concertada (tratamiento de pacientes)',
    cpv: ['851'],
    terminos: [
      'concierto',
      'concertada',
      'concertado',
      'asistencia sanitaria oncologica',
      'prestacion de radioterapia',
      'derecho a prestacion',
    ],
  },
  protones_radiocirugia: {
    nombre: 'Protonterapia y radiocirugía',
    terminos: [
      'protonterapia',
      'terapia de protones',
      'radiocirugia',
      'estereotactica',
      'estereotaxica',
      'sbrt',
      'srs',
      'cyberknife',
      'gamma knife',
    ],
  },
  obras: {
    nombre: 'Obras e instalaciones (búnker)',
    cpv: ['45'],
    // «Obra de», para no contar la «mano de obra» de un mantenimiento.
    terminos: [
      'bunker',
      'blindaje',
      'obra de',
      'construccion',
      'reforma',
      'instalacion radiactiva',
    ],
  },
} satisfies Record<string, Categoria>;
type Clave = keyof typeof CATEGORIAS;
const CLAVES = Object.keys(CATEGORIAS) as [Clave, ...Clave[]];

// Palabras enteras y con su plural: «linac» no está dentro de «inclinación», ni «aria» dentro de «variante». Los
// términos son de este fichero y no llevan caracteres especiales de las expresiones regulares.
const patron = (termino: string) =>
  new RegExp(`\\b${termino.replaceAll(' ', '(?:e?s)?[\\s-]+')}(?:e?s)?\\b`);
const patrones = (terminos: string[]) => terminos.map(patron);
const PATRONES = {
  palabras: patrones(PALABRAS),
  marcas: patrones(MARCAS),
  otraCosa: patrones(OTRA_COSA),
  categorias: Object.entries(CATEGORIAS).map(([clave, c]: [string, Categoria]) => ({
    clave: clave as Clave,
    patrones: patrones(c.terminos),
    cpv: c.cpv ?? [],
  })),
};

/** Las categorías de una licitación de radioterapia (quizá ninguna), o null si no es de radioterapia. */
export function clasificar(texto: string, cpv: string[]): Clave[] | null {
  const t = fold(texto);
  const dice = (ps: RegExp[]) => ps.some((p) => p.test(t));
  const conCpv = (prefijos: string[]) => cpv.some((c) => prefijos.some((p) => c.startsWith(p)));
  const es =
    (dice(PATRONES.palabras) || conCpv(CPV) || dice(PATRONES.marcas)) && !dice(PATRONES.otraCosa);
  if (!es) return null;
  return PATRONES.categorias.filter((c) => dice(c.patrones) || conCpv(c.cpv)).map((c) => c.clave);
}

// La misma regla en la sintaxis de TED, que lematiza (singular y plural, guiada y guiado) y no distingue tildes.
const algunaDe = (terminos: string[], prefijos: string[] = []) =>
  `(${[
    ...prefijos.map((c) => `classification-cpv=${c.length === 8 ? c : `${c}*`}`),
    ...terminos.map(frase),
  ].join(' OR ')})`;
// El texto libre de TED casa también el nombre del CPV, y el del 33150000 («Aparatos de radioterapia, mecanoterapia,
// electroterapia y fisioterapia») lo llevan sobre todo compras de rehabilitación: con ese CPV, la palabra
// «radioterapia» sola no basta, ni sus adjetivos, que casan igual ese nombre del CPV.
const MAS_QUE_LA_PALABRA = PALABRAS.filter((p) => !p.startsWith('radioterap'));
const RADIOTERAPIA_TED = `((${algunaDe(PALABRAS)} OR ${algunaDe(MARCAS, CPV)}) AND NOT ${algunaDe(OTRA_COSA)} AND NOT (classification-cpv=33150000 AND NOT ${algunaDe([...MAS_QUE_LA_PALABRA, ...MARCAS], CPV)}))`;
export const consultaTed = (categoria?: Clave) => {
  const c: Categoria | undefined = categoria && CATEGORIAS[categoria];
  return c ? `${RADIOTERAPIA_TED} AND ${algunaDe(c.terminos, c.cpv)}` : RADIOTERAPIA_TED;
};

// Lo que se compra está en el título y en los lotes. El órgano no cuenta: un instituto de oncología lo compra todo.
const textoDe = (l: Licitacion) => [l.titulo, ...l.lotes.map((x) => x.nombre)].join(' · ');

// En la PLACSP no hay tipo de aviso sino estado del expediente.
const ESTADOS_POR_TIPO: Record<Tipo, string[]> = {
  previo: ['Anuncio previo'],
  convocatoria: ['En plazo', 'Pendiente de adjudicación'],
  adjudicacion: ['Adjudicada', 'Resuelta'],
};

type Filtros = {
  categoria?: Clave;
  lugar?: string;
  tipo?: Tipo;
  enPlazo?: boolean;
  texto?: string;
  desde?: string;
  hasta?: string;
};

export async function buscarEnPlacsp(
  fetchImpl: Fetch,
  f: Filtros,
  paginas: number,
  limite: number,
) {
  const leidos = await Promise.all(
    (['placsp', 'agregadas'] as const).map((fuente) => leer(fetchImpl, fuente, paginas)),
  );
  const w = words(f.texto);
  // «En plazo» en la fuente sigue así unos días después de cerrar: se mira también la fecha, como en contratacion.ts.
  const hoy = new Date().toISOString().slice(0, 10);
  const lugar = f.lugar;
  let sinLugar = 0;
  let masAmplio = 0;
  const found = leidos
    .flatMap((l) => l.entradas)
    .flatMap((l) => {
      const categorias = clasificar(textoDe(l), l.cpv);
      if (!categorias || (f.categoria && !categorias.includes(f.categoria))) return [];
      if (w.length && !matches([textoDe(l), l.organo, l.expediente].join(' '), w)) return [];
      if (f.tipo && !ESTADOS_POR_TIPO[f.tipo].includes(l.estado ?? '')) return [];
      if (
        f.enPlazo &&
        (l.estado !== 'En plazo' ||
          (l.plazo_presentacion && l.plazo_presentacion.slice(0, 10) < hoy))
      )
        return [];
      const dia = l.actualizada!.slice(0, 10);
      if ((f.desde && dia < f.desde) || (f.hasta && dia > f.hasta)) return [];
      if (lugar) {
        const codes = [l.lugar, ...l.lotes.map((x) => x.lugar)].flatMap((x) => x?.nuts ?? []);
        if (!codes.length) sinLugar++;
        const dentro = codes.some((c) => c.startsWith(lugar));
        // «ES61» para un acuerdo marco del SAS cuando se pide Sevilla: puede incluirla, pero no se sabe.
        if (!dentro && codes.some((c) => lugar.startsWith(c))) masAmplio++;
        if (!dentro) return [];
      }
      return [{ ...l, categorias }];
    })
    .sort((a, b) => Date.parse(b.actualizada!) - Date.parse(a.actualizada!));
  return {
    revisado: leidos.map((l) => l.revisado),
    aviso:
      'De la Plataforma de Contratación solo se leen las licitaciones publicadas o actualizadas entre «desde» y «hasta» de cada fuente: una más antigua que no haya cambiado después no aparece. Para ir más atrás, sube `paginas` o mira TED.',
    ...(sinLugar ? { sin_lugar_de_ejecucion: sinLugar } : {}),
    // De radioterapia y con el resto de filtros, pero con un lugar más amplio que el pedido.
    ...(masAmplio ? { lugar_mas_amplio: masAmplio } : {}),
    total: found.length,
    licitaciones: found.slice(0, limite).map((l) => ({
      ...l,
      lotes: l.lotes.map((x) => x.nombre),
      resultados: undefined,
      documentos: undefined,
      adjudicatarios: [...new Set(l.resultados.flatMap((r) => r.adjudicatarios))],
    })),
  };
}

export async function buscarEnTed(fetchImpl: Fetch, f: Filtros, pagina: number, limite: number) {
  const { categoria, ...filtros } = f;
  const r = await buscarTed(fetchImpl, consultaTed(categoria), filtros, pagina, limite);
  return {
    ...r,
    avisos: r.avisos.map((a) => ({
      ...a,
      // Se clasifica con la descripción entera y se recorta para la lista; el detalle la da ver_licitacion.
      descripcion: a.descripcion && a.descripcion.slice(0, 400),
      categorias: categoriasTed(a),
    })),
  };
}

// null cuando lo que da la API no basta para clasificar: TED encontró el aviso por el texto completo del anuncio, y
// ni el título, la descripción y los lotes ni el CPV lo dicen. De un aviso anterior a eForms solo cuenta el CPV (su
// título es el nombre del CPV, no el de la licitación), y si el CPV no da ninguna categoría no se sabe qué compra:
// también null, no una lista vacía que diría «sin categoría».
function categoriasTed(a: AvisoTed) {
  if (!a.nota) return clasificar([a.titulo, a.descripcion, ...(a.lotes ?? [])].join(' · '), a.cpv);
  const porCpv = clasificar('', a.cpv);
  return porCpv?.length ? porCpv : null;
}

const INSTRUCTIONS = `Licitaciones de radioterapia de España, cada una con lo que compra: aceleradores y equipos de tratamiento, radioterapia guiada por superficie (SGRT), simulación, braquiterapia, dosimetría y control de calidad, planificación y software, inmovilización, mantenimiento, actualización o sustitución de equipos, radioterapia concertada, protonterapia y radiocirugía, y obras de búnker.
- Si una licitación es a la vez «mantenimiento» y «actualizacion», el servicio puede incluir equipos o funciones nuevas que el título no nombra: lo dice el pliego, y ver_licitacion da su enlace.
- Dos fuentes, que se complementan. La Plataforma de Contratación del Sector Público (PLACSP y plataformas autonómicas agregadas) trae lo publicado o actualizado en los últimos días, también los contratos pequeños. TED trae los contratos armonizados con todo su histórico; desde finales de 2023 (eForms), con título, lotes, adjudicatarios y ofertas recibidas. De los avisos anteriores, la API solo da comprador, lugar, CPV, tipo y fecha, y lo dice en «nota»: el resto está en el enlace.
- Si una fuente falla, la otra responde igual y la que falló trae «error».
- Es de radioterapia lo que lo dice (radioterapia, acelerador lineal, braquiterapia, radiocirugía, protonterapia, tomoterapia, TC de simulación), o lo que lleva el CPV 33151 o 31643100 o nombra un equipo o programa de la especialidad, salvo que sea de otra cosa: la radioembolización con itrio-90, los radiofármacos y la terapia metabólica son de medicina nuclear aunque digan «radioterapia», y los aceleradores de investigación (IFMIF, luz de sincrotrón) no tratan pacientes. El órgano no cuenta. Muchos mantenimientos llevan CPV genéricos (50421000) y solo los encuentran las palabras. En TED, con el CPV 33150000 (cuyo nombre incluye «radioterapia» y que llevan sobre todo compras de rehabilitación) hace falta algo más que esa palabra.
- La categoría sale del título y de los lotes (en TED, también de la descripción), aunque TED busca en todo el anuncio. Una licitación puede tener varias, o ninguna si solo dice «radioterapia». «categorias: null» en TED quiere decir que lo que da la API no basta para clasificarla; en los avisos anteriores a eForms solo se puede mirar el CPV, y quedan en null si el CPV no dice qué se compra. Las que entran solo por el CPV, sin ninguna categoría, pueden ser de otra especialidad: hay compradores que ponen el 33151 a equipos de fisioterapia o de un centro de salud.
- «tipo: convocatoria» trae los anuncios de licitación, abiertos o no; para lo que sigue abierto, «en_plazo»: en TED, con el plazo de ofertas o el de solicitudes de participación sin vencer.
- Al pedir una provincia, la PLACSP dice en «lugar_mas_amplio» cuántas licitaciones de radioterapia tienen un lugar más amplio (toda la comunidad o toda España) y en «sin_lugar_de_ejecucion» cuántas no lo indican; en TED, un aviso etiquetado con la comunidad no sale al pedir una de sus provincias: pide también la comunidad.
- El Servicio Andaluz de Salud titula muchas licitaciones «Contrato de Servicios (CONTR AAAA NNNNNNNNNN)»: en la PLACSP no se ve qué compran; en TED, la descripción sí lo dice.
- ver_licitacion da el detalle: en la PLACSP, con su id y su fuente; en TED, con el número de aviso. El expediente de un aviso de TED es el que usa la PLACSP.
${SOURCE}`;

const iso = z.iso.date();

export function createRadioterapiaMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-radioterapia', title: 'Licitaciones de radioterapia' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_licitaciones',
        {
          title: 'Buscar licitaciones de radioterapia',
          description:
            'Licitaciones de radioterapia de la Plataforma de Contratación (recientes) y de TED (con histórico), cada una con sus categorías, de la más reciente a la más antigua.',
          inputSchema: z.object({
            categoria: z
              .enum(CLAVES)
              .optional()
              .describe(
                Object.entries(CATEGORIAS)
                  .map(([k, c]) => `${k}: ${c.nombre}`)
                  .join('; '),
              ),
            fuente: z.enum(['ambas', 'placsp', 'ted']).default('ambas'),
            lugar: z
              .string()
              .regex(/^ES[1-7][0-9A-Z]{0,2}$/)
              .optional()
              .describe(
                'Código NUTS del lugar de ejecución: ES11 Galicia, ES12 Asturias, ES13 Cantabria, ES21 País Vasco, ES22 Navarra, ES23 La Rioja, ES24 Aragón, ES30 Madrid, ES41 Castilla y León, ES42 Castilla-La Mancha, ES43 Extremadura, ES51 Cataluña, ES52 C. Valenciana, ES53 Baleares, ES61 Andalucía, ES62 Murcia, ES63 Ceuta, ES64 Melilla, ES70 Canarias; o una provincia, como ES112 (Lugo).',
              ),
            tipo: z
              .enum(TIPOS)
              .optional()
              .describe(
                'previo, convocatoria (en la PLACSP: en plazo o pendiente de adjudicación) o adjudicacion (adjudicada o resuelta; sin las modificaciones de contrato).',
              ),
            en_plazo: z
              .boolean()
              .optional()
              .describe(
                'Solo las convocatorias con el plazo abierto hoy: el de ofertas o, en TED, también el de solicitudes de participación.',
              ),
            texto: z
              .string()
              .min(3)
              .max(100)
              .optional()
              .describe(
                'En la PLACSP, palabras en cualquier orden en el título, los lotes, el órgano o el expediente; en TED, la frase en todo el anuncio.',
              ),
            desde: iso.optional().describe('Publicadas o actualizadas desde, AAAA-MM-DD.'),
            hasta: iso.optional().describe('Hasta, AAAA-MM-DD.'),
            paginas: z
              .number()
              .int()
              .min(1)
              .max(4)
              .default(2)
              .describe('Páginas recientes de cada feed de la PLACSP (unos días cada una).'),
            pagina: z.number().int().min(1).max(100).default(1).describe('Página de TED.'),
            limite: z.number().int().min(1).max(50).default(20),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ fuente, paginas, pagina, limite, en_plazo: enPlazo, ...resto }) =>
          run(SOURCE, async () => {
            // Juntos no casaría nada, y una lista vacía parecería «no hay ninguna».
            if (enPlazo && resto.tipo && resto.tipo !== 'convocatoria')
              throw new SourceError(
                'en_plazo solo vale para convocatorias: quita `tipo` o usa «convocatoria».',
              );
            const f = { ...resto, enPlazo };
            // Cada fuente por su lado: si la PLACSP no contesta, lo de TED sigue valiendo, y al revés.
            const [placsp, ted] = await Promise.allSettled([
              fuente === 'ted' ? undefined : buscarEnPlacsp(fetchImpl, f, paginas, limite),
              fuente === 'placsp' ? undefined : buscarEnTed(fetchImpl, f, pagina, limite),
            ]);
            const motivo = (reason: unknown) =>
              reason instanceof SourceError
                ? reason.message
                : 'Error interno al consultar la fuente.';
            const [uno, otro] = [placsp, ted].filter(
              (r): r is PromiseRejectedResult => r.status === 'rejected',
            );
            // Sin ninguna fuente no hay respuesta; con las dos caídas, se dice el motivo de cada una.
            if (uno && otro)
              throw new SourceError(
                `Plataforma de Contratación: ${motivo(uno.reason)} TED: ${motivo(otro.reason)}`,
              );
            if (uno && fuente !== 'ambas') throw new SourceError(motivo(uno.reason));
            const bloque = <T>(r: PromiseSettledResult<T>) =>
              r.status === 'fulfilled' ? r.value : { error: motivo(r.reason) };
            return {
              ...(f.categoria ? { categoria: CATEGORIAS[f.categoria].nombre } : {}),
              ...(fuente === 'ted' ? {} : { placsp: bloque(placsp) }),
              ...(fuente === 'placsp' ? {} : { ted: bloque(ted) }),
            };
          }),
      );
      s.registerTool(
        'ver_licitacion',
        {
          title: 'Ver una licitación',
          description:
            'El detalle de una licitación con sus categorías: en la PLACSP, lotes, resultados, adjudicatarios y documentos; en TED, expediente, pliegos, lotes, importes, ofertas recibidas, licitadores y adjudicatarios.',
          inputSchema: z.object({
            fuente: z.enum(['placsp', 'agregadas', 'ted']),
            id: z
              .string()
              .regex(/^(\d{1,12}|\d{1,9}-\d{4})$/)
              .describe(
                'Id de la PLACSP (solo cifras) o número de aviso de TED, como 583348-2026.',
              ),
            paginas: z.number().int().min(1).max(4).default(2),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ fuente, id, paginas }) =>
          run(SOURCE, async () => {
            // Sin esto, un número de TED con fuente «placsp» bajaría varias páginas de la PLACSP para nada.
            if ((fuente === 'ted') !== id.includes('-'))
              throw new SourceError(
                fuente === 'ted'
                  ? 'Un aviso de TED se escribe con su año, como 583348-2026.'
                  : 'El id de la PLACSP son solo cifras; un número con guion es un aviso de TED (fuente «ted»).',
              );
            if (fuente === 'ted') {
              const a = await verAviso(fetchImpl, id);
              return { ...a, categorias: categoriasTed(a) };
            }
            const l = await verLicitacion(fetchImpl, id, fuente, paginas);
            return { ...l, categorias: clasificar(textoDe(l), l.cpv) };
          }),
      );
    },
  );
}
