// Servidor MCP de subvenciones: la API pública y sin clave del Sistema Nacional de Publicidad de
// Subvenciones y Ayudas Públicas (BDNS, infosubvenciones.es), documentada en
// https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json. La búsqueda no trae el
// plazo de solicitud ni filtra por él: el plazo sale del detalle de cada convocatoria, que se pide
// una a una porque la API corta con 429 a partir de unas pocas peticiones a la vez.
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const API = 'https://www.infosubvenciones.es/bdnstrans/api';
const WEB = 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias';
const SOURCE =
  'Fuente: Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas (BDNS, infosubvenciones.es), Intervención General de la Administración del Estado.';
// Cada resultado pide su detalle para saber el plazo: más por página haría saltar el límite de la API.
const POR_PAGINA = 10;
// Con abiertas=true se revisan más, porque muchas salen sin plazo o cerradas.
const POR_PAGINA_ABIERTAS = 20;
const POR_PAGINA_CONCESIONES = 20;
// El cortafuegos de la BDNS rechaza las URL de más de unos 2.100 caracteres con una página HTML y
// un 200; un filtro de órgano muy general («ayuntamiento») llega a eso.
const MAX_URL = 2000;

const INSTRUCTIONS = `Convocatorias de subvenciones y ayudas públicas de todas las administraciones de España (Estado, comunidades autónomas, entidades locales y otros organismos), tal como se registran en la Base de Datos Nacional de Subvenciones (BDNS), y las concesiones ya otorgadas.
- buscar_convocatorias da las más recientes primero, 10 por página (20 con abiertas=true), con su plazo de solicitud; ver_convocatoria da el detalle de una (beneficiarios, regiones, presupuesto, bases reguladoras, extracto en el diario oficial y documentos).
- El estado del plazo se calcula con las fechas que registra el órgano y la fecha de hoy en Madrid: «abierta», «indefinida» (sin fechas, la BDNS la marca de solicitud indefinida; puede llevar años así sin que nadie la cierre: mira la fecha de registro y compruébalo en las bases o la sede), «aun_no_abierta», «cerrada», «anulada» (el título empieza por «ANULADA»: la BDNS no la marca de otra forma y deja sus fechas) o «desconocido» (sin fechas, solo un texto como «desde el día siguiente a la publicación»). No supongas que una convocatoria «desconocido» está abierta: da el texto y remite a las bases o a la sede.
- La BDNS no filtra por plazo: con abiertas=true se revisa cada convocatoria de la página pedida y se dejan las «abierta» y las «indefinida», así que la página siguiente puede tener más. Buena parte de las convocatorias registradas son instrumentales.
- solo_beneficiarios_nombrados marca una convocatoria instrumental (subvención nominativa, directa o de un convenio): solo puede pedirla la entidad que nombra. Sus fechas pueden ser el plazo que esa entidad tiene para presentar la solicitud o las de la actividad; dilo así y remite al decreto o al convenio, sin presentarla como abierta a cualquiera.
- La región es la zona de impacto que registra el órgano e incluye las que tiene dentro (Euskadi incluye Gipuzkoa), pero no las de fuera: una convocatoria para toda España no sale al filtrar por Gipuzkoa. El órgano es quien convoca («eibar», «diputacion foral de bizkaia», «pais vasco», «ministerio de industria»).
- No todas las administraciones registran todo en la BDNS; si falta una convocatoria, mira el boletín oficial del órgano (por ejemplo con el servidor del BOE).
- buscar_concesiones da las concesiones de una convocatoria o de una entidad por su CIF. Los nombres de las personas físicas son datos personales y no se devuelven: sale sin nombre (nombre_omitido) todo beneficiario que no tenga CIF de persona jurídica, también algunas entidades extranjeras; tampoco se busca por DNI o NIE.
${SOURCE}`;

const madrid = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' });
/** La fecha de hoy en Madrid, AAAA-MM-DD. */
const hoy = () => madrid.format(new Date());
/** AAAA-MM-DD a DD/MM/AAAA, el formato que pide la API. */
const dmy = (iso: string) => iso.split('-').reverse().join('/');

