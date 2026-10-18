import { once } from 'node:events';
import { existsSync, mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { setTimeout as dormir } from 'node:timers/promises';
import path from 'node:path';
import {
  dialog,
  ipcMain,
  session,
  shell,
  WebContentsView,
  type BrowserWindow,
  type Session,
} from 'electron';
import { z } from 'zod';
import { llamar, type Dialogo, type Navegador } from '@reforma-digital/agent';
import { direccionPrivada } from '@reforma-digital/agent/fetch';
import { isOfficial } from '@reforma-digital/government/domains';
import type { Descarga, Rect } from '../shared/api';

/** Mundo aislado donde corre el script de lectura: la página no puede ver ni tocar sus variables. */
const MUNDO = 1000;
const ZOOM = 0.8;
const configuradas = new WeakSet<Session>();

/**
 * La sesión del navegador de un trámite. Persistente, se guarda en disco y la persona sigue dentro
 * de las webs al volver a abrir la app; si no, vive en memoria y desaparece al cerrarla.
 */
export const particion = (tramite: string, persistente: boolean) =>
  `${persistente ? 'persist:' : ''}tramite-${tramite}`;
const sesionLectura = () => session.fromPartition('lectura');
export const esLectura = (ses: Session) => ses === sesionLectura();
/**
 * Lo que se abre dentro del navegador del trámite, solo por https; AutoFirma se abre fuera y el
 * resto (también http) se ignora.
 */
const EN_VISTA = /^(https|blob):/i;

/** Si el host es, o resuelve a, una dirección de la red local (router, impresora, localhost…). */
async function enRedLocal(ses: Session, host: string) {
  const h = host.replace(/^\[|\]$/g, '');
  if (isIP(h)) return direccionPrivada(h);
  const r = await ses.resolveHost(h).catch(() => null);
  return Boolean(r?.endpoints.some((e) => direccionPrivada(e.address)));
}

/** Sin permisos de cámara, ubicación ni notificaciones, y con el agente de usuario de Chrome. */
function prepararSesion(ses: Session) {
  // Las webs oficiales comprueban que sea Chrome: se quita la marca de Electron del agente de usuario.
  ses.setUserAgent(
    ses.getUserAgent().replace(/ (Electron|ReformaDigital|reforma-digital-desktop)\/\S+/gi, ''),
  );
  ses.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));
  ses.setPermissionCheckHandler(() => false);
}

/**
 * Lo que se espera de una página puede no llegar nunca (si se va a otra mientras se lee): sin un
 * plazo, el asistente se quedaría esperando para siempre.
 */
const aTiempo = <T>(p: Promise<T>, ms: number, error = 'La web no ha respondido a tiempo.') =>
  Promise.race([
    p,
    dormir(ms).then(() => {
      throw new Error(error);
    }),
  ]);

/**
 * Lee el texto de una web oficial que rechaza las peticiones que no vienen de un navegador. Usa
 * una vista oculta con su propia sesión en memoria: no comparte cookies con ningún trámite.
 */
