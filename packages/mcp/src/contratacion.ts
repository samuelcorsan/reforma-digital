// Servidor MCP de las licitaciones públicas: los feeds ATOM de datos abiertos de la Plataforma de
// Contratación del Sector Público (PLACSP), sin clave. Cada entrada es un expediente en formato
// CODICE, y vuelve a salir arriba cada vez que cambia (se publica, se adjudica, se formaliza…). No
// hay búsqueda en la fuente: se leen las páginas más recientes, de 5 a 15 MB cada una, y se filtra
// aquí. Por eso la respuesta dice siempre hasta qué fecha llegó la lectura.
import { z } from 'zod';
import { fold, get, matches, READ_ONLY_EXTERNAL, run, server, SourceError, words } from './comun';
import type { Fetch } from './comun';

const BASE = 'https://contrataciondelestado.es/sindicacion/';
const FEEDS = {
  // Lo que se publica en la propia PLACSP: la AGE y los organismos que no tienen plataforma propia.
  placsp: {
    url: `${BASE}sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`,
    nombre: 'Plataforma de Contratación del Sector Público',
  },
  // Lo que las comunidades publican en sus plataformas y la PLACSP agrega, sin contratos menores.
  agregadas: {
    url: `${BASE}sindicacion_1044/PlataformasAgregadasSinMenores.atom`,
    nombre:
      'Plataformas autonómicas agregadas (Euskadi, Catalunya, Madrid, Andalucía, Galicia, Navarra, La Rioja)',
  },
};
type Fuente = keyof typeof FEEDS;
const SOURCE =
  'Fuente: Plataforma de Contratación del Sector Público, Ministerio de Hacienda (contrataciondelestado.es), datos abiertos.';
// Una página puede pasar de 15 MB y la fuente la sirve a ~1 MB/s.
const TIMEOUT = 60_000;
const MAX_PAGINAS = 4;