/** Las palabras sueltas de un texto, sin tildes ni mayúsculas: «Irun» no es «Iruña». */
const tokens = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
// Nombres con que se pide un sitio y que la BDNS escribe de otra forma.
const ALIAS: Record<string, string> = {
  euskadi: 'pais vasco',
  'gobierno vasco': 'pais vasco',
  catalunya: 'cataluna',
  xunta: 'galicia',
  'comunitat valenciana': 'valenciana',
  guipuzcoa: 'gipuzkoa',
  vizcaya: 'bizkaia',
};
// La BDNS cuelga los órganos autonómicos de la comunidad («ANDALUCÍA · CONSEJERÍA…»), sin
// «Junta», «Xunta» ni «Generalitat»: «junta de andalucia» se busca como «andalucia».
const GOBIERNO = /^(gobierno|junta|xunta|generalitat|govern)( de la| de| del)? (?=\S)/;
const query = (q: string) => {
  const f = fold(q);
  const sin = f.replace(GOBIERNO, '');
  const q2 = tokens(ALIAS[f] ?? ALIAS[sin] ?? sin);
  // Sin palabras, el filtro lo aceptaría todo y la respuesta parecería filtrada.
  if (!q2.length) throw new SourceError(`«${q}» no tiene ninguna palabra que buscar.`);
  return q2;
};
const contiene = (text: string, q: string[]) => {
  const t = tokens(text);
  return q.every((w) => t.includes(w));
};

async function json<T>(
  fetchImpl: Fetch,
  path: string,
  params: URLSearchParams,
  reintento = true,
): Promise<T | undefined> {
  // vpd es el portal: GE, el general, tiene las convocatorias de todas las administraciones.
  params.set('vpd', 'GE');
  // Las comas de las listas de ids, sin codificar: con «%2C» caben muchos menos órganos.
  const url = `${API}/${path}?${params}`.replaceAll('%2C', ',');
  if (url.length > MAX_URL)
    throw new SourceError(
      'La consulta abarca demasiados órganos o regiones para la BDNS: concreta el órgano (el municipio, la comunidad o el departamento), usa `administracion` o quita la región.',
    );
  let response: Response;
  try {
    response = await get(fetchImpl, url);
  } catch (error) {
    if (error instanceof SourceError && error.status === 429) {
      // El límite es por ráfagas: pasado un momento, vuelve a responder.
      if (reintento) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return json<T>(fetchImpl, path, params, false);
      }
      throw new SourceError(
        'La BDNS limita las peticiones seguidas: espera unos segundos y repite la consulta.',
      );
    }
    if (error instanceof SourceError && error.status === 400)
      throw new SourceError('La BDNS no acepta algún filtro de la consulta.');
    throw error;
  }
  // La API responde 204 sin cuerpo cuando no encuentra lo pedido.
  if (response.status === 204) return undefined;
  // El cortafuegos responde 200 con una página «Página Rechazada» a lo que no le gusta.
  if (!response.headers.get('content-type')?.includes('json'))
    throw new SourceError(
      'La BDNS ha rechazado la consulta. Prueba con otras palabras o con menos filtros.',
    );
  return (await response.json()) as T;
}

type Nodo = { id: number; descripcion: string; children?: Nodo[] };

// Las listas de valores de los filtros apenas cambian: una vez por proceso (y por `fetch`, para
// que cada test tenga las suyas). Si fallan, no se guarda el error.
const listas = new WeakMap<Fetch, Map<string, Promise<unknown>>>();
function cached<T>(fetchImpl: Fetch, key: string, load: () => Promise<T>) {
  let porFetch = listas.get(fetchImpl);
  if (!porFetch) listas.set(fetchImpl, (porFetch = new Map()));
  const saved = porFetch.get(key);
  if (saved) return saved as Promise<T>;
  const value = load().catch((error: unknown) => {
    porFetch.delete(key);
    throw error;
  });
  porFetch.set(key, value);
  return value;
}

async function lista<T>(fetchImpl: Fetch, path: string, params = new URLSearchParams()) {
  const body = await json<T[]>(fetchImpl, path, params);
  if (!Array.isArray(body) || !body.length)
    throw new SourceError(`La BDNS no ha devuelto la lista de ${path}. Prueba más tarde.`);
  return body;
}

