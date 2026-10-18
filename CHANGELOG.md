# Cambios

## 0.1.0 · En desarrollo

- App para Mac (`apps/desktop`, experimental): un asistente investiga el trámite en webs oficiales, lo explica con las fuentes consultadas debajo de cada respuesta y lo hace en la sede con un navegador integrado. Los datos personales no llegan al modelo: los de «Mis datos» y los que un detector local (reglas y Rampart Edge) encuentra en el chat y en las páginas se envían como marcadores, y si el detector falla no se envía nada. No pide clave. Los envíos, pagos y firmas necesitan su aprobación; todo se guarda cifrado y cada trámite tiene su propia sesión web, que se guarda salvo que se pida cerrarla al salir de la app. Ver [apps/desktop](apps/desktop/README.md) y su [protocolo de seguridad](apps/desktop/security-protocol.md).
- App de escritorio sin claves dentro: habla con el servidor de Reforma Digital (`apps/web`, rutas `/api/escritorio`), que guarda las de NaN Builders y Exa y limita el gasto a 0,50 $ al día por instalación, 2,50 $ por IP (las IPv6, por su /64) y un tope diario entre todos para el modelo y otro para Exa.
- App de escritorio: también para Windows y Linux; otro proveedor de IA compatible con OpenAI o un modelo local (el de la app sigue por defecto); los diálogos de las webs se ven y se responden; espera a que aparezca un texto; llamada guiada; búsqueda de normas en el BOE; preguntas de varias respuestas, provincia y condicionales; el aviso del certificado dice en qué web se usa. A la IA no le llega lo que una persona no ve en una web ni los caracteres invisibles, y el detector valida con su algoritmo NIF, CIF, NUSS, CCC y referencia catastral, sigue el plan de numeración para los teléfonos y reconoce datos tras su etiqueta.
- `packages/agent`: el agente, sus herramientas y garantías, reutilizable fuera de Electron. `pnpm eval:agent` lo evalúa en una sede ficticia y con casos del dataset del buscador.
- `packages/government/src/domains.ts`: sufijos de dominio de las administraciones públicas españolas.
- Toda la IA del repositorio usa NaN Builders y la búsqueda web, Exa: el pipeline de búsqueda (`deepseek-v4-flash`, con `glm5.3-flash` como evaluador), las evaluaciones del agente y `pnpm doctor`. Se retiran Vercel AI Gateway y OpenRouter, y sus claves (`AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`).
- La web deja de incluir el chat: se retiran `/chat`, `/api/search`, `/api/feedback`, las páginas de fuentes y de funcionamiento del buscador y el panel `/admin/evals`. `/chat`, `/sources` y `/how-it-works` redirigen a la portada. El pipeline de búsqueda (`packages/ai`) y sus evaluaciones (`pnpm eval`) se conservan.
- El chat sustituye datos personales en el navegador con Rampart antes de enviar la consulta, y no la envía si esa protección falla.
- Monorepo con una extensión Chrome, laboratorio local y paquetes comunes.
- Subproyectos por portal, con pantallas y conexiones organizadas por carpeta.
- Adaptación experimental de entrada e identificación del DNI con fixtures sintéticas.
- Carpetas preparadas para Hacienda y Registro de Asociaciones, desactivadas.
- Conexiones de controles React, recuperación del original y pruebas de navegador.
- Sistema de diseño común (`packages/design`, DESIGN.md): tokens con contraste AA, componentes y tema para webs con el framework Morfos de la AGE. El runtime, el popup y los portales lo usan.
- Portal de cita previa de Extranjería (experimental): página informativa, provincia, oficina y trámite, e información del trámite con la elección con o sin Cl@ve. Fixtures con HTML real de las páginas públicas.
- `site.config.json` admite `routes` con varias rutas por dominio y `verifiedAt`. Un content script por portal.
- Pantallas guiadas en el runtime (`panels`, `page`, `shell`) y espera a contenido oficial tardío con aviso de interfaz original.
- Acciones `custom` en `DomBridge` para elementos no nativos revisados.
- Herramientas `site:live`, `site:record` y `site:preview` para trabajar con la web real y sin conexión.
- DNI con tema de página completa, ayudas leídas de la página oficial y fixtures reales.
- Hacienda (experimental): «Asistencia y Cita» y buscador del catálogo de servicios de la Agencia Tributaria. Tema `aeat.css`.
- Registro de Asociaciones (experimental): consulta pública del Fichero de Denominaciones con campo conectado. Tema `sede-interior.css`.
- `DomBridge` aplica los límites de longitud del control oficial antes de enviar el formulario (los valores escritos por script no los activan en el navegador).
- Las capturas de las herramientas no alteran los controles oficiales (`caret: 'initial'`) y la reproducción sin conexión distingue peticiones por método y cuerpo.
- DNI con tema de página completa, ayudas leídas de la página oficial y fixtures reales.
- Hacienda (experimental): «Asistencia y Cita» y buscador del catálogo de servicios de la Agencia Tributaria. Tema `aeat.css`.
- Registro de Asociaciones (experimental): consulta pública del Fichero de Denominaciones con campo conectado. Tema `sede-interior.css`.
- `DomBridge` aplica los límites de longitud del control oficial antes de enviar el formulario (los valores escritos por script no los activan en el navegador).
- Las capturas de las herramientas no alteran los controles oficiales (`caret: 'initial'`); la reproducción sin conexión distingue peticiones por método y cuerpo.