// Listas de códigos CODICE de la propia PLACSP (contrataciondelestado.es/codice/cl/).
const ESTADOS: Record<string, string> = {
  PRE: 'Anuncio previo',
  PUB: 'En plazo',
  EV: 'Pendiente de adjudicación',
  ADJ: 'Adjudicada',
  RES: 'Resuelta',
  ANUL: 'Anulada',
};
const ESTADO_FILTRO = {
  anuncio_previo: 'PRE',
  en_plazo: 'PUB',
  pendiente_de_adjudicacion: 'EV',
  adjudicada: 'ADJ',
  resuelta: 'RES',
  anulada: 'ANUL',
} as const;
const estadoSchema = z.enum(Object.keys(ESTADO_FILTRO) as [keyof typeof ESTADO_FILTRO]);
const TIPOS: Record<string, string> = {
  '1': 'Suministros',
  '2': 'Servicios',
  '3': 'Obras',
  '21': 'Gestión de servicios públicos',
  '22': 'Concesión de servicios',
  '31': 'Concesión de obras públicas',
  '32': 'Concesión de obras',
  '40': 'Colaboración público-privada',
  '7': 'Administrativo especial',
  '8': 'Privado',
  '50': 'Patrimonial',
};
const PROCEDIMIENTOS: Record<string, string> = {
  '1': 'Abierto',
  '2': 'Restringido',
  '3': 'Negociado sin publicidad',
  '4': 'Negociado con publicidad',
  '5': 'Diálogo competitivo',
  '6': 'Contrato menor',
  '7': 'Derivado de acuerdo marco',
  '8': 'Concurso de proyectos',
  '9': 'Abierto simplificado',
  '10': 'Asociación para la innovación',
  '11': 'Derivado de asociación para la innovación',
  '12': 'Basado en un sistema dinámico de adquisición',
  '13': 'Licitación con negociación',
  '100': 'Normas internas',
  '999': 'Otros',
};
const RESULTADOS: Record<string, string> = {
  '1': 'Adjudicado provisionalmente',
  '2': 'Adjudicado definitivamente',
  '3': 'Desierto',
  '4': 'Desistimiento',
  '5': 'Renuncia',
  '6': 'Desierto provisionalmente',
  '7': 'Desierto definitivamente',
  '8': 'Adjudicado',
  '9': 'Formalizado',
  '10': 'Licitador mejor valorado',
  '11': 'Encargo formalizado',
};
// NUTS 2021 de España (lista NUTS-2021 de la PLACSP). Las agregadas solo traen el código.
const NUTS: Record<string, string> = {
  ES1: 'Noroeste',
  ES11: 'Galicia',
  ES111: 'A Coruña',
  ES112: 'Lugo',
  ES113: 'Ourense',
  ES114: 'Pontevedra',
  ES12: 'Principado de Asturias',
  ES120: 'Asturias',
  ES13: 'Cantabria',
  ES130: 'Cantabria',
  ES2: 'Noreste',
  ES21: 'País Vasco',
  ES211: 'Araba/Álava',
  ES212: 'Gipuzkoa',
  ES213: 'Bizkaia',
  ES22: 'Comunidad Foral de Navarra',
  ES220: 'Navarra',
  ES23: 'La Rioja',
  ES230: 'La Rioja',
  ES24: 'Aragón',
  ES241: 'Huesca',
  ES242: 'Teruel',
  ES243: 'Zaragoza',
  ES3: 'Comunidad de Madrid',
  ES30: 'Comunidad de Madrid',
  ES300: 'Madrid',
  ES4: 'Centro',
  ES41: 'Castilla y León',
  ES411: 'Ávila',
  ES412: 'Burgos',
  ES413: 'León',
  ES414: 'Palencia',
  ES415: 'Salamanca',
  ES416: 'Segovia',
  ES417: 'Soria',
  ES418: 'Valladolid',
  ES419: 'Zamora',
  ES42: 'Castilla-La Mancha',
  ES421: 'Albacete',
  ES422: 'Ciudad Real',
  ES423: 'Cuenca',
  ES424: 'Guadalajara',
  ES425: 'Toledo',
  ES43: 'Extremadura',
  ES431: 'Badajoz',
  ES432: 'Cáceres',
  ES5: 'Este',
  ES51: 'Cataluña/Catalunya',
  ES511: 'Barcelona',
  ES512: 'Girona',
  ES513: 'Lleida',
  ES514: 'Tarragona',
  ES52: 'Comunitat Valenciana',
  ES521: 'Alicante/Alacant',
  ES522: 'Castellón/Castelló',
  ES523: 'Valencia/València',
  ES53: 'Illes Balears',
  ES531: 'Eivissa y Formentera',
  ES532: 'Mallorca',
  ES533: 'Menorca',
  ES6: 'Sur',
  ES61: 'Andalucía',
  ES611: 'Almería',
  ES612: 'Cádiz',
  ES613: 'Córdoba',
  ES614: 'Granada',
  ES615: 'Huelva',
  ES616: 'Jaén',
  ES617: 'Málaga',
  ES618: 'Sevilla',
  ES62: 'Región de Murcia',
  ES620: 'Murcia',
  ES63: 'Ceuta',
  ES630: 'Ceuta',
  ES64: 'Melilla',
  ES640: 'Melilla',
  ES7: 'Canarias',
  ES70: 'Canarias',
  ES703: 'El Hierro',
  ES704: 'Fuerteventura',
  ES705: 'Gran Canaria',
  ES706: 'La Gomera',
  ES707: 'La Palma',
  ES708: 'Lanzarote',
  ES709: 'Tenerife',
};
// Los nombres en castellano que la lista NUTS no trae.
const ALIAS: Record<string, string> = {
  vizcaya: 'ES213',
  guipuzcoa: 'ES212',
  euskadi: 'ES21',
  'pais vasco': 'ES21',
  'la coruna': 'ES111',
  coruna: 'ES111',
  orense: 'ES113',
  gerona: 'ES512',
  lerida: 'ES513',
  baleares: 'ES53',
};

/**
 * El prefijo NUTS de una provincia, comunidad o código; error si no se conoce. Una comunidad de una
 * sola provincia sube a su código más amplio: las entradas de Madrid traen ES300, ES30 o ES3.
 */
function nuts(provincia: string) {
  const code = provincia.trim().toUpperCase();
  const f = fold(provincia);
  let found =
    code in NUTS
      ? code
      : (ALIAS[f] ??
        Object.keys(NUTS).find((c) => NUTS[c]!.split('/').some((name) => fold(name) === f)));
  if (!found)
    throw new SourceError(
      `No conozco «${provincia}» como provincia ni comunidad. Usa su nombre (Gipuzkoa, Bizkaia, Araba/Álava, Sevilla…), el de la comunidad o el código NUTS (ES212). Las provincias canarias van por isla (Tenerife, Gran Canaria…) o como Canarias.`,
    );
  const hermanos = (c: string) =>
    Object.keys(NUTS).filter((k) => k.length === c.length && k.startsWith(c.slice(0, -1)));
  while (found.slice(0, -1) in NUTS && hermanos(found).length === 1) found = found.slice(0, -1);
  return found;
}

