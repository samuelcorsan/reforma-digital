import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
  systemPreferences,
  type MenuItemConstructorOptions,
} from 'electron';
import updater from 'electron-updater';
import { z } from 'zod';
import {
  camposPerfil,
  esIdentificador,
  mensajeDeError,
  normalizarCampo,
  crearDetector,
  probarConexion,
  validarCampo,
  type ConfigProveedor,
  type Detector,
  type ServidorReforma,
  type Perfil,
} from '@reforma-digital/agent';
import {
  ajustesEsquema,
  urlProveedor,
  type Ajustes,
  type ApiRd,
  type EstadoApp,
  type EventoApp,
} from '../shared/api';
import { Almacen } from './almacen';
import { esLectura } from './navegador';
import { Tramites } from './tramites';

const RAIZ = import.meta.dirname;
/** Fuera del ASAR: ONNX Runtime no lee modelos desde un archivo empaquetado. */
const DESEMPAQUETADO = RAIZ.replace(/app\.asar(?=[/\\]|$)/, 'app.asar.unpacked');
const ORIGEN_APP = 'app://bundle';
/** Sin empaquetar, Electron lleva su icono: en el Dock, la ventana y los diálogos va el de la app. */
const ICONO = app.isPackaged ? undefined : path.join(RAIZ, '../build/icon.png');
app.setName('Reforma Digital');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
if (!app.requestSingleInstanceLock()) app.quit();

/**
 * El servidor de Reforma Digital (`apps/web`), que guarda las claves del modelo y del buscador: la
 * app no lleva ninguna. Se fija al compilar (RD_SERVIDOR); sin empaquetar, RD_SERVIDOR_LOCAL lo
 * cambia al arrancar, para desarrollar o probar con un servidor en local.
 */
const SERVIDOR = (
  (!app.isPackaged && process.env['RD_SERVIDOR_LOCAL']) ||
  process.env.RD_SERVIDOR ||
  'https://reforma-digital.es'
).replace(/\/+$/, '');

/** El de Reforma Digital, a través de su servidor; se identifica con la instalación. */
const proveedorApp = (): ServidorReforma => ({
  tipo: 'reforma',
  url: SERVIDOR,
  instalacion: secretos.instalacion,
});

/** Otro proveedor elegido por la persona; busca con su clave de Exa o, si no tiene, en el servidor. */
function proveedorPropio(
  p: NonNullable<Ajustes['proveedorPropio']>,
  claves: Claves,
): ConfigProveedor {
  return {
    tipo: 'compatible',
    url: p.url,
    modelo: p.modelo,
    ...(claves.proveedor ? { clave: claves.proveedor } : {}),
    busqueda: claves.exa ? { tipo: 'exa', clave: claves.exa } : proveedorApp(),
  };
}

/** El proveedor con el que habla el asistente ahora. */
function configProveedor(): ConfigProveedor {
  const a = secretos.ajustes;
  if (a.proveedor === 'propio' && a.proveedorPropio)
    return proveedorPropio(a.proveedorPropio, secretos.claves ?? {});
  return proveedorApp();
}

/** La clave guardada del otro proveedor solo se manda al servidor para el que se dio. */
const claveGuardadaPara = (url: string) =>
  URL.parse(url)?.origin === URL.parse(secretos.ajustes.proveedorPropio?.url ?? '')?.origin
    ? secretos.claves?.proveedor
    : undefined;

/** Las claves del otro proveedor: cifradas con lo demás y nunca enviadas a la interfaz. */
type Claves = { proveedor?: string; exa?: string };
/**
 * `instalacion`: identificador aleatorio de esta instalación para el servidor; no dice nada de la
 * persona. `websConfiadas`: las webs que no son oficiales en las que confía para recibir sus datos.
 */
type Secretos = {
  ajustes: Ajustes;
  claves?: Claves;
  instalacion: string;
  websConfiadas?: string[];
};
const AJUSTES_INICIALES: Ajustes = {
  touchIdEnConfirmaciones: true,
  cerrarSesiones: false,
  proveedor: 'app',
  proveedorPropio: null,
};

let ventana: BrowserWindow | null = null;
let almacen: Almacen;
let tramites: Tramites;
let secretos: Secretos = { ajustes: AJUSTES_INICIALES, instalacion: randomUUID() };
let perfil: Perfil = {};
let detector: Promise<Detector> | undefined;
/** Se carga una vez, del modelo que va dentro de la app; si falla, se reintenta en el siguiente turno. */
const cargarDetector = () =>
  (detector ??= crearDetector(path.join(DESEMPAQUETADO, 'modelos/rampart-edge')).catch(
    (e: unknown) => {
      detector = undefined;
      throw e;
    },
  ));

