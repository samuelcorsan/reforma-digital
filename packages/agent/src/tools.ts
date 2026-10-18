import { randomBytes } from 'node:crypto';
import { setTimeout as dormir } from 'node:timers/promises';
import { tool } from 'ai';
import { z } from 'zod';
import { isOfficial } from '@reforma-digital/government/domains';
import { provincias } from '@reforma-digital/government/provincias';
import type { Detector, OrigenTexto } from './detector';
import { FetchError, leerPagina } from './fetch';
import type { Proveedor } from './models';
import {
  elegirOpcion,
  enfocarElemento,
  infoElemento,
  instantanea,
  leerTextoPagina,
  destinoDeTecla,
  pareceIrreversible,
  puntoElemento,
  type Dialogo,
  type InfoElemento,
  type Navegador,
} from './page';
import {
  campoPerfil,
  claveDeDato,
  DETECTADO,
  esIdentificador,
  normalizarCampo,
  normalizarValor,
  perfilParaModelo,
  Privacidad,
  validarCampo,
  type Perfil,
} from './profile';
import { buscarEnElBoe, buscarEnLaWeb, type Fuente, type Fuentes } from './research';

const campoEntrada = z.object({
  clave: z.string().regex(/^[a-z0-9_]{2,40}$/),
  etiqueta: z.string().min(2).max(90),
  tipo: z
    .enum([
      'texto',
      'texto_largo',
      'fecha',
      'opcion',
      'varias',
      'si_no',
      'numero',
      'email',
      'telefono',
      'provincia',
    ])
    .describe('varias: se pueden marcar varias opciones; provincia: un desplegable con todas'),
  opciones: z.array(z.string().max(80)).max(60).optional(),
  ayuda: z.string().max(200).optional(),
  obligatorio: z.boolean().optional(),
  /** El modelo no ve la respuesta, solo su marcador. Por defecto en datos que no son de contexto. */
  privado: z
    .boolean()
    .optional()
    .describe(
      'false si necesitas leer la respuesta: solo vale en si_no, opcion, numero y texto_largo',
    ),
  paso: z
    .string()
    .max(24)
    .optional()
    .describe(
      'Si pides más de 4 datos, el paso del formulario en el que va, con un nombre corto («Tus datos», «La cita»); los del mismo paso, seguidos',
    ),
  solo_si: z
    .object({ campo: z.string(), valor: z.string() })
    .optional()
    .describe(
      'Solo se pregunta si otro campo (de tipo opcion, varias o si_no) tiene esta respuesta, p. ej. {campo: "tiene_hijos", valor: "Sí"}',
    ),
});
const formularioEntrada = z.object({
  titulo: z.string().min(3).max(90),
  explicacion: z.string().max(300).optional(),
  accion: z
    .string()
    .min(2)
    .max(40)
    .optional()
    .describe(
      'Si el formulario es para hacer el trámite, el botón que lo pone en marcha, en infinitivo: «Pedir la cita» (la app añade «por mí»)',
    ),
  campos: z.array(campoEntrada).min(1).max(12),
});
const confirmacionEntrada = z.object({
  tipo: z.enum(['enviar', 'pagar', 'firmar', 'reservar', 'otro']),
  accion: z
    .string()
    .min(5)
    .max(160)
    .describe('Qué vas a hacer, p. ej. «Reservar la cita del 3 de noviembre a las 9:30»'),
  detalles: z
    .array(z.string().max(200))
    .max(10)
    .describe('Datos que se enviarán, con marcadores para los datos personales'),
  sitio: z.string().optional(),
});
const llamadaEntrada = z.object({
  organismo: z.string().min(2).max(120),
  telefono: z
    .string()
    .min(3)
    .max(40)
    .describe('El teléfono como lo da la web oficial que has leído (o su marcador, si lo ves así)'),
  objetivo: z.string().min(5).max(200).describe('Qué tiene que conseguir con la llamada'),
  preguntas: z.array(z.string().max(200)).min(1).max(8).describe('Qué preguntar, en orden'),
  tener_a_mano: z.array(z.string().max(120)).max(8).optional(),
  horario: z.string().max(120).optional().describe('El horario de atención, si la web lo da'),
});
const ayudaEntrada = z.object({
  motivo: z.enum(['iniciar_sesion', 'captcha', 'certificado', 'firma', 'pago', 'adjuntar', 'otro']),
  instrucciones: z.string().min(5).max(300).describe('Qué tiene que hacer, en una o dos frases'),
});

export type CampoFormulario = z.infer<typeof campoEntrada>;
export type Formulario = z.infer<typeof formularioEntrada>;
export type Ayuda = z.infer<typeof ayudaEntrada>;
export type Llamada = z.infer<typeof llamadaEntrada>;
export type Confirmacion = z.infer<typeof confirmacionEntrada> & {
  /** Acciones vinculantes ya hechas en este trámite: la persona las ve antes de aprobar otra. */
  previas?: string[];
};

/** Lo que el agente necesita de la app (o del simulador de las evaluaciones). */
export interface Anfitrion {
  perfil(): Perfil;
  guardarPerfil(valores: Perfil): Promise<void>;
  /** `null` si la persona descarta el formulario. */
  preguntar(f: Formulario, signal: AbortSignal): Promise<Record<string, string> | null>;
  confirmar(c: Confirmacion, signal: AbortSignal): Promise<boolean>;
  pedirAyuda(a: Ayuda, signal: AbortSignal): Promise<{ hecho: boolean; nota?: string }>;
  /** La persona llama por teléfono y apunta lo que le dicen. Sin él, el agente no puede pedírselo. */
  pedirLlamada?(l: Llamada, signal: AbortSignal): Promise<{ hecho: boolean; notas?: string }>;
  /**
   * Si la persona confía en que una web que no es oficial (`host`) reciba sus datos. Quien lo
   * implementa lo pregunta la primera vez y recuerda la respuesta.
   */
  confiarEn(host: string, signal: AbortSignal): Promise<boolean>;
  navegador(): Promise<Navegador>;
  /**
   * Lee una página oficial con un navegador real y aparte (sin sesiones del trámite), para webs
   * que rechazan las peticiones que no vienen de un navegador. Solo en la app.
   */
  leerConNavegador?(
    url: string,
    signal: AbortSignal,
  ): Promise<{ url: string; titulo: string; texto: string }>;
}

