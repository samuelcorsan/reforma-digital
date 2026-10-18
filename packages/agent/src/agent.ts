import {
  RetryError,
  streamText,
  type LanguageModelMiddleware,
  type ModelMessage,
  type ToolCallPart,
  type ToolResultPart,
  type ToolSet,
} from 'ai';
import { ErrorDeProteccion, type Detector } from './detector';
import { guardaPrivacidad, type Proveedor } from './models';
import { Privacidad, type Perfil } from './profile';
import { contextoDelTurno, INSTRUCCIONES } from './prompt';
import { Fuentes, type Fuente } from './research';
import {
  crearHerramientas,
  proteger,
  protegerPagina,
  usoVacio,
  type Anfitrion,
  type Contexto,
  type EventoAgente,
  type Uso,
} from './tools';

/** Todo lo que se guarda de un trámite entre turnos. */
export type EstadoAgente = {
  /** Sale del primer mensaje, ya sin datos personales. */
  titulo: string;
  fuentes: Fuente[];
  datosTramite: Perfil;
  vinculantes: { accion: string; fecha: string }[];
  mensajes: ModelMessage[];
  uso: Uso;
};

export const estadoInicial = (titulo = ''): EstadoAgente => ({
  titulo,
  fuentes: [],
  datosTramite: {},
  vinculantes: [],
  mensajes: [],
  uso: usoVacio(),
});

export type Limites = { pasos: number; costeUsd: number };
export const LIMITES: Limites = { pasos: 40, costeUsd: 0.5 };

export type FinTurno = 'respondido' | 'limite_pasos' | 'limite_coste' | 'cancelado' | 'error';

const HERRAMIENTAS_DE_PAGINA = new Set([
  'abrir',
  'ver',
  'pulsar',
  'escribir',
  'elegir',
  'marcar',
  'tecla',
  'volver',
  'esperar',
  'responder_dialogo',
  'pedir_ayuda',
]);

/**
 * Herramientas que esperan a la persona. No se ejecutan dentro del paso: su llamada se guarda
 * antes, así que, si se cierra la app mientras espera, el turno se retoma con la misma pregunta.
 */
const DE_LA_PERSONA = new Set(['preguntar', 'confirmar', 'pedir_ayuda', 'llamar']);

/** Llamadas de la última respuesta del modelo que aún no tienen resultado: esperan a la persona. */
export function pendientes(mensajes: ModelMessage[]): ToolCallPart[] {
  const i = mensajes.map((m) => m.role).lastIndexOf('assistant');
  const respuesta = mensajes[i];
  if (respuesta?.role !== 'assistant' || typeof respuesta.content === 'string') return [];
  const resueltas = new Set(
    mensajes
      .slice(i + 1)
      .flatMap((m) => (m.role === 'tool' ? m.content : []))
      .flatMap((p) => (p.type === 'tool-result' ? [p.toolCallId] : [])),
  );
  return respuesta.content.filter(
    (p): p is ToolCallPart => p.type === 'tool-call' && !resueltas.has(p.toolCallId),
  );
}

function anotar(mensajes: ModelMessage[], llamada: ToolCallPart, salida: unknown) {
  const parte: ToolResultPart = {
    type: 'tool-result',
    toolCallId: llamada.toolCallId,
    toolName: llamada.toolName,
    output: { type: 'text', value: typeof salida === 'string' ? salida : JSON.stringify(salida) },
  };
  const ultimo = mensajes.at(-1);
  if (ultimo?.role === 'tool') ultimo.content.push(parte);
  else mensajes.push({ role: 'tool', content: [parte] });
}

/** Deja sin respuesta lo que esperaba a la persona: ya no se retoma. */
export function sinResponder(
  mensajes: ModelMessage[],
  motivo = 'La persona detuvo al asistente sin responder.',
) {
  for (const llamada of pendientes(mensajes)) anotar(mensajes, llamada, motivo);
}

/** El final de una respuesta que ofrece hacer el trámite o pide algo a la persona. */
const OFRECE =
  /formulario|[?:]$|(puedo|podría) (ayudarte|hacerlo|pedir|solicitar|tramitar|reservar)|quieres que (te )?(lo |la )?(haga|ayude|pida|solicite|tramite|reserve)|te (ayudo|acompaño)/i;

