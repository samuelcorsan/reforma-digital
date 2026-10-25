/**
 * Contrato entre el proceso principal, el preload y la interfaz. Tipos, y el esquema de los ajustes
 * que valida el proceso principal (la interfaz solo importa tipos, así que zod no entra en ella).
 */
import { z } from 'zod';
import type {
  Ayuda,
  CampoPerfil,
  Confirmacion,
  Formulario,
  Fuente,
  Llamada,
} from '@reforma-digital/agent';

export type { Ayuda, CampoPerfil, Confirmacion, Formulario, Fuente, Llamada };

export type Razonamiento = 'low' | 'medium' | 'high';

/**
 * Servidor de otro proveedor: https o, para un modelo que corre en el propio ordenador (Ollama,
 * LM Studio), http en esta máquina.
 */
export const urlProveedor = z
  .string()
  .trim()
  .max(300)
  .refine((u) => {
    const url = URL.parse(u);
    if (!url || url.username || url.password) return false;
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    );
  }, 'Usa una dirección https, o http solo en este ordenador (localhost).')
  .transform((u) => u.replace(/\/+$/, ''));

export const ajustesEsquema = z.object({
  /** Pedir Touch ID antes de aprobar envíos, pagos y firmas. */
  touchIdEnConfirmaciones: z.boolean(),
  /** Borrar las sesiones de las webs (cookies, inicios de sesión) al cerrar la app. */
  cerrarSesiones: z.boolean(),
  /** Enviar estadísticas de uso anónimas: qué acciones se hacen, sin su contenido. */
  estadisticas: z.boolean(),
  /** El proveedor de IA: el de Reforma Digital, a través de su servidor (por defecto), u otro. */
  proveedor: z.enum(['app', 'propio']),
  /** El otro proveedor: un servidor compatible con la API de OpenAI y su modelo. Sus claves van aparte. */
  proveedorPropio: z
    .object({ url: urlProveedor, modelo: z.string().trim().min(1).max(200) })
    .nullable(),
});
export type Ajustes = z.infer<typeof ajustesEsquema>;

export type Pregunta =
  | { tipo: 'formulario'; formulario: Formulario }
  | { tipo: 'confirmacion'; confirmacion: Confirmacion }
  | { tipo: 'ayuda'; ayuda: Ayuda }
  | { tipo: 'llamada'; llamada: Llamada }
  /** Si una web que no es oficial puede recibir sus datos. */
  | { tipo: 'confianza'; web: string };

export type ItemConversacion =
  | {
      tipo: 'usuario';
      id: string;
      texto: string;
      protegidos: number;
      /** Lo mandó mientras el asistente trabajaba, para redirigirlo. */
      redirigido?: boolean;
      /** Cuántos mensajes tenía el asistente antes de este: para volver atrás. */
      mensajes?: number;
    }
  | { tipo: 'asistente'; id: string; texto: string }
  | {
      tipo: 'actividad';
      id: string;
      herramienta: string;
      resumen: string;
      estado: 'inicio' | 'fin' | 'error';
      detalle?: string;
      /** Desde cuándo trabajaba el asistente en lo que llevó a esta acción, y cuándo terminó (ISO). */
      desde?: string;
      hasta?: string;
      /** Las webs consultadas por esta acción, incluidas las revisitadas. */
      fuentes?: string[];
    }
  | {
      tipo: 'pregunta';
      id: string;
      pregunta: Pregunta;
      estado: 'pendiente' | 'respondida' | 'cancelada';
      /** Resumen sin valores, para el historial: «Respondido», «Aprobado», «No aprobado». */
      resultado?: string;
    }
  | {
      tipo: 'aviso';
      id: string;
      tono: 'info' | 'error';
      texto: string;
      continuar?: boolean;
      /** Documento descargado al que lleva el aviso. */
      archivo?: string;
    };

export type EstadoEjecucion = 'inactivo' | 'trabajando' | 'esperando';

export type Descarga = { nombre: string; ruta: string };

