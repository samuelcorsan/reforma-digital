// Servidor MCP del Catastro: los servicios web de consulta de datos no protegidos de la Sede
// Electrónica del Catastro (ovc.catastro.meh.es), sin clave. Araba/Álava, Bizkaia, Gipuzkoa y
// Navarra tienen catastro propio (foral) y no están en ellos: el servicio responde como si el
// inmueble no existiera, así que se detectan aquí y se dice adónde ir.
import { z } from 'zod';
import forales from '../data/forales.json';
import {
  fold,
  get,
  matches,
  READ_ONLY_EXTERNAL,
  run,
  server,
  SourceError,
  type Fetch,
} from './comun';

const OVC = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero';
const SOURCE =
  'Fuente: Dirección General del Catastro, Sede Electrónica del Catastro (sedecatastro.gob.es), datos no protegidos.';

const CATASTROS_FORALES = {
  '01': 'Araba/Álava tiene catastro propio: el Catastro de Álava, de la Diputación Foral de Álava (https://web.araba.eus/es/hacienda/catastro).',
  '20': 'Gipuzkoa tiene catastro propio: el Catastro de Gipuzkoa, de la Diputación Foral de Gipuzkoa (https://www.gipuzkoa.eus/es/web/ogasuna/catastro).',
  '31': 'Navarra tiene catastro propio: el Registro de la Riqueza Territorial de Navarra (https://catastro.navarra.es).',
  '48': 'Bizkaia tiene catastro propio: el Catastro de Bizkaia, de la Diputación Foral de Bizkaia (https://www.bizkaia.eus/catastro).',
};
type Foral = keyof typeof CATASTROS_FORALES;
const SIN_FORALES =
  'Araba/Álava, Bizkaia, Gipuzkoa y Navarra no están en el Catastro del Estado: tienen catastro foral propio (Álava: https://web.araba.eus/es/hacienda/catastro; Bizkaia: https://www.bizkaia.eus/catastro; Gipuzkoa: https://www.gipuzkoa.eus/es/web/ogasuna/catastro; Navarra: https://catastro.navarra.es).';
/** El número de portal con su letra, si la tiene («28B»). */
const numero = (d: Dir | undefined) => `${d?.pnp ?? ''}${d?.plp ?? ''}`.trim();
const foral = (codigo: Foral) =>
  new SourceError(`${CATASTROS_FORALES[codigo]} El Catastro del Estado no tiene sus inmuebles.`);

const INSTRUCTIONS = `Datos no protegidos del Catastro del Estado (Dirección General del Catastro): de cada inmueble, su uso (residencial, comercial, industrial…), superficie construida, año de construcción, coeficiente de participación y construcciones (uso, escalera, planta, puerta y superficie); de cada parcela, sus inmuebles, la superficie del suelo y, si es rústica, sus cultivos.
- ver_inmueble: por referencia catastral, de 14 caracteres (la parcela) o 20 (un inmueble de la parcela). Una parcela con varios inmuebles, como un bloque de pisos, da la lista con la referencia de 20 caracteres de cada uno, por páginas.
- buscar_direccion: los inmuebles de una dirección (provincia, municipio, calle y número; escalera, planta y puerta si se saben). Los nombres se buscan sin tildes en el callejero del Catastro; si no encajan con uno solo, el error da los candidatos.
- buscar_coordenadas: la parcela de un punto (latitud y longitud) y las que tiene a menos de 25 m.
No hay titulares, valor catastral ni otros datos protegidos: estos servicios no los dan. ${SIN_FORALES}
Las superficies van en m² y el coeficiente de participación en %. Planta -1 es un sótano y 00 la baja.
${SOURCE}`;

// Lo que devuelve cada consulta: el recuento en `control` y lo pedido, o una lista de errores con
// su código y motivo (que unas operaciones dan como lista y otras dentro de `err`).
type Fallo = { cod: string; des: string };
type Resultado = {
  control: Record<string, number>;
  lerr?: Fallo[] | { err: Fallo[] };
  bico?: Bico;
  lrcdnp?: { rcdnp: Unidad[] };
  numerero?: { nump: { num: Dir }[] };
  provinciero?: { prov: Provincia[] };
  municipiero?: { muni: Municipio[] };
  callejero?: { calle: Calle[] };
  coordenadas?: { coord: { ldt?: string }[] };
  coordenadas_distancias?: { coordd: { lpcd?: Cercana[] }[] };
};

