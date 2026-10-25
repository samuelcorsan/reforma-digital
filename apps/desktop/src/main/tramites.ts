import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { app, Notification, session, type BrowserWindow } from 'electron';
import {
  crearProveedor,
  ejecutarTurno,
  estadoInicial,
  MARCADOR,
  pendientes,
  sinResponder,
  type Anfitrion,
  type ConfigProveedor,
  type Detector,
  type EstadoAgente,
  type EventoAgente,
  type Perfil,
} from '@reforma-digital/agent';
import type {
  Descarga,
  EventoApp,
  ItemConversacion,
  Pregunta,
  Razonamiento,
  Rect,
  ResumenTramite,
  TramiteVista,
} from '../shared/api';
import type { Almacen } from './almacen';
import { leerConNavegador, NavegadorTramite, particion } from './navegador';

type Registro = {
  id: string;
  actualizado: string;
  estado: EstadoAgente;
  conversacion: ItemConversacion[];
  descargas: Descarga[];
  fijado?: boolean;
  /** Cuánto piensa el asistente en este trámite; lo elige la persona en el compositor. */
  razonamiento?: Razonamiento;
};

export type Entorno = {
  perfil(): Perfil;
  guardarPerfil(valores: Perfil): Promise<void>;
  /** Configuración del proveedor: el servidor de Reforma Digital u otro que haya elegido la persona. */
  proveedor(): ConfigProveedor;
  /** Touch ID para aprobar envíos; `true` si no está disponible o desactivado. */
  verificarIdentidad(motivo: string): Promise<boolean>;
  /** Detector local de datos personales; falla si el modelo no se puede cargar. */
  detector(): Promise<Detector>;
  /** Si la persona confía en que esa web, que no es oficial, reciba sus datos. */
  confiaEn(web: string): boolean;
  confiar(web: string): Promise<void>;
  /** Si las sesiones de las webs se guardan al cerrar la app. */
  sesionesGuardadas(): boolean;
  ventana(): BrowserWindow | null;
  emitir(e: EventoApp): void;
  alCambiarLista(): void;
};

/** Lo que queda en el historial de cada pregunta, sin valores. */
const RESULTADOS: Record<Pregunta['tipo'], [string, string]> = {
  formulario: ['Respondido', 'Sin responder'],
  confirmacion: ['Aprobado', 'No aprobado'],
  ayuda: ['Hecho', 'No has podido'],
  llamada: ['Has llamado', 'No has llamado'],
  confianza: ['Aprobado', 'No aprobado'],
};

/** Al cerrar la app, lo que espera a la persona sigue pendiente: se retoma al volver a abrirla. */
const CIERRE = new Error('La app se cierra');
/**
 * Si el asistente ofrece hacer el trámite y la persona escribe otra cosa, la oferta se cancela y su
 * mensaje va en un turno nuevo: el asistente decide si volver a ofrecerlo.
 */
const OTRO_MENSAJE = new Error('La persona escribe otra cosa');

type ItemActividad = Extract<ItemConversacion, { tipo: 'actividad' }>;

type Espera = {
  tramite: string;
  resolver: (respuesta: Record<string, string> | boolean | null) => void;
};

const archivo = (id: string) => `tramite-${id}.bin`;
const ahora = () => new Date().toISOString();
/** Para lo que se ve fuera de la app (notificaciones, carpeta de descargas): sin datos. */
const sinMarcadores = (t: string) => t.replace(MARCADOR, '…');

/**
 * La persona ve en la app los datos que el asistente solo conoce como marcador ({{nombre_1}});
 * los de «Mis datos» siguen ocultos tras Touch ID.
 */
const mostrar = (r: Registro) => (t: string) =>
  t.replace(MARCADOR, (m, clave: string) => r.estado.datosTramite[clave] ?? m);

/** Una copia de `valor` (datos JSON) con `fn` aplicada a cada texto. */
const textos = <T>(valor: T, fn: (t: string) => string): T =>
  JSON.parse(JSON.stringify(valor), (_k, v: unknown) => (typeof v === 'string' ? fn(v) : v));