const ADMINISTRACIONES = { estado: 'C', autonomica: 'A', local: 'L', otros: 'O' } as const;
type Administracion = keyof typeof ADMINISTRACIONES;

const BENEFICIARIOS = {
  personas_fisicas: 1,
  entidades_sin_actividad_economica: 2,
  pymes_y_autonomos: 3,
  gran_empresa: 4,
} as const;
type Beneficiario = keyof typeof BENEFICIARIOS;

type Organo = { id: number; ruta: string };

// Solo las hojas del árbol filtran: los ids de los nodos intermedios (provincia, municipio) son de
// otra numeración y la API los toma por otros órganos.
const organos = (fetchImpl: Fetch, tipo: Administracion) =>
  cached(fetchImpl, `organos-${tipo}`, async () => {
    const hojas: Organo[] = [];
    const walk = (nodos: Nodo[], ruta: string[]) => {
      for (const n of nodos) {
        if (n.children?.length) walk(n.children, [...ruta, n.descripcion]);
        else hojas.push({ id: n.id, ruta: [...ruta, n.descripcion].join(' · ') });
      }
    };
    const params = new URLSearchParams({ idAdmon: ADMINISTRACIONES[tipo] });
    walk(await lista<Nodo>(fetchImpl, 'organos', params), []);
    return hojas;
  });
const regiones = (fetchImpl: Fetch) =>
  cached(fetchImpl, 'regiones', () => lista<Nodo>(fetchImpl, 'regiones'));
const finalidades = (fetchImpl: Fetch) =>
  cached(fetchImpl, 'finalidades', () =>
    lista<{ id: number; descripcion: string }>(fetchImpl, 'finalidades'),
  );

async function resolverOrganos(
  fetchImpl: Fetch,
  texto: string,
  administracion: Administracion | undefined,
) {
  const q = query(texto);
  const tipos = administracion
    ? [administracion]
    : (Object.keys(ADMINISTRACIONES) as Administracion[]);
  const found: Organo[] = [];
  // Una lista tras otra: en paralelo, la API puede responder 429.
  for (const t of tipos)
    found.push(...(await organos(fetchImpl, t)).filter((o) => contiene(o.ruta, q)));
  if (!found.length)
    throw new SourceError(
      `Ningún órgano${administracion ? ` de la administración ${administracion}` : ''} se llama «${texto}». Usa palabras enteras del nombre del ayuntamiento, la comunidad, la diputación o el ministerio, como «eibar», «pais vasco», «diputacion foral bizkaia» o «ministerio industria».`,
    );
  return found;
}

async function resolverRegiones(fetchImpl: Fetch, texto: string) {
  const q = query(texto);
  const ids = new Set<number>();
  const nombres: string[] = [];
  // Una región incluye las que tiene dentro: la API filtra solo por la región exacta, y una
  // convocatoria de «ES21 - PAIS VASCO» no saldría al pedir Gipuzkoa ni al revés.
  const walk = (nodos: Nodo[], dentro: boolean) => {
    for (const n of nodos) {
      // «ES212 - Gipuzkoa»: se busca por el código o por el nombre.
      const [codigo, nombre = ''] = n.descripcion.split(' - ');
      const coincide = !dentro && (fold(codigo!) === fold(texto) || contiene(nombre, q));
      if (coincide) nombres.push(n.descripcion.trim());
      if (dentro || coincide) ids.add(n.id);
      walk(n.children ?? [], dentro || coincide);
    }
  };
  walk(await regiones(fetchImpl), false);
  if (!ids.size)
    throw new SourceError(
      `Ninguna región se llama «${texto}». Usa una comunidad o provincia («pais vasco», «gipuzkoa», «cataluña», «comunidad de madrid») o un código NUTS como ES212.`,
    );
  return { ids: [...ids], nombres };
}

async function resolverFinalidad(fetchImpl: Fetch, texto: string) {
  const all = await finalidades(fetchImpl);
  const q = query(texto);
  const exact = all.filter((f) => fold(f.descripcion) === fold(texto));
  const found = exact.length ? exact : all.filter((f) => contiene(f.descripcion, q));
  if (found.length !== 1)
    throw new SourceError(
      `${found.length ? `«${texto}» es más de una finalidad` : `Ninguna finalidad se llama «${texto}»`}. Las finalidades: ${all.map((f) => f.descripcion.toLowerCase()).join('; ')}.`,
    );
  return found[0]!;
}

