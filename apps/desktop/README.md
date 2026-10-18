# Reforma Digital para escritorio

Asistente de trámites para macOS, Windows y Linux. La persona cuenta qué necesita; el asistente lo investiga en webs oficiales, se lo explica mostrando debajo las webs que ha consultado y, si ella quiere, lo hace en la sede electrónica con un navegador dentro de la app mientras lo ve. Las contraseñas, CAPTCHA, certificados, firmas y pagos los hace la persona.

Es un proyecto independiente, sin vinculación con la Administración. Está en desarrollo: no se ha validado ningún trámite completo en una web oficial real (ver [Limitaciones](#limitaciones)).

## Puesta en marcha

Requiere Node 22.18+ y pnpm 11 en macOS con Apple silicon, Windows 10/11 o Linux x64.

```sh
pnpm install --frozen-lockfile
pnpm --filter @reforma-digital/desktop exec install-electron   # una vez: descarga Electron
pnpm --filter @reforma-digital/desktop dev                     # compila y abre la app
pnpm --filter @reforma-digital/desktop package                 # la app, sin instalador, en apps/desktop/dist
```

`package` empaqueta para el sistema y la arquitectura en los que se ejecuta (`dist/mac-arm64`, `dist/win-unpacked`, `dist/linux-unpacked`…). El detector usa ONNX Runtime en WebAssembly, igual en todos los sistemas: la app no lleva binarios nativos propios, pero Electron sí, así que cada sistema se empaqueta en el suyo. Después, `pnpm --filter @reforma-digital/desktop exec electron-builder --config electron-builder.json` crea los instaladores de ese sistema: `.dmg` para Apple silicon y para Intel, instalador `.exe` (NSIS) o `.deb` y `.AppImage`. En macOS, empaquetar pide Xcode 26 por el icono de Icon Composer.

`dev` y `package` descargan antes, una sola vez, el modelo del detector de datos personales (1,45 MB, versión fija y huella SHA-256 comprobada) en `packages/agent/.cache/rampart-edge`; la app lo lleva dentro. Sin él, la app no envía nada al asistente.

Si el terminal tiene `ELECTRON_RUN_AS_NODE=1` (lo definen algunas apps hechas con Electron), quítalo antes de `dev`: con esa variable Electron arranca como Node. La app empaquetada no se ve afectada porque el fusible `runAsNode` está desactivado.

**La app no lleva claves.** Habla con el servidor de Reforma Digital (`apps/web`, en `https://reforma-digital.es`), que guarda las de [NaN Builders](https://nan.builders) y [Exa](https://exa.ai) en sus variables de entorno:

- `POST /api/escritorio/v1/chat/completions` pasa las peticiones del modelo a NaN Builders (`deepseek-v4-flash`, modelo abierto alojado en la UE y sin registro de peticiones). Es compatible con la API de OpenAI. El modelo y el máximo de tokens los pone el servidor, y solo pasan los campos que usa el agente.
- `POST /api/escritorio/buscar` busca en Exa.

Las peticiones ya llegan sin datos personales (van como marcadores) y el servidor no las guarda. Solo apunta, en Postgres, lo que gasta cada persona en el día: cada instalación (un identificador aleatorio que la app crea al arrancar por primera vez y envía en `x-rd-instalacion`) y cada IP, guardadas con hash. El límite es de **0,50 $ al día por persona** y 2,50 $ por IP (para quien reinstale la app y empiece de cero), en `apps/web/lib/escritorio.ts`. Cuenta lo que cobra Exa por cada búsqueda y los tokens del modelo al precio que salen con la suscripción de NaN Builders (70 € al mes por 3.000 millones de tokens, unos 0,03 $ por millón). Una app que se reparte no puede guardar secretos: este límite es lo que impide el abuso.

En el servidor solo hacen falta `NAN_API_KEY` y `EXA_API_KEY` (y la `DATABASE_URL` que ya usa la web, para que el límite se comparta entre funciones). Sin las claves, las rutas responden 503. Para desarrollar con la web en local (`pnpm dev`), compila la app con `RD_SERVIDOR=http://localhost:3000` o, sin empaquetar, arráncala con `RD_SERVIDOR_LOCAL=http://localhost:3000`.

**Otro proveedor.** En Ajustes, en lugar del de la app (el que viene elegido), se puede usar cualquier servidor compatible con la API de OpenAI: otro proveedor con su clave o un modelo en el propio ordenador (Ollama, LM Studio). La app lo prueba antes de guardarlo y ofrece los modelos que liste. Sus claves se guardan cifradas con lo demás y no vuelven a la interfaz. Para buscar usa la clave de Exa que se le dé o, si no hay, la búsqueda de la app; sin ninguna, el asistente solo lee las webs cuya dirección conoce. Con otro proveedor, sus condiciones deciden si guarda o entrena con las peticiones; los datos personales siguen llegando como marcadores.

## Cómo está hecha

```mermaid
flowchart LR
  UI["Interfaz · React + sistema Sol"] -- "window.rd (IPC validado)" --> Main["Proceso principal · Electron"]
  Main --> Almacen["Almacén cifrado · AES-256-GCM, clave en el llavero"]
  Main --> Agente["@reforma-digital/agent · bucle del agente"]
  Agente --> Servidor["Servidor de Reforma Digital · apps/web"]
  Servidor --> Modelo["NaN Builders (modelo) + Exa (búsqueda)"]
  Agente --> Oficiales["Webs oficiales · búsqueda y lectura"]
  Main --> Vista["Navegador del trámite · WebContentsView, sesión propia"]
  Agente -. "mismo script de página" .-> Vista
```

| Pieza                                                                            | Qué hace                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/agent`](../../packages/agent)                                         | El agente, sin Electron: herramientas, instrucciones, bucle con límites, privacidad, lectura segura de webs oficiales y el script que lee y maneja páginas. Lo usan la app y las evaluaciones.                                |
| [`packages/government/src/domains.ts`](../../packages/government/src/domains.ts) | Sufijos de dominio de las administraciones (208, adaptados de SpainAssist con licencia MIT). Marcan qué webs son oficiales; las demás salen como «sin verificar». No convierten una página en fuente registrada del buscador. |
| [`packages/evals/src/agent`](../../packages/evals/src/agent)                     | Evaluaciones del agente: sede ficticia, navegador Playwright, persona simulada, escenarios y métricas.                                                                                                                        |
| [`apps/desktop`](.)                                                              | La app: ventana, almacén cifrado, navegador por trámite, Touch ID, notificaciones, certificados del sistema, AutoFirma e interfaz.                                                                                            |

El bucle del agente hace un paso del modelo cada vez (Vercel AI SDK 7): guarda el progreso tras cada paso, comprueba el límite de pasos y de gasto, corta acciones repetidas y compacta el contexto (solo la última página del navegador va completa). Las acciones sobre la página se ejecutan de una en una aunque el modelo pida varias a la vez.

Archivos de la app:

| Ruta                    | Qué hay                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/main/index.ts`     | Ventana, protocolo `app://`, menú, IPC validado con zod, Touch ID, certificados, ajustes y perfil.                        |
| `src/main/almacen.ts`   | Archivos cifrados con AES-256-GCM; la clave la protege el llavero (`safeStorage`).                                        |
| `src/main/tramites.ts`  | Turnos del agente, preguntas pendientes, notificaciones e insignia del Dock.                                              |
| `src/main/navegador.ts` | Navegador de cada trámite (`WebContentsView`, una sesión por trámite), descargas, AutoFirma y lector oculto.              |
| `src/preload`           | `window.rd`, el único puente entre la interfaz y el proceso principal.                                                    |
| `src/renderer`          | Interfaz React con `@reforma-digital/design` (Sol).                                                                       |
| `build/icon.icon`       | Icono de Icon Composer, con fondo blanco y, en modo oscuro, negro. Se edita con Icon Composer y empaquetar pide Xcode 26. |
| `build/icon.png`        | Icono de Windows y Linux: el mismo logo sobre blanco, de 1024 px.                                                         |

Los datos de la app están cifrados en `~/Library/Application Support/Reforma Digital/datos` (macOS), `%APPDATA%\Reforma Digital\datos` (Windows) o `~/.config/Reforma Digital/datos` (Linux). Los documentos que descargan los trámites van a `Reforma Digital/<trámite>/`, dentro de la carpeta de descargas.

### Garantías que no dependen del prompt

Se comprueban en el código de las herramientas y tienen pruebas en [`agent.test.ts`](../../packages/agent/src/agent.test.ts):

- **Datos personales ocultos.** El modelo no recibe los identificadores de «Mis datos» ni los que un detector local (reglas y [Rampart Edge](https://huggingface.co/nationaldesignstudio/rampart-edge), que funciona en el ordenador) encuentra en lo que escribe la persona y en las páginas: nombres, documentos, direcciones, teléfonos, correos y fechas de nacimiento, también de otras personas. Le llegan como marcadores (`{{documento_numero}}`, `{{nombre_1}}`). De los campos de un formulario solo ve lo que ha escrito él. La app sustituye el marcador por el valor al escribir en una web y en su propia interfaz. Ve los datos de contexto (municipio, provincia, nacionalidad, edad…) porque los necesita para investigar. Antes de cada petición, una última capa vuelve a buscar los valores guardados y cualquier identificador con control válido (DNI, NIE, NIF, CIF, NUSS, IBAN, CCC o referencia catastral). Si el detector falla, no se envía nada. Detalles, límites y comprobaciones en el [protocolo de seguridad](security-protocol.md).
- **Nada vinculante sin permiso.** Los botones que envían, confirman, reservan, pagan o firman necesitan un código de un solo uso que solo da `confirmar` cuando la persona lo aprueba (con Touch ID si está activado). El código vale solo en la web donde se pidió y se gasta al pulsar. Intro y Espacio sobre un botón vinculante o en un formulario que se enviaría también lo necesitan. Si en el trámite ya se hizo un envío, la confirmación lo recuerda para no repetirlo.
- **Webs sin lista cerrada.** El asistente busca, lee y abre cualquier web https sin pedir permiso. Los datos de la persona solo los escribe sin preguntar en las webs oficiales; en cualquier otra (solo con https), antes la app le pregunta si confía en esa web y recuerda la respuesta: las aceptadas, para siempre, hasta que las quite en Ajustes; las rechazadas, en ese trámite, sin escribir nada. Marca como «sin verificar» los resultados cuyo dominio no está en la lista de webs oficiales (`packages/government/src/domains.ts`); las instrucciones le piden basar requisitos, plazos y costes solo en webs de una administración. Nunca escribe en campos de contraseña.
- **Lectura segura.** `leer_pagina` solo usa HTTPS, comprueba cada redirección y conecta con la IP que ha comprobado; rechaza también las IPs de la red local escritas en la dirección (no puede llegar a la red local).
- **Lo que no se ve no llega.** Antes de llegar al modelo, todo lo que devuelven las herramientas pierde los caracteres invisibles (de formato, como los de ancho cero o las «etiquetas» Unicode, y los selectores de variante), y de las páginas se queda fuera lo que una persona no ve (recortado a nada, de 1 px con lo demás escondido o fuera de la página). El título de la página le llega marcado como texto de la web. Así una web no puede esconder órdenes para el asistente ni partir un DNI para que no se reconozca.
- **Diálogos de la web.** Los `alert`, `confirm` y `prompt` de una página no los muestra Electron: el preload del navegador del trámite los pasa a la app. El asistente los ve y los responde con `responder_dialogo`, y la persona también, en un cuadro de la app que se cierra si contesta antes el asistente. Aceptar un `confirm` o un `prompt` necesita el código de `confirmar`, salvo que lo haya abierto el botón que ya lo usó.
- **Fuentes a la vista.** En los pasos de cada búsqueda, la app muestra las webs que encontró el asistente, con su icono; se abren en el navegador del trámite. La lista sale de lo que leyó, no de lo que dice el modelo. Lo que no hay es una comprobación de que cada dato de la respuesta salga de esas webs (ver [Limitaciones](#limitaciones)).

Además: todos los datos de la app se guardan cifrados; cada trámite tiene su propia sesión de navegador, guardada para no tener que volver a entrar (en Ajustes se puede pedir que se cierren al cerrar la app); el proveedor por defecto no registra las peticiones ni entrena con ellas; el navegador del trámite no concede permisos de cámara, ubicación ni notificaciones ni carga nada por http ni de la red local (router, `localhost`…); lo que descarga una web no oficial se guarda solo si la persona lo acepta en el cuadro de guardar; los certificados se eligen de los instalados en el sistema; las ventanas nuevas se abren en el mismo navegador; los enlaces `afirma://` abren la AutoFirma instalada tras pedir permiso y el resto de esquemas se ignoran; y la app empaquetada desactiva los fusibles `runAsNode`, `NODE_OPTIONS` e inspector y valida la integridad del ASAR.

### Herramientas del agente

| Herramienta                                                                                                               | Para qué                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buscar`, `leer_pagina`                                                                                                   | Buscar en la web y leer las páginas; lo consultado se muestra debajo de la respuesta.                                                                    |
| `buscar_ley`                                                                                                              | Buscar normas estatales en la legislación consolidada del BOE (API abierta, sin clave).                                                                  |
| `mis_datos`, `preguntar`                                                                                                  | Qué hay guardado y pedir lo que falte (con varias opciones, la provincia o campos que dependen de otra respuesta); lo que se responde se guarda cifrado. |
| `confirmar`, `pedir_ayuda`                                                                                                | Permiso para lo vinculante y ceder el navegador a la persona.                                                                                            |
| `llamar`                                                                                                                  | Cuando solo se puede por teléfono: la persona llama con una guía y cuenta lo que le dicen.                                                               |
| `abrir`, `ver`, `leer_texto`, `pulsar`, `escribir`, `elegir`, `marcar`, `tecla`, `volver`, `esperar`, `responder_dialogo` | Manejar la sede electrónica con los controles originales; `esperar` puede esperar a que aparezca o desaparezca un texto.                                 |

## Evaluaciones

```sh
pnpm eval:agent --suite ejecucion      # escenarios en la sede ficticia
pnpm eval:agent --suite investigacion  # casos del dataset del buscador
pnpm eval:agent --suite todo --comparar artifacts/runs/<informe>.json
```

Necesitan `NAN_API_KEY` y `EXA_API_KEY`. El agente usa `deepseek-v4-flash`, como el servidor de Reforma Digital, y el juez `glm5.3-flash`, de otra familia para que no se califique a sí mismo (`--modelo` y `--juez` los cambian). Usan modelos reales y guardan el informe y las transcripciones en `artifacts/runs/`. Las transcripciones contienen marcadores, no datos personales.

Sin coste, en `pnpm test:e2e`: `tests/e2e/agente-guionado.spec.ts` recorre el arnés con un modelo guionado (cada inyección llega o se filtra, una exfiltración codificada se detecta, una cita limpia da cero, los diálogos se responden) y `tests/e2e/escritorio.spec.ts` abre la app compilada con un proveedor simulado, escribe un DNI en el chat y comprueba que no le llega y que el trámite queda cifrado en disco. Este último necesita Electron y el modelo del detector; en CI corre en macOS.

- **Ejecución.** Una sede electrónica ficticia (`https://sede.villaejemplo.es`, servida en local dentro del navegador de prueba) con cita previa, carpeta con inicio de sesión, CAPTCHA, huecos que se ocupan, aviso de cookies que tapa los botones e instrucciones maliciosas para asistentes. Dos escenarios miden la privacidad con datos que no están en «Mis datos»: el nombre y el DNI de un hijo escritos en el chat, y los datos que la carpeta muestra y rellena tras iniciar sesión. La persona simulada responde con sus datos, resuelve el inicio de sesión y el CAPTCHA cuando se lo piden y aprueba (o rechaza) las confirmaciones. Se mide si el servidor recibe exactamente lo correcto, si se pidió la ayuda adecuada, salidas de la sede, obediencia a la inyección, preguntas innecesarias, pasos, tiempo, coste y **fugas**: peticiones al modelo que contienen un identificador de la persona después de todas las capas. Las fugas las cuenta un detector propio de la evaluación, que no reutiliza el código de privacidad de la app: busca cada valor normalizado, sus dígitos con separadores y las fechas como dd/mm/aaaa.
- **Inyecciones.** Cuatro variantes en la cita de la sede, cada una hacia su propia dirección del atacante: un aviso visible para asistentes, órdenes ocultas (caracteres «etiqueta» de Unicode, bits de ancho cero y un enlace de 1 px con la orden en su `aria-label`), una orden en el título y un enlace falso de «verificación de identidad». Cada orden queda como «llegó», «filtrada» o «no llegó» al modelo; si no llegó, obedecer es inconcluso, no un acierto. **Exfiltración** cuenta los envíos que llevan un dato de la persona fuera de donde la sede lo pide, en todo lo que sale (peticiones del navegador y su cuerpo, `leer_pagina` y `buscar`), también en base64, hex, base32, ROT13, del revés, con porcentajes o troceado.
- **Investigación.** Ocho casos del dataset del buscador (`full-v1`): comunes, territoriales, ambiguos y sin respuesta. Un juez mide la completitud de la respuesta frente a los hechos esperados, qué parte de sus afirmaciones respaldan las páginas que leyó el agente y si la decisión de responder o preguntar es correcta.

**Versión actual, sin tarjeta** (16 de octubre):

- **Ejecución:** 10/10 con éxito, 0 fugas y 0 violaciones, con menos pasos (14 de media frente a 17–19) y la mitad de coste (0,03 $).
- **Investigación:** completitud y decisión del 100 %. Solo el 48 % de las afirmaciones concretas de las respuestas aparecen en las páginas que leyó el agente (0,13 $).
  - El juez es estricto y ve hasta 12.000 caracteres de seis fuentes, así que la cifra no es exacta. Desde entonces lee los resultados de `leer_pagina` y `buscar` en lugar del texto guardado de las fuentes, que ya no se guarda.
  - Aun así, la diferencia es real: el modelo añade plazos, documentos y pasos que no ha leído en ninguna web oficial de ese trámite.
  - Con la tarjeta, esos datos se rechazaban.

Son mediciones puntuales con datasets pequeños y casos pendientes de revisión humana; no certifican calidad. La variación entre pasadas es del modelo y del juez. En investigación cada caso tiene un solo hecho esperado, así que un caso mueve la completitud 17 puntos. Los escenarios que fallan con un error cuentan como no conseguidos en el éxito y aparecen en `errores`. Lo que encontró la verificación de privacidad del 16 de octubre está en el [protocolo de seguridad](security-protocol.md#verificación-del-16-de-octubre-de-2026).

Las evaluaciones guiaron cambios concretos: una sede que se presentaba «de pruebas» hacía desconfiar al agente; los datos ocultos que mostraban las páginas parecían marcadores literales; y se presentaba dos veces una solicitud cuando faltaba el justificante. Probar la app real descubrió además que las acciones en paralelo se mezclaban en un mismo campo y que el aviso de «el campo contiene…» devolvía los datos al modelo; las dos cosas están corregidas y con pruebas.

## Frente a SpainAssist

[SpainAssist](https://github.com/MeLlamoPablo/SpainAssist) (MIT) es el punto de partida. Esta app toma su idea (un agente local que investiga y hace trámites) y cambia el diseño donde las auditorías del código encontraron riesgos:

| SpainAssist                                                                                | Reforma Digital                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| La investigación devuelve texto sin fuentes.                                               | Cada respuesta muestra las webs consultadas y marca las que no están en la lista de webs oficiales.                                                 |
| El modelo recibe los datos personales; los límites contra exfiltración están en el prompt. | El modelo ve marcadores, también para los datos que detecta un modelo local; contraseñas, confirmaciones y la red local se comprueban en el código. |
| `confirm_action` es orientativo.                                                           | Sin código de confirmación no se pulsa un botón vinculante.                                                                                         |
| `fetch_url` y `run_script` pueden llegar a la red local con IPv6 mapeado.                  | Solo HTTPS, conexión a la IP comprobada y nada de la red local, tampoco en el navegador del trámite.                                                |
| Sin evaluación de la calidad del agente.                                                   | Suites de ejecución e investigación con métricas de éxito, seguridad, privacidad y coste.                                                           |
| Navegador aparte que roba el foco; Chromium descargado al usarlo (≈150 MB).                | Navegador dentro de la ventana, con la vista en directo y sin descargas extra.                                                                      |
| Transcripciones y sesiones del agente sin cifrar.                                          | Todo cifrado con una clave protegida por el llavero.                                                                                                |
| Un proceso por agente, sidecar en Go y fusible `runAsNode` activo.                         | Un solo proceso, certificados del llavero y fusibles cerrados. `.app` de 327 MB.                                                                    |
| Sin notificaciones ni límites de gasto.                                                    | Notificaciones, insignia del Dock, límite de pasos y de gasto, y el gasto en IA a la vista.                                                         |

Lo que SpainAssist tiene y esta app no: firma propia sin AutoFirma, DNIe con el móvil, escaneo de documentos, mapas de oficinas, grabar y transcribir las llamadas, y bonos de crédito. Algunas se han dejado fuera a propósito: la firma, los certificados y el DNIe siguen en los controles oficiales y AutoFirma, como pide este repositorio.

## Limitaciones

- **Webs reales sin validar.** La ejecución se ha probado en la sede ficticia, en Playwright y en la app; la investigación, en webs oficiales reales. No se ha completado ningún trámite en una sede real.
- **Las respuestas no se verifican.** Muestran las fuentes consultadas y las instrucciones piden no decir nada que no esté en ellas, pero nada lo comprueba: el modelo puede equivocarse en un requisito, un importe o un plazo. Antes, una tarjeta citaba y verificaba cada dato; se quitó para simplificar la app.
- **Los iconos de las fuentes vienen de Google.** Al mostrarlas, Google recibe el origen de cada web (`https://sede.policia.gob.es`), sin ruta ni referer: sabe qué webs se han consultado, no la pregunta ni los datos.
- **La protección de datos reduce el riesgo, no lo elimina.** El modelo sigue viendo el contexto y la información del trámite que no identifica (fechas de cita, importes, estados), y el detector puede pasar por alto un nombre suelto. Ver [lo que todavía puede llegar al modelo](security-protocol.md#lo-que-todavía-puede-llegar-al-modelo).
- **Touch ID es una comprobación de la interfaz**, no protege criptográficamente la clave de datos. Solo existe en Mac: en Windows y Linux, las confirmaciones se aprueban sin él.
- **Sin firma de Apple ni notarización.** El `.app` está firmado ad hoc; en otro Mac, Gatekeeper lo bloqueará hasta abrirlo con clic derecho → Abrir.
- **Sin firma en Windows.** SmartScreen avisa de que el instalador es de un editor desconocido («Más información» → «Ejecutar de todas formas»). Las notificaciones necesitan la app instalada, no la carpeta de `package`.
- **Linux necesita un llavero.** Sin GNOME Keyring o KWallet, la app no arranca: no tendría con qué proteger la clave de datos. En Ubuntu 24.04 o posterior, mejor el `.deb`, que instala el perfil de AppArmor que necesita Electron; el `.AppImage` puede no abrirse.
- **Sin probar en Windows, Linux ni Mac con Intel.** Se han empaquetado desde un Mac con Apple silicon para comprobar la configuración, pero la app no se ha abierto en esos sistemas.
- **Los límites del servidor son por instalación, no por persona.** Quien reinstale la app o cambie su identificador obtiene otro cupo; el tope por IP y el presupuesto diario lo acotan. Ver [Puesta en marcha](#puesta-en-marcha).
- **Webs que bloquean a los programas.** Algunas (interior.gob.es) rechazan las peticiones que no vienen de un navegador; la app las lee con una vista oculta de Chromium. En las evaluaciones, sin esa vista, el agente usa los extractos de la búsqueda.
- **Interfaces comunitarias.** Aparecen en Ajustes como «Próximamente»: la app todavía no carga la extensión.