// CODICE en texto: cada elemento que se lee aquí no se anida consigo mismo, salvo el proyecto de
// cada lote, que se quita antes de leer el del contrato.
const decode = (s: string) =>
  s
    .replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, name: string) =>
      hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : dec
          ? String.fromCodePoint(Number(dec))
          : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()]!,
    )
    .replace(/\s+/g, ' ')
    .trim();
const all = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map(
    (m) => m[1]!,
  );
const one = (xml: string | undefined, tag: string) =>
  xml === undefined ? undefined : all(xml, tag)[0];
const text = (xml: string | undefined, tag: string) => {
  const v = one(xml, tag);
  return v === undefined ? undefined : decode(v);
};
const amount = (xml: string | undefined, tag: string) => {
  const v = text(xml, tag);
  return v === undefined ? undefined : Number(v);
};

function lugar(project: string | undefined) {
  const loc = one(project, 'cac:RealizedLocation');
  const code = text(loc, 'cbc:CountrySubentityCode');
  return code === undefined
    ? undefined
    : { nuts: code, nombre: NUTS[code] ?? text(loc, 'cbc:CountrySubentity') };
}

const presupuesto = (project: string | undefined) => {
  const b = one(project, 'cac:BudgetAmount');
  return {
    sin_iva: amount(b, 'cbc:TaxExclusiveAmount'),
    con_iva: amount(b, 'cbc:TotalAmount'),
    valor_estimado: amount(b, 'cbc:EstimatedOverallContractAmount'),
  };
};

const cpvs = (project: string | undefined) =>
  all(project ?? '', 'cbc:ItemClassificationCode').map(decode);

/** Una entrada del feed leída a lo que se le cuenta al asistente. */
function licitacion(entry: string, fuente: Fuente) {
  const lotes = all(entry, 'cac:ProcurementProjectLot');
  const main = one(
    entry.replace(/<cac:ProcurementProjectLot>[\s\S]*?<\/cac:ProcurementProjectLot>/g, ''),
    'cac:ProcurementProject',
  );
  const party = one(one(entry, 'cac-place-ext:LocatedContractingParty'), 'cac:Party');
  const plazo = one(entry, 'cac:TenderSubmissionDeadlinePeriod');
  const estado = text(entry, 'cbc-place-ext:ContractFolderStatusCode');
  const tipo = text(main, 'cbc:TypeCode');
  const procedimiento = text(entry, 'cbc:ProcedureCode');
  const lotCpvs = lotes.flatMap((l) => cpvs(one(l, 'cac:ProcurementProject')));
  const fecha = text(plazo, 'cbc:EndDate');
  return {
    id: /(\d+)$/.exec(text(entry, 'id')!)![1]!,
    fuente,
    // Las agregadas dicen de qué plataforma vienen.
    plataforma: text(one(party, 'cac:AgentParty'), 'cbc:Name'),
    expediente: text(entry, 'cbc:ContractFolderID'),
    titulo: text(entry, 'title'),
    organo: text(one(party, 'cac:PartyName'), 'cbc:Name'),
    estado: estado && (ESTADOS[estado] ?? estado),
    tipo: tipo && (TIPOS[tipo] ?? tipo),
    procedimiento: procedimiento && (PROCEDIMIENTOS[procedimiento] ?? procedimiento),
    cpv: [...new Set([...cpvs(main), ...lotCpvs])],
    importe: presupuesto(main),
    lugar: lugar(main),
    plazo_presentacion: fecha && [fecha, text(plazo, 'cbc:EndTime')].filter(Boolean).join(' '),
    actualizada: text(entry, 'updated'),
    enlace: /<link[^>]*href="([^"]*)"/.exec(entry)?.[1]?.replaceAll('&amp;', '&'),
    lotes: lotes.map((l) => {
      const p = one(l, 'cac:ProcurementProject');
      return {
        lote: text(l, 'cbc:ID'),
        nombre: text(p, 'cbc:Name'),
        importe: presupuesto(p),
        cpv: cpvs(p),
        lugar: lugar(p),
      };
    }),
    resultados: all(entry, 'cac:TenderResult').map((r) => {
      const total = one(r, 'cac:LegalMonetaryTotal');
      const resultado = text(r, 'cbc:ResultCode');
      return {
        lote: text(r, 'cbc:ProcurementProjectLotID'),
        resultado: resultado && (RESULTADOS[resultado] ?? resultado),
        fecha: text(r, 'cbc:AwardDate'),
        ofertas_recibidas: amount(r, 'cbc:ReceivedTenderQuantity'),
        // Solo el nombre: el NIF de un autónomo es un dato personal y no hace falta para la búsqueda.
        adjudicatarios: all(r, 'cac:WinningParty').map((w) =>
          text(one(w, 'cac:PartyName'), 'cbc:Name'),
        ),
        importe: {
          sin_iva: amount(total, 'cbc:TaxExclusiveAmount'),
          con_iva: amount(total, 'cbc:PayableAmount'),
        },
      };
    }),
    documentos: [
      'cac:LegalDocumentReference',
      'cac:TechnicalDocumentReference',
      'cac:AdditionalDocumentReference',
    ]
      .flatMap((tag) => all(entry, tag))
      .map((d) => ({ nombre: text(d, 'cbc:ID'), url: text(d, 'cbc:URI') })),
  };
}
export type Licitacion = ReturnType<typeof licitacion>;

