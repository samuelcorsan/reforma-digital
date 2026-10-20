import type { Detector, OrigenTexto, TipoDato } from './detector';

/**
 * «Mis datos»: el perfil local de la persona y la capa que impide que sus identificadores lleguen
 * al modelo. El modelo trabaja con marcadores (`{{documento_numero}}`) y la app los sustituye por
 * el valor real solo al escribir en una web oficial.
 */

/** `contexto` se comparte con el modelo (sirve para investigar); `identificador` nunca. */
export type Sensibilidad = 'identificador' | 'contexto';
export type TipoCampo = 'texto' | 'fecha' | 'opcion' | 'email' | 'telefono';

export type CampoPerfil = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  privacidad: Sensibilidad;
  grupo: 'Identidad' | 'Documento' | 'Contacto' | 'Domicilio' | 'Otros';
  opciones?: readonly string[];
};

const campo = (
  clave: string,
  etiqueta: string,
  grupo: CampoPerfil['grupo'],
  privacidad: Sensibilidad,
  tipo: TipoCampo = 'texto',
  opciones?: readonly string[],
): CampoPerfil => ({ clave, etiqueta, grupo, privacidad, tipo, ...(opciones ? { opciones } : {}) });

export const camposPerfil: readonly CampoPerfil[] = [
  campo('nombre', 'Nombre', 'Identidad', 'identificador'),
  campo('apellido1', 'Primer apellido', 'Identidad', 'identificador'),
  campo('apellido2', 'Segundo apellido', 'Identidad', 'identificador'),
  campo('fecha_nacimiento', 'Fecha de nacimiento', 'Identidad', 'identificador', 'fecha'),
  campo('sexo', 'Sexo', 'Identidad', 'contexto', 'opcion', ['Mujer', 'Hombre']),
  campo('nacionalidad', 'Nacionalidad', 'Identidad', 'contexto'),
  campo('estado_civil', 'Estado civil', 'Identidad', 'contexto', 'opcion', [
    'Soltero/a',
    'Casado/a',
    'Pareja de hecho',
    'Separado/a',
    'Divorciado/a',
    'Viudo/a',
  ]),
  campo('documento_tipo', 'Tipo de documento', 'Documento', 'contexto', 'opcion', [
    'DNI',
    'NIE',
    'Pasaporte',
  ]),
  campo('documento_numero', 'Número de DNI, NIE o pasaporte', 'Documento', 'identificador'),
  campo('documento_soporte', 'Número de soporte', 'Documento', 'identificador'),
  campo('documento_caducidad', 'Caducidad del documento', 'Documento', 'identificador', 'fecha'),
  campo('nuss', 'Número de la Seguridad Social', 'Documento', 'identificador'),
  campo('telefono', 'Teléfono', 'Contacto', 'identificador', 'telefono'),
  campo('email', 'Correo electrónico', 'Contacto', 'identificador', 'email'),
  campo('direccion', 'Dirección (calle, número, piso)', 'Domicilio', 'identificador'),
  campo('codigo_postal', 'Código postal', 'Domicilio', 'identificador'),
  campo('municipio', 'Municipio', 'Domicilio', 'contexto'),
  campo('provincia', 'Provincia', 'Domicilio', 'contexto'),
  campo('iban', 'IBAN de tu cuenta', 'Otros', 'identificador'),
];

export type Perfil = Record<string, string>;

export const campoPerfil = (clave: string) => camposPerfil.find((c) => c.clave === clave);
/** Las claves desconocidas (datos que pide un trámite concreto) se tratan como identificadores. */
export const esIdentificador = (clave: string) => campoPerfil(clave)?.privacidad !== 'contexto';

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const letraDni = (numero: string) => LETRAS_DNI[Number(numero) % 23];