async function ovc(fetchImpl: Fetch, path: string, params: Record<string, string>) {
  const url = `${OVC}/${path}?${new URLSearchParams(params)}`;
  const body = await (await get(fetchImpl, url)).json().catch(() => {
    throw new SourceError('El Catastro devolvió una respuesta que no es JSON. Prueba más tarde.');
  });
  const [r] = Object.values(body as Record<string, Resultado | undefined>);
  if (!r?.control) throw new SourceError('El Catastro devolvió una respuesta incompleta.');
  const lerr = r.lerr === undefined ? [] : Array.isArray(r.lerr) ? r.lerr : r.lerr.err;
  return { r, fallo: lerr[0] };
}

const motivo = (f: Fallo) => `El Catastro responde: «${f.des.trim()}» (código ${f.cod}).`;

// Las letras de control de una referencia de 20 caracteres, con el algoritmo de la Dirección
// General del Catastro: pesos por posición sobre la parcela (en dos mitades) y el cargo. Las letras
// desde la O valen uno más porque el alfabeto cuenta la Ñ.
const PESOS = [13, 15, 12, 5, 4, 17, 9, 21, 3, 7, 1];
const valor = (c: string) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 64 + (c > 'N' ? 1 : 0));
const letra = (s: string) =>
  'MQWERTYUIOPASDFGHJKLBZX'[[...s].reduce((sum, c, i) => sum + PESOS[i]! * valor(c), 0) % 23];
export const letrasControl = (rc: string) =>
  `${letra(rc.slice(0, 7) + rc.slice(14, 18))}${letra(rc.slice(7, 14) + rc.slice(14, 18))}`;

function referencia(texto: string) {
  const rc = texto.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[0-9A-Z]{14}(\d{4}[A-Z]{2})?$/.test(rc))
    throw new SourceError(
      'Una referencia catastral tiene 14 caracteres (la parcela) o 20 (un inmueble: los 14 de la parcela, 4 cifras y 2 letras de control), solo letras y cifras.',
    );
  // Una rústica empieza por los códigos de provincia y municipio (como 18161A03700081).
  const provincia = /^(\d\d)\d{3}[A-Z]\d{8}/.exec(rc)?.[1];
  if (provincia && provincia in CATASTROS_FORALES) throw foral(provincia as Foral);
  if (rc.length === 20 && letrasControl(rc) !== rc.slice(18))
    throw new SourceError(
      `Las letras de control de ${rc} no cuadran con el resto: algún carácter está mal copiado.`,
    );
  return rc;
}

type Rc = { pc1: string; pc2: string; car?: string; cc1?: string; cc2?: string };
type Loint = { bq?: string; es?: string; pt?: string; pu?: string };
type Dir = { tv?: string; nv?: string; pnp?: string; plp?: string };
type Dt = {
  np: string;
  nm: string;
  locs?: { lous?: { lourb: { dir?: Dir; loint?: Loint } } };
};
type Debi = { luso: string; sfc?: string; cpt?: string; ant?: string };
type Unidad = { rc: Rc; dt: Dt; debi: Debi };
type Bico = {
  bi: { idbi: { cn: string; rc: Rc }; dt: Dt; ldt: string; debi: Debi };
  finca: { ldt?: string; ltp?: string; dff?: { ss?: string }; infgraf?: { igraf: string } };
  lcons?: {
    lcd: string;
    dt?: { lourb?: { loint?: Loint } };
    dfcons: { stl: string };
    dvcons?: { dtip?: string };
  }[];
  lspr?: { cspr: string; dspr: { dcc?: string; ip?: string; ssp?: string } }[];
};

// Las superficies y los años son enteros, y en las listas llevan punto de millar («3.230»); el
// coeficiente de participación lleva coma decimal («5,499900»).
const entero = (s: string | undefined) => (s ? Number(s.replaceAll('.', '')) : undefined);
const decimal = (s: string | undefined) => (s ? Number(s.replace(',', '.')) : undefined);
const rc20 = (rc: Rc) => rc.pc1 + rc.pc2 + (rc.car ?? '') + (rc.cc1 ?? '') + (rc.cc2 ?? '');
const situacion = (l: Loint | undefined) => ({
  bloque: l?.bq,
  escalera: l?.es,
  planta: l?.pt,
  puerta: l?.pu,
});
const CLASES: Record<string, string> = {
  UR: 'urbano',
  RU: 'rústico',
  BI: 'de características especiales',
};