type Borrada = { id: string; motivo: string | undefined; fecha: string | undefined };
type Pagina = { entradas: Licitacion[]; borradas: Borrada[]; siguiente: string | undefined };

async function pagina(fetchImpl: Fetch, url: string, fuente: Fuente): Promise<Pagina> {
  const response = await get(fetchImpl, url, 'application/atom+xml', undefined, TIMEOUT);
  let xml: string;
  try {
    xml = await response.text();
  } catch {
    // El tiempo límite también corta la lectura del cuerpo.
    throw new SourceError(
      'La Plataforma de Contratación tardó demasiado en enviar el feed. Prueba con menos páginas.',
    );
  }
  if (!xml.includes('<feed'))
    throw new SourceError('La Plataforma de Contratación no devolvió un feed ATOM.');
  // Un feed cortado a medias daría una lista incompleta como si fuera la página entera.
  const abiertas = xml.match(/<entry>/g)?.length ?? 0;
  if (!xml.trimEnd().endsWith('</feed>') || abiertas !== (xml.match(/<\/entry>/g)?.length ?? 0))
    throw new SourceError('La Plataforma de Contratación devolvió un feed incompleto.');
  const enlace = [...xml.matchAll(/<link\b[^>]*>/g)].find((m) => /\brel="next"/.test(m[0]));
  const next = enlace && /\bhref="([^"]+)"/.exec(enlace[0])?.[1];
  return {
    entradas: all(xml, 'entry').map((e) => licitacion(e, fuente)),
    // Las retiradas del feed: `<at:comment type="ANULADA"/>` o `"CERRADA"`.
    borradas: [
      ...xml.matchAll(
        /<at:deleted-entry ref="[^"]*?(\d+)"(?: when="([^"]*)")?>\s*(?:<at:comment type="([^"]*)")?/g,
      ),
    ].map((m) => ({ id: m[1]!, fecha: m[2], motivo: m[3] })),
    // Solo se siguen enlaces a la propia sindicación.
    siguiente: next?.startsWith(BASE) ? next : undefined,
  };
}

/**
 * Las entradas de las `paginas` más recientes de un feed, sin repetir expediente: la primera que
 * aparece es la versión más reciente. Con `id`, deja de leer en cuanto lo encuentra.
 */
export async function leer(fetchImpl: Fetch, fuente: Fuente, paginas: number, id?: string) {
  const vistas = new Set<string>();
  const nueva = (x: { id: string }) => !vistas.has(x.id) && Boolean(vistas.add(x.id));
  const entradas: Licitacion[] = [];
  const borradas: Borrada[] = [];
  let url: string | undefined = FEEDS[fuente].url;
  let leidas = 0;
  while (url && leidas < paginas) {
    const p = await pagina(fetchImpl, url, fuente);
    leidas++;
    borradas.push(...p.borradas.filter(nueva));
    entradas.push(...p.entradas.filter(nueva));
    url = p.siguiente;
    if (id && vistas.has(id)) break;
  }
  const fechas = entradas.map((e) => e.actualizada!).sort();
  return {
    entradas,
    borradas,
    revisado: {
      fuente: FEEDS[fuente].nombre,
      paginas: leidas,
      licitaciones: entradas.length,
      desde: fechas[0],
      hasta: fechas.at(-1),
    },
  };
}