type Pagina<T> = { content: T[]; totalElements: number; totalPages: number };

function pagina<T>(body: Pagina<T> | undefined, numero: number) {
  // Un total sin páginas, o una página vacía que debería tener resultados, es una respuesta rota.
  if (
    !body ||
    !Array.isArray(body.content) ||
    typeof body.totalElements !== 'number' ||
    typeof body.totalPages !== 'number' ||
    (body.totalElements > 0 && numero <= body.totalPages && !body.content.length)
  )
    throw new SourceError('La BDNS ha devuelto una respuesta incompleta. Prueba más tarde.');
  if (body.totalElements > 0 && numero > body.totalPages)
    throw new SourceError(
      `La búsqueda tiene ${body.totalPages} páginas (${body.totalElements} resultados): pide una página entre 1 y ${body.totalPages}.`,
    );
  return body;
}

type Convocatoria = {
  numeroConvocatoria: string;
  descripcion: string;
  fechaRecepcion: string;
  nivel1: string;
  nivel2: string;
  nivel3: string | null;
};

type Detalle = {
  codigoBDNS: string;
  organo: { nivel1: string; nivel2: string; nivel3: string | null };
  sedeElectronica: string | null;
  fechaRecepcion: string;
  instrumentos: { descripcion: string }[];
  tipoConvocatoria: string | null;
  presupuestoTotal: number | null;
  mrr: boolean;
  descripcion: string;
  descripcionLeng: string | null;
  tiposBeneficiarios: { descripcion: string }[];
  sectores: { descripcion: string; codigo: string }[];
  regiones: { descripcion: string }[];
  descripcionFinalidad: string | null;
  descripcionBasesReguladoras: string | null;
  urlBasesReguladoras: string | null;
  sePublicaDiarioOficial: boolean;
  abierto: boolean;
  fechaInicioSolicitud: string | null;
  fechaFinSolicitud: string | null;
  textInicio: string | null;
  textFin: string | null;
  ayudaEstado: string | null;
  urlAyudaEstado: string | null;
  fondos: { descripcion: string }[];
  reglamento: { descripcion: string } | null;
  objetivos: { descripcion: string }[];
  documentos: {
    id: number;
    nombreFic: string;
    descripcion: string | null;
    datPublicacion: string | null;
  }[];
  anuncios: {
    titulo: string | null;
    url: string | null;
    desDiarioOficial: string | null;
    datPublicacion: string | null;
  }[];
};

const organo = (o: { nivel1: string; nivel2: string; nivel3: string | null }) =>
  [o.nivel1, o.nivel2, o.nivel3].filter(Boolean).join(' · ');
// Muchas convocatorias antiguas e instrumentales registran 0: es que no lo dan, no que sea 0 €.
const presupuesto = (p: number | null) => (p ? p : null);
const limpio = (t: string | null) => (t?.trim() ? t.trim() : undefined);

/** El plazo de solicitud y si está abierto hoy, solo con las fechas registradas. */
function plazo(d: Detalle, dia = hoy()) {
  const inicio = d.fechaInicioSolicitud;
  const fin = d.fechaFinSolicitud;
  for (const f of [inicio, fin])
    if (f !== null && !/^\d{4}-\d{2}-\d{2}$/.test(f))
      throw new SourceError(
        `La BDNS ha devuelto un plazo con una fecha que no se entiende («${f}»).`,
      );
  // Una instrumental (nominativa, directa o de un convenio) no está abierta a cualquiera, pero sus
  // fechas pueden ser el plazo en que la entidad nombrada tiene que pedirla (RD 1016/2026, art. 4.3):
  // se calcula el estado igual y se marca, en vez de decir que no admite solicitudes.
  const instrumental = fold(d.tipoConvocatoria ?? '').endsWith('instrumental');
  // La BDNS no tiene un campo de anulación: el órgano pone «ANULADA» delante del título, y las
  // fechas se quedan como estaban.
  const estado = /^\s*anulad[ao]\b/i.test(d.descripcion)
    ? 'anulada'
    : fin && fin < dia
      ? 'cerrada'
      : inicio && inicio > dia
        ? 'aun_no_abierta'
        : inicio && fin
          ? 'abierta'
          : // Sin fin ni texto que lo ponga: la BDNS la marca de solicitud indefinida. No se da
            // por «abierta»: hay de hace años que nadie ha cerrado en la BDNS.
            d.abierto && !fin && !limpio(d.textFin)
            ? 'indefinida'
            : 'desconocido';
  return {
    estado,
    solo_beneficiarios_nombrados: instrumental || undefined,
    inicio,
    fin,
    texto_inicio: limpio(d.textInicio),
    texto_fin: limpio(d.textFin),
  };
}