function detalle({ bi, finca, lcons = [], lspr = [] }: Bico) {
  return {
    referencia: rc20(bi.idbi.rc),
    clase: CLASES[bi.idbi.cn] ?? bi.idbi.cn,
    direccion: bi.ldt,
    uso: bi.debi.luso,
    superficie_construida_m2: entero(bi.debi.sfc),
    coeficiente_participacion: decimal(bi.debi.cpt),
    año_construccion: entero(bi.debi.ant),
    ...situacion(bi.dt.locs?.lous?.lourb.loint),
    parcela: {
      referencia: bi.idbi.rc.pc1 + bi.idbi.rc.pc2,
      tipo: finca.ltp,
      superficie_suelo_m2: entero(finca.dff?.ss),
      mapa: finca.infgraf?.igraf,
    },
    construcciones: lcons.map((c) => ({
      uso: c.lcd,
      ...situacion(c.dt?.lourb?.loint),
      superficie_m2: entero(c.dfcons.stl),
      tipo: c.dvcons?.dtip,
    })),
    cultivos: lspr.length
      ? lspr.map((s) => ({
          subparcela: s.cspr,
          cultivo: s.dspr.dcc,
          intensidad: s.dspr.ip,
          superficie_m2: entero(s.dspr.ssp),
        }))
      : undefined,
  };
}

type Pagina = { pagina: number; limite: number };

/** Un inmueble con su detalle, o la lista de una parcela o dirección con varios, por páginas. */
function inmuebles({ bico, lrcdnp, control }: Resultado, { pagina, limite }: Pagina) {
  if (bico) {
    // Un solo inmueble es una sola página: otra no daría lo mismo como si fuera la pedida.
    if (pagina > 1) throw new SourceError('Es un solo inmueble: no hay más páginas.');
    // El recuento de construcciones y de cultivos va aparte: si no cuadra, la lista llegó cortada.
    if (
      (control.cucons ?? 0) !== (bico.lcons?.length ?? 0) ||
      (control.cucul ?? 0) !== (bico.lspr?.length ?? 0)
    )
      throw new SourceError(
        'El Catastro devolvió las construcciones o los cultivos del inmueble incompletos. Prueba más tarde.',
      );
    return detalle(bico);
  }
  const todos = lrcdnp?.rcdnp;
  // El recuento del Catastro va aparte: si no coincide, la lista ha llegado cortada.
  if (!todos || todos.length !== control.cudnp)
    throw new SourceError(
      'El Catastro devolvió una lista de inmuebles incompleta. Prueba más tarde.',
    );
  const paginas = Math.ceil(todos.length / limite);
  if (pagina > paginas)
    throw new SourceError(
      `Son ${todos.length} inmuebles: con ${limite} por página, la última es la ${paginas}.`,
    );
  return {
    total: todos.length,
    pagina,
    paginas,
    inmuebles: todos.slice((pagina - 1) * limite, pagina * limite).map((u) => {
      const lourb = u.dt.locs?.lous?.lourb;
      const dir = lourb?.dir;
      return {
        referencia: rc20(u.rc),
        uso: u.debi.luso,
        superficie_construida_m2: entero(u.debi.sfc),
        coeficiente_participacion: decimal(u.debi.cpt),
        año_construccion: entero(u.debi.ant),
        direccion: dir && [dir.tv, dir.nv, numero(dir)].join(' ').trim(),
        ...situacion(lourb?.loint),
      };
    }),
    nota: 'Las construcciones de cada inmueble, con ver_inmueble y su referencia de 20 caracteres.',
  };
}

// El Catastro tarda unos 45 ms por inmueble en listar una parcela o un portal: con más de unos 400
// se pasa del tiempo límite. Los de una sola planta llegan enseguida.
function siTarda(error: unknown, donde = ''): never {
  if (error instanceof SourceError && error.status === undefined)
    throw new SourceError(
      `${error.message} Si es un edificio con cientos de inmuebles, el Catastro tarda demasiado en listarlos todos: pídelos planta a planta con buscar_direccion${donde}.`,
    );
  throw error;
}