export class Tramites {
  private registros = new Map<string, Registro>();
  private ejecuciones = new Map<string, AbortController>();
  private esperas = new Map<string, Espera>();
  private navegadores = new Map<string, NavegadorTramite>();
  /** Lo que el agente ha escrito en cada navegador; vive en memoria, como sus sesiones. */
  private escritos = new Map<string, Map<string, string>>();
  /** Las webs a las que la persona no ha querido dar sus datos en cada trámite: no se repregunta. */
  private desconfiadas = new Map<string, Set<string>>();
  private pendienteEmitir = new Set<string>();
  /** Última escritura de cada trámite: se encadenan para que una antigua no pise a otra nueva. */
  private escrituras = new Map<string, Promise<void>>();
  private temporizador: NodeJS.Timeout | null = null;
  /** Lo que la persona escribe mientras el asistente trabaja: sale al terminar, de uno en uno. */
  private colas = new Map<string, { id: string; texto: string }[]>();
  /** Lo que manda para redirigirlo: entra en el turno antes del siguiente paso. */
  private redirecciones = new Map<string, string[]>();

  constructor(
    private almacen: Almacen,
    private entorno: Entorno,
  ) {}

  async cargar() {
    for (const f of await this.almacen.lista('tramite-')) {
      const r = await this.almacen.leer<Registro>(f).catch(() => undefined);
      if (!r) continue;
      // Si esperaba a la persona cuando se cerró la app, el turno se retoma y vuelve a esperar su
      // respuesta, con la misma tarjeta.
      const config = pendientes(r.estado.mensajes).length ? this.entorno.proveedor() : null;
      if (!config) {
        // Si no, lo que esperaba respuesta ya no tiene a nadie esperando.
        r.conversacion = r.conversacion.map((i) =>
          i.tipo === 'pregunta' && i.estado === 'pendiente'
            ? { ...i, estado: 'cancelada', resultado: 'Se cerró la app' }
            : i,
        );
        // Un turno que no terminó (la app se cerró mientras trabajaba) se puede retomar.
        const ultimo = r.conversacion.at(-1);
        if (ultimo && ultimo.tipo !== 'asistente' && ultimo.tipo !== 'aviso')
          r.conversacion.push({
            tipo: 'aviso',
            id: randomUUID(),
            tono: 'info',
            texto:
              'La app se cerró mientras el asistente trabajaba. Pulsa «Continuar» para retomarlo donde lo dejó.',
            continuar: true,
          });
      }
      this.registros.set(r.id, r);
      if (config) this.iniciar(r, undefined, config);
    }
  }

  lista(): ResumenTramite[] {
    return [...this.registros.values()]
      .map((r) => this.resumen(r))
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  }

  private resumen(r: Registro): ResumenTramite {
    const esperando = [...this.esperas.values()].some((e) => e.tramite === r.id);
    const ejecucion = esperando
      ? 'esperando'
      : this.ejecuciones.has(r.id)
        ? 'trabajando'
        : 'inactivo';
    const ultimo = r.conversacion.at(-1);
    const oferta = r.conversacion.some(
      (i) =>
        i.tipo === 'pregunta' &&
        i.estado === 'pendiente' &&
        i.pregunta.tipo === 'formulario' &&
        Boolean(i.pregunta.formulario.accion),
    );
    return {
      id: r.id,
      titulo: mostrar(r)(r.estado.titulo || 'Nuevo trámite'),
      ejecucion,
      aviso:
        esperando && oferta
          ? 'oferta'
          : ejecucion === 'inactivo' && ultimo?.tipo === 'asistente'
            ? 'terminado'
            : null,
      fijado: Boolean(r.fijado),
      razonamiento: r.razonamiento ?? 'medium',
      actualizado: r.actualizado,
      costeUsd: r.estado.uso.costeUsd,
    };
  }

  vista(id: string): TramiteVista | null {
    const r = this.registros.get(id);
    if (!r) return null;
    const nav = this.navegadores.get(id);
    return {
      ...this.resumen(r),
      fuentes: r.estado.fuentes,
      conversacion: textos(r.conversacion, mostrar(r)),
      cola: this.colas.get(id) ?? [],
      navegador: nav
        ? {
            url: nav.url(),
            puedeVolver: nav.webContents.navigationHistory.canGoBack(),
          }
        : null,
    };
  }