async function detalle(fetchImpl: Fetch, numero: string) {
  const d = await json<Detalle>(
    fetchImpl,
    'convocatorias',
    new URLSearchParams({ numConv: numero }),
  );
  if (!d)
    throw new SourceError(
      `No hay ninguna convocatoria con el número BDNS ${numero}. Búscala con buscar_convocatorias.`,
    );
  if (d.codigoBDNS !== numero)
    throw new SourceError(
      `La BDNS ha devuelto otra convocatoria (${d.codigoBDNS}) al pedir la ${numero}.`,
    );
  return d;
}

type FiltrosConvocatorias = {
  texto?: string;
  desde?: string;
  hasta?: string;
  administracion?: Administracion;
  organo?: string;
  region?: string;
  beneficiario?: Beneficiario;
  finalidad?: string;
  abiertas?: boolean;
  pagina?: number;
};

export async function buscarConvocatorias(fetchImpl: Fetch, f: FiltrosConvocatorias) {
  if (f.desde && f.hasta && f.desde > f.hasta)
    throw new SourceError('`desde` es posterior a `hasta`.');
  const numero = f.pagina ?? 1;
  const params = new URLSearchParams({
    page: String(numero - 1),
    pageSize: String(f.abiertas ? POR_PAGINA_ABIERTAS : POR_PAGINA),
    order: 'fechaRecepcion',
    direccion: 'desc',
  });
  const filtros: Record<string, unknown> = {};
  if (f.texto) {
    params.set('descripcion', f.texto);
    // 1: todas las palabras, en cualquier orden; la API ya ignora tildes y mayúsculas.
    params.set('descripcionTipoBusqueda', '1');
    filtros.texto = f.texto;
  }
  if (f.desde) params.set('fechaDesde', dmy(f.desde));
  if (f.hasta) params.set('fechaHasta', dmy(f.hasta));
  if (f.desde || f.hasta) filtros.registrada = { desde: f.desde, hasta: f.hasta };
  if (f.administracion) {
    params.set('tipoAdministracion', ADMINISTRACIONES[f.administracion]);
    filtros.administracion = f.administracion;
  }
  if (f.organo) {
    const found = await resolverOrganos(fetchImpl, f.organo, f.administracion);
    params.set('organos', found.map((o) => o.id).join(','));
    filtros.organos = { total: found.length, ejemplos: found.slice(0, 10).map((o) => o.ruta) };
  }
  if (f.region) {
    const { ids, nombres } = await resolverRegiones(fetchImpl, f.region);
    params.set('regiones', ids.join(','));
    filtros.regiones = nombres;
  }
  if (f.beneficiario) {
    params.set('tiposBeneficiario', String(BENEFICIARIOS[f.beneficiario]));
    filtros.beneficiario = f.beneficiario;
  }
  if (f.finalidad) {
    const fin = await resolverFinalidad(fetchImpl, f.finalidad);
    params.set('finalidad', String(fin.id));
    filtros.finalidad = fin.descripcion;
  }
  let body = pagina(
    await json<Pagina<Convocatoria>>(fetchImpl, 'convocatorias/busqueda', params),
    numero,
  );
  // La BDNS guarda la ñ y la ç de más de una forma: «Pollença» no encuentra una convocatoria cuyo
  // título sí la tiene, y «Pollen» sí. Sin resultados, se repite con la palabra cortada antes.
  const cortado = f.texto?.replace(/(\p{L}{3,}?)[ñçÑÇ]\p{L}*/gu, '$1');
  if (!body.totalElements && f.texto && cortado !== f.texto) {
    params.set('descripcion', cortado!);
    body = pagina(
      await json<Pagina<Convocatoria>>(fetchImpl, 'convocatorias/busqueda', params),
      numero,
    );
    filtros.texto = `${cortado} (sin resultados con «${f.texto}»: la BDNS escribe la ñ y la ç de más de una forma)`;
  }
  const dia = hoy();
  const convocatorias = [];
  // Una a una: en paralelo, la API responde 429 en cuanto van unas pocas a la vez.
  for (const c of body.content) {
    const d = await detalle(fetchImpl, c.numeroConvocatoria);
    convocatorias.push({
      numero: c.numeroConvocatoria,
      titulo: c.descripcion,
      organo: organo(c),
      registrada: c.fechaRecepcion,
      tipo: d.tipoConvocatoria,
      presupuesto: presupuesto(d.presupuestoTotal),
      plazo: plazo(d, dia),
      enlace: `${WEB}/${c.numeroConvocatoria}`,
    });
  }
  const abiertas = convocatorias.filter((c) => ['abierta', 'indefinida'].includes(c.plazo.estado));
  const porEstado: Record<string, number> = {};
  for (const c of convocatorias) porEstado[c.plazo.estado] = (porEstado[c.plazo.estado] ?? 0) + 1;
  return {
    total: body.totalElements,
    pagina: numero,
    paginas: body.totalPages,
    hoy: dia,
    filtros,
    ...(f.abiertas
      ? {
          abiertas: {
            revisadas: convocatorias.length,
            por_estado: porEstado,
            nota: `Solo se ha revisado esta página (${convocatorias.length} de ${body.totalElements}): la BDNS no filtra por plazo. Pide la página ${numero + 1} para revisar más. Se han quitado las que no están abiertas, también las de plazo «desconocido».`,
          },
        }
      : {}),
    convocatorias: f.abiertas ? abiertas : convocatorias,
  };
}