export async function verInmueble(fetchImpl: Fetch, texto: string, pagina: Pagina) {
  const rc = referencia(texto);
  const { r, fallo } = await ovc(fetchImpl, 'COVCCallejero.svc/json/Consulta_DNPRC', {
    RefCat: rc,
  }).catch(async (error: unknown) => {
    // Solo una parcela entera puede tardar tanto; su dirección ayuda a pedirla por plantas.
    if (rc.length !== 14 || !(error instanceof SourceError) || error.status !== undefined)
      throw error;
    const sitio = await ovc(fetchImpl, 'COVCCoordenadas.svc/json/Consulta_CPMRC', {
      SRS: 'EPSG:4326',
      RefCat: rc,
    }).then(
      ({ r }) => r.coordenadas?.coord[0]?.ldt,
      () => undefined,
    );
    return siTarda(error, sitio && ` (la parcela está en ${sitio})`);
  });
  if (fallo?.cod === '5')
    throw new SourceError(
      `No hay ningún inmueble con la referencia ${rc} en el Catastro del Estado. ${SIN_FORALES}`,
    );
  if (fallo) throw new SourceError(motivo(fallo));
  return inmuebles(r, pagina);
}

// Palabras que no distinguen un nombre: artículos y preposiciones, que el Catastro a veces pone
// detrás («PALMA LA») o quita.
const VACIAS = new Set('de del la las el els los les l d i y a o en'.split(' '));
const palabras = (texto: string) =>
  fold(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !VACIAS.has(w));
const clave = (texto: string) => palabras(texto).sort().join(' ');

function distancia(a: string, b: string) {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++)
      fila[j] = Math.min(
        previa[j]! + 1,
        fila[j - 1]! + 1,
        previa[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previa = fila;
  }
  return previa[b.length]!;
}

/** Los que tienen el mismo nombre que `texto`, sin tildes ni artículos. */
const encaje = <T>(texto: string, candidatos: T[], nombres: (c: T) => string[]) =>
  candidatos.filter((c) => nombres(c).some((n) => clave(n) === clave(texto)));

/**
 * El candidato que es `texto`, sin tildes ni artículos. Si hay varios o ninguno, un error con los que
 * podrían ser: uno que solo contiene sus palabras («CIUDAD REAL» para «Real») no se toma por él.
 */
function elegir<T>(
  texto: string,
  que: string,
  candidatos: T[],
  nombres: (c: T) => string[],
  ver: (c: T) => string,
  pista = '',
) {
  const buscado = clave(texto);
  const encajan = encaje(texto, candidatos, nombres);
  if (encajan.length === 1) return encajan[0]!;
  if (encajan.length)
    throw new SourceError(
      `«${texto}» encaja con ${encajan.length} ${que}: ${encajan.slice(0, 30).map(ver).join('; ')}. Repite con uno de esos nombres, con el tipo de vía delante si dos se llaman igual.`,
    );
  // Ninguno: los que contienen sus palabras, los de nombre parecido (por una errata) o con alguna de
  // sus palabras largas (por una palabra de más, como «Calle Mayor de Triana» para CL TRIANA).
  const w = palabras(texto);
  const largas = w.filter((p) => p.length > 3);
  const parecidos = candidatos
    .map((c) => ({ c, d: Math.min(...nombres(c).map((n) => distancia(clave(n), buscado))) }))
    .filter(
      ({ c, d }) =>
        d <= Math.max(2, buscado.length / 4) ||
        nombres(c).some(
          (n) => matches(palabras(n).join(' '), w) || palabras(n).some((p) => largas.includes(p)),
        ),
    )
    .sort((a, b) => a.d - b.d)
    .slice(0, 10);
  throw new SourceError(
    `Ningún nombre de ${que} es «${texto}».${parecidos.length ? ` ¿Es alguno de estos? ${parecidos.map(({ c }) => ver(c)).join('; ')}.` : ''} El Catastro puede tenerlo en otra lengua o con otro nombre.${pista}`,
  );
}