// Sin los documentos ni el detalle de lotes y resultados, que da ver_licitacion.
const resumen = (l: Licitacion) => ({
  ...l,
  lotes: l.lotes.length || undefined,
  resultados: undefined,
  documentos: undefined,
  adjudicatarios: [...new Set(l.resultados.flatMap((r) => r.adjudicatarios))],
});

type Filtros = z.infer<typeof buscarSchema>;

export async function buscarLicitaciones(fetchImpl: Fetch, f: Filtros) {
  // Los filtros se validan antes de descargar nada.
  const prefijo = f.provincia === undefined ? undefined : nuts(f.provincia);
  // De un código entero, sin el dígito de control ni los ceros del final, que no acotan
  // (45421000 → 45421), sin bajar de la división (90000000 → 90, no 9). Un prefijo más corto se
  // toma tal cual: «45420» no es «4542».
  const sinControl = f.cpv?.replace(/-\d$/, '');
  const cpv = sinControl?.length === 8 ? sinControl.replace(/^(\d{2}\d*?)0+$/, '$1') : sinControl;
  // «En plazo» en la fuente sigue así unos días después de cerrar: se mira también la fecha.
  const hoy = new Date().toISOString().slice(0, 10);
  const w = words(f.texto);
  const estado = f.estado && ESTADOS[ESTADO_FILTRO[f.estado]];
  const fuentes: Fuente[] = f.fuente === 'ambas' ? ['placsp', 'agregadas'] : [f.fuente];
  const leidos = await Promise.all(fuentes.map((fuente) => leer(fetchImpl, fuente, f.paginas)));
  const todas = leidos.flatMap((l) => l.entradas);
  let sinLugar = 0;
  let masAmplio = 0;
  const found = todas.filter((l) => {
    if (w.length && !matches([l.titulo, l.organo, l.expediente].join(' '), w)) return false;
    if (estado && l.estado !== estado) return false;
    if (f.estado === 'en_plazo' && l.plazo_presentacion && l.plazo_presentacion.slice(0, 10) < hoy)
      return false;
    if (cpv && !l.cpv.some((c) => c.startsWith(cpv))) return false;
    if (prefijo) {
      const codes = [l.lugar, ...l.lotes.map((x) => x.lugar)].flatMap((x) => x?.nuts ?? []);
      if (!codes.length) sinLugar++;
      const dentro = codes.some((c) => c.startsWith(prefijo));
      // «ES» (toda España) o «ES21» para Gipuzkoa: puede incluirla, pero no se sabe.
      if (!dentro && codes.some((c) => prefijo.startsWith(c))) masAmplio++;
      return dentro;
    }
    return true;
  });
  // Las dos fuentes, mezcladas de la más reciente a la más antigua.
  found.sort((a, b) => Date.parse(b.actualizada!) - Date.parse(a.actualizada!));
  return {
    revisado: leidos.map((l) => l.revisado),
    aviso:
      'Solo se leen las licitaciones publicadas o actualizadas entre «desde» y «hasta» de cada fuente: una más antigua que no haya cambiado después no aparece. Para ir más atrás, sube `paginas`.',
    ...(prefijo
      ? {
          provincia: { nuts: prefijo, nombre: NUTS[prefijo] },
          ...(sinLugar ? { sin_lugar_de_ejecucion: sinLugar } : {}),
          // Cumplen el resto de filtros pero su lugar es más amplio que la provincia pedida.
          ...(masAmplio ? { lugar_mas_amplio: masAmplio } : {}),
        }
      : {}),
    total: found.length,
    licitaciones: found.slice(0, f.limite).map(resumen),
  };
}

export async function verLicitacion(fetchImpl: Fetch, id: string, fuente: Fuente, paginas: number) {
  const { entradas, borradas, revisado } = await leer(fetchImpl, fuente, paginas, id);
  const found = entradas.find((l) => l.id === id);
  if (found) return found;
  const borrada = borradas.find((b) => b.id === id);
  if (borrada)
    throw new SourceError(
      `La licitación ${id} se retiró del feed${borrada.motivo ? ` como ${borrada.motivo}` : ''}${borrada.fecha ? ` el ${borrada.fecha}` : ''}: la Plataforma ya no publica sus datos abiertos.`,
    );
  throw new SourceError(
    `La licitación ${id} no está en lo leído de ${revisado.fuente} (${revisado.paginas} página(s)${revisado.desde ? `, actualizadas desde ${revisado.desde}` : ''}). Puede ser más antigua o de la otra fuente: sube \`paginas\` o cambia \`fuente\`.`,
  );
}