const touchId = () => process.platform === 'darwin' && systemPreferences.canPromptTouchID();
async function verificar(motivo: string, exigir: boolean) {
  if (!exigir || !touchId()) return true;
  return systemPreferences.promptTouchID(motivo).then(
    () => true,
    () => false,
  );
}

/** Mostrar «Mis datos» pide Touch ID o, si el equipo no lo tiene, que la persona lo acepte. */
async function permitirVerDatos() {
  if (touchId()) return verificar('mostrar tus datos', true);
  const opciones = {
    type: 'question' as const,
    buttons: ['Mostrar', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    message: '¿Mostrar tus datos?',
    detail:
      'Se verán en pantalla tu documento, tu IBAN y el resto de «Mis datos». Comprueba que nadie más está mirando.',
  };
  const r = ventana
    ? await dialog.showMessageBox(ventana, opciones)
    : await dialog.showMessageBox(opciones);
  return r.response === 0;
}

/** Vista del perfil sin identificadores: solo «guardado» y una pista mínima. */
function perfilVista() {
  return camposPerfil.map((c) => {
    const v = perfil[c.clave];
    const vista = !v
      ? ''
      : esIdentificador(c.clave)
        ? v.length > 6
          ? `•••• ${v.slice(-3)}`
          : '••••'
        : v;
    return { clave: c.clave, guardado: Boolean(v), vista };
  });
}

function recordatorios(): EstadoApp['recordatorios'] {
  const caduca = perfil.documento_caducidad;
  if (!caduca || caduca.startsWith('9999')) return [];
  const dias = Math.round((Date.parse(caduca) - Date.now()) / 86400000);
  if (!Number.isFinite(dias) || dias > 120) return [];
  const doc = perfil.documento_tipo || 'documento';
  const fecha = caduca.split('-').reverse().join('/');
  return [
    {
      texto: dias < 0 ? `Tu ${doc} caducó el ${fecha}.` : `Tu ${doc} caduca el ${fecha}.`,
      sugerencia:
        doc === 'NIE'
          ? 'Quiero renovar mi tarjeta de residencia (TIE)'
          : `Quiero renovar mi ${doc}`,
    },
  ];
}

function estadoApp(): EstadoApp {
  return {
    version: app.getVersion(),
    ajustes: secretos.ajustes,
    clavesPropias: {
      proveedor: Boolean(secretos.claves?.proveedor),
      exa: Boolean(secretos.claves?.exa),
    },
    tramites: tramites.lista(),
    campos: camposPerfil,
    perfil: perfilVista(),
    touchId: touchId(),
    plataforma: process.platform,
    desarrollo: !app.isPackaged,
    recordatorios: recordatorios(),
    websConfiadas: secretos.websConfiadas ?? [],
  };
}

function emitir(e: EventoApp) {
  ventana?.webContents.send('rd:evento', e);
}

const texto = z.string().trim().min(1).max(4000);
const razonamiento = z.enum(['low', 'medium', 'high']);
const id = z.string().uuid();
const rect = z
  .object({ x: z.number(), y: z.number(), width: z.number().min(0), height: z.number().min(0) })
  .nullable();

/** Cada método de `window.rd`, con su validación de entrada. */
const metodos: { [K in Exclude<keyof ApiRd, 'on'>]: (...args: unknown[]) => ReturnType<ApiRd[K]> } =
  {
    estado: async () => estadoApp(),
    guardarAjustes: async (entrada) => {
      // El otro proveedor solo se cambia probándolo, con guardarProveedorPropio.
      const a = ajustesEsquema.omit({ proveedorPropio: true }).partial().safeParse(entrada);
      if (!a.success) return { ok: false, error: 'Revisa los ajustes.' };
      const ajustes = { ...secretos.ajustes, ...a.data };
      if (ajustes.proveedor === 'propio' && !ajustes.proveedorPropio)
        return { ok: false, error: 'Configura antes el otro proveedor.' };
      secretos = { ...secretos, ajustes };
      await almacen.escribir('secretos.bin', secretos);
      emitir({ tipo: 'estado', estado: estadoApp() });
      return { ok: true };
    },
    guardarProveedorPropio: async (entrada) => {
      const e = ajustesEsquema.shape.proveedorPropio
        .unwrap()
        .extend({
          clave: z.string().trim().max(500).optional(),
          claveExa: z.string().trim().max(200).optional(),
        })
        .safeParse(entrada);
      if (!e.success)
        return { ok: false, error: e.error.issues[0]?.message ?? 'Revisa los datos.' };
      const { url, modelo, clave, claveExa } = e.data;
      const claves: Claves = { ...secretos.claves };
      if (clave) claves.proveedor = clave;
      else if (!claveGuardadaPara(url)) delete claves.proveedor;
      if (claveExa) claves.exa = claveExa;
      const propio = { url, modelo };
      try {
        await probarConexion(proveedorPropio(propio, claves));
      } catch (err) {
        return { ok: false, error: `No responde: ${mensajeDeError(err)}` };
      }
      secretos = {
        ...secretos,
        claves,
        ajustes: { ...secretos.ajustes, proveedor: 'propio', proveedorPropio: propio },
      };
      await almacen.escribir('secretos.bin', secretos);
      emitir({ tipo: 'estado', estado: estadoApp() });
      return { ok: true };
    },
    modelosDelProveedor: async (entrada) => {
      const e = z
        .object({ url: urlProveedor, clave: z.string().trim().max(500).optional() })
        .safeParse(entrada);
      if (!e.success) return [];
      const clave = e.data.clave || claveGuardadaPara(e.data.url);
      try {
        const res = await net.fetch(`${e.data.url}/models`, {
          headers: clave ? { authorization: `Bearer ${clave}` } : {},
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const r = z
          .object({ data: z.array(z.object({ id: z.string().max(200) })).max(2000) })
          .safeParse(await res.json());
        return r.success ? r.data.data.map((m) => m.id).sort() : [];
      } catch {
        return [];
      }
    },
    crearTramite: async (t, r) => tramites.crear(texto.parse(t), razonamiento.parse(r)),
    ajustarTramite: async (t, c) =>
      tramites.ajustar(
        id.parse(t),
        z.object({ fijado: z.boolean(), razonamiento }).partial().strict().parse(c),
      ),
    verTramite: async (t) => tramites.vista(id.parse(t)),
    enviar: async (t, m) => tramites.enviar(id.parse(t), texto.parse(m)),
    quitarDeCola: async (t, m) => tramites.quitarDeCola(id.parse(t), id.parse(m)),
    redirigir: async (t, m) => tramites.redirigir(id.parse(t), id.parse(m)),
    volver: async (t, m) => tramites.volver(id.parse(t), id.parse(m)),
    detener: async (t) => tramites.detener(id.parse(t)),
    borrarTramite: async (t) => {
      await tramites.borrar(id.parse(t));
    },
    responder: async (t, p, r) =>
      tramites.responder(
        id.parse(t),
        id.parse(p),
        z
          .union([z.record(z.string().max(60), z.string().max(2000)), z.boolean(), z.null()])
          .parse(r),
      ),
    colocarNavegador: async (t, r) => tramites.colocarNavegador(id.parse(t), rect.parse(r)),
    navegar: async (t, accion) => {
      const nav = tramites.navegador(id.parse(t));
      if (z.enum(['atras', 'recargar']).parse(accion) === 'atras') await nav.atras();
      else nav.webContents.reload();
    },
    abrirEnTramite: async (t, u) => {
      const url = z
        .string()
        .url()
        .refine((u) => u.startsWith('https://'))
        .parse(u);
      await tramites.navegador(id.parse(t)).abrir(url);
    },
    revelarPerfil: async () => ((await permitirVerDatos()) ? { ...perfil } : null),
    guardarPerfil: async (entrada) => {
      const valores = z
        .record(z.string().regex(/^[a-z0-9_]{2,40}$/), z.string().max(300))
        .parse(entrada);
      const errores: Record<string, string> = {};
      const nuevo = { ...perfil };
      for (const [clave, bruto] of Object.entries(valores)) {
        if (!bruto.trim()) {
          delete nuevo[clave];
          continue;
        }
        const valor = normalizarCampo(clave, bruto);
        const error = validarCampo(clave, valor);
        if (error) errores[clave] = error;
        else nuevo[clave] = valor;
      }
      if (!Object.keys(errores).length) await guardarPerfil(nuevo);
      return errores;
    },
    borrarDatos: async (que) => {
      if (z.enum(['perfil', 'todo']).parse(que) === 'perfil') await guardarPerfil({});
      else {
        tramites.detenerTodo();
        await tramites.borrarTodo();
        await almacen.destruir();
        // Lo que quedara de las sesiones de las webs (cookies, caché…), también de trámites ya borrados.
        await fs
          .rm(path.join(app.getPath('userData'), 'Partitions'), { recursive: true, force: true })
          .catch(() => undefined);
        // Lo que guarda la interfaz: la bienvenida vuelve a salir y se olvida qué trámites se han visto.
        await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
        app.relaunch();
        app.exit(0);
      }
    },
    dejarDeConfiar: async (w) => {
      const web = z.string().max(300).parse(w);
      await guardarWebsConfiadas((secretos.websConfiadas ?? []).filter((x) => x !== web));
    },
    abrirEnlace: async (u) => {
      const url = new URL(z.string().parse(u));
      // tel: abre la app de llamadas del sistema, para la llamada guiada.
      if (url.protocol === 'https:' || url.protocol === 'tel:') await shell.openExternal(url.href);
    },
    mostrarArchivo: async (ruta) => {
      const r = z.string().parse(ruta);
      // Solo archivos que el propio trámite ha descargado.
      if (tramites.esDescarga(r)) shell.showItemInFolder(r);
    },
  };

async function guardarWebsConfiadas(websConfiadas: string[]) {
  secretos = { ...secretos, websConfiadas };
  await almacen.escribir('secretos.bin', secretos);
  emitir({ tipo: 'estado', estado: estadoApp() });
}

async function guardarPerfil(nuevo: Perfil) {
  perfil = nuevo;
  await almacen.escribir('perfil.bin', perfil);
  emitir({ tipo: 'estado', estado: estadoApp() });
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1040,
    minHeight: 660,
    show: false,
    // En macOS, los semáforos dentro de la ventana. En Windows y Linux, sus botones arriba a la
    // derecha sobre el lienzo (la cabecera les deja hueco con .hueco-botones) y sin barra de menú:
    // los atajos del menú siguen funcionando.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 18, y: 20 } }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: { color: '#f5f5f5', symbolColor: '#0a0a0a', height: 52 },
          autoHideMenuBar: true,
        }),
    backgroundColor: '#f5f5f5',
    ...(ICONO && { icon: ICONO }),
    webPreferences: {
      preload: path.join(RAIZ, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });
  ventana.webContents.on('will-navigate', (e) => e.preventDefault());
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.once('ready-to-show', () => ventana?.show());
  ventana.on('closed', () => {
    ventana = null;
  });
  void ventana.loadURL(`${ORIGEN_APP}/index.html`);
}

function menu() {
  const plantilla: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'Acerca de Reforma Digital' },
        { type: 'separator' },
        {
          label: 'Ajustes…',
          accelerator: 'CmdOrCtrl+,',
          click: () => emitir({ tipo: 'menu', vista: 'ajustes' }),
        },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar Reforma Digital' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de Reforma Digital' },
      ],
    },
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo trámite',
          accelerator: 'CmdOrCtrl+N',
          click: () => emitir({ tipo: 'menu', vista: 'inicio' }),
        },
        {
          label: 'Mis datos',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => emitir({ tipo: 'menu', vista: 'datos' }),
        },
        { type: 'separator' },
        { role: 'close', label: 'Cerrar ventana' },
      ],
    },
    { label: 'Edición', role: 'editMenu' },
    {
      label: 'Ver',
      submenu: [
        ...(app.isPackaged
          ? []
          : [
              { role: 'reload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const },
            ]),
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Ampliar' },
        { role: 'zoomOut', label: 'Reducir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    { label: 'Ventana', role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

app.on('second-instance', () => {
  ventana?.show();
  ventana?.focus();
});

// Certificados del llavero de macOS: la persona elige con cuál se identifica en cada web.
app.on('select-client-certificate', (event, webContents, url, lista, responder) => {
  event.preventDefault();
  // La lectura oculta de webs oficiales nunca se identifica.
  if (!lista.length || (webContents && esLectura(webContents.session))) return responder();
  // Electron da «host:puerto», no una URL completa.
  const sitio = url.replace(/^[a-z]+:\/\//i, '').replace(/[/:].*$/, '');
  // Sin lista de webs: la persona ve en qué web va a usarlo y decide.
  const opciones = {
    type: 'question' as const,
    message: `¿Te identificas en ${sitio} con tu certificado digital?`,
    detail: `${sitio} recibirá los datos de tu certificado, como tu nombre y tu DNI o NIE. Hazlo solo si es la web donde quieres hacer el trámite. El asistente no ve tu certificado ni su contraseña.`,
    buttons: [...lista.map((c) => `Usar ${c.subjectName || c.issuerName}`), 'No identificarme'],
    cancelId: lista.length,
  };
  const padre = (webContents && BrowserWindow.fromWebContents(webContents)) ?? ventana;
  void (padre ? dialog.showMessageBox(padre, opciones) : dialog.showMessageBox(opciones)).then(
    (r) => responder(r.response < lista.length ? lista[r.response] : undefined),
  );
});

app.on('web-contents-created', (_e, contents) => {
  // Ninguna web puede pedir credenciales HTTP básicas ni abrir vistas nuevas por su cuenta.
  contents.on('login', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app
  .whenReady()
  .then(async () => {
    const renderer = path.join(RAIZ, 'renderer');
    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url);
      const destino = path.normalize(path.join(renderer, decodeURIComponent(pathname)));
      if (!destino.startsWith(renderer + path.sep))
        return new Response('No encontrado', { status: 404 });
      return net.fetch(pathToFileURL(destino).href);
    });
    if (ICONO) app.dock?.setIcon(ICONO);
    almacen = await Almacen.abrir(path.join(app.getPath('userData'), 'datos'));
    const guardados = await almacen.leer<Partial<Secretos>>('secretos.bin');
    secretos = {
      ...guardados,
      ajustes: { ...AJUSTES_INICIALES, ...guardados?.ajustes },
      instalacion: guardados?.instalacion ?? randomUUID(),
    };
    if (!guardados?.instalacion) await almacen.escribir('secretos.bin', secretos);
    if (secretos.ajustes.proveedor === 'propio' && !secretos.ajustes.proveedorPropio)
      secretos.ajustes.proveedor = 'app';
    // Con «cerrar sesiones», las sesiones de las webs viven en memoria y se borran las que quedaran.
    if (secretos.ajustes.cerrarSesiones)
      await fs.rm(path.join(app.getPath('userData'), 'Partitions'), {
        recursive: true,
        force: true,
      });
    perfil = (await almacen.leer<Perfil>('perfil.bin')) ?? {};
    tramites = new Tramites(almacen, {
      perfil: () => perfil,
      guardarPerfil: async (v) => guardarPerfil({ ...perfil, ...v }),
      proveedor: configProveedor,
      sesionesGuardadas: () => !secretos.ajustes.cerrarSesiones,
      verificarIdentidad: (motivo) => verificar(motivo, secretos.ajustes.touchIdEnConfirmaciones),
      confiaEn: (web) => Boolean(secretos.websConfiadas?.includes(web)),
      confiar: (web) =>
        guardarWebsConfiadas([...new Set([...(secretos.websConfiadas ?? []), web])]),
      detector: cargarDetector,
      ventana: () => ventana,
      emitir,
      alCambiarLista: () => emitir({ tipo: 'estado', estado: estadoApp() }),
    });
    await tramites.cargar();
    ipcMain.handle('rd', async (event, metodo: unknown, ...args: unknown[]) => {
      if (!event.senderFrame?.url.startsWith(ORIGEN_APP + '/'))
        throw new Error('Origen no permitido');
      const fn =
        typeof metodo === 'string' && Object.hasOwn(metodos, metodo)
          ? metodos[metodo as keyof typeof metodos]
          : null;
      if (!fn) throw new Error('Método desconocido');
      return fn(...args);
    });
    menu();
    crearVentana();
    // Se carga ya para que el primer mensaje no espere; los fallos se muestran al enviarlo.
    cargarDetector().catch(() => undefined);
    // Solo empaquetada: descarga la versión nueva que publique la web y la instala al salir.
    updater.autoUpdater
      .checkForUpdatesAndNotify({
        title: 'Actualización lista',
        body: '{appName} {version} se instalará al cerrar la app.',
      })
      .catch(() => undefined);
    app.on('activate', () => {
      if (!ventana) crearVentana();
    });
  })
  .catch(async (e: unknown) => {
    // Sin llavero o con datos dañados la app no puede arrancar: se explica y se ofrece empezar de cero.
    const r = await dialog.showMessageBox({
      type: 'error',
      message: 'Reforma Digital no ha podido abrir tus datos',
      detail: `${e instanceof Error ? e.message : String(e)}\n\nSi el sistema te ha pedido acceso al llavero y lo has denegado, sal y vuelve a abrir la app. Si el problema sigue, puedes borrar lo que la app guarda en este ordenador (datos, trámites, ajustes y sesiones de las webs) y empezar de cero.`,
      buttons: ['Salir', 'Borrar todo y reiniciar'],
      defaultId: 0,
      cancelId: 0,
    });
    if (r.response === 1) {
      for (const dir of ['datos', 'Partitions'])
        await fs.rm(path.join(app.getPath('userData'), dir), { recursive: true, force: true });
      app.relaunch();
    }
    app.exit(0);
  });

app.on('before-quit', () => tramites?.detenerTodo());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