// El nombre de cada provincia foral, en castellano y en euskera, para no confundirla con una que
// falta en la lista.
const PROVINCIAS_FORALES: Record<string, Foral> = {
  alava: '01',
  araba: '01',
  gipuzkoa: '20',
  guipuzcoa: '20',
  navarra: '31',
  nafarroa: '31',
  bizkaia: '48',
  vizcaya: '48',
};
// El Catastro nombra algunas provincias en la lengua cooficial o abreviadas.
const OTROS_NOMBRES: Record<string, string> = {
  alicante: 'ALACANT',
  castellon: 'CASTELLO',
  'castellon plana': 'CASTELLO',
  baleares: 'ILLES BALEARS',
  'islas baleares': 'ILLES BALEARS',
  'santa cruz tenerife': 'S.C. TENERIFE',
  tenerife: 'S.C. TENERIFE',
  coruna: 'A CORUÑA',
  gerona: 'GIRONA',
  lerida: 'LLEIDA',
  orense: 'OURENSE',
};

type Provincia = { cpine: string; np: string };
let provincias: Promise<Provincia[]> | undefined;

async function provincia(fetchImpl: Fetch, texto: string) {
  const cod = texto.trim().padStart(2, '0');
  const codigo =
    palabras(texto)
      .map((w) => PROVINCIAS_FORALES[w])
      .find(Boolean) ?? (cod in CATASTROS_FORALES ? (cod as Foral) : undefined);
  if (codigo) throw foral(codigo);
  // Las 48 provincias del Catastro apenas cambian: se piden una vez por proceso.
  provincias ??= ovc(fetchImpl, 'COVCCallejero.svc/json/ObtenerProvincias', {})
    .then(({ r }) => {
      if (!r.provinciero) throw new SourceError('El Catastro no devolvió la lista de provincias.');
      return r.provinciero.prov;
    })
    .catch((error: unknown) => {
      provincias = undefined;
      throw error;
    });
  const todas = await provincias;
  const porCodigo = todas.find((p) => p.cpine === cod);
  if (porCodigo) return porCodigo.np;
  const otro = OTROS_NOMBRES[palabras(texto).join(' ')];
  return elegir(
    otro ?? texto,
    'provincias',
    todas,
    (p) => [p.np],
    (p) => p.np,
    ` ${SIN_FORALES}`,
  ).np;
}

type Municipio = { nm: string };

async function municipio(fetchImpl: Fetch, prov: string, texto: string) {
  const { r, fallo } = await ovc(fetchImpl, 'COVCCallejero.svc/json/ObtenerMunicipios', {
    Provincia: prov,
  });
  if (fallo) throw new SourceError(motivo(fallo));
  if (!r.municipiero)
    throw new SourceError('El Catastro no devolvió los municipios de la provincia.');
  // Nombres como «ALICANTE/ALACANT» o «ESQUIROL, L'»: se busca por cada uno, y con el artículo
  // delante.
  const nombres = (m: Municipio) => [
    m.nm,
    ...m.nm.split('/'),
    m.nm.replace(/^(.+), (\S+)$/, '$2 $1'),
  ];
  return elegir(texto, `municipios de ${prov}`, r.municipiero.muni, nombres, (m) => m.nm).nm;
}

// El tipo de vía escrito delante del nombre («Calle Fuencarral»), con la sigla que usa el Catastro.
const TIPOS: Record<string, string> = Object.fromEntries(
  Object.entries({
    CL: 'calle c cl carrer kalea rua',
    AV: 'avenida av avda avinguda etorbidea',
    PZ: 'plaza pl pz placa praza',
    PS: 'paseo ps passeig pg',
    CR: 'carretera ctra',
    CM: 'camino cami',
    RD: 'ronda',
    TR: 'travesia travessera',
    GL: 'glorieta',
    PJ: 'pasaje passatge',
    RB: 'rambla',
    CT: 'cuesta',
    UR: 'urbanizacion',
  }).flatMap(([sigla, nombres]) => nombres.split(' ').map((n) => [n, sigla])),
);

type Calle = { dir: { tv: string; nv: string } };
const ver = (c: Calle) => `${c.dir.tv} ${c.dir.nv}`;