export async function verConvocatoria(fetchImpl: Fetch, numero: string) {
  const d = await detalle(fetchImpl, numero);
  const descripciones = (xs: { descripcion: string }[]) => xs.map((x) => x.descripcion.trim());
  return {
    numero: d.codigoBDNS,
    titulo: d.descripcion,
    titulo_cooficial: limpio(d.descripcionLeng),
    organo: organo(d.organo),
    registrada: d.fechaRecepcion,
    tipo: d.tipoConvocatoria,
    instrumentos: descripciones(d.instrumentos),
    presupuesto: presupuesto(d.presupuestoTotal),
    finalidad: d.descripcionFinalidad,
    beneficiarios: descripciones(d.tiposBeneficiarios),
    sectores: d.sectores.map((s) => `${s.codigo} ${s.descripcion}`),
    regiones: descripciones(d.regiones),
    objetivos: descripciones(d.objetivos),
    plazo: plazo(d),
    sede_electronica: limpio(d.sedeElectronica),
    bases_reguladoras: { titulo: d.descripcionBasesReguladoras, url: d.urlBasesReguladoras },
    extracto_en_diario_oficial: d.sePublicaDiarioOficial,
    anuncios: d.anuncios.map((a) => ({
      diario: a.desDiarioOficial,
      publicado: a.datPublicacion,
      titulo: a.titulo,
      url: a.url,
    })),
    documentos: d.documentos.map((doc) => ({
      nombre: doc.nombreFic,
      descripcion: doc.descripcion,
      publicado: doc.datPublicacion,
      url: `${API}/convocatorias/documentos?idDocumento=${doc.id}`,
    })),
    ayuda_de_estado: d.ayudaEstado ? { numero: d.ayudaEstado, url: d.urlAyudaEstado } : undefined,
    reglamento_ue: d.reglamento?.descripcion,
    fondos_ue: descripciones(d.fondos),
    mrr: d.mrr,
    enlace: `${WEB}/${d.codigoBDNS}`,
  };
}