  /** Agrupa los cambios rápidos (texto que llega a trozos) en un aviso cada 60 ms. */
  private cambio(id: string) {
    this.pendienteEmitir.add(id);
    if (this.temporizador) return;
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      for (const t of this.pendienteEmitir) {
        const v = this.vista(t);
        if (v) this.entorno.emitir({ tipo: 'tramite', vista: v });
      }
      this.pendienteEmitir.clear();
      this.entorno.alCambiarLista();
    }, 60);
  }

  private guardar(r: Registro) {
    r.actualizado = ahora();
    const escritura = (this.escrituras.get(r.id) ?? Promise.resolve())
      .catch(() => undefined)
      // Un turno que sigue después de borrar el trámite no debe volver a escribirlo en disco.
      .then(() =>
        this.registros.get(r.id) === r ? this.almacen.escribir(archivo(r.id), r) : undefined,
      );
    this.escrituras.set(r.id, escritura);
    return escritura;
  }

  async crear(texto: string, razonamiento: Razonamiento): Promise<string> {
    const id = randomUUID();
    // El título lo pone el asistente: el mensaje puede llevar datos personales y el título se ve
    // en las notificaciones y nombra la carpeta de descargas.
    const r: Registro = {
      id,
      actualizado: ahora(),
      estado: estadoInicial(),
      conversacion: [],
      descargas: [],
      razonamiento,
    };
    this.registros.set(id, r);
    await this.guardar(r);
    await this.enviar(id, texto);
    return id;
  }

  async enviar(id: string, texto: string) {
    const r = this.registros.get(id);
    if (!r) throw new Error('Trámite no encontrado');
    const ejecucion = this.ejecuciones.get(id);
    if (ejecucion) {
      const oferta = r.conversacion.some(
        (i) =>
          i.tipo === 'pregunta' &&
          this.esperas.has(i.id) &&
          i.pregunta.tipo === 'formulario' &&
          Boolean(i.pregunta.formulario.accion),
      );
      // Delante en la cola: al cancelar la oferta, es lo primero que sale.
      const mensaje = { id: randomUUID(), texto };
      const cola = this.colas.get(id) ?? [];
      this.colas.set(id, oferta ? [mensaje, ...cola] : [...cola, mensaje]);
      if (oferta) ejecucion.abort(OTRO_MENSAJE);
      this.cambio(id);
      return;
    }
    // Si escribe en vez de responder a una tarjeta que no se pudo retomar, se queda sin respuesta.
    for (const i of r.conversacion)
      if (i.tipo === 'pregunta' && i.estado === 'pendiente')
        Object.assign(i, { estado: 'cancelada', resultado: 'Sin responder' });
    r.conversacion.push({
      tipo: 'usuario',
      id: randomUUID(),
      texto,
      protegidos: 0,
      mensajes: r.estado.mensajes.length,
    });
    this.iniciar(r, texto, this.entorno.proveedor());
  }

  /** Pone a trabajar al asistente; sin texto, retoma lo que esperaba a la persona. */
  private iniciar(r: Registro, texto: string | undefined, config: ConfigProveedor) {
    const id = r.id;
    const control = new AbortController();
    this.ejecuciones.set(id, control);
    this.cambio(id);
    void this.ejecutar(r, texto, config, control)
      .catch(async (e: unknown) => {
        r.conversacion.push({
          tipo: 'aviso',
          id: randomUUID(),
          tono: 'error',
          texto: `No se ha podido guardar el trámite: ${e instanceof Error ? e.message : String(e)}`,
        });
        await this.guardar(r).catch(() => undefined);
      })
      .finally(() => {
        this.ejecuciones.delete(id);
        this.cambio(id);
        // Lo que quedó por mandar sale ahora, salvo si la persona lo ha detenido o se cierra la app:
        // entonces las redirecciones vuelven a la cola.
        const redirigidos = this.redirecciones.get(id) ?? [];
        this.redirecciones.delete(id);
        const cola = this.colas.get(id) ?? [];
        if (control.signal.aborted && control.signal.reason !== OTRO_MENSAJE)
          return void cola.unshift(...redirigidos.map((t) => ({ id: randomUUID(), texto: t })));
        const siguiente = redirigidos.length ? redirigidos.join('\n\n') : cola.shift()?.texto;
        if (siguiente && this.registros.has(id))
          this.enviar(id, siguiente).catch((e: unknown) => console.error(e));
      });
  }

  quitarDeCola(id: string, mensaje: string) {
    this.colas.set(
      id,
      (this.colas.get(id) ?? []).filter((m) => m.id !== mensaje),
    );
    this.cambio(id);
  }

  /**
   * Manda ya un mensaje de la cola: entra en el turno antes del siguiente paso del asistente. Si
   * estaba esperando una respuesta, la tarjeta se queda sin ella para que pueda seguir.
   */
  async redirigir(id: string, mensaje: string) {
    const m = this.colas.get(id)?.find((x) => x.id === mensaje);
    if (!m) return;
    this.quitarDeCola(id, mensaje);
    if (!this.ejecuciones.has(id)) return this.enviar(id, m.texto);
    this.redirecciones.set(id, [...(this.redirecciones.get(id) ?? []), m.texto]);
    for (const [pregunta, e] of this.esperas)
      if (e.tramite === id) await this.responder(id, pregunta, null);
  }

  /** Vuelve a antes de un mensaje de la persona: se borran él y lo que vino después. */
  async volver(id: string, mensaje: string) {
    const r = this.registros.get(id);
    if (!r || this.ejecuciones.has(id)) return;
    const i = r.conversacion.findIndex((x) => x.id === mensaje);
    const item = r.conversacion[i];
    if (item?.tipo !== 'usuario' || item.mensajes === undefined) return;
    if (!r.conversacion.slice(0, i).some((x) => x.tipo === 'usuario')) return;
    r.conversacion = r.conversacion.slice(0, i);
    r.estado.mensajes = r.estado.mensajes.slice(0, item.mensajes);
    await this.guardar(r);
    this.cambio(id);
  }

  private preguntar(r: Registro, pregunta: Pregunta, signal: AbortSignal) {
    // Al retomar el turno tras cerrar la app, la tarjeta ya está en la conversación.
    const previa = r.conversacion.find(
      (i): i is Extract<ItemConversacion, { tipo: 'pregunta' }> =>
        i.tipo === 'pregunta' && i.estado === 'pendiente' && !this.esperas.has(i.id),
    );
    const item = previa ?? {
      tipo: 'pregunta' as const,
      id: randomUUID(),
      pregunta,
      estado: 'pendiente' as const,
    };
    const id = item.id;
    if (!previa) {
      r.conversacion.push(item);
      this.avisar(r, pregunta);
    }
    this.cambio(r.id);
    return new Promise<Record<string, string> | boolean | null>((resolver, rechazar) => {
      const terminar = () => {
        this.esperas.delete(id);
        this.actualizarInsignia();
      };
      this.esperas.set(id, {
        tramite: r.id,
        resolver: (v) => {
          terminar();
          resolver(v);
        },
      });
      this.actualizarInsignia();
      signal.addEventListener(
        'abort',
        () => {
          if (!this.esperas.has(id)) return;
          terminar();
          if (signal.reason !== CIERRE)
            Object.assign(item, { estado: 'cancelada', resultado: 'Cancelada' });
          rechazar(signal.reason);
        },
        { once: true },
      );
    });
  }

  /** La respuesta de la persona a una pregunta pendiente; `false` si sigue pendiente. */
  async responder(
    tramite: string,
    preguntaId: string,
    respuesta: Record<string, string> | boolean | null,
  ) {
    const espera = this.esperas.get(preguntaId);
    const r = this.registros.get(tramite);
    const item = r?.conversacion.find((i) => i.id === preguntaId);
    if (!espera || espera.tramite !== tramite || !r || item?.tipo !== 'pregunta') return true;
    // Si Touch ID se cancela o falla, la pregunta sigue pendiente: no es lo mismo que decir que no.
    if (
      item.pregunta.tipo === 'confirmacion' &&
      respuesta === true &&
      !(await this.entorno.verificarIdentidad(item.pregunta.confirmacion.accion))
    )
      return false;
    // Mientras Touch ID esperaba, el turno se ha podido detener o la pregunta responder.
    if (this.esperas.get(preguntaId) !== espera || item.estado !== 'pendiente') return true;
    const [si, no] = RESULTADOS[item.pregunta.tipo];
    Object.assign(item, { estado: 'respondida', resultado: respuesta ? si : no });
    espera.resolver(respuesta);
    this.cambio(tramite);
    return true;
  }

  private avisar(r: Registro, p: Pregunta) {
    this.notificar(
      r,
      p.tipo === 'formulario'
        ? p.formulario.titulo
        : p.tipo === 'confirmacion'
          ? `Pide tu permiso: ${p.confirmacion.accion}`
          : p.tipo === 'llamada'
            ? `Te pide que llames a ${p.llamada.organismo}`
            : p.tipo === 'confianza'
              ? `Pide tu permiso para dar tus datos a ${p.web}`
              : p.ayuda.instrucciones,
    );
  }

  /** Notificación del sistema solo si la ventana no está delante; al pulsarla, la trae. */
  private notificar(r: Registro, cuerpo: string) {
    const ventana = this.entorno.ventana();
    if (ventana?.isFocused() || !Notification.isSupported()) return;
    const n = new Notification({
      title: sinMarcadores(r.estado.titulo || 'Reforma Digital'),
      body: sinMarcadores(cuerpo),
    });
    n.on('click', () => {
      ventana?.show();
      ventana?.focus();
    });
    n.show();
  }

  private actualizarInsignia() {
    app.dock?.setBadge(this.esperas.size ? String(this.esperas.size) : '');
  }

  navegador(id: string): NavegadorTramite {
    let nav = this.navegadores.get(id);
    if (!nav) {
      const r = this.registros.get(id);
      // Un aviso tardío de la interfaz no debe crear el navegador de un trámite ya borrado.
      if (!r) throw new Error('Trámite no encontrado');
      nav = new NavegadorTramite(id, {
        persistente: this.entorno.sesionesGuardadas(),
        ventana: () => this.entorno.ventana(),
        carpetaDescargas: () =>
          path.join(
            app.getPath('downloads'),
            'Reforma Digital',
            sinMarcadores(r.estado.titulo || id)
              .replace(/[/\\:*?"<>|]/g, '-')
              .slice(0, 60),
          ),
        alCambiar: () => this.cambio(id),
        alDescargar: (d) => {
          r.descargas.push(d);
          r.conversacion.push({
            tipo: 'aviso',
            id: randomUUID(),
            tono: 'info',
            texto: `Descargado «${d.nombre}» en tu carpeta de Descargas.`,
            archivo: d.ruta,
          });
          void this.guardar(r).catch((e: unknown) => console.error(e));
          this.cambio(id);
        },
      });
      this.navegadores.set(id, nav);
    }
    return nav;
  }

  colocarNavegador(id: string, rect: Rect | null) {
    const ventana = this.entorno.ventana();
    for (const [otro, nav] of this.navegadores)
      if (otro !== id && ventana) nav.colocar(ventana, null);
    if (!ventana) return;
    if (rect) this.navegador(id).colocar(ventana, rect);
    else this.navegadores.get(id)?.colocar(ventana, null);
    this.cambio(id);
  }

  private async ejecutar(
    r: Registro,
    texto: string | undefined,
    config: ConfigProveedor,
    control: AbortController,
  ) {
    let actual: Extract<ItemConversacion, { tipo: 'asistente' }> | null = null;
    // Un proveedor puede reutilizar el ID de una herramienta en otro turno.
    const turno = randomUUID();
    // Desde cuándo trabaja el asistente en lo que sigue: el inicio del turno, el final de su último
    // texto o la respuesta de la persona. Es lo que tarda cada tanda de acciones.
    let trabajaDesde = ahora();
    const esperar = async (pregunta: Pregunta, signal: AbortSignal) => {
      const v = await this.preguntar(r, pregunta, signal);
      trabajaDesde = ahora();
      return v;
    };
    const anfitrion: Anfitrion = {
      perfil: () => this.entorno.perfil(),
      guardarPerfil: (v) => this.entorno.guardarPerfil(v),
      preguntar: async (formulario, signal) => {
        const v = await esperar({ tipo: 'formulario', formulario }, signal);
        return v && typeof v === 'object' ? v : null;
      },
      confirmar: async (confirmacion, signal) =>
        (await esperar({ tipo: 'confirmacion', confirmacion }, signal)) === true,
      pedirAyuda: async (ayuda, signal) => ({
        hecho: (await esperar({ tipo: 'ayuda', ayuda }, signal)) === true,
      }),
      // Si ha llamado, la tarjeta devuelve sus notas; si no ha podido, `false`.
      pedirLlamada: async (llamada, signal) => {
        const v = await esperar({ tipo: 'llamada', llamada }, signal);
        return v && typeof v === 'object'
          ? { hecho: true, ...(v.notas ? { notas: v.notas } : {}) }
          : { hecho: false };
      },
      confiarEn: async (web, signal) => {
        if (this.entorno.confiaEn(web)) return true;
        const no = this.desconfiadas.get(r.id) ?? new Set<string>();
        this.desconfiadas.set(r.id, no);
        if (no.has(web)) return false;
        const si = (await esperar({ tipo: 'confianza', web }, signal)) === true;
        if (si) await this.entorno.confiar(web);
        else no.add(web);
        return si;
      },
      navegador: async () => this.navegador(r.id),
      leerConNavegador,
    };
    const evento = (e: EventoAgente) => {
      if (e.tipo === 'texto') {
        if (!actual) {
          actual = { tipo: 'asistente', id: randomUUID(), texto: '' };
          r.conversacion.push(actual);
        }
        actual.texto += e.delta;
        trabajaDesde = ahora();
      } else if (e.tipo === 'actividad') {
        actual = null;
        const previo = r.conversacion.find(
          (i): i is ItemActividad => i.tipo === 'actividad' && i.id === `${turno}:${e.id}`,
        );
        const item: ItemActividad = {
          tipo: 'actividad',
          id: `${turno}:${e.id}`,
          herramienta: e.herramienta,
          resumen: e.resumen,
          estado: e.estado,
          ...(e.detalle ? { detalle: e.detalle } : {}),
          desde: previo?.desde ?? trabajaDesde,
          ...(e.estado === 'inicio' ? {} : { hasta: ahora() }),
        };
        if (previo) Object.assign(previo, item);
        else r.conversacion.push(item);
      } else if (e.tipo === 'protegidos') {
        const usuario = r.conversacion.findLast((i) => i.tipo === 'usuario');
        if (usuario) usuario.protegidos = e.cantidad;
      } else if (e.tipo === 'fuentes') {
        const accion = r.conversacion.find(
          (i): i is ItemActividad => i.tipo === 'actividad' && i.id === `${turno}:${e.actividad}`,
        );
        if (accion)
          accion.fuentes = [
            ...new Set([...(accion.fuentes ?? []), ...e.consultadas.map((f) => f.id)]),
          ];
        r.estado.fuentes = e.fuentes;
      } else if (e.tipo === 'uso') r.estado.uso = e.uso;
      this.cambio(r.id);
    };
    const escritos = this.escritos.get(r.id) ?? new Map<string, string>();
    this.escritos.set(r.id, escritos);
    let detector: Detector;
    try {
      detector = await this.entorno.detector();
    } catch (e) {
      r.conversacion.push({
        tipo: 'aviso',
        id: randomUUID(),
        tono: 'error',
        texto: `No se ha podido cargar la protección de datos personales, así que no se ha enviado nada al asistente. Reinstala la app si sigue pasando. (${e instanceof Error ? e.message : String(e)})`,
      });
      await this.guardar(r);
      return;
    }
    const resultado = await ejecutarTurno({
      proveedor: (guarda) => crearProveedor(config, guarda),
      detector,
      escritos,
      entrantes: () => {
        const textos = this.redirecciones.get(r.id) ?? [];
        this.redirecciones.delete(r.id);
        for (const t of textos)
          r.conversacion.push({
            tipo: 'usuario',
            id: randomUUID(),
            texto: t,
            protegidos: 0,
            redirigido: true,
          });
        if (textos.length) actual = null;
        return textos;
      },
      anfitrion,
      estado: r.estado,
      ...(texto === undefined ? {} : { texto }),
      evento,
      guardar: async (estado) => {
        r.estado = estado;
        await this.guardar(r);
      },
      signal: control.signal,
      razonamiento: r.razonamiento ?? 'medium',
    });
    r.estado = resultado.estado;
    // Solo al cerrar la app sigue algo esperando a la persona.
    if (control.signal.reason === OTRO_MENSAJE)
      sinResponder(
        r.estado.mensajes,
        'La persona no ha rellenado el formulario: ha escrito el mensaje siguiente.',
      );
    else if (control.signal.reason !== CIERRE) sinResponder(r.estado.mensajes);
    const aviso = {
      limite_pasos:
        'He dado muchos pasos seguidos y me he parado para que lo revises. Pulsa «Continuar» si quieres que siga.',
      limite_coste:
        'He llegado al límite de gasto de este turno. Pulsa «Continuar» si quieres que siga.',
      cancelado:
        control.signal.aborted &&
        control.signal.reason !== CIERRE &&
        control.signal.reason !== OTRO_MENSAJE
          ? 'Has detenido al asistente.'
          : '',
      error: resultado.error ?? 'Ha ocurrido un error.',
      respondido: '',
    }[resultado.fin];
    if (aviso)
      r.conversacion.push({
        tipo: 'aviso',
        id: randomUUID(),
        tono: resultado.fin === 'error' ? 'error' : 'info',
        texto: aviso,
        ...(resultado.fin === 'limite_pasos' || resultado.fin === 'limite_coste'
          ? { continuar: true }
          : {}),
      });
    await this.guardar(r);
    if (resultado.fin === 'respondido')
      this.notificar(r, 'El asistente ha terminado. Revisa la respuesta.');
  }

  detener(id: string) {
    this.ejecuciones.get(id)?.abort(new Error('Detenido por la persona'));
  }

  async borrar(id: string) {
    // Primero sale del registro: desde aquí ninguna escritura nueva lo vuelve a guardar.
    this.registros.delete(id);
    this.colas.delete(id);
    this.redirecciones.delete(id);
    this.detener(id);
    const nav = this.navegadores.get(id);
    this.navegadores.delete(id);
    this.escritos.delete(id);
    this.desconfiadas.delete(id);
    await nav?.cerrar();
    // Todo, también la caché de las páginas, y su carpeta en disco (si el sistema deja borrarla
    // con la sesión abierta: en Windows puede que no, pero ya está vacía).
    for (const persistente of [true, false]) {
      const ses = session.fromPartition(particion(id, persistente));
      await ses.clearData();
      if (ses.storagePath)
        await rm(ses.storagePath, { recursive: true, force: true }).catch(() => undefined);
    }
    await this.escrituras.get(id)?.catch(() => undefined);
    this.escrituras.delete(id);
    await this.almacen.borrar(archivo(id));
    this.entorno.alCambiarLista();
  }

  async ajustar(id: string, cambios: Pick<Registro, 'fijado' | 'razonamiento'>) {
    const r = this.registros.get(id);
    if (!r) return;
    Object.assign(r, cambios);
    await this.guardar(r);
    this.cambio(id);
  }

  /** Si el archivo lo ha descargado algún trámite. */
  esDescarga(ruta: string) {
    return [...this.registros.values()].some((r) => r.descargas.some((d) => d.ruta === ruta));
  }

  async borrarTodo() {
    for (const id of [...this.registros.keys()]) await this.borrar(id);
  }

  detenerTodo() {
    for (const c of this.ejecuciones.values()) c.abort(CIERRE);
  }
}