async function calles(fetchImpl: Fetch, prov: string, muni: string, nombre: string) {
  const { r, fallo } = await ovc(fetchImpl, 'COVCCallejero.svc/json/ObtenerCallejero', {
    Provincia: prov,
    Municipio: muni,
    TipoVia: '',
    NomVia: nombre.toUpperCase(),
  });
  // 10: ninguna vía contiene ese texto.
  if (fallo?.cod === '10') return [];
  if (fallo) throw new SourceError(motivo(fallo));
  if (!r.callejero) throw new SourceError('El Catastro no devolvió el callejero.');
  return r.callejero.calle;
}

async function via(fetchImpl: Fetch, prov: string, muni: string, texto: string) {
  const [primera = '', ...resto] = palabras(texto);
  // Una palabra de dos letras delante es una sigla del Catastro (CL, EM…) aunque no esté en TIPOS.
  const tipo = resto.length
    ? (TIPOS[primera] ?? (primera.length === 2 ? primera.toUpperCase() : undefined))
    : undefined;
  const nombre = tipo ? resto.join(' ') : palabras(texto).join(' ');
  if (!nombre) throw new SourceError('Falta el nombre de la vía, no solo su tipo.');
  // El callejero busca el texto dentro del nombre, sin tildes pero con la Ñ y la Ç: con la palabra
  // más larga y, si no sale nada, con su trozo más largo sin N ni C (por si era una Ñ o una Ç) y con
  // sus tres primeras letras (por si hay una errata, para proponer las parecidas).
  const larga = nombre.split(' ').sort((a, b) => b.length - a.length)[0]!;
  let candidatas = await calles(fetchImpl, prov, muni, larga);
  if (!candidatas.length) {
    const trozo = larga.split(/[nc]/).sort((a, b) => b.length - a.length)[0]!;
    const otras = await Promise.all(
      [...new Set([trozo, larga.slice(0, 3)])]
        .filter((q) => q.length >= 3 && q !== larga)
        .map((q) => calles(fetchImpl, prov, muni, q)),
    );
    candidatas = [...new Map(otras.flat().map((c) => [ver(c), c])).values()];
  }
  const nv = (c: Calle) => [c.dir.nv];
  // El tipo escrito elige entre vías del mismo nombre; si no hay ninguna de ese tipo, se dice.
  const delTipo = candidatas.filter((c) => c.dir.tv === tipo);
  const elegida = elegir(
    nombre,
    `vías en ${muni}`,
    encaje(nombre, delTipo, nv).length ? delTipo : candidatas,
    nv,
    ver,
  );
  if (tipo && elegida.dir.tv !== tipo)
    throw new SourceError(
      `En ${muni} no hay «${texto}», pero sí ${ver(elegida)}. Repite con ese nombre si es la que buscas.`,
    );
  return elegida.dir;
}

type Direccion = {
  provincia: string;
  municipio: string;
  via: string;
  numero: number;
  bloque?: string;
  escalera?: string;
  planta?: string;
  puerta?: string;
};