const INSTRUCTIONS = `Licitaciones públicas de España desde los datos abiertos de la Plataforma de Contratación del Sector Público (PLACSP), del Ministerio de Hacienda: anuncios, plazos, importes, lotes y adjudicaciones.
Hay dos fuentes: «placsp», lo que se publica en la propia Plataforma (Administración General del Estado, ayuntamientos y organismos sin plataforma propia), y «agregadas», lo que Euskadi, Catalunya, Madrid, Andalucía, Galicia, Navarra y La Rioja publican en sus plataformas. Por defecto se leen las dos. Los contratos menores no están.
La fuente no tiene buscador: buscar_licitaciones lee las páginas más recientes de cada feed (las licitaciones publicadas o que han cambiado hace poco: un día laborable puede llenar varias páginas) y filtra. Di siempre hasta qué fecha llegó («revisado»): una licitación más antigua sin cambios después no sale, y no por eso no existe.
La provincia es el lugar de ejecución (código NUTS), no la sede del órgano. Las licitaciones de ámbito más amplio (toda España, la comunidad entera) no salen al filtrar por provincia: «lugar_mas_amplio» dice cuántas había. El CPV filtra por prefijo: 4542 son las obras de carpintería, 45421 las de carpintería de madera y metal, 44221 las ventanas, puertas y elementos afines.
Los importes van en euros: sin_iva es el presupuesto base de licitación sin impuestos, con_iva con ellos, y valor_estimado incluye prórrogas y modificaciones.
${SOURCE}`;

const paginasSchema = (def: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGINAS)
    .default(def)
    .describe(
      `Cuántas páginas de cada feed leer, de la más reciente hacia atrás (unas 400 licitaciones y de 5 a 15 MB cada una; hasta ${MAX_PAGINAS}).`,
    );

const buscarSchema = z.object({
  texto: z
    .string()
    .max(100)
    .optional()
    .describe('Palabras del título, del órgano o del expediente, sin importar tildes ni orden.'),
  provincia: z
    .string()
    .max(60)
    .optional()
    .describe(
      'Provincia o comunidad del lugar de ejecución (Gipuzkoa, Bizkaia, Araba, Madrid…) o código NUTS (ES212).',
    ),
  cpv: z
    .string()
    .regex(/^\d{2,8}(-\d)?$/)
    .optional()
    .describe('Código CPV o su comienzo: 45421 encuentra 45421000, 45421100…'),
  estado: estadoSchema.optional(),
  fuente: z.enum(['ambas', 'placsp', 'agregadas']).default('ambas'),
  paginas: paginasSchema(1),
  limite: z.number().int().min(1).max(50).default(20).describe('Cuántas licitaciones devolver.'),
});

export function createContratacionMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-contratacion', title: 'Licitaciones públicas' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_licitaciones',
        {
          title: 'Buscar licitaciones',
          description:
            'Las licitaciones publicadas o actualizadas hace poco que cumplen todos los filtros, de la más reciente a la más antigua: expediente, título, órgano, estado, tipo, CPV, importe, lugar de ejecución, plazo de presentación, adjudicatarios y enlace. `revisado` dice qué periodo se leyó de cada fuente.',
          inputSchema: buscarSchema,
          annotations: READ_ONLY_EXTERNAL,
        },
        (args) => run(SOURCE, () => buscarLicitaciones(fetchImpl, args)),
      );
      s.registerTool(
        'ver_licitacion',
        {
          title: 'Ver una licitación',
          description:
            'Una licitación entera por su id y fuente de buscar_licitaciones: lotes con su importe, CPV y lugar, resultado y adjudicatario de cada lote con el importe adjudicado, y los pliegos y demás documentos.',
          inputSchema: z.object({
            id: z
              .string()
              .regex(/^\d{1,12}$/)
              .describe('El id de buscar_licitaciones, como 20849627.'),
            fuente: z.enum(['placsp', 'agregadas']),
            paginas: paginasSchema(2),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ id, fuente, paginas }) =>
          run(SOURCE, () => verLicitacion(fetchImpl, id, fuente, paginas)),
      );
    },
  );
}