export type Uso = {
  entrada: number;
  salida: number;
  cache: number;
  costeUsd: number;
  costeDesconocido: boolean;
  pasos: number;
};
export const usoVacio = (): Uso => ({
  entrada: 0,
  salida: 0,
  cache: 0,
  costeUsd: 0,
  costeDesconocido: false,
  pasos: 0,
});

export type EventoAgente =
  | { tipo: 'texto'; delta: string }
  | {
      tipo: 'actividad';
      id: string;
      herramienta: string;
      resumen: string;
      estado: 'inicio' | 'fin' | 'error';
      detalle?: string;
    }
  | { tipo: 'fuentes'; fuentes: Fuente[] }
  | { tipo: 'uso'; uso: Uso }
  | { tipo: 'privacidad'; filtrados: number }
  /** Datos ocultos al modelo en el mensaje de la persona. */
  | { tipo: 'protegidos'; cantidad: number };

export type Contexto = {
  anfitrion: Anfitrion;
  proveedor: Proveedor;
  fuentes: Fuentes;
  privacidad: Privacidad;
  /** Detector local de datos personales que no están en «Mis datos». */
  detector: Detector;
  /**
   * Lo que el agente ha escrito en cada campo, tal como lo escribió (con sus marcadores), por el
   * valor que quedó en la página (normalizado). Es lo único de un campo que ve.
   */
  escritos: Map<string, string>;
  /** Respuestas privadas de este trámite que no son de «Mis datos» (DNI de un hijo, referencias…). */
  datosTramite: Perfil;
  /** Códigos de confirmación aprobados y la web en la que se aprobaron. */
  confirmaciones: Map<string, { accion: string; host: string | null }>;
  /** Host de la última página vista en el navegador. */
  hostActual: string | null;
  /** Acciones vinculantes ejecutadas en el trámite (envíos, reservas, pagos, firmas). */
  vinculantes: { accion: string; fecha: string }[];
  uso: Uso;
  evento: (e: EventoAgente) => void;
};

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Números de tarificación adicional del plan español de numeración (servicios de pago, concursos,
 * información de abonados): las administraciones no los usan para atender.
 */
const tarificacionAdicional = (telefono: string) =>
  /^(?:80[367]|905|118)/.test(telefono.replace(/\D/g, '').replace(/^(?:0034|34)(?=\d{9}$)/, ''));

/** Un texto para buscarlo en otro sin mayúsculas, tildes ni espacios de más. */
const comparable = (t: string) =>
  t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Perfil global y datos del trámite juntos, para resolver marcadores. */
const todosLosDatos = (ctx: Contexto) => ({ ...ctx.anfitrion.perfil(), ...ctx.datosTramite });

/** Lo que escriben la persona o una web: sin los datos de «Mis datos» ni los que encuentre el detector. */
export function proteger(ctx: Contexto, texto: string, origen: OrigenTexto) {
  ctx.privacidad.actualizar(todosLosDatos(ctx));
  return ctx.privacidad.proteger(texto, ctx.detector, ctx.datosTramite, origen);
}