export async function buscarDireccion(fetchImpl: Fetch, d: Direccion, pagina: Pagina) {
  const prov = await provincia(fetchImpl, d.provincia);
  const muni = await municipio(fetchImpl, prov, d.municipio);
  const { tv, nv } = await via(fetchImpl, prov, muni, d.via);
  const { r, fallo } = await ovc(fetchImpl, 'COVCCallejero.svc/json/Consulta_DNPLOC', {
    Provincia: prov,
    Municipio: muni,
    Sigla: tv,
    Calle: nv,
    Numero: String(d.numero),
    Bloque: d.bloque ?? '',
    Escalera: d.escalera ?? '',
    Planta: d.planta ?? '',
    Puerta: d.puerta ?? '',
  }).catch((error: unknown) => {
    if (d.planta) throw error;
    return siTarda(error);
  });
  const sitio = `${tv} ${nv} ${d.numero}, ${muni} (${prov})`;
  if (fallo?.cod === '43') {
    const cerca = [...new Set(r.numerero?.nump.map(({ num }) => numero(num)))];
    throw new SourceError(
      `El número ${d.numero} no existe en ${tv} ${nv} (${muni}).${cerca.length ? ` Números que sí existen: ${cerca.join(', ')}.` : ''}`,
    );
  }
  const filtros = (['bloque', 'escalera', 'planta', 'puerta'] as const).filter((f) => d[f]);
  if (fallo?.cod === '5' && filtros.length)
    throw new SourceError(
      `En ${sitio} no hay inmuebles con ${filtros.map((f) => `${f} ${d[f]}`).join(', ')}. Repite sin ${filtros.length > 1 ? 'esos filtros' : 'ese filtro'} para ver los que hay.`,
    );
  if (fallo) throw new SourceError(motivo(fallo));
  // El Catastro aplica los filtros; si algún inmueble no los cumple, no se dan como filtrados.
  const lourbs = (r.bico ? [r.bico.bi.dt] : (r.lrcdnp?.rcdnp ?? []).map((u) => u.dt)).map(
    (dt) => dt.locs?.lous?.lourb,
  );
  const sinCeros = (s: string | undefined) => fold(s ?? '').replace(/^0+(?=.)/, '');
  const campo = { bloque: 'bq', escalera: 'es', planta: 'pt', puerta: 'pu' } as const;
  for (const f of filtros)
    if (lourbs.some((l) => sinCeros(l?.loint?.[campo[f]]) !== sinCeros(d[f])))
      throw new SourceError(
        `El Catastro devolvió en ${sitio} inmuebles que no son de ${f} ${d[f]}: no se dan como filtrados. Repite sin ese filtro.`,
      );
  // El Catastro da con el número sus duplicados (28 y 28B), y no deja pedir uno solo; con un solo
  // inmueble, puede ser solo el de la letra (1D al pedir el 1).
  const numeros = new Set(lourbs.map((l) => numero(l?.dir)));
  numeros.delete(String(d.numero));
  return {
    direccion: sitio,
    aviso: numeros.size
      ? `${r.bico ? 'El inmueble es del número' : 'La lista incluye también los números'} ${[...numeros].join(', ')}, no del ${d.numero}: mira la dirección de cada inmueble.`
      : undefined,
    ...inmuebles(r, pagina),
  };
}

/** La provincia foral en la que cae un punto, con sus contornos simplificados (unos 500 m). */
export function provinciaForal(lat: number, lon: number) {
  for (const [codigo, anillos] of Object.entries(forales)) {
    let dentro = false;
    for (const anillo of anillos)
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        const [xi, yi] = anillo[i]!;
        const [xj, yj] = anillo[j]!;
        if (yi! > lat !== yj! > lat && lon < ((xj! - xi!) * (lat - yi!)) / (yj! - yi!) + xi!)
          dentro = !dentro;
      }
    if (dentro) return codigo as Foral;
  }
}

type Cercana = { pc: Rc; ldt?: string; dis: string };

export async function buscarCoordenadas(fetchImpl: Fetch, latitud: number, longitud: number) {
  const { r, fallo } = await ovc(fetchImpl, 'COVCCoordenadas.svc/json/Consulta_RCCOOR_Distancia', {
    CoorX: String(longitud),
    CoorY: String(latitud),
    SRS: 'EPSG:4326',
  });
  if (fallo) throw new SourceError(motivo(fallo));
  const punto = r.coordenadas_distancias?.coordd[0];
  if (!punto) throw new SourceError('El Catastro devolvió una respuesta incompleta.');
  if (!punto.lpcd?.length) {
    // Sin parcelas cerca, puede ser porque el punto cae en un catastro foral.
    const codigo = provinciaForal(latitud, longitud);
    if (codigo)
      throw new SourceError(
        `El punto cae en un territorio foral (o muy cerca de su límite). ${CATASTROS_FORALES[codigo]} El Catastro del Estado no tiene parcelas ahí.`,
      );
    throw new SourceError(
      `No hay ninguna parcela del Catastro en ese punto ni a menos de 25 m: puede ser una plaza o una calle, agua o un punto fuera de España. Comprueba que la latitud y la longitud no estén cambiadas, o busca por dirección. ${SIN_FORALES}`,
    );
  }
  const parcelas = punto.lpcd.map((p) => ({
    referencia: p.pc.pc1 + p.pc.pc2,
    direccion: p.ldt || undefined,
    distancia_m: Number(p.dis),
  }));
  const [primera] = parcelas;
  const dentro = primera?.distancia_m === 0 ? primera : undefined;
  // Junto al límite de un territorio foral, las cercanas pueden ser del otro lado.
  const codigo = dentro ? undefined : provinciaForal(latitud, longitud);
  return {
    parcela: dentro ?? null,
    cercanas: parcelas.filter((p) => p !== dentro),
    nota: dentro
      ? 'Los inmuebles de la parcela, con ver_inmueble y su referencia.'
      : codigo
        ? `El punto no cae en ninguna parcela del Catastro del Estado y está en un territorio foral (o muy cerca de su límite): las cercanas son las del otro lado. ${CATASTROS_FORALES[codigo]}`
        : 'El punto no cae dentro de ninguna parcela (suele ser la calle): estas son las que hay a menos de 25 m.',
  };
}