type Concesion = {
  numeroConvocatoria: string;
  convocatoria: string;
  nivel1: string;
  nivel2: string;
  nivel3: string | null;
  fechaConcesion: string;
  beneficiario: string | null;
  instrumento: string | null;
  importe: number | null;
  ayudaEquivalente: number | null;
};

// El CIF de una persona jurídica: letra de forma jurídica, 7 cifras y el control. Las personas
// físicas llegan con el DNI o NIE enmascarado («***1234**») y su nombre: eso no se devuelve. La
// BDNS guarda algunos CIF con ceros delante («000A12345678»).
const CIF = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/;

function beneficiario(texto: string | null) {
  const [id = '', ...nombre] = (texto ?? '').trim().split(/\s+/);
  const nif = id.replace(/^0+(?=[A-Z])/, '');
  // Sin un CIF limpio no se sabe si es una persona física (un DNI sin enmascarar también
  // llega así, con ceros delante): el nombre se omite siempre.
  return CIF.test(nif)
    ? { nif, beneficiario: nombre.join(' ') }
    : { nombre_omitido: true, beneficiario: null };
}

export async function buscarConcesiones(
  fetchImpl: Fetch,
  f: { convocatoria?: string; nif?: string; desde?: string; hasta?: string; pagina?: number },
) {
  if (!f.convocatoria && !f.nif)
    throw new SourceError(
      'Indica `convocatoria` (el número BDNS) o `nif` (el CIF de una entidad). Para buscar convocatorias, usa buscar_convocatorias.',
    );
  if (f.nif && !CIF.test(f.nif))
    throw new SourceError(
      'Solo se buscan entidades por su CIF (como B12345678). Las concesiones a personas físicas son datos personales y no se buscan por DNI ni NIE.',
    );
  if (f.desde && f.hasta && f.desde > f.hasta)
    throw new SourceError('`desde` es posterior a `hasta`.');
  const numero = f.pagina ?? 1;
  const params = new URLSearchParams({
    page: String(numero - 1),
    pageSize: String(POR_PAGINA_CONCESIONES),
    order: 'fechaConcesion',
    direccion: 'desc',
  });
  if (f.convocatoria) params.set('numeroConvocatoria', f.convocatoria);
  if (f.nif) params.set('nifCif', f.nif);
  if (f.desde) params.set('fechaDesde', dmy(f.desde));
  if (f.hasta) params.set('fechaHasta', dmy(f.hasta));
  let body = pagina(
    await json<Pagina<Concesion>>(fetchImpl, 'concesiones/busqueda', params),
    numero,
  );
  // La API busca el NIF exacto, y algunos CIF están guardados con ceros delante: se miran las dos
  // formas, y si las dos tienen concesiones no se da una sola como si fuera el total.
  if (f.nif) {
    params.set('nifCif', `000${f.nif}`);
    const relleno = pagina(
      await json<Pagina<Concesion>>(fetchImpl, 'concesiones/busqueda', params),
      numero,
    );
    if (body.totalElements && relleno.totalElements)
      throw new SourceError(
        `La BDNS tiene concesiones de ${f.nif} guardadas de dos formas (${f.nif}: ${body.totalElements}; 000${f.nif}: ${relleno.totalElements}) y no se pueden listar juntas. Búscalas por convocatoria.`,
      );
    if (!body.totalElements) body = relleno;
  }
  return {
    total: body.totalElements,
    pagina: numero,
    paginas: body.totalPages,
    nota: body.totalElements
      ? undefined
      : 'Ninguna concesión. Puede que no haya, o que sean antiguas: la BDNS solo publica las concesiones de los últimos años.',
    concesiones: body.content.map((c) => ({
      fecha: c.fechaConcesion,
      ...beneficiario(c.beneficiario),
      importe: c.importe,
      ayuda_equivalente: c.ayudaEquivalente,
      instrumento: c.instrumento?.trim(),
      convocatoria: { numero: c.numeroConvocatoria, titulo: c.convocatoria },
      organo: organo(c),
    })),
  };
}

const numero = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-Z]{1,20}$/)
  .describe('Número BDNS de la convocatoria, como 943839 (los antiguos llevan letras).');