export async function leerConNavegador(url: string, signal: AbortSignal) {
  const ses = sesionLectura();
  if (!configuradas.has(ses)) {
    configuradas.add(ses);
    prepararSesion(ses);
    ses.on('will-download', (e) => e.preventDefault());
  }
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Una página que solo se lee no le pregunta nada a nadie.
      disableDialogs: true,
    },
  });
  const wc = view.webContents;
  // Solo sigue redirecciones y navegaciones a webs oficiales por HTTPS: nunca a la red local.
  const soloOficiales = (e: { url: string; preventDefault(): void }) => {
    if (!isOfficial(e.url)) e.preventDefault();
  };
  wc.on('will-navigate', soloOficiales);
  wc.on('will-redirect', soloOficiales);
  let codigo = 0;
  wc.on('did-navigate', (_e, _url, c) => (codigo = c));
  const cerrar = () => {
    if (!wc.isDestroyed()) wc.close();
  };
  signal.addEventListener('abort', cerrar, { once: true });
  try {
    await aTiempo(
      wc.loadURL(url).catch((e: Error) => {
        if (!/ERR_ABORTED/.test(e.message)) throw e;
      }),
      25000,
      'La web oficial no ha cargado a tiempo.',
    );
    // Algunas webs comprueban el navegador con JavaScript (con un error 403 mientras tanto) y
    // recargan: se espera a que se calme.
    for (let i = 0; i < 16 && (wc.isLoading() || codigo >= 400); i++) await dormir(500);
    // Lo que se ve es un error o una comprobación que no pasa sola: no es la página que se buscaba.
    if (codigo >= 400)
      throw new Error(
        `La web oficial responde con un error ${codigo}. Si pide comprobar que eres una persona, ábrela con abrir en el navegador del trámite y, si la comprobación no pasa sola, usa pedir_ayuda con motivo «captcha».`,
      );
    await dormir(1200);
    const r = (await aTiempo(
      wc.executeJavaScriptInIsolatedWorld(MUNDO, [{ code: llamar('leerTexto', 0, 200000) }]),
      15000,
      'La web oficial no ha respondido a tiempo.',
    )) as { texto: string; titulo: string };
    return { url: wc.getURL(), titulo: r.titulo, texto: r.texto };
  } finally {
    signal.removeEventListener('abort', cerrar);
    cerrar();
  }
}