const paginado = {
  pagina: z.number().int().min(1).default(1).describe('Página de la lista de inmuebles, desde 1.'),
  limite: z.number().int().min(1).max(200).default(50).describe('Inmuebles por página.'),
};
// Un filtro en blanco no filtra nada: mejor rechazarlo que devolver todo como si filtrara.
const filtro = (max: number) => z.string().trim().min(1).max(max);

export function createCatastroMcp(fetchImpl: Fetch = fetch) {
  return server({ name: 'reforma-digital-catastro', title: 'Catastro' }, INSTRUCTIONS, (s) => {
    s.registerTool(
      'ver_inmueble',
      {
        title: 'Ver un inmueble',
        description:
          'Un inmueble o una parcela por su referencia catastral: uso, superficie construida, año de construcción, coeficiente de participación, construcciones (uso, escalera, planta, puerta, superficie) y la parcela (superficie del suelo, cultivos si es rústica, mapa). Una parcela con varios inmuebles da la lista con la referencia de 20 caracteres de cada uno, por páginas. No incluye Araba/Álava, Bizkaia, Gipuzkoa ni Navarra.',
        inputSchema: z.object({
          referencia: z
            .string()
            .max(30)
            .describe(
              'Referencia catastral de 14 caracteres (parcela) o 20 (inmueble), como 9872023VH5797S0001WX.',
            ),
          ...paginado,
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ referencia, pagina, limite }) =>
        run(SOURCE, () => verInmueble(fetchImpl, referencia, { pagina, limite })),
    );
    s.registerTool(
      'buscar_direccion',
      {
        title: 'Buscar por dirección',
        description:
          'Los inmuebles de una dirección, con su referencia catastral, uso, superficie y planta y puerta. Provincia, municipio y vía se buscan sin tildes en el callejero del Catastro; si un nombre no encaja con uno solo, el error da los candidatos. Escalera, planta y puerta acotan a un piso. El número trae también sus duplicados (18A, 18B…), que se distinguen por la dirección de cada inmueble. No incluye Araba/Álava, Bizkaia, Gipuzkoa ni Navarra.',
        inputSchema: z.object({
          provincia: filtro(60).describe(
            'Provincia, como «Madrid», «A Coruña» o «Alicante», o su código INE.',
          ),
          municipio: filtro(80),
          via: filtro(100).describe(
            'La calle, con o sin su tipo: «Calle Fuencarral», «Fuencarral», «Avinguda Diagonal».',
          ),
          numero: z.number().int().min(1).max(99999).describe('Número del portal.'),
          bloque: filtro(10).optional(),
          escalera: filtro(10).optional(),
          planta: filtro(10).optional().describe('Como 1, 01, 00 (baja) o -1 (sótano).'),
          puerta: filtro(10).optional().describe('Como A, DR, IZ o 02.'),
          ...paginado,
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ pagina, limite, ...direccion }) =>
        run(SOURCE, () => buscarDireccion(fetchImpl, direccion, { pagina, limite })),
    );
    s.registerTool(
      'buscar_coordenadas',
      {
        title: 'Buscar por coordenadas',
        description:
          'La parcela catastral de un punto (latitud y longitud en grados, WGS84) con su referencia y dirección, y las que tiene a menos de 25 m. Si el punto cae en la calle, da solo las cercanas.',
        inputSchema: z.object({
          latitud: z.number().min(-90).max(90).describe('Como 40.4262.'),
          longitud: z
            .number()
            .min(-180)
            .max(180)
            .describe('Como -3.7015 (al oeste de Greenwich, negativa).'),
        }),
        annotations: READ_ONLY_EXTERNAL,
      },
      ({ latitud, longitud }) => run(SOURCE, () => buscarCoordenadas(fetchImpl, latitud, longitud)),
    );
  });
}