/** Herramientas cuyo resultado sale de la página del trámite: pasan por el detector. */
const CON_DATOS = new Set([...HERRAMIENTAS_DE_PAGINA, 'leer_texto']);

/** Las URL de un texto sin sus parámetros, que pueden llevar datos de la sesión o de la persona. */
const urlsSinParametros = (t: string) =>
  t.replace(/(https?:\/\/[^\s?#'"]+)([?#][^\s'"]*)/g, (_, base: string, resto: string) =>
    resto.startsWith('?') ? `${base}?…` : base,
  );

type Salida = { type: string; value?: unknown };
const textoDeSalida = (o: Salida) =>
  typeof o.value === 'string' ? o.value : JSON.stringify(o.value ?? '');

/**
 * Reduce el contexto sin perder lo necesario: solo la última página del navegador va completa
 * (las anteriores quedan como su primera línea) y los resultados de investigación antiguos se
 * recortan, porque se pueden volver a leer con leer_pagina.
 */
export function compactar(mensajes: ModelMessage[]): ModelMessage[] {
  const resultados = mensajes.flatMap((m) =>
    m.role === 'tool' ? m.content.filter((p): p is ToolResultPart => p.type === 'tool-result') : [],
  );
  const ultimaPagina = resultados.filter((p) => HERRAMIENTAS_DE_PAGINA.has(p.toolName)).at(-1);
  const recientes = new Set(resultados.slice(-6));
  return mensajes.map((msg) =>
    msg.role !== 'tool'
      ? msg
      : {
          ...msg,
          content: msg.content.map((part) => {
            if (part.type !== 'tool-result') return part;
            const texto = textoDeSalida(part.output as Salida);
            let nuevo = texto;
            if (HERRAMIENTAS_DE_PAGINA.has(part.toolName) && part !== ultimaPagina) {
              const cabecera = texto.split('\n---\n')[0] ?? '';
              if (cabecera.length < texto.length)
                nuevo = `${cabecera}\n[página omitida: ya no es la actual]`;
            } else if (
              (part.toolName === 'buscar' || part.toolName === 'leer_pagina') &&
              !recientes.has(part) &&
              texto.length > 800
            )
              nuevo =
                texto.slice(0, 600) +
                '\n[recortado: vuelve a leerlo con leer_pagina si lo necesitas]';
            return nuevo === texto
              ? part
              : { ...part, output: { type: 'text' as const, value: nuevo } };
          }),
        },
  );
}

/**
 * Envuelve las herramientas para avisar a la interfaz y cortar repeticiones inútiles.
 * Una acción está atascada si las dos últimas veces que se pidió igual dieron el mismo resultado:
 * repetirla tras un cambio en la página (un aviso cerrado, un dato corregido) sí está permitido.
 * Si el detector falla, `cortar` para el turno: lo que no se ha podido proteger no sale.
 */
/**
 * Caracteres que no se ven: los de formato (ancho cero, control de dirección, las «etiquetas»
 * Unicode) y los que Unicode marca como ignorables (selectores de variante, rellenos Hangul…). Una
 * web puede esconder en ellos instrucciones o partir un DNI para que no se reconozca, así que no
 * llegan al modelo.
 */
export const sinInvisibles = (t: string) =>
  t.replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '');

function supervisar(tools: ToolSet, ctx: Contexto, cortar: (e: Error) => void): ToolSet {
  const historial: { clave: string; resultado: unknown }[] = [];
  return Object.fromEntries(
    Object.entries(tools).map(([nombre, t]) => [
      nombre,
      {
        ...t,
        execute: async (input: unknown, opts: Parameters<NonNullable<typeof t.execute>>[1]) => {
          const clave = nombre + JSON.stringify(input);
          const previas = historial.slice(-8).filter((h) => h.clave === clave);
          const atascada =
            previas.length >= 2 && previas.every((h) => h.resultado === previas[0]!.resultado);
          const id = opts.toolCallId;
          const resumen = resumir(nombre, input);
          if (atascada && nombre !== 'preguntar' && nombre !== 'confirmar') {
            ctx.evento({
              tipo: 'actividad',
              id,
              herramienta: nombre,
              resumen,
              estado: 'error',
              detalle: 'Acción repetida',
            });
            return 'Ya has hecho exactamente esto dos veces sin avanzar. Cambia de estrategia: lee el texto de la página, prueba otra ruta o pide ayuda a la persona.';
          }
          // Ningún resultado (tampoco un error) vuelve al modelo con un valor del perfil, venga de
          // donde venga, y lo que sale de la página del trámite pasa además por el detector.
          const proteger = async (texto: string) => {
            ctx.privacidad.actualizar({ ...ctx.anfitrion.perfil(), ...ctx.datosTramite });
            return CON_DATOS.has(nombre)
              ? protegerPagina(ctx, texto)
              : ctx.privacidad.limpiar(texto);
          };
          ctx.evento({ tipo: 'actividad', id, herramienta: nombre, resumen, estado: 'inicio' });
          try {
            const r: unknown = await t.execute!(input, opts);
            ctx.evento({ tipo: 'actividad', id, herramienta: nombre, resumen, estado: 'fin' });
            const texto = typeof r === 'string' ? sinInvisibles(r) : r;
            const resultado = typeof texto !== 'string' ? texto : await proteger(texto);
            historial.push({
              clave,
              resultado: typeof resultado === 'string' ? resultado : JSON.stringify(resultado),
            });
            return resultado;
          } catch (e) {
            if (e instanceof ErrorDeProteccion) {
              cortar(e);
              throw e;
            }
            // Un error de la página puede traer la URL a la que ha ido, con sus parámetros.
            const detalle = urlsSinParametros(e instanceof Error ? e.message : String(e));
            ctx.evento({
              tipo: 'actividad',
              id,
              herramienta: nombre,
              resumen,
              estado: 'error',
              detalle,
            });
            if (opts.abortSignal?.aborted) throw e;
            historial.push({ clave, resultado: detalle });
            try {
              return `Error: ${await proteger(sinInvisibles(detalle))}`;
            } catch (e2) {
              if (e2 instanceof ErrorDeProteccion) cortar(e2);
              throw e2;
            }
          }
        },
      },
    ]),
  );
}

/**
 * Lo que ve la persona en la lista de actividad. Nunca incluye valores de los campos ni lo que
 * busca el modelo.
 */
export function resumir(nombre: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const host = (u: unknown) => {
    try {
      return new URL(String(u)).hostname;
    } catch {
      return String(u);
    }
  };
  switch (nombre) {
    case 'buscar':
      return 'Buscando en webs oficiales';
    case 'leer_pagina':
      return `Leyendo ${host(i.url)}`;
    case 'abrir':
      return `Abriendo ${host(i.url)}`;
    case 'preguntar':
      return `Preguntándote: ${String(i.titulo)}`;
    case 'confirmar':
      return `Pidiendo tu permiso: ${String(i.accion)}`;
    case 'pedir_ayuda':
      return 'Esperando a que lo hagas tú en el navegador';
    case 'llamar':
      return 'Esperando a que llames';
    case 'buscar_ley':
      return 'Buscando la norma en el BOE';
    case 'responder_dialogo':
      return 'Respondiendo a un aviso de la web';
    case 'esperar':
      return 'Esperando a la página';
    case 'mis_datos':
      return 'Consultando Mis datos';
    case 'pulsar':
      return 'Pulsando en la página';
    case 'escribir':
      return 'Escribiendo en un campo';
    case 'elegir':
      return 'Eligiendo una opción';
    case 'marcar':
      return 'Marcando una casilla';
    default:
      return 'Revisando la página';
  }
}

export type OpcionesTurno = {
  /** Crea el proveedor con la guarda de privacidad del turno. */
  proveedor: (guarda: LanguageModelMiddleware) => Proveedor;
  anfitrion: Anfitrion;
  estado: EstadoAgente;
  /** Sin texto, el turno retoma lo que esperaba a la persona (al volver a abrir la app). */
  texto?: string;
  evento: (e: EventoAgente) => void;
  /** Detector local de datos personales. Sin él no se envía nada al modelo. */
  detector: Detector;
  /**
   * Lo que el agente ha escrito en el navegador del trámite. Lo guarda quien lleva el navegador,
   * para que en el turno siguiente siga viendo sus propios valores en los campos.
   */
  escritos?: Map<string, string>;
  /**
   * Lo que la persona escribe mientras trabaja para redirigirlo: entra antes del siguiente paso.
   * Si responde sin otro paso, lo que quede lo manda quien lleva el turno.
   */
  entrantes?: () => string[];
  /** Se llama tras cada paso para guardar el progreso. */
  guardar?: (estado: EstadoAgente) => void | Promise<void>;
  signal: AbortSignal;
  limites?: Limites;
  razonamiento?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
};

export type ResultadoTurno = { estado: EstadoAgente; fin: FinTurno; error?: string };

/**
 * Un turno del agente: el mensaje de la persona y todos los pasos (llamadas al modelo y
 * herramientas) hasta que responde, se cancela o llega a un límite. Sin mensaje, retoma las
 * llamadas que esperaban a la persona.
 */
export async function ejecutarTurno(o: OpcionesTurno): Promise<ResultadoTurno> {
  const limites = o.limites ?? LIMITES;
  const perfil = o.anfitrion.perfil();
  const privacidad = new Privacidad({ ...perfil, ...o.estado.datosTramite });
  let filtrados = 0;
  const proveedor = o.proveedor(
    guardaPrivacidad(privacidad, () => {
      filtrados++;
      o.evento({ tipo: 'privacidad', filtrados });
    }),
  );
  const estado: EstadoAgente = structuredClone(o.estado);
  const ctx: Contexto = {
    anfitrion: o.anfitrion,
    proveedor,
    fuentes: new Fuentes(estado.fuentes),
    privacidad,
    detector: o.detector,
    escritos: o.escritos ?? new Map(),
    datosTramite: estado.datosTramite,
    confirmaciones: new Map(),
    hostActual: null,
    vinculantes: estado.vinculantes,
    uso: estado.uso,
    evento: o.evento,
  };
  const interno = new AbortController();
  const signal = AbortSignal.any([o.signal, interno.signal]);
  const tools = supervisar(crearHerramientas(ctx), ctx, (e) => interno.abort(e));
  const enElPaso: ToolSet = Object.fromEntries(
    Object.entries(tools).map(([n, t]) => [
      n,
      DE_LA_PERSONA.has(n) ? { ...t, execute: undefined } : t,
    ]),
  );
  const sincronizar = () => {
    estado.fuentes = ctx.fuentes.lista();
  };
  const atenderPendientes = async () => {
    for (const llamada of pendientes(estado.mensajes)) {
      const t = tools[llamada.toolName];
      const salida: unknown = t?.execute
        ? await t.execute(llamada.input, {
            toolCallId: llamada.toolCallId,
            messages: estado.mensajes,
            abortSignal: signal,
            context: undefined,
          })
        : `Error: no existe la herramienta ${llamada.toolName}.`;
      anotar(estado.mensajes, llamada, salida);
      await o.guardar?.(estado);
    }
  };
  if (o.texto !== undefined)
    try {
      // Si escribe en vez de responder, lo que esperaba se queda sin respuesta.
      sinResponder(estado.mensajes);
      const mensaje = await proteger(ctx, o.texto, 'persona');
      o.evento({ tipo: 'protegidos', cantidad: Privacidad.marcadores(mensaje).length });
      // El título es la primera frase del primer mensaje, ya protegida: también se ve en las
      // notificaciones y nombra la carpeta de descargas. Se corta entre palabras, sin partir un marcador.
      estado.titulo ||= mensaje
        .replace(/\s+/g, ' ')
        .replace(/(?<=[.?!])\s.*$/, '')
        .replace(/^(.{0,60})(\s.*)?$/, '$1')
        .trim();
      estado.mensajes.push({
        role: 'user',
        content: `${contextoDelTurno(perfil)}\n\n${mensaje}`,
      });
    } catch (e) {
      return { estado: o.estado, fin: 'error', error: mensajeDeError(e) };
    }
  const costeInicial = estado.uso.costeUsd;
  const tokensIniciales = estado.uso.entrada + estado.uso.salida;
  // El modelo a veces termina ofreciendo hacer el trámite o pidiendo datos en el texto («Puedo
  // pedirte la cita; dime esto en el formulario:») sin llamar a preguntar, y la persona no ve
  // ningún formulario. Entonces tiene un paso más en el que solo puede llamar a preguntar.
  let forzarPregunta = false;
  try {
    for (let paso = 0; ; paso++) {
      await atenderPendientes();
      for (const t of o.entrantes?.() ?? []) {
        const mensaje = await proteger(ctx, t, 'persona');
        o.evento({ tipo: 'protegidos', cantidad: Privacidad.marcadores(mensaje).length });
        estado.mensajes.push({ role: 'user', content: mensaje });
      }
      if (paso >= limites.pasos) return { estado, fin: 'limite_pasos' };
      // Si el proveedor no informa del coste, se para por tokens (unos 2 millones en un turno).
      const tokens = estado.uso.entrada + estado.uso.salida - tokensIniciales;
      if (
        estado.uso.costeUsd - costeInicial >= limites.costeUsd ||
        (estado.uso.costeDesconocido && tokens > 2_000_000)
      )
        return { estado, fin: 'limite_coste' };
      const r = streamText({
        model: proveedor.modelo,
        instructions: INSTRUCCIONES,
        messages: compactar(estado.mensajes),
        tools: enElPaso,
        ...(forzarPregunta ? { toolChoice: { type: 'tool' as const, toolName: 'preguntar' } } : {}),
        abortSignal: signal,
        maxRetries: 2,
        timeout: { firstChunkMs: 120000, chunkMs: 90000 },
        ...(o.razonamiento ? { reasoning: o.razonamiento } : {}),
      });
      let texto = '';
      for await (const parte of r.fullStream) {
        if (parte.type === 'text-delta') {
          texto += parte.text;
          o.evento({ tipo: 'texto', delta: parte.text });
        }
        if (parte.type === 'error') throw parte.error;
      }
      const [mensajes, uso, fin] = await Promise.all([r.responseMessages, r.usage, r.finishReason]);
      estado.mensajes.push(...mensajes);
      estado.mensajes = compactar(estado.mensajes);
      estado.uso.entrada += uso.inputTokens ?? 0;
      estado.uso.salida += uso.outputTokens ?? 0;
      estado.uso.cache += uso.inputTokenDetails?.cacheReadTokens ?? 0;
      estado.uso.pasos++;
      // Los proveedores no informan del coste del modelo: el límite cuenta los tokens.
      estado.uso.costeDesconocido = true;
      sincronizar();
      o.evento({ tipo: 'uso', uso: { ...estado.uso } });
      await o.guardar?.(estado);
      if (fin === 'tool-calls') forzarPregunta = false;
      else if (!forzarPregunta && OFRECE.test(texto.trim().slice(-300))) forzarPregunta = true;
      else return { estado, fin: 'respondido' };
    }
  } catch (e) {
    sincronizar();
    if (o.signal.aborted) return { estado, fin: 'cancelado' };
    return { estado, fin: 'error', error: mensajeDeError(interno.signal.reason ?? e) };
  }
}

/** Errores del proveedor en palabras claras. */
export function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (e instanceof ErrorDeProteccion)
    return `${texto}. No se ha enviado nada al asistente. Vuelve a intentarlo; si sigue fallando, reinstala la app.`;
  // Tras los reintentos, el código HTTP está en el último error.
  const causa = RetryError.isInstance(e) ? e.lastError : e;
  const status = (causa as { statusCode?: number } | undefined)?.statusCode;
  if (/zero data retention|\bZDR\b/i.test(texto))
    return 'Tu cuenta del proveedor de IA no permite la retención cero de datos (en Vercel exige el plan Pro). Desactívala en Ajustes o cambia de plan.';
  if (status === 401 || /unauthori[sz]ed|invalid api key|user not found/i.test(texto))
    return 'El proveedor de IA no acepta la clave. Revísala en Ajustes.';
  if (status === 402 || /insufficient|credit|balance|quota/i.test(texto))
    return 'No queda saldo en el proveedor de IA. Recárgalo o cambia de proveedor en Ajustes.';
  if (status === 429)
    return 'El proveedor de IA está limitando las peticiones. Espera un poco y vuelve a intentarlo.';
  if (/fetch failed|ENOTFOUND|ECONNRESET|network/i.test(texto))
    return 'No hay conexión a internet.';
  return `El asistente ha tenido un problema: ${texto.slice(0, 200)}`;
}