/** Pide confirmación antes de abrir AutoFirma desde una web. Otras apps no se abren. */
async function abrirAutoFirma(ventana: BrowserWindow | null, url: string) {
  if (!/^afirma:/i.test(url)) return;
  const opciones = {
    type: 'question' as const,
    buttons: ['Abrir', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    message: 'La web quiere abrir AutoFirma para firmar',
    detail:
      'La firma la haces tú en AutoFirma, con tu certificado. Si no la tienes, descárgala de firmaelectronica.gob.es.',
  };
  const r = ventana
    ? await dialog.showMessageBox(ventana, opciones)
    : await dialog.showMessageBox(opciones);
  if (r.response !== 0) return;
  await shell
    .openExternal(url)
    .catch(() =>
      dialog.showErrorBox(
        'No se ha podido abrir',
        'Instala AutoFirma desde firmaelectronica.gob.es y vuelve a intentarlo.',
      ),
    );
}

/**
 * El navegador de un trámite: una vista dentro de la ventana, con su propia sesión en memoria
 * (no se mezcla con la de otros trámites y no deja nada en disco).
 */
/** Lo que llega del preload cuando la web abre un diálogo: el texto lo escribe la web. */
const dialogoDeLaWeb = z.object({
  tipo: z.enum(['alert', 'confirm', 'prompt']),
  mensaje: z.string().max(5000),
  porDefecto: z.string().max(5000).nullable(),
});
type Pendiente = { info: Dialogo; contestar: (aceptar: boolean, texto?: string) => void };

/** Cada navegador de trámite por su webContents, para darle los diálogos que abre su web. */
const porContenido = new Map<number, NavegadorTramite>();
let escuchando = false;
function escucharDialogos() {
  if (escuchando) return;
  escuchando = true;
  ipcMain.on('rd:dialogo', (e, tipo: unknown, mensaje: unknown, porDefecto: unknown) => {
    const nav = porContenido.get(e.sender.id);
    const d = dialogoDeLaWeb.safeParse({ tipo, mensaje, porDefecto });
    if (nav && d.success) nav.abrirDialogo(e, d.data);
    else e.returnValue = null;
  });
}

export class NavegadorTramite implements Navegador {
  readonly view: WebContentsView;
  private nuevas: string[] = [];
  private enVentana: BrowserWindow | null = null;
  private pendiente: Pendiente | null = null;
  private dialogos = 0;
  /** Quien espera un resultado de la página: un diálogo abierto lo bloquea, así que se le avisa. */
  private alAbrirDialogo = new Set<() => void>();

  constructor(
    tramite: string,
    private opciones: {
      persistente: boolean;
      carpetaDescargas: () => string;
      ventana: () => BrowserWindow | null;
      alCambiar: () => void;
      alDescargar: (d: Descarga) => void;
    },
  ) {
    const ses = session.fromPartition(particion(tramite, opciones.persistente));
    this.configurar(ses);
    this.view = new WebContentsView({
      webPreferences: {
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        preload: path.join(import.meta.dirname, 'preload-navegador.cjs'),
        // El preload de los diálogos también en los marcos (sin Node: siguen en el sandbox).
        nodeIntegrationInSubFrames: true,
      },
    });
    escucharDialogos();
    porContenido.set(this.view.webContents.id, this);
    this.view.setBackgroundColor('#ffffff');
    // Las sedes están pensadas para pantallas anchas: al 80 % caben en el panel sin cortarse.
    this.view.webContents.on('did-finish-load', () => this.view.webContents.setZoomFactor(ZOOM));
    const wc = this.view.webContents;
    wc.on('did-navigate', () => this.opciones.alCambiar());
    wc.on('did-navigate-in-page', () => this.opciones.alCambiar());
    // Las ventanas nuevas se abren en la misma vista: el trámite sigue en un solo sitio. Un
    // formulario con target="_blank" (p. ej. «descargar justificante») conserva su envío POST.
    wc.setWindowOpenHandler(({ url, referrer, postBody }) => {
      if (EN_VISTA.test(url))
        void wc
          .loadURL(url, {
            httpReferrer: referrer,
            ...(postBody && {
              postData: postBody.data,
              extraHeaders: `Content-Type: ${postBody.contentType}${postBody.boundary ? `; boundary=${postBody.boundary}` : ''}`,
            }),
          })
          .catch(() => undefined);
      else void abrirAutoFirma(this.opciones.ventana(), url);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e) => {
      if (EN_VISTA.test(e.url)) return;
      e.preventDefault();
      void abrirAutoFirma(this.opciones.ventana(), e.url);
    });
    // Si la página se cae con un diálogo abierto, ya no espera respuesta.
    wc.on('render-process-gone', () => this.pendiente?.contestar(false));
  }

  /**
   * Un diálogo de la web, mientras la página espera. Lo ve el asistente (`dialogo`) y la persona,
   * en un cuadro de la app que se cierra si contesta antes el asistente. Si la web abre otro a la
   * vez (desde otro marco), ese se cancela.
   */
  abrirDialogo(e: Electron.IpcMainEvent, d: z.infer<typeof dialogoDeLaWeb>) {
    if (this.pendiente) {
      e.returnValue = d.tipo === 'confirm' ? false : null;
      return;
    }
    const cerrar = new AbortController();
    const p: Pendiente = {
      info: {
        id: ++this.dialogos,
        tipo: d.tipo,
        mensaje: d.mensaje,
        ...(d.porDefecto ? { porDefecto: d.porDefecto } : {}),
        ...(e.senderFrame ? { origen: e.senderFrame.origin } : {}),
      },
      contestar: (aceptar, texto) => {
        if (this.pendiente !== p) return;
        this.pendiente = null;
        cerrar.abort();
        e.returnValue =
          d.tipo === 'confirm'
            ? aceptar
            : d.tipo === 'prompt' && aceptar
              ? (texto ?? d.porDefecto ?? '')
              : null;
        this.opciones.alCambiar();
      },
    };
    this.pendiente = p;
    for (const avisar of this.alAbrirDialogo) avisar();
    this.opciones.alCambiar();
    const opciones = {
      type: d.tipo === 'alert' ? ('info' as const) : ('question' as const),
      message: `${URL.parse(this.url())?.host || 'La web'} dice:`,
      detail: d.mensaje,
      buttons: d.tipo === 'alert' ? ['Aceptar'] : ['Aceptar', 'Cancelar'],
      defaultId: 0,
      cancelId: d.tipo === 'alert' ? 0 : 1,
      signal: cerrar.signal,
    };
    const ventana = this.opciones.ventana();
    void (
      ventana ? dialog.showMessageBox(ventana, opciones) : dialog.showMessageBox(opciones)
    ).then(
      (r) => p.contestar(r.response === 0),
      () => undefined,
    );
  }

  dialogo() {
    return this.pendiente?.info ?? null;
  }

  /** Se cumple cuando la web abre un diálogo: la página queda parada hasta que se responda. */
  private cuandoDialogo() {
    let quitar = () => {};
    const abierto = new Promise<void>((resolver) => {
      this.alAbrirDialogo.add(resolver);
      quitar = () => this.alAbrirDialogo.delete(resolver);
    });
    return { abierto, quitar };
  }

  async responderDialogo(aceptar: boolean, texto?: string) {
    this.pendiente?.contestar(aceptar, texto);
  }

  private configurar(ses: Session) {
    if (configuradas.has(ses)) return;
    configuradas.add(ses);
    prepararSesion(ses);
    // Nada sin cifrar (tampoco una redirección a http) y nada de la red local, en ninguna petición:
    // ni el asistente ni una web pueden llevar el navegador del trámite allí.
    ses.webRequest.onBeforeRequest((d, responder) => {
      const url = new URL(d.url);
      if (url.protocol === 'http:' || url.protocol === 'ws:') return responder({ cancel: true });
      void enRedLocal(ses, url.hostname).then((cancel) => responder({ cancel }));
    });
    // AutoFirma lanzada desde un iframe no pasa por will-navigate: llega como permiso para abrir
    // una app externa. Se deniega y, si es AutoFirma, se abre tras preguntar.
    ses.setPermissionRequestHandler((_wc, permiso, responder, detalles) => {
      if (permiso === 'openExternal' && 'externalURL' in detalles && detalles.externalURL)
        void abrirAutoFirma(this.opciones.ventana(), detalles.externalURL);
      responder(false);
    });
    ses.on('will-download', (_e, item) => {
      const dir = this.opciones.carpetaDescargas();
      const nombre = path.basename(item.getFilename()).replace(/[/\\:]/g, '_') || 'descarga';
      mkdirSync(dir, { recursive: true });
      let ruta = path.join(dir, nombre);
      for (let n = 2; existsSync(ruta); n++)
        ruta = path.join(dir, nombre.replace(/(\.[^.]*)?$/, ` (${n})$1`));
      // Lo que descarga una web oficial se guarda solo. De otra web, la persona lo ve en el cuadro
      // de guardar del sistema y decide; si lo cancela, no se guarda.
      if (isOfficial(this.url())) item.setSavePath(ruta);
      else {
        const aviso = `${URL.parse(this.url())?.host || 'Una web'} quiere descargar «${nombre}»`;
        item.setSaveDialogOptions({
          title: aviso,
          message: `${aviso}. No es una web oficial: guárdalo solo si lo esperabas.`,
          defaultPath: ruta,
        });
      }
      item.once('done', (_ev, estado) => {
        if (estado !== 'completed') return;
        // La persona puede haberlo guardado en otra carpeta o con otro nombre.
        ruta = item.getSavePath();
        this.nuevas.push(path.basename(ruta));
        this.opciones.alDescargar({
          nombre: path.basename(ruta),
          ruta,
        });
      });
    });
  }

  get webContents() {
    return this.view.webContents;
  }

  /** Coloca la vista sobre el hueco que deja la interfaz, o la oculta con `null`. */
  colocar(ventana: BrowserWindow, rect: Rect | null) {
    if (this.enVentana !== ventana) {
      this.quitarDeVentana();
      ventana.contentView.addChildView(this.view);
      this.enVentana = ventana;
    }
    // La interfaz mide en píxeles CSS; con la ventana ampliada, la vista se coloca en puntos.
    const z = ventana.webContents.getZoomFactor();
    if (rect)
      this.view.setBounds({
        x: Math.round(rect.x * z),
        y: Math.round(rect.y * z),
        width: Math.round(rect.width * z),
        height: Math.round(rect.height * z),
      });
    this.view.setVisible(Boolean(rect));
  }

  url = () => this.webContents.getURL();

  async abrir(url: string) {
    this.asegurarEnVentana();
    // Un diálogo mientras carga la deja a medias hasta que se responda: se vuelve para verlo.
    const d = this.cuandoDialogo();
    await aTiempo(
      Promise.race([
        this.webContents.loadURL(url).catch((e: Error) => {
          // Una redirección o una navegación nueva cancelan la anterior: no es un error.
          if (!/ERR_ABORTED/.test(e.message)) throw e;
        }),
        d.abierto,
      ]),
      30000,
      'La web no ha cargado a tiempo. Puede que siga cargando: mírala con ver.',
    ).finally(d.quitar);
    await this.esperar(200);
  }

  async atras() {
    if (this.webContents.navigationHistory.canGoBack()) this.webContents.navigationHistory.goBack();
    await this.esperar();
  }

  evaluar<T>(expresion: string): Promise<T> {
    if (this.pendiente) return Promise.reject(new Error('La web tiene un diálogo abierto.'));
    // Si la web abre un diálogo mientras tanto, la página no responderá hasta que se conteste.
    const d = this.cuandoDialogo();
    return aTiempo(
      Promise.race([
        this.webContents.executeJavaScriptInIsolatedWorld(MUNDO, [
          { code: expresion },
        ]) as Promise<T>,
        d.abierto.then(() => {
          throw new Error('La web ha abierto un diálogo.');
        }),
      ]),
      20000,
    ).finally(d.quitar);
  }

  async clic(x: number, y: number) {
    this.asegurarEnVentana();
    const wc = this.webContents;
    // El script mide en píxeles CSS; los eventos van en puntos de la vista.
    const z = wc.getZoomFactor();
    const p = { x: Math.round(x * z), y: Math.round(y * z) };
    wc.sendInputEvent({ type: 'mouseMove', ...p });
    wc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
  }

  async insertarTexto(texto: string) {
    await this.webContents.insertText(texto);
  }

  async tecla(tecla: Parameters<Navegador['tecla']>[0]) {
    const codigo = {
      Enter: 'Return',
      Tab: 'Tab',
      Escape: 'Escape',
      ArrowDown: 'Down',
      ArrowUp: 'Up',
      Backspace: 'Backspace',
      Space: 'Space',
    }[tecla];
    const wc = this.webContents;
    wc.sendInputEvent({ type: 'keyDown', keyCode: codigo });
    if (tecla === 'Enter') wc.sendInputEvent({ type: 'char', keyCode: '\r' });
    if (tecla === 'Space') wc.sendInputEvent({ type: 'char', keyCode: ' ' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: codigo });
  }

  async esperar(ms = 400) {
    await dormir(ms);
    const wc = this.webContents;
    if (!wc.isLoading() || this.pendiente) return;
    const d = this.cuandoDialogo();
    await Promise.race([once(wc, 'did-stop-loading'), dormir(20000), d.abierto]).finally(d.quitar);
  }

  descargas() {
    return this.nuevas.splice(0);
  }

  /** Los eventos de ratón y teclado solo llegan a una vista que está en una ventana. */
  private asegurarEnVentana() {
    const v = this.opciones.ventana();
    if (v && this.enVentana !== v) this.colocar(v, null);
  }

  /** La vista sobrevive a la ventana: tras cerrarla y volver a abrir la app, pasa a la nueva. */
  private quitarDeVentana() {
    if (this.enVentana && !this.enVentana.isDestroyed())
      this.enVentana.contentView.removeChildView(this.view);
    this.enVentana = null;
  }

  async cerrar() {
    this.pendiente?.contestar(false);
    porContenido.delete(this.view.webContents.id);
    this.quitarDeVentana();
    this.view.webContents.close();
  }
}