export type ResumenTramite = {
  id: string;
  titulo: string;
  ejecucion: EstadoEjecucion;
  /**
   * `oferta`: espera a que la persona diga si el asistente lo hace por ella; `terminado`: acabó
   * con una respuesta.
   */
  aviso: 'oferta' | 'terminado' | null;
  fijado: boolean;
  razonamiento: Razonamiento;
  actualizado: string;
  costeUsd: number;
};

export type TramiteVista = ResumenTramite & {
  fuentes: Fuente[];
  conversacion: ItemConversacion[];
  /** Lo escrito mientras trabaja, que sale cuando termine. */
  cola: { id: string; texto: string }[];
  navegador: { url: string; puedeVolver: boolean } | null;
};

export type DatoPerfil = { clave: string; guardado: boolean; vista: string };

export type EstadoApp = {
  version: string;
  ajustes: Ajustes;
  tramites: ResumenTramite[];
  campos: readonly CampoPerfil[];
  perfil: DatoPerfil[];
  touchId: boolean;
  plataforma: NodeJS.Platform;
  /** La app sin empaquetar: muestra datos para desarrollar, como el gasto. */
  desarrollo: boolean;
  /** Avisos que salen de Mis datos, p. ej. un DNI a punto de caducar. */
  recordatorios: { texto: string; sugerencia: string }[];
  /** Qué claves del otro proveedor hay guardadas (nunca su valor). */
  clavesPropias: { proveedor: boolean; exa: boolean };
  /** Webs que no son oficiales en las que la persona confía para recibir sus datos (hosts). */
  websConfiadas: string[];
};

export type Rect = { x: number; y: number; width: number; height: number };

export type EventoApp =
  | { tipo: 'estado'; estado: EstadoApp }
  | { tipo: 'tramite'; vista: TramiteVista }
  /** Atajos del menú de la app. */
  | { tipo: 'menu'; vista: 'inicio' | 'datos' | 'ajustes' };

/** Lo que el preload expone en `window.rd`. */
export type ApiRd = {
  estado(): Promise<EstadoApp>;
  guardarAjustes(a: Partial<Ajustes>): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Prueba el modelo con retención cero, que es lo que más proveedores puede descartar. */
  /**
   * Prueba el otro proveedor y, si responde, lo guarda y lo usa. Sin clave, sirve la guardada solo
   * si el servidor es el mismo al que se dio.
   */
  guardarProveedorPropio(p: {
    url: string;
    modelo: string;
    clave?: string;
    claveExa?: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Los modelos que ofrece un servidor compatible con OpenAI, si los lista. */
  modelosDelProveedor(p: { url: string; clave?: string }): Promise<string[]>;
  crearTramite(texto: string, razonamiento: Razonamiento): Promise<string>;
  /** Fija el trámite arriba de la lista o cambia cuánto piensa el asistente en él. */
  ajustarTramite(
    id: string,
    cambios: { fijado?: boolean; razonamiento?: Razonamiento },
  ): Promise<void>;
  verTramite(id: string): Promise<TramiteVista | null>;
  /** Si el asistente trabaja, el mensaje espera en la cola. */
  enviar(id: string, texto: string): Promise<void>;
  quitarDeCola(id: string, mensaje: string): Promise<void>;
  redirigir(id: string, mensaje: string): Promise<void>;
  volver(id: string, mensaje: string): Promise<void>;
  detener(id: string): Promise<void>;
  borrarTramite(id: string): Promise<void>;
  responder(
    id: string,
    preguntaId: string,
    respuesta: Record<string, string> | boolean | null,
  ): Promise<boolean>;
  /** `null` oculta el navegador del trámite. */
  colocarNavegador(id: string, rect: Rect | null): Promise<void>;
  navegar(id: string, accion: 'atras' | 'recargar'): Promise<void>;
  /** Abre una web en el navegador del trámite. */
  abrirEnTramite(id: string, url: string): Promise<void>;
  revelarPerfil(): Promise<Record<string, string> | null>;
  guardarPerfil(valores: Record<string, string>): Promise<Record<string, string>>;
  borrarDatos(que: 'perfil' | 'todo'): Promise<void>;
  dejarDeConfiar(web: string): Promise<void>;
  abrirEnlace(url: string): Promise<void>;
  mostrarArchivo(ruta: string): Promise<void>;
  on(listener: (e: EventoApp) => void): () => void;
};