const sinParametros = (url: string) =>
  url.replace(/[?#].*$/, (q) => (q.startsWith('?') ? '?…' : ''));

/** Mientras la web espera respuesta a un diálogo propio, la página está bloqueada: solo se ve él. */
const verDialogo = (d: Dialogo, aviso: string) =>
  [
    aviso,
    `La web ha abierto un diálogo (${d.tipo}) y la página está bloqueada hasta que se responda. Su texto, de la web:`,
    `«${d.mensaje}»`,
    d.tipo === 'prompt'
      ? `Pide escribir algo${d.porDefecto ? ` (propone «${d.porDefecto}»)` : ''}.`
      : '',
    'Respóndelo con responder_dialogo.',
  ]
    .filter(Boolean)
    .join('\n');

async function verPagina(ctx: Contexto, nav: Navegador, aviso = ''): Promise<string> {
  const dialogo = nav.dialogo?.();
  if (dialogo) return verDialogo(dialogo, aviso);
  let p;
  try {
    p = await instantanea(nav);
  } catch (e) {
    const abierto = nav.dialogo?.();
    if (abierto) return verDialogo(abierto, aviso);
    if (e instanceof Error && e.name === 'AbortError') throw e;
    // La página estaba navegando: se espera a que cargue y se vuelve a leer una vez.
    await nav.esperar(1000);
    p = await instantanea(nav);
  }
  const descargas = nav.descargas?.() ?? [];
  const avisos = [
    p.captcha ? '⚠ Hay un CAPTCHA: no lo resuelvas tú; usa pedir_ayuda con motivo «captcha».' : '',
    p.contrasenas
      ? '⚠ Hay un campo de contraseña: el inicio de sesión lo hace la persona (pedir_ayuda, motivo «iniciar_sesion»).'
      : '',
  ].filter(Boolean);
  // De un campo solo se ve lo que ha escrito el agente, como lo escribió. Lo que trae la web (los
  // datos de la persona tras iniciar sesión, lo que ella escribe) queda como dato oculto.
  const campos = p.texto.replace(/⟦(\d+)⟧/g, (_m, i: string) => {
    const v = p.valores[Number(i)] ?? '';
    const propio = ctx.escritos.get(normalizarValor(v));
    if (propio !== undefined) return propio;
    const todos = todosLosDatos(ctx);
    const clave = claveDeDato(todos, 'dato', v);
    if (!esIdentificador(clave)) return v;
    if (!todos[clave]) ctx.datosTramite[clave] = v;
    return `{{${clave}}}`;
  });
  const texto = [
    aviso,
    ...descargas.map((d) => `⬇ Descargado «${d}»: ya está guardado en el trámite.`),
    `Página: ${sinParametros(p.url)}`,
    // El título lo escribe la web: es un dato más, como su texto.
    p.titulo ? `Título que pone la web: «${p.titulo}»` : '',
    ...avisos,
    '---',
    campos,
  ]
    .filter(Boolean)
    .join('\n');
  ctx.hostActual = host(p.url);
  return texto;
}

/**
 * Lo que sale del navegador del trámite, antes de llegar al modelo: los datos personales como
 * marcador, también las partes de un dato (el día de la fecha, el número del DNI sin la letra)
 * que se ven en un campo. Lo aplica `supervisar` a todas las herramientas de la página.
 */
export async function protegerPagina(ctx: Contexto, texto: string) {
  const limpio = ctx.privacidad.ocultarEnCampos(await proteger(ctx, texto, 'pagina'));
  return Privacidad.marcadores(limpio).length
    ? limpio.replace(
        '\n---\n',
        '\n(Los {{…}} de esta página son los datos reales de la persona, ocultos para ti: el campo está bien relleno.)\n---\n',
      )
    : limpio;
}

const formatoFuente = (f: Fuente, extracto: string) =>
  `[${f.id}] ${f.titulo} — ${host(f.url)}${f.organismo ? ` (${f.organismo})` : ''}${f.oficial ? '' : ' (sin verificar)'}\n${extracto}`;

export function crearHerramientas(ctx: Contexto) {
  const signalDe = (o: { abortSignal?: AbortSignal }) =>
    o.abortSignal ?? new AbortController().signal;
  const navegador = () => ctx.anfitrion.navegador();
  const resolver = (texto: string) => {
    const datos = new Privacidad(todosLosDatos(ctx)).resolver(texto);
    if (datos.faltan.length)
      return {
        error: `Faltan datos sin guardar: ${datos.faltan.join(', ')}. Pídelos con preguntar.`,
      };
    return { texto: datos.texto };
  };
  /**
   * Los datos de la persona (un marcador o un dato suyo escrito tal cual) solo se escriben en una
   * web oficial o en una en la que ella confía. `url` es la de la página o el marco que los
   * recibe, leída justo antes de escribir. Devuelve por qué no, o `null`.
   */
  const sinPermisoParaDatos = async (url: () => string, texto: string, signal: AbortSignal) => {
    ctx.privacidad.actualizar(todosLosDatos(ctx));
    if (!Privacidad.marcadores(texto).length && !ctx.privacidad.contieneDatos(texto)) return null;
    const antes = url();
    if (isOfficial(antes)) return null;
    const web = host(antes);
    if (!antes.startsWith('https://'))
      return `${web || 'Esta página'} no usa https: ahí no se escriben datos de la persona.`;
    if (!(await ctx.anfitrion.confiarEn(web, signal)))
      return `La persona no quiere que ${web} reciba sus datos: no se ha escrito nada. No lo intentes otra vez en esta web; díselo y, si el trámite es de una administración, busca su web oficial.`;
    // Mientras ella respondía, la página ha podido irse a otra web.
    return host(url()) === web ? null : 'La página ha cambiado de web. Vuelve a verla con ver.';
  };
  const ref = z
    .number()
    .int()
    .positive()
    .describe('Número del elemento entre corchetes en la página');
  /** Un paso vinculante necesita un código aprobado para esta misma web. */
  type Permiso = { ok: true; codigo?: string; accion?: string } | { ok: false; error: string };
  const codigoValido = (
    info: Pick<InfoElemento, 'nombre' | 'rol' | 'paginaConfirmacion' | 'incierto'>,
    codigo: string | undefined,
    url: string,
  ): Permiso => {
    if (!pareceIrreversible(info) && !codigo) return { ok: true };
    const aprobada = codigo ? ctx.confirmaciones.get(codigo) : undefined;
    if (!codigo || !aprobada)
      return {
        ok: false,
        error: `«${info.nombre}» parece enviar o confirmar algo. Antes llama a confirmar con un resumen de lo que se enviará y pasa aquí el código.`,
      };
    if (aprobada.host && aprobada.host !== host(url))
      return { ok: false, error: `Ese código se aprobó para ${aprobada.host}, no para esta web.` };
    return { ok: true, codigo, accion: aprobada.accion };
  };
  /**
   * Diálogo de la web que abrió una acción ya aprobada con código (el «¿Seguro que quiere
   * enviarla?» tras pulsar «Enviar»): aceptarlo no necesita otro código.
   */
  let dialogoAprobado: number | null = null;
  /** Se gasta el código y se apunta la acción solo cuando de verdad se ha ejecutado. */
  const gastar = (v: Permiso) => {
    if (!v.ok || !v.codigo || !v.accion) return;
    ctx.vinculantes.push({ accion: v.accion, fecha: new Date().toISOString() });
    ctx.confirmaciones.delete(v.codigo);
  };
  /** Tras una acción aprobada, el diálogo que haya abierto queda cubierto por esa aprobación. */
  const cubrirDialogo = (v: Permiso, nav: Navegador) => {
    if (v.ok && v.codigo) dialogoAprobado = nav.dialogo?.()?.id ?? null;
  };
  // El modelo puede pedir varias acciones a la vez: en la página se hacen de una en una, en orden.
  let cola: Promise<unknown> = Promise.resolve();
  const enOrden =
    <A, R>(fn: (a: A, o: { abortSignal?: AbortSignal }) => Promise<R>) =>
    (a: A, o: { abortSignal?: AbortSignal }): Promise<R> => {
      // Lo que esperaba en la cola no se hace si el turno se ha parado mientras.
      const r = cola.then(() => {
        o.abortSignal?.throwIfAborted();
        return fn(a, o);
      });
      cola = r.catch(() => undefined);
      return r;
    };

  return {
    mis_datos: tool({
      description:
        'Qué datos de la persona hay guardados en «Mis datos». Los identificadores aparecen como marcadores {{clave}}: no conoces su valor, pero puedes escribirlos con escribir o elegir.',
      inputSchema: z.object({}),
      execute: async () => {
        const extra = Object.keys(ctx.datosTramite);
        return (
          perfilParaModelo(ctx.anfitrion.perfil()) +
          (extra.length
            ? `\nDatos de este trámite: ${extra.map((k) => `{{${k}}}`).join(', ')}`
            : '')
        );
      },
    }),

    buscar: tool({
      description:
        'Busca en la web, desde España. Devuelve fuentes con id (F1, F2…) y extractos; las que no están en la lista de webs oficiales de la app salen como (sin verificar). Para buscar solo en la web de un organismo, ayuntamiento o diputación, pasa su dominio en dominios.',
      inputSchema: z.object({
        consulta: z
          .string()
          .min(3)
          .max(300)
          .describe('Qué buscar, en español, sin datos personales'),
        dominios: z
          .array(z.string())
          .max(10)
          .optional()
          .describe('Solo estos dominios, p. ej. ["getafe.es", "comunidad.madrid"]'),
      }),
      execute: async ({ consulta, dominios }, opts) => {
        const limpia = ctx.privacidad.limpiar(consulta, { usuario: true });
        const validos = (dominios ?? [])
          .map(
            (d) =>
              d
                .trim()
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .split('/')[0]!,
          )
          .filter((d) => /^[\p{L}\d-]+(\.[\p{L}\d-]+)+$/u.test(d));
        const { resultados, costeUsd } = await buscarEnLaWeb(
          limpia,
          validos,
          ctx.proveedor,
          signalDe(opts),
        );
        if (costeUsd !== null) ctx.uso.costeUsd += costeUsd;
        const vistas = resultados.flatMap((r) => {
          const f = ctx.fuentes.añadir(r.url, r.titulo, 'busqueda');
          return f ? [formatoFuente(f, r.extracto.slice(0, 1400))] : [];
        });
        ctx.evento({ tipo: 'fuentes', fuentes: ctx.fuentes.lista() });
        return vistas.length
          ? vistas.join('\n\n') +
              '\n\nPara citar un dato necesitas su texto literal: si el extracto no basta, usa leer_pagina.'
          : 'Sin resultados. Prueba con otras palabras o con el dominio del organismo.';
      },
    }),

    leer_pagina: tool({
      description:
        'Lee el texto de una página o PDF (https). Queda como fuente citable. Usa desde para seguir leyendo.',
      inputSchema: z.object({ url: z.string(), desde: z.number().int().min(0).optional() }),
      execute: async ({ url, desde = 0 }, opts) => {
        const previa = ctx.fuentes.obtener(url);
        const destino = previa?.url ?? url;
        let p: { url: string; titulo: string; texto: string };
        try {
          p = await leerPagina(destino, signalDe(opts));
        } catch (e) {
          // Solo cuando una web oficial responde con un error HTTP (suele ser un filtro contra
          // programas): nunca si el dominio no es oficial o apunta a una red privada.
          if (
            !ctx.anfitrion.leerConNavegador ||
            !(e instanceof FetchError) ||
            !e.status ||
            !isOfficial(destino)
          )
            throw e;
          p = await ctx.anfitrion.leerConNavegador(destino, signalDe(opts));
          if (!isOfficial(p.url)) return `${host(p.url)} no es una web oficial.`;
        }
        const f = ctx.fuentes.añadir(p.url, p.titulo, 'pagina');
        if (!f) return `${host(p.url)} no usa https.`;
        ctx.evento({ tipo: 'fuentes', fuentes: ctx.fuentes.lista() });
        const trozo = p.texto.slice(desde, desde + 12000);
        const resto =
          p.texto.length > desde + 12000
            ? `\n… (sigue: leer_pagina con desde=${desde + 12000})`
            : '';
        return formatoFuente(f, trozo) + resto;
      },
    }),

    preguntar: tool({
      description:
        'Pide datos a la persona con un formulario. Usa las claves de «Mis datos» (nombre, documento_numero, telefono…) cuando correspondan: se guardan para otros trámites. No pidas contraseñas, PIN ni códigos. Un campo con solo_si solo se pregunta según otra respuesta. Las respuestas te llegan como marcador {{clave}}, salvo las de si_no, opcion, varias, numero y texto_largo con privado: false (varias llegan separadas por «; »).',
      inputSchema: formularioEntrada,
      execute: async (f, opts) => {
        if (
          f.campos.some((c) =>
            /contrase|password|\bpin\b|clave de acceso|codigo sms|código sms/i.test(c.etiqueta),
          )
        )
          return 'No pidas contraseñas, PIN ni códigos: los escribe la persona en la web oficial (pedir_ayuda).';
        // Esas claves son de datos ya encontrados: una respuesta las cambiaría por otra cosa.
        const ocupada = f.campos.find((c) => DETECTADO.test(c.clave));
        if (ocupada)
          return `La clave ${ocupada.clave} es de un dato ya encontrado ({{${ocupada.clave}}}). Usa otra, p. ej. nombre_hijo.`;
        // La condición apunta a otro campo con opciones, y a una de ellas tal cual.
        const malCondicionado = f.campos.find((c) => {
          if (!c.solo_si) return false;
          const de = f.campos.find((o) => o.clave === c.solo_si!.campo);
          const opciones = de?.tipo === 'si_no' ? ['Sí', 'No'] : (de?.opciones ?? []);
          return (
            !de ||
            !['opcion', 'varias', 'si_no'].includes(de.tipo) ||
            !opciones.includes(c.solo_si.valor)
          );
        });
        if (malCondicionado)
          return `solo_si de ${malCondicionado.clave} tiene que apuntar a otro campo del formulario de tipo opcion, varias o si_no, y a una de sus opciones tal cual (en si_no, «Sí» o «No»).`;
        const campos: CampoFormulario[] = f.campos.map((pedido) => {
          const perfil = campoPerfil(pedido.clave);
          // Un dato de contexto de «Mis datos» llega al modelo y se guarda en el perfil: se pregunta
          // como está en «Mis datos», para que su clave no sirva para pedir otra cosa.
          const c: CampoFormulario =
            perfil && !esIdentificador(perfil.clave)
              ? {
                  ...pedido,
                  etiqueta: perfil.etiqueta,
                  tipo: perfil.clave === 'provincia' ? 'provincia' : perfil.tipo,
                  opciones: perfil.opciones?.slice(),
                }
              : pedido;
          // La provincia es un desplegable con todas; la persona no tiene que escribirla.
          const tipo =
            perfil?.tipo === 'fecha' ? 'fecha' : c.tipo === 'provincia' ? 'opcion' : c.tipo;
          return {
            ...c,
            tipo,
            // El modelo solo lee lo que necesita para razonar: un sí o no, una de sus opciones, una
            // cantidad o una explicación (y estas, sin los datos que encuentre el detector). Un
            // identificador de «Mis datos», un nombre, una fecha o un número de documento le
            // llegan siempre como marcador, aunque pida verlos.
            // La provincia es un dato de contexto, como la de «Mis datos»: el modelo la necesita.
            privado:
              c.tipo !== 'provincia' &&
              esIdentificador(c.clave) &&
              !(
                !perfil &&
                c.privado === false &&
                ['si_no', 'opcion', 'varias', 'numero', 'texto_largo'].includes(tipo)
              ),
            opciones:
              c.tipo === 'provincia'
                ? Object.values(provincias).sort((a, b) => a.localeCompare(b, 'es'))
                : (c.opciones ?? perfil?.opciones?.slice()),
          };
        });
        const respuestas = await ctx.anfitrion.preguntar({ ...f, campos }, signalDe(opts));
        if (!respuestas)
          return 'La persona ha cerrado el formulario sin responder: no lo vuelvas a ofrecer en este turno.';
        const paraPerfil: Perfil = {};
        const lineas: string[] = [];
        for (const c of campos) {
          const bruto = respuestas[c.clave]?.trim();
          if (!bruto) {
            lineas.push(`- ${c.clave}: (sin respuesta)`);
            continue;
          }
          const valor = normalizarCampo(c.clave, bruto);
          if (campoPerfil(c.clave)) {
            const error = validarCampo(c.clave, valor);
            if (error) {
              lineas.push(`- ${c.clave}: no válido (${error})`);
              continue;
            }
            paraPerfil[c.clave] = valor;
          }
          // Un número largo (la Seguridad Social, una cuenta) tampoco se lee, aunque se pida.
          const privado = c.privado || (c.tipo === 'numero' && valor.replace(/\D/g, '').length > 3);
          if (privado && !campoPerfil(c.clave)) ctx.datosTramite[c.clave] = valor;
          lineas.push(
            privado
              ? `- ${c.clave}: {{${c.clave}}}${campoPerfil(c.clave) ? ' (guardado en Mis datos)' : ''}`
              : `- ${c.clave}: ${await proteger(ctx, valor, 'persona')}`,
          );
        }
        if (Object.keys(paraPerfil).length) await ctx.anfitrion.guardarPerfil(paraPerfil);
        ctx.privacidad.actualizar(todosLosDatos(ctx));
        return `Respuestas:\n${lineas.join('\n')}`;
      },
    }),

    confirmar: tool({
      description:
        'Pide permiso a la persona antes de algo vinculante o irreversible: enviar una solicitud, reservar o anular una cita, pagar o firmar. Resume exactamente qué se enviará y a quién. Si lo aprueba, recibes un código que debes pasar a pulsar en el botón final. Nunca repitas un envío ya hecho.',
      inputSchema: confirmacionEntrada,
      execute: async (c, opts) => {
        const previas = ctx.vinculantes.map((v) => v.accion);
        const aprobado = await ctx.anfitrion.confirmar(
          { ...c, sitio: ctx.hostActual ?? c.sitio, previas },
          signalDe(opts),
        );
        if (!aprobado) return 'La persona NO lo ha aprobado. No lo hagas. Pregúntale qué prefiere.';
        const codigo = 'C' + randomBytes(3).toString('hex').toUpperCase();
        ctx.confirmaciones.set(codigo, { accion: c.accion, host: ctx.hostActual });
        return (
          `Aprobado. Código de confirmación: ${codigo}. Pásalo en pulsar al botón que lo ejecuta; sirve una sola vez.` +
          (previas.length
            ? ` Ojo: en este trámite ya se hizo «${previas.join('», «')}». No lo repitas.`
            : '')
        );
      },
    }),

    pedir_ayuda: tool({
      description:
        'Cede el navegador a la persona para lo que solo puede hacer ella: iniciar sesión (Cl@ve, certificado, DNIe), resolver un CAPTCHA, firmar con AutoFirma, pagar o adjuntar archivos. Espera a que termine y devuelve la página.',
      inputSchema: ayudaEntrada,
      execute: enOrden(async (a, opts) => {
        const r = await ctx.anfitrion.pedirAyuda(a, signalDe(opts));
        const nav = await navegador();
        const nota = r.nota ? ` Nota: ${await proteger(ctx, r.nota, 'persona')}` : '';
        return verPagina(
          ctx,
          nav,
          r.hecho
            ? `La persona dice que ya está.${nota}`
            : `La persona no ha podido hacerlo.${nota}`,
        );
      }),
    }),

    abrir: tool({
      description:
        'Abre una URL en el navegador del trámite y devuelve la página con sus elementos numerados.',
      inputSchema: z.object({ url: z.string() }),
      execute: enOrden(async ({ url }) => {
        if (!URL.canParse(url) || new URL(url).protocol !== 'https:')
          return 'URL no válida: solo se abren webs https.';
        const nav = await navegador();
        await nav.abrir(url);
        return verPagina(ctx, nav);
      }),
    }),

    ver: tool({
      description: 'Vuelve a leer la página actual del navegador.',
      inputSchema: z.object({}),
      execute: enOrden(async () => verPagina(ctx, await navegador())),
    }),

    leer_texto: tool({
      description:
        'Texto completo de la página del navegador (sin elementos), por trozos. Si es una web oficial, queda como fuente citable.',
      inputSchema: z.object({ desde: z.number().int().min(0).optional() }),
      execute: enOrden(async ({ desde = 0 }) => {
        const nav = await navegador();
        const { texto, total, titulo } = await leerTextoPagina(nav, desde, 10000);
        ctx.privacidad.actualizar(todosLosDatos(ctx));
        // Una página oficial sin datos de la persona también sirve como fuente citable. Sin
        // parámetros: pueden ser de la sesión o de la persona, y leer_pagina la volvería a leer.
        let cabecera = '';
        if (
          isOfficial(nav.url()) &&
          !URL.parse(nav.url())?.search &&
          !desde &&
          !ctx.privacidad.contieneDatos(texto)
        ) {
          const f = ctx.fuentes.añadir(nav.url(), titulo, 'pagina');
          if (f) {
            cabecera = `[${f.id}] ${f.titulo} — ${host(f.url)} (fuente citable)\n`;
            ctx.evento({ tipo: 'fuentes', fuentes: ctx.fuentes.lista() });
          }
        }
        return (
          cabecera + texto + (total > desde + 10000 ? `\n… (sigue con desde=${desde + 10000})` : '')
        );
      }),
    }),

    pulsar: tool({
      description:
        'Pulsa un botón, enlace u opción. Los botones que envían, confirman, reservan, pagan o firman necesitan el código de confirmar.',
      inputSchema: z.object({ ref, confirmacion: z.string().optional() }),
      execute: enOrden(async ({ ref: r, confirmacion }) => {
        const nav = await navegador();
        const info = await infoElemento(nav, r);
        if (!info) return 'Ese elemento ya no está en la página. Vuelve a verla con ver.';
        if (info.desactivado)
          return `«${info.nombre}» está desactivado. Revisa si falta algún dato.`;
        const v = codigoValido(info, confirmacion, nav.url());
        if (!v.ok) return v.error;
        const p = await puntoElemento(nav, r);
        if (!p || p.invisible) return 'No puedo pulsarlo: no está visible.';
        if (p.tapado)
          return `«${info.nombre}» está tapado por otro elemento (¿un aviso de cookies o una ventana?). Ciérralo primero.`;
        await nav.clic(p.x, p.y);
        gastar(v);
        await nav.esperar();
        cubrirDialogo(v, nav);
        return verPagina(ctx, nav, `Pulsado «${info.nombre}».`);
      }),
    }),

    escribir: tool({
      description:
        'Escribe en un campo de texto, sustituyendo lo que tenga. Para datos de la persona usa marcadores: {{documento_numero}}, {{nombre}}, {{fecha_nacimiento}} (dd/mm/aaaa), {{fecha_nacimiento:iso}}, {{fecha_nacimiento:dia}}/:mes/:anio, {{documento_numero:numero}} y :letra. Para enviar el formulario, pulsa su botón.',
      inputSchema: z.object({ ref, texto: z.string().max(2000) }),
      execute: enOrden(async ({ ref: r, texto }, o) => {
        const nav = await navegador();
        const info = await infoElemento(nav, r);
        if (!info) return 'Ese elemento ya no está en la página. Vuelve a verla con ver.';
        if (info.contrasena)
          return 'Las contraseñas las escribe la persona: usa pedir_ayuda con motivo «iniciar_sesion».';
        if (info.rol !== 'textbox')
          return `«${info.nombre}» no es un campo de texto (${info.rol || info.tag}). Usa elegir, marcar o pulsar.`;
        const resuelto = resolver(texto);
        if ('error' in resuelto) return resuelto.error;
        const p = await puntoElemento(nav, r);
        if (p && !p.invisible && !p.tapado) await nav.clic(p.x, p.y);
        if (!(await enfocarElemento(nav, r))) return 'No puedo escribir en ese campo.';
        const sinPermiso = await sinPermisoParaDatos(() => nav.url(), texto, signalDe(o));
        if (sinPermiso) return sinPermiso;
        await nav.insertarTexto(resuelto.texto);
        ctx.escritos.set(normalizarValor(resuelto.texto), texto);
        const despues = await infoElemento(nav, r);
        // Nunca se repite aquí el valor del campo: podría contener datos de la persona.
        const aviso =
          despues && despues.valor !== resuelto.texto
            ? `Ojo: el campo no ha quedado igual que lo escrito (tiene ${despues.valor.length} caracteres en vez de ${resuelto.texto.length}; puede tener formato o un límite). Revisa la página.`
            : `Escrito en «${info.nombre}»${Privacidad.marcadores(texto).length ? ' (con el valor real de los marcadores)' : ''}.`;
        return verPagina(ctx, nav, aviso);
      }),
    }),

    elegir: tool({
      description:
        'Elige una opción de un desplegable por su texto (admite marcadores de «Mis datos»).',
      inputSchema: z.object({ ref, opcion: z.string().max(200) }),
      execute: enOrden(async ({ ref: r, opcion }, o) => {
        const nav = await navegador();
        const resuelto = resolver(opcion);
        if ('error' in resuelto) return resuelto.error;
        const sinPermiso = await sinPermisoParaDatos(() => nav.url(), opcion, signalDe(o));
        if (sinPermiso) return sinPermiso;
        // Con marcadores, el modelo solo ve el marcador, nunca la opción resuelta.
        const conMarcas = Privacidad.marcadores(opcion).length > 0;
        const res = await elegirOpcion(nav, r, resuelto.texto);
        if (!res.ok)
          return conMarcas
            ? `Ese desplegable no tiene ninguna opción para ${opcion}.`
            : (res.error ?? 'No se ha podido elegir.');
        await nav.esperar();
        return verPagina(ctx, nav, `Elegido «${conMarcas ? opcion : res.elegida}».`);
      }),
    }),

    marcar: tool({
      description: 'Marca o desmarca una casilla, o elige una opción de un grupo (radio).',
      inputSchema: z.object({ ref, marcado: z.boolean().default(true) }),
      execute: enOrden(async ({ ref: r, marcado }) => {
        const nav = await navegador();
        const info = await infoElemento(nav, r);
        if (!info) return 'Ese elemento ya no está en la página. Vuelve a verla con ver.';
        if (info.marcado === null) return `«${info.nombre}» no es una casilla ni una opción.`;
        if (info.marcado !== marcado) {
          const p = await puntoElemento(nav, r);
          if (!p || p.invisible || p.tapado)
            return 'No puedo pulsarla: no está visible o la tapa otro elemento.';
          await nav.clic(p.x, p.y);
          await nav.esperar(800);
        }
        return verPagina(ctx, nav);
      }),
    }),

    tecla: tool({
      description:
        'Pulsa una tecla en el elemento con el foco. Si Intro o Espacio envían un formulario vinculante, necesitan el código de confirmar.',
      inputSchema: z.object({
        tecla: z.enum(['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'Backspace', 'Space']),
        confirmacion: z.string().optional(),
      }),
      execute: enOrden(async ({ tecla, confirmacion }) => {
        const nav = await navegador();
        let v: Permiso = { ok: true };
        if (tecla === 'Enter' || tecla === 'Space') {
          const destino = await destinoDeTecla(nav);
          if (destino) v = codigoValido(destino, confirmacion, nav.url());
          if (!v.ok) return v.error;
        }
        await nav.tecla(tecla);
        gastar(v);
        await nav.esperar();
        cubrirDialogo(v, nav);
        return verPagina(ctx, nav);
      }),
    }),

    volver: tool({
      description: 'Vuelve a la página anterior del navegador.',
      inputSchema: z.object({}),
      execute: enOrden(async () => {
        const nav = await navegador();
        await nav.atras();
        return verPagina(ctx, nav);
      }),
    }),

    esperar: tool({
      description:
        'Espera a que la página cambie: unos segundos, o hasta que aparezca o desaparezca un texto (como mucho 60 s). Úsalo con las redirecciones de Cl@ve o las webs que tardan en cargar.',
      inputSchema: z.object({
        segundos: z
          .number()
          .min(1)
          .max(60)
          .optional()
          .describe('Cuánto esperar como mucho (por defecto 5, o 30 si esperas un texto)'),
        aparece: z
          .string()
          .min(2)
          .max(200)
          .optional()
          .describe('Esperar hasta que la página muestre este texto'),
        desaparece: z
          .string()
          .min(2)
          .max(200)
          .optional()
          .describe('Esperar hasta que la página deje de mostrar este texto, p. ej. «Cargando»'),
      }),
      execute: enOrden(async ({ segundos, aparece, desaparece }, o) => {
        const nav = await navegador();
        const buscado = aparece ?? desaparece;
        const limite = (segundos ?? (buscado ? 30 : 5)) * 1000;
        if (!buscado) {
          await dormir(limite, undefined, o.abortSignal ? { signal: o.abortSignal } : {});
          return verPagina(ctx, nav);
        }
        // Se busca el texto real: si el modelo escribe un marcador, el valor que se ve en la página.
        const resuelto = resolver(buscado);
        if ('error' in resuelto) return resuelto.error;
        // Buscar un dato oculto revela si la web lo muestra, y cuándo: pide el mismo permiso que
        // escribirlo y se deja de buscar si la página se va a otra web.
        const sinPermiso = await sinPermisoParaDatos(() => nav.url(), buscado, signalDe(o));
        if (sinPermiso) return sinPermiso;
        const web = Privacidad.marcadores(buscado).length ? host(nav.url()) : undefined;
        const enLaWeb = () => web === undefined || host(nav.url()) === web;
        const objetivo = comparable(resuelto.texto);
        const inicio = Date.now();
        let cumplido = false;
        while (!cumplido && Date.now() - inicio < limite && !nav.dialogo?.() && enLaWeb()) {
          const t = await leerTextoPagina(nav, 0, 1_000_000).catch(() => null);
          cumplido =
            t !== null && enLaWeb() && comparable(t.texto).includes(objetivo) === Boolean(aparece);
          if (!cumplido)
            await dormir(500, undefined, o.abortSignal ? { signal: o.abortSignal } : {});
        }
        const s = Math.round((Date.now() - inicio) / 1000);
        return verPagina(
          ctx,
          nav,
          cumplido
            ? `${aparece ? 'Ha aparecido' : 'Ya no se ve'} «${buscado}» (${s} s).`
            : `Tras ${s} s, ${aparece ? 'no ha aparecido' : 'sigue viéndose'} «${buscado}».`,
        );
      }),
    }),

    responder_dialogo: tool({
      description:
        'Responde al diálogo que ha abierto la web (alert, confirm o prompt). Aceptar un confirm o un prompt necesita el código de confirmar, salvo que lo haya abierto el botón que ya lo usó; un alert solo se cierra.',
      inputSchema: z.object({
        aceptar: z.boolean(),
        texto: z
          .string()
          .max(500)
          .optional()
          .describe('En un prompt, lo que se escribe (admite marcadores)'),
        confirmacion: z.string().optional(),
      }),
      execute: enOrden(async ({ aceptar, texto, confirmacion }, o) => {
        const nav = await navegador();
        const d = nav.dialogo?.();
        if (!d || !nav.responderDialogo)
          return verPagina(ctx, nav, 'No hay ningún diálogo abierto.');
        // Un «¿Seguro?» no dice siempre qué confirma: aceptarlo pide siempre el código, salvo
        // que lo haya abierto el botón aprobado. Un aviso (alert) solo se cierra.
        let v: Permiso = { ok: true };
        if (
          aceptar &&
          d.tipo !== 'alert' &&
          d.tipo !== 'beforeunload' &&
          d.id !== dialogoAprobado
        ) {
          const aprobada = confirmacion ? ctx.confirmaciones.get(confirmacion) : undefined;
          if (!confirmacion || !aprobada)
            return `Aceptar «${d.mensaje}» puede enviar o confirmar algo. Antes llama a confirmar con lo que se enviará y pasa aquí el código, o cancélalo.`;
          if (aprobada.host && aprobada.host !== host(nav.url()))
            return `Ese código se aprobó para ${aprobada.host}, no para esta web.`;
          v = { ok: true, codigo: confirmacion, accion: aprobada.accion };
        }
        const resuelto = texto ? resolver(texto) : { texto: undefined };
        if ('error' in resuelto) return resuelto.error;
        // El texto lo recibe el marco que abrió el diálogo, que puede ser de otra web.
        const sinPermiso =
          aceptar && texto
            ? await sinPermisoParaDatos(() => d.origen ?? nav.url(), texto, signalDe(o))
            : null;
        if (sinPermiso) return sinPermiso;
        await nav.responderDialogo(aceptar, resuelto.texto);
        gastar(v);
        await nav.esperar();
        cubrirDialogo(v, nav);
        return verPagina(ctx, nav, aceptar ? 'Diálogo aceptado.' : 'Diálogo cancelado.');
      }),
    }),

    llamar: tool({
      description:
        'Cuando el trámite solo se puede hacer o aclarar por teléfono: la persona llama con tu guía (qué conseguir, qué preguntar, qué tener a mano) y te cuenta lo que le han dicho. El teléfono tiene que salir de una web oficial que hayas leído.',
      inputSchema: llamadaEntrada,
      execute: async (l, opts) => {
        if (!ctx.anfitrion.pedirLlamada)
          return 'Aquí no se puede pedir una llamada: explica en el chat a qué teléfono llamar y qué preguntar.';
        if (tarificacionAdicional(l.telefono))
          return `${l.telefono} es de tarificación adicional (803, 806, 807, 905, 118…): no lo propongas. Busca en la web oficial su teléfono gratuito o de tarifa normal.`;
        const r = await ctx.anfitrion.pedirLlamada(l, signalDe(opts));
        const notas = r.notas?.trim() ? await proteger(ctx, r.notas, 'persona') : '';
        if (!r.hecho)
          return `La persona no ha llamado o no ha podido hablar con nadie.${notas ? ` Dice: ${notas}` : ''}`;
        return `La persona ha llamado. ${notas ? `Lo que le han dicho, según sus notas: ${notas}` : 'No ha apuntado nada: pregúntale qué le han dicho si lo necesitas.'}`;
      },
    }),

    buscar_ley: tool({
      description:
        'Busca normas estatales (leyes, reales decretos, órdenes) en la legislación consolidada del BOE por palabras de su título. Úsalo para comprobar qué dice la norma de un trámite (plazos, requisitos, quién puede hacerlo); para leer una, usa leer_pagina con su id.',
      inputSchema: z.object({
        palabras: z
          .array(z.string().min(2).max(60))
          .min(1)
          .max(6)
          .describe(
            'Palabras o expresiones que tiene que llevar el título, p. ej. ["régimen local"] o ["extranjería", "reglamento"]',
          ),
        derogadas: z
          .boolean()
          .optional()
          .describe('true para incluir también las normas que ya no están vigentes'),
      }),
      execute: async ({ palabras, derogadas }, opts) => {
        const normas = await buscarEnElBoe(
          palabras.map((p) => ctx.privacidad.limpiar(p, { usuario: true })),
          !derogadas,
          signalDe(opts),
        );
        if (!normas.length)
          return 'El BOE no tiene ninguna norma con esas palabras en el título. Prueba con menos palabras o con otras.';
        const vistas = normas.flatMap((n) => {
          const f = ctx.fuentes.añadir(n.url, n.titulo, 'busqueda');
          return f
            ? [
                `[${f.id}] ${n.titulo}${n.rango ? ` — ${n.rango}` : ''}${n.publicada ? `, publicada el ${n.publicada}` : ''}${n.vigente ? '' : ' (ya no está vigente)'}`,
              ]
            : [];
        });
        ctx.evento({ tipo: 'fuentes', fuentes: ctx.fuentes.lista() });
        return vistas.join('\n');
      },
    }),
  };
}