/** Mensaje de error en lenguaje claro, o `null` si el valor es válido. */
export function validarCampo(clave: string, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'Escribe un valor.';
  if (v.length > 300) return 'El valor es demasiado largo.';
  if (clave === 'documento_numero') {
    const dni = /^(\d{8})[\s-]?([A-Z])$/i.exec(v);
    const nie = /^([XYZ])[\s-]?(\d{7})[\s-]?([A-Z])$/i.exec(v);
    if (dni)
      return letraDni(dni[1]!) === dni[2]!.toUpperCase() ? null : 'La letra del DNI no cuadra.';
    if (nie) {
      const numero = 'XYZ'.indexOf(nie[1]!.toUpperCase()) + nie[2]!;
      return letraDni(numero) === nie[3]!.toUpperCase() ? null : 'La letra del NIE no cuadra.';
    }
    return /^[A-Z0-9]{6,12}$/i.test(v) ? null : 'Revisa el número del documento.';
  }
  const tipo = campoPerfil(clave)?.tipo;
  if (tipo === 'fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Usa una fecha válida.';
  if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Revisa el correo.';
  if (tipo === 'telefono' && !/^(\+\d{2,3})?[\d\s.-]{9,14}$/.test(v)) return 'Revisa el teléfono.';
  if (clave === 'codigo_postal' && !/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(v))
    return 'El código postal tiene 5 cifras.';
  if (
    clave === 'iban' &&
    (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(sinSeparadores(v)) || !ibanValido(v))
  )
    return 'Revisa el IBAN.';
  return null;
}

/** Normaliza lo que se guarda: fechas ISO, documento sin separadores, IBAN sin espacios. */
export function normalizarCampo(clave: string, valor: string): string {
  const v = valor.trim().replace(/\s+/g, ' ');
  if (clave === 'documento_numero' || clave === 'iban')
    return v.replace(/[\s-]/g, '').toUpperCase();
  return v;
}

function edad(fechaIso: string, hoy: Date): number | null {
  const [y, m, d] = fechaIso.split('-').map(Number);
  if (!y || !m || !d) return null;
  let anios = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--;
  return anios >= 0 && anios < 130 ? anios : null;
}

/** La caducidad del documento sin la fecha: basta para saber si hay que renovarlo. */
function vigencia(fechaIso: string, hoy: Date): string {
  const fin = Date.parse(fechaIso);
  if (fechaIso.startsWith('9999')) return 'permanente';
  if (Number.isNaN(fin)) return '';
  if (fin < hoy.getTime()) return 'caducado';
  const meses = Math.floor((fin - hoy.getTime()) / (30.44 * 86400000));
  return meses < 1 ? 'caduca en menos de un mes' : `caduca en ${meses} meses`;
}

/** Lo que el modelo sabe del perfil: los datos de contexto y qué identificadores están guardados. */
export function perfilParaModelo(perfil: Perfil, hoy = new Date()): string {
  const lineas: string[] = [];
  const faltan: string[] = [];
  for (const c of camposPerfil) {
    const valor = perfil[c.clave];
    if (!valor) {
      faltan.push(c.clave);
      continue;
    }
    if (c.privacidad === 'contexto') lineas.push(`- ${c.clave} (${c.etiqueta}): ${valor}`);
    else {
      const extra =
        c.clave === 'fecha_nacimiento' && edad(valor, hoy) !== null
          ? `; edad: ${edad(valor, hoy)} años`
          : c.clave === 'documento_caducidad' && vigencia(valor, hoy)
            ? `; ${vigencia(valor, hoy)}`
            : '';
      lineas.push(
        `- ${c.clave} (${c.etiqueta}): {{${c.clave}}} (guardado${extra}${conForma(c.clave, valor)})`,
      );
    }
  }
  for (const [clave, valor] of Object.entries(perfil))
    if (valor && !campoPerfil(clave))
      lineas.push(`- ${clave}: {{${clave}}} (guardado${conForma(clave, valor)})`);
  return [
    lineas.length ? lineas.join('\n') : '- (sin datos guardados)',
    faltan.length ? `Sin guardar: ${faltan.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const MESES =
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(
    ' ',
  );
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VOCALES: Record<string, string> = {
  a: 'aáàâä',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôö',
  u: 'uúùûü',
  n: 'nñ',
  c: 'cç',
};
/** Patrón que acepta mayúsculas, tildes y espacios distintos a los del valor guardado. */
function patronFlexible(valor: string): string {
  return [...valor.trim()]
    .map((ch) => {
      if (/\s/.test(ch)) return '\\s+';
      const base = ch
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      return VOCALES[base] ? `[${VOCALES[base]}]` : escapar(ch);
    })
    .join('');
}
/** Dígitos con separadores opcionales entre ellos: «600 12 34 56», «600-123-456»… */
const digitosFlexibles = (digitos: string) => [...digitos].map(escapar).join('[\\s./-]?');

function variantes(clave: string, valor: string): string[] {
  const v = valor.trim();
  if (clave === 'documento_numero') {
    // También con puntos («12.345.678-Z») y solo el número, sin la letra.
    const m = /^([XYZ]?)(\d{7,8})([A-Z])$/i.exec(v);
    if (m) {
      const numero = `${m[1] ? `${m[1]}[\\s.-]?` : ''}${digitosFlexibles(m[2]!)}`;
      return [`${numero}[\\s.-]?${m[3]}`, numero];
    }
  }
  if (clave === 'telefono') {
    const digitos = v.replace(/\D/g, '').replace(/^(0034|34)(?=\d{9}$)/, '');
    if (digitos.length >= 9) return [`(?:(?:\\+|00)34[\\s.-]?)?${digitosFlexibles(digitos)}`];
  }
  if (clave === 'iban' || clave === 'nuss') return [digitosFlexibles(v.replace(/[\s/-]/g, ''))];
  if (campoPerfil(clave)?.tipo === 'fecha') {
    const [y, m, d] = v.split('-');
    if (y && m && d) {
      const dd = String(Number(d));
      const mm = String(Number(m));
      return [
        `${y}-${m}-${d}`,
        `0?${dd}[/.-]0?${mm}[/.-]${y}`,
        `0?${dd}\\s+de\\s+${MESES[Number(m) - 1]}\\s+(?:de\\s+|del\\s+)?${y}`,
      ];
    }
  }
  return [patronFlexible(v)];
}

type Regla = { patron: RegExp; marcador: string; clave: string; valido?: (v: string) => boolean };
/**
 * Tipos de los datos que encuentra el detector o que trae una web (`{{nombre_1}}`, `{{dato_3}}`) y
 * si son códigos: un código se reconoce aunque vaya pegado a letras y la última capa lo busca sin
 * límites. Es la única lista: `TipoDato`, `DETECTADO` y las reglas salen de aquí.
 */
export const TIPOS_DATO = {
  nombre: false,
  apellido: false,
  direccion: false,
  documento: true,
  cuenta: true,
  telefono: true,
  correo: true,
  fecha: true,
  referencia: true,
  dato: false,
} as const;
const clavesDe = (tipos: string[]) => new RegExp(`^(${tipos.join('|')})_\\d+$`);
/** Cualquier marcador, con su formato opcional: `{{fecha_nacimiento:dia}}`, `{{direccion:3-5}}`. */
export const MARCADOR = /\{\{([a-z0-9_.]+)(?::([a-z0-9/-]+))?\}\}/gi;
/** Claves de los datos que encuentra el detector o que trae una web: `{{nombre_1}}`, `{{dato_3}}`. */
export const DETECTADO = clavesDe(Object.keys(TIPOS_DATO));
const CODIGO_DETECTADO = clavesDe(
  Object.entries(TIPOS_DATO).flatMap(([tipo, codigo]) => (codigo ? [tipo] : [])),
);
/** Aplica `fn` solo al texto que hay entre marcadores: un valor («Correo») no toca {{correo_1}}. */
const fueraDeMarcadores = (texto: string, fn: (t: string) => string) =>
  texto
    .split(/(\{\{[a-z0-9_.]+(?::[a-z0-9/-]+)?\}\})/i)
    .map((t, i) => (i % 2 ? t : fn(t)))
    .join('');
const BORDE_INI = '(?<![\\p{L}\\p{N}])';
const BORDE_FIN = '(?![\\p{L}\\p{N}])';
/** Códigos que se reconocen aunque vayan pegados a letras («12345678ZLucía»): basta con que no haya más cifras. */
const CODIGOS = new Set([
  'documento_numero',
  'documento_soporte',
  'telefono',
  'iban',
  'nuss',
  'fecha_nacimiento',
  'email',
]);

const sinSeparadores = (v: string) => v.replace(/[\s./-]/g, '').toUpperCase();
function ibanValido(v: string) {
  const s = sinSeparadores(v);
  let resto = 0;
  for (const c of s.slice(4) + s.slice(0, 4))
    for (const d of /\d/.test(c) ? c : String(c.charCodeAt(0) - 55))
      resto = (resto * 10 + Number(d)) % 97;
  return resto === 1;
}

/** CIF (Orden EHA/451/2008): A, B, E y H acaban en cifra; N, P, Q, R, S y W, en letra; el resto, en cualquiera. */
function cifValido(v: string) {
  const s = sinSeparadores(v);
  const suma = [...s.slice(1, 8)].reduce((t, c, i) => {
    const n = Number(c) * (i % 2 ? 1 : 2);
    return t + Math.floor(n / 10) + (n % 10);
  }, 0);
  const cifra = (10 - (suma % 10)) % 10;
  const control = s.at(-1)!;
  if ('ABEH'.includes(s[0]!)) return control === String(cifra);
  if ('NPQRSW'.includes(s[0]!)) return control === 'JABCDEFGHI'[cifra];
  return control === String(cifra) || control === 'JABCDEFGHI'[cifra];
}

/** NUSS: provincia (2), número (8) y control (2) = resto entre 97 del número con la provincia delante. */
function nussValido(v: string) {
  const s = sinSeparadores(v);
  const numero = Number(s.slice(2, 10));
  // Si el número tiene menos de 8 cifras, se le quita el cero de la izquierda antes de unirlo.
  const base = numero < 1e7 ? Number(s.slice(0, 2)) * 1e7 + numero : Number(s.slice(0, 10));
  return base % 97 === Number(s.slice(10));
}

const PESOS_CCC = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
const digitoCcc = (cifras: string) => {
  const d = 11 - ([...cifras].reduce((t, c, i) => t + Number(c) * PESOS_CCC[i]!, 0) % 11);
  return d === 11 ? 0 : d === 10 ? 1 : d;
};
/** CCC: entidad y oficina (8), dos dígitos de control (módulo 11) y cuenta (10). */
function cccValido(v: string) {
  const s = sinSeparadores(v);
  return `${digitoCcc(`00${s.slice(0, 8)}`)}${digitoCcc(s.slice(10))}` === s.slice(8, 10);
}

const PESOS_CATASTRO = [13, 15, 12, 5, 4, 17, 9, 21, 3, 7, 1];
/** Las cifras valen lo que son; las letras, su posición en el alfabeto español (A = 1, Ñ = 15, Z = 27). */
const valorCatastro = (c: string) =>
  /\d/.test(c) ? Number(c) : 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.indexOf(c) + 1;
const letraCatastro = (s: string) =>
  'MQWERTYUIOPASDFGHJKLBZX'.charAt(
    [...s].reduce((t, c, i) => t + valorCatastro(c) * PESOS_CATASTRO[i]!, 0) % 23,
  );
/** Referencia catastral: finca (7), hoja (7), cargo (4) y una letra de control por cada mitad. */
function catastralValida(v: string) {
  const s = sinSeparadores(v);
  const cargo = s.slice(14, 18);
  return (
    letraCatastro(s.slice(0, 7) + cargo) + letraCatastro(s.slice(7, 14) + cargo) === s.slice(18)
  );
}

const ARROBA = '@|\\s*[[({](?:at|arroba)[\\])}]\\s*|\\s+arroba\\s+';
const PUNTO = '\\.|\\s*[[({](?:dot|punto)[\\])}]\\s*|\\s+punto\\s+';
/**
 * Plan de numeración (CNMC): son de una persona los móviles (6, 71-74) y los fijos geográficos
 * (81-88, 91-98). Los de tarificación especial o gratuitos (800, 803, 806, 807, 900, 901, 902,
 * 905…) y los cortos (060, 012) son de servicios y se quedan a la vista.
 */
const PERSONAL = '(?:6|7(?=[1-4])|[89](?=[1-8]))(?:[\\s.-]?\\d){8}';
/** «600.000.000» es más a menudo un importe: así escrito, solo es teléfono si lo dice delante. */
const CONTEXTO_TELEFONO = 'tel[eé]fono|tel\\.|tfno|m[oó]vil|fijo|fax|whatsapp|sms|ll[aá]m';
const MONEDA = '€|\\$|eur(?:os?)?(?!\\p{L})';

/** Un número de solo cifras no es un trozo de otro más largo: «2100-0418-45-…» no lleva un NUSS dentro. */
const ANTES_CIFRAS = '(?<![\\p{L}\\p{N}]|\\p{N}[\\s./-])';
const DESPUES_CIFRAS = '(?![\\p{L}\\p{N}]|[\\s./-]\\p{N})';

/**
 * Identificadores de cualquier persona. Los que tienen control (letra o dígitos) se validan con su
 * algoritmo oficial y se ocultan siempre antes del modelo. Las letras separadas por un espacio solo
 * cuentan en mayúscula: «12.000.000 y» es un importe, no un DNI.
 */
export const GENERICAS: readonly (Regla & { tipo: TipoDato })[] = [
  {
    clave: 'dni',
    marcador: '[DNI]',
    tipo: 'documento',
    patron: /(?<![\p{L}\p{N}])\d{2}([.\s]?)\d{3}\1\d{3}(?:[\s.-]?[A-Z]|-?[a-z])(?![\p{L}\p{N}])/gu,
    valido: (v) => letraDni(sinSeparadores(v).slice(0, 8)) === sinSeparadores(v).at(-1),
  },
  {
    clave: 'nie',
    marcador: '[NIE]',
    tipo: 'documento',
    patron:
      /(?<![\p{L}\p{N}])(?:[XYZ][\s.-]?\d{7}[\s.-]?[A-Z]|[XYZxyz]-?\d{7}-?[A-Za-z])(?![\p{L}\p{N}])/gu,
    valido: (v) => {
      const s = sinSeparadores(v);
      return letraDni('XYZ'.indexOf(s[0]!) + s.slice(1, 8)) === s.at(-1);
    },
  },
  {
    // K (menores de 14 años), L (españoles no residentes) y M (extranjeros sin NIE): la letra del
    // DNI calculada con las siete cifras.
    clave: 'nif',
    marcador: '[NIF]',
    tipo: 'documento',
    patron:
      /(?<![\p{L}\p{N}])(?:[KLM][\s.-]?\d{7}[\s.-]?[A-Z]|[KLMklm]-?\d{7}-?[A-Za-z])(?![\p{L}\p{N}])/gu,
    valido: (v) => letraDni(sinSeparadores(v).slice(1, 8)) === sinSeparadores(v).at(-1),
  },
  {
    // Sin P, Q ni S (administraciones públicas): sus CIF salen en las webs oficiales y no son de nadie.
    clave: 'cif',
    marcador: '[CIF]',
    tipo: 'documento',
    patron: /(?<![\p{L}\p{N}])[ABCDEFGHJNRUVW]-?\d{7}[\dA-J](?![\p{L}\p{N}])/gu,
    valido: cifValido,
  },
  {
    clave: 'nuss',
    marcador: '[NUSS]',
    tipo: 'documento',
    patron: new RegExp(`${ANTES_CIFRAS}\\d{2}[\\s/-]?\\d{8}[\\s/-]?\\d{2}${DESPUES_CIFRAS}`, 'gu'),
    valido: nussValido,
  },
  {
    clave: 'iban',
    marcador: '[IBAN]',
    tipo: 'cuenta',
    // Cada grupo lleva alguna cifra o va en mayúsculas: si no, «… 1332 para el» se tragaba «para».
    patron:
      /(?<![\p{L}\p{N}])[A-Za-z]{2}\d{2}(?:\s?(?:[A-Z]{4}|(?=[A-Za-z]{0,3}\d)[A-Za-z\d]{4})){4,7}(?:\s?(?=[A-Za-z]{0,3}\d)[A-Za-z\d]{1,4})?(?![\p{L}\p{N}])/gu,
    valido: ibanValido,
  },
  {
    // Después del IBAN, que la lleva dentro. En grupos de 4-4-2-10 o de cuatro en cuatro.
    clave: 'ccc',
    marcador: '[CCC]',
    tipo: 'cuenta',
    patron: new RegExp(
      `${ANTES_CIFRAS}\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{2}(?:[\\s-]?\\d{10}|\\d{2}(?:[\\s-]?\\d{4}){2})${DESPUES_CIFRAS}`,
      'gu',
    ),
    valido: cccValido,
  },
  {
    clave: 'catastral',
    marcador: '[referencia catastral]',
    tipo: 'referencia',
    patron: /(?<![\p{L}\p{N}])\d{5}[\dA-Z]{2}\s?[\dA-Z]{7}\s?\d{4}\s?[A-Z]{2}(?![\p{L}\p{N}])/gu,
    valido: catastralValida,
  },
  // Empieza donde empieza la palabra: sin ese límite, un texto largo sin espacios sería muy lento.
  // También escrito para que no lo lean los robots: «lucia arroba ejemplo punto es», «[at]», «(dot)».
  {
    clave: 'email',
    marcador: '[correo]',
    tipo: 'correo',
    patron: new RegExp(`(?<![\\w.+-])[\\w.+-]+(?:${ARROBA})[\\w-]+(?:(?:${PUNTO})[\\w-]+)+`, 'giu'),
  },
  {
    // Ni dentro de otro número ni junto a una moneda: «1.600.000.000», «600 000 000 €».
    clave: 'telefono',
    marcador: '[teléfono]',
    tipo: 'telefono',
    patron: new RegExp(
      `(?<![\\p{N}+]|\\p{N}[.,]|[€$]\\s?)` +
        `(?:(?:\\+|00)34[\\s.-]?|(?<=(?:${CONTEXTO_TELEFONO})\\D{0,25})|(?!\\d{3}\\.\\d{3}\\.\\d{3}(?!\\p{N})))` +
        `${PERSONAL}(?![.,]?\\p{N})(?!\\s?(?:${MONEDA}))`,
      'giu',
    ),
  },
  {
    // Con el prefijo internacional (E.164: hasta 15 cifras). El +34 sigue el plan español, arriba.
    clave: 'telefono',
    marcador: '[teléfono]',
    tipo: 'telefono',
    patron: /(?<![\p{L}\p{N}+])\+(?!34)[1-9](?:[\s.()-]{0,2}\d){7,14}(?![.,]?\p{N})/gu,
  },
];

const VALIDADAS = GENERICAS.filter((r) => r.valido);
/** Para comparar valores sin mayúsculas, tildes, espacios ni separadores. */
export const normalizarValor = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Sustituye los identificadores del perfil por su marcador. `usuario: true` añade los detectores
 * genéricos (documentos, cuentas, correo y teléfono de cualquiera) para las búsquedas. La última
 * comprobación (`laxo`) oculta además cualquier identificador con su control válido (DNI, NIE, NIF,
 * CIF, NUSS, IBAN, CCC, referencia catastral), venga de donde venga.
 */
export class Privacidad {
  private reglas: Regla[] = [];
  /**
   * Los códigos (documentos, teléfonos, cuentas, fechas, correos) sin ningún límite: para la última
   * comprobación. Los nombres no, porque «Lucía» está dentro de «Andalucía».
   */
  private laxas: Regla[] = [];
  /** Sustituciones hechas, por clave. Sin valores: sirve para auditoría y evaluaciones. */
  readonly registro: Record<string, number> = {};

  constructor(private perfil: Perfil) {
    this.actualizar(perfil);
  }

  actualizar(perfil: Perfil) {
    this.perfil = perfil;
    const codigo = (clave: string) => CODIGOS.has(clave) || CODIGO_DETECTADO.test(clave);
    const reglas = (estricto: boolean) =>
      Object.entries(perfil)
        .filter(
          ([clave, valor]) =>
            esIdentificador(clave) &&
            // Lo que traía un campo ({{dato_N}}) solo se oculta en ese campo: puede ser cualquier
            // cosa («España») y como regla taparía también el texto de las webs oficiales.
            !/^dato_\d+$/.test(clave) &&
            (estricto || codigo(clave)) &&
            valor.trim().length >= (estricto ? 3 : 5),
        )
        .flatMap(([clave, valor]) => {
          const esCodigo = codigo(clave);
          const ini = !estricto ? '' : esCodigo ? '(?<!\\d)' : BORDE_INI;
          const fin = !estricto ? '' : esCodigo ? '(?!\\d)' : BORDE_FIN;
          return variantes(clave, valor).map((p) => ({
            clave,
            marcador: `{{${clave}}}`,
            patron: new RegExp(ini + p + fin, 'giu'),
          }));
        })
        // Primero los valores largos: «García López» antes que «García».
        .sort((a, b) => b.patron.source.length - a.patron.source.length);
    this.reglas = reglas(true);
    this.laxas = reglas(false);
  }

  limpiar(texto: string, opciones: { usuario?: boolean; laxo?: boolean } = {}): string {
    let out = texto;
    const base = opciones.laxo ? [...this.laxas, ...this.reglas, ...VALIDADAS] : this.reglas;
    for (const regla of opciones.usuario ? [...base, ...GENERICAS] : base)
      out = fueraDeMarcadores(out, (t) =>
        t.replace(regla.patron, (m) => {
          if (regla.valido && !regla.valido(m)) return m;
          this.registro[regla.clave] = (this.registro[regla.clave] ?? 0) + 1;
          return regla.marcador;
        }),
      );
    return out;
  }

  /** ¿Contiene el texto algún valor del perfil o un identificador válido? Para la última comprobación. */
  contieneDatos(texto: string): boolean {
    const sinMarcadores = texto.replace(MARCADOR, ' ');
    return [...this.laxas, ...this.reglas, ...VALIDADAS].some((r) =>
      [...sinMarcadores.matchAll(r.patron)].some((m) => !r.valido || r.valido(m[0])),
    );
  }

  /**
   * `limpiar` y, además, lo que encuentre el detector local. Lo que escribe la persona pasa a ser
   * un dato del trámite con su propio marcador (`{{nombre_1}}`), que se oculta también donde
   * vuelva a salir y que la app puede escribir en una web oficial. Lo que sale de una página se
   * oculta solo ahí (`{{dato_N}}`): una regla taparía también el texto de las webs oficiales.
   */
  async proteger(
    texto: string,
    detector: Detector,
    datos: Perfil,
    origen: OrigenTexto,
  ): Promise<string> {
    // Los marcadores que ya hay se quedan, lo guardado conserva su marcador y el detector mira el
    // texto original: con marcadores dentro («LUCÍA {{apellido1}} ORTUZAR») pierde el contexto.
    const tramos = [...texto.matchAll(MARCADOR)].map((m) => ({
      inicio: m.index,
      fin: m.index + m[0].length,
      clave: '',
    }));
    const solapa = (a: number, b: number) => tramos.some((t) => a < t.fin && b > t.inicio);
    for (const r of this.reglas)
      for (const m of texto.matchAll(r.patron))
        if (!solapa(m.index, m.index + m[0].length))
          tramos.push({ inicio: m.index, fin: m.index + m[0].length, clave: r.clave });
    for (const d of await detector(texto, origen)) {
      // Solo lo que no es ya un dato: «Iker Zubeldia» con Zubeldia guardado deja «Iker».
      let piezas = [[d.inicio, d.fin]];
      for (const t of tramos)
        piezas = piezas.flatMap(([a = 0, b = 0]) =>
          t.fin <= a || t.inicio >= b
            ? [[a, b]]
            : [...(t.inicio > a ? [[a, t.inicio]] : []), ...(t.fin < b ? [[t.fin, b]] : [])],
        );
      for (const [a = 0, b = 0] of piezas) {
        // Sin los espacios y signos de los bordes: «Iker,» se guarda como «Iker».
        const bruto = texto.slice(a, b);
        const valor = bruto.replace(/^[\s,.;:()|]+|[\s,.;:()|]+$/g, '');
        if (!normalizarValor(valor)) continue;
        const todos = { ...this.perfil, ...datos };
        const clave = claveDeDato(todos, origen === 'pagina' ? 'dato' : d.tipo, valor);
        // Un dato de contexto (el municipio) se queda a la vista aunque el detector lo marque.
        if (!esIdentificador(clave)) continue;
        if (!todos[clave]) datos[clave] = valor;
        const inicio = a + bruto.indexOf(valor);
        tramos.push({ inicio, fin: inicio + valor.length, clave });
        // Las demás veces que sale en este texto, aunque el detector no las haya marcado (si no es
        // tan corto que taparía cualquier otra cosa, como la «B» de un piso).
        if (valor.length < 3) continue;
        const igual = new RegExp(BORDE_INI + patronFlexible(valor) + BORDE_FIN, 'giu');
        for (const m of texto.matchAll(igual))
          if (!solapa(m.index, m.index + m[0].length))
            tramos.push({ inicio: m.index, fin: m.index + m[0].length, clave });
      }
    }
    let out = texto;
    for (const t of tramos.filter((x) => x.clave).sort((x, y) => y.inicio - x.inicio))
      out = `${out.slice(0, t.inicio)}{{${t.clave}}}${out.slice(t.fin)}`;
    this.actualizar({ ...this.perfil, ...datos });
    return this.limpiar(out);
  }

  /**
   * En las líneas de controles de una página («[4] campo "Año" = "1988"»), sustituye también las
   * partes de un dato que la app escribió con formato: el día o el año de la fecha, el número del
   * DNI sin la letra. Solo el valor exacto del campo, para no tocar el resto del texto.
   */
  ocultarEnCampos(texto: string): string {
    const pares: [string, string][] = [];
    for (const [clave, valor] of Object.entries(this.perfil)) {
      if (!esIdentificador(clave) || !valor) continue;
      const formatos =
        campoPerfil(clave)?.tipo === 'fecha'
          ? ['', 'iso', 'dia', 'mes', 'anio']
          : clave === 'documento_numero'
            ? ['', 'numero']
            : [''];
      for (const f of formatos) {
        const marcador = f ? `{{${clave}:${f}}}` : `{{${clave}}}`;
        const v = formatear(clave, valor, f || undefined);
        pares.push([v, marcador]);
        if (/^0\d$/.test(v)) pares.push([v.slice(1), marcador]);
      }
    }
    return texto
      .split('\n')
      .map((linea) =>
        /^(⚠ )?\[\d+\] /.test(linea)
          ? pares.reduce((l, [v, m]) => l.replaceAll(`= "${v}"`, `= "${m}"`), linea)
          : linea,
      )
      .join('\n');
  }

  /** Marcadores que aparecen en un texto, para saber si escribirlo exige una web oficial. */
  static marcadores(texto: string): string[] {
    return [...texto.matchAll(MARCADOR)].map((m) => m[1]!);
  }

  /**
   * Sustituye los marcadores por los valores reales. Formatos: `{{fecha_nacimiento}}` (dd/mm/aaaa),
   * `:iso`, `:dia`, `:mes`, `:anio`; `{{documento_numero:numero}}` y `:letra`; y un trozo de cualquier
   * dato según su forma: `{{direccion:2}}`, `{{direccion:3-5}}`. Un trozo que no existe falta.
   */
  resolver(texto: string): { texto: string; faltan: string[] } {
    const faltan: string[] = [];
    const out = texto.replace(MARCADOR, (marca, clave: string, formato?: string) => {
      const valor = this.perfil[clave];
      if (!valor) {
        faltan.push(clave);
        return marca;
      }
      const v = formatear(clave, valor, formato);
      if (!v) faltan.push(`${clave}:${formato}`);
      return v || marca;
    });
    return { texto: out, faltan };
  }
}

/** El marcador de un dato detectado: el mismo si ya se había visto (con otro formato o en Mis datos). */
export function claveDeDato(todos: Perfil, tipo: TipoDato, valor: string): string {
  const n = normalizarValor(valor);
  const previa = Object.entries(todos).find(([, v]) => normalizarValor(v) === n)?.[0];
  if (previa) return previa;
  const usados = Object.keys(todos).flatMap((k) =>
    k.startsWith(`${tipo}_`) ? [Number(k.slice(tipo.length + 1)) || 0] : [],
  );
  return `${tipo}_${Math.max(0, ...usados) + 1}`;
}

/** Los trozos de un dato: palabras y números (el «º» de «2º» va aparte, como un signo). */
const trozos = (valor: string) => [...valor.matchAll(/(?:(?![ºª])\p{L})+|\p{N}+/gu)];

/**
 * La forma de un dato sin su contenido, para que el modelo razone con qué trozos rellenar un
 * formulario que lo pide por partes: «C/ Mayor, 11, 2º B» → «[1 letra]/ [2 palabra], [3 número],
 * [4 número]º [5 letra]». Solo se ven los signos y la clase de cada trozo, no su longitud.
 */
function forma(valor: string): string {
  let out = '';
  let fin = 0;
  trozos(valor).forEach((t, n) => {
    const clase = /\p{N}/u.test(t[0]) ? 'número' : t[0].length === 1 ? 'letra' : 'palabra';
    out += `${valor.slice(fin, t.index)}[${n + 1} ${clase}]`;
    fin = t.index + t[0].length;
  });
  return out + valor.slice(fin);
}

/** La forma de un identificador de varios trozos, para la línea de «Mis datos» que ve el modelo. */
function conForma(clave: string, valor: string): string {
  const tipo = campoPerfil(clave)?.tipo;
  if (tipo === 'fecha' || tipo === 'email' || trozos(valor).length < 2) return '';
  return `; forma: ${forma(valor)}`;
}

function formatear(clave: string, valor: string, formato?: string): string {
  const rango = /^(\d+)(?:-(\d+))?$/.exec(formato ?? '');
  if (rango) {
    const t = trozos(valor);
    const a = t[Number(rango[1]) - 1];
    const b = t[Number(rango[2] ?? rango[1]) - 1];
    return a && b && b.index >= a.index ? valor.slice(a.index, b.index + b[0].length) : '';
  }
  if (campoPerfil(clave)?.tipo === 'fecha') {
    const [y = '', m = '', d = ''] = valor.split('-');
    if (formato === 'iso') return valor;
    if (formato === 'dia') return d;
    if (formato === 'mes') return m;
    if (formato === 'anio') return y;
    return `${d}/${m}/${y}`;
  }
  if (clave === 'documento_numero') {
    const m = /^([XYZ]?\d{7,8})([A-Z])$/i.exec(valor);
    if (m && formato === 'numero') return m[1]!;
    if (m && formato === 'letra') return m[2]!;
  }
  return valor;
}