const fecha = (que: string) => z.iso.date().optional().describe(`${que}, AAAA-MM-DD.`);
const paginaArg = z.number().int().min(1).max(100_000).default(1).describe('Página, desde 1.');

export function createSubvencionesMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-subvenciones', title: 'Subvenciones públicas (BDNS)' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_convocatorias',
        {
          title: 'Buscar convocatorias',
          description: `Convocatorias de subvenciones y ayudas, de la registrada más recientemente a la más antigua, ${POR_PAGINA} por página (${POR_PAGINA_ABIERTAS} con abiertas=true): número BDNS, título, órgano convocante, fecha de registro, presupuesto (null si no lo dan), plazo de solicitud con su estado hoy y enlace a la ficha oficial. Todos los filtros son opcionales y se combinan; la respuesta dice cuáles se han aplicado.`,
          inputSchema: z.object({
            texto: z
              .string()
              .trim()
              .min(2)
              .max(200)
              .optional()
              .describe(
                'Palabras del título, todas, sin importar tildes; también encuentra las que las contienen («energ» encuentra «energética»): «eficiencia energetica».',
              ),
            desde: fecha('Registrada desde'),
            hasta: fecha('Registrada hasta'),
            administracion: z
              .enum(Object.keys(ADMINISTRACIONES) as [Administracion, ...Administracion[]])
              .optional()
              .describe(
                'Quién convoca: el Estado, una comunidad autónoma, una entidad local (ayuntamientos, diputaciones) u otros.',
              ),
            organo: z
              .string()
              .trim()
              .min(2)
              .max(120)
              .optional()
              .describe(
                'Palabras enteras del órgano convocante o de dónde está: «eibar», «diputacion foral bizkaia», «pais vasco», «ministerio industria».',
              ),
            region: z
              .string()
              .trim()
              .min(2)
              .max(80)
              .optional()
              .describe(
                'Zona de impacto, con las que tiene dentro: «euskadi», «gipuzkoa», «cataluña», «comunidad de madrid» o un código NUTS como ES212.',
              ),
            beneficiario: z
              .enum(Object.keys(BENEFICIARIOS) as [Beneficiario, ...Beneficiario[]])
              .optional()
              .describe('Tipo de beneficiario que puede pedirla.'),
            finalidad: z
              .string()
              .trim()
              .min(2)
              .max(80)
              .optional()
              .describe(
                'Política de gasto, como «industria y energia», «vivienda» o «fomento del empleo».',
              ),
            abiertas: z
              .boolean()
              .optional()
              .describe(
                'Deja solo las abiertas hoy por sus fechas y las indefinidas, entre las de esta página.',
              ),
            pagina: paginaArg,
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        (args) => run(SOURCE, () => buscarConvocatorias(fetchImpl, args)),
      );
      s.registerTool(
        'ver_convocatoria',
        {
          title: 'Ver una convocatoria',
          description:
            'El detalle de una convocatoria: órgano, tipo, presupuesto, finalidad, beneficiarios, sectores, regiones, plazo de solicitud y su estado hoy, sede electrónica, bases reguladoras, extractos en el diario oficial y documentos (con su enlace de descarga).',
          inputSchema: z.object({ numero }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ numero }) => run(SOURCE, () => verConvocatoria(fetchImpl, numero)),
      );
      s.registerTool(
        'buscar_concesiones',
        {
          title: 'Buscar concesiones',
          description: `Subvenciones ya concedidas, de la más reciente a la más antigua, ${POR_PAGINA_CONCESIONES} por página: fecha, beneficiario, importe y convocatoria. Por convocatoria, por entidad (CIF) o por las dos. Un beneficiario sin CIF de persona jurídica (personas físicas, y algunas entidades extranjeras) sale sin nombre (nombre_omitido: true).`,
          inputSchema: z.object({
            convocatoria: numero.optional(),
            nif: z
              .string()
              .trim()
              .toUpperCase()
              .max(12)
              .optional()
              .describe('CIF de la entidad beneficiaria, como B12345678.'),
            desde: fecha('Concedida desde'),
            hasta: fecha('Concedida hasta'),
            pagina: paginaArg,
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        (args) => run(SOURCE, () => buscarConcesiones(fetchImpl, args)),
      );
    },
  );
}
