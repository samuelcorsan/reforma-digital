# Contribuir

Cada cambio de un trámite se desarrolla dentro de `sites/<portal>`. El código compartido se mantiene en `packages/`; `apps/extension` se encarga de Chrome y `apps/playground` sirve para desarrollo local.

## Crear o mejorar una interfaz

1. Crea el subproyecto con `npm run site:new -- <id>` o entra en uno existente.
2. Define los dominios HTTPS exactos y el prefijo de rutas en `site.config.json`. Mantén `enabled: false` mientras no haya una pantalla implementada. Si el servicio usa rutas distintas en cada dominio, usa `routes` en lugar de `origins` + `pathPrefix` (ver `sites/extranjeria/site.config.json`): cada ruta es un `pathPrefix` terminado en `/` o un `path` exacto, y nunca un dominio entero. Anota en `verifiedAt` la fecha en que comprobaste las conexiones contra la web real.
3. Crea `src/pages/<pantalla>/page.tsx` y `bindings.ts`. La primera define la interfaz y la segunda identifica los controles originales. Registra la pantalla en `src/pages/index.ts`.
4. Reutiliza componentes de `packages/react` (campos conectados) y `packages/design` (componentes visuales). Los componentes específicos de ese portal van en su `src/components/`. Todo lo visual sigue [DESIGN.md](DESIGN.md): no definas colores, tamaños ni componentes propios.
5. Añade HTML sintético o anonimizado en `fixtures/` y pruebas en `tests/`. Documenta si proviene del DOM real o si solo representa el contrato esperado. Si el portal tiene `flow.ts`, `npm run site:live -- <id>` captura el HTML real de las páginas públicas sin scripts ni tokens de sesión. Añade `fixtures/routes.json` para que el laboratorio sirva esas páginas a las pruebas de navegador.
6. Actualiza el README del portal con rutas adaptadas, controles que permanecen originales y verificaciones pendientes.

Las páginas implementan `SitePage`. El registro verifica el dominio y rechaza rutas ambiguas. `prepare` devuelve `null` si el DOM no coincide con el contrato, o una `Enhancement` con el motor de conexiones, las zonas a reemplazar y una comprobación de integridad.

```tsx
import { DomBridge, fieldByLabel } from '@reforma-digital/bridge';
import { BridgeProvider, BoundField } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';

export const contactPage: SitePage = {
  id: 'contact',
  matches: (url) => url.pathname === '/tramite/contacto',
  prepare(document, _url, restore) {
    const email = fieldByLabel(document, 'Correo electrónico');
    if (!email) return null;
    const bridge = new DomBridge(
      { email: { element: email, label: 'Correo electrónico' } },
      {},
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Datos de contacto',
      description: 'Tu trámite',
      slots: [
        {
          source: email,
          render: () => (
            <BridgeProvider value={bridge}>
              <BoundField binding="email" />
            </BridgeProvider>
          ),
        },
      ],
      health: () => fieldByLabel(document, 'Correo electrónico') === email,
    };
  },
};
```

Este ejemplo requiere validar el comportamiento del campo en su portal. No basta con que coincida su etiqueta.

### Pantallas guiadas

Además de los `slots` (un control original sustituido en su sitio), una `Enhancement` puede declarar:

- `panels`: bloques de interfaz insertados junto a un elemento oficial (`anchor` + `position`), por ejemplo una guía con buscador que maneja los desplegables oficiales mediante el bridge. El contenido oficial no se mueve.
- `page` y `pageStyles`: el runtime añade `data-bg-site` y `data-bg-page` al `<html>` e inyecta los estilos de la pantalla. Solo pueden ocultar controles oficiales que el panel replica y sincroniza (DESIGN.md §4.2).
- `shell`: dónde va la barra comunitaria. Por defecto va al principio de `<body>`; úsalo si la cabecera oficial es fija y la taparía.

Si la web oficial pinta su contenido tarde (por ejemplo, tras una comprobación anti‑bot), el runtime espera hasta 12 s a que `prepare` encaje. Si no encaja, mantiene la interfaz original y muestra un aviso discreto que se puede cerrar. Ver `sites/extranjeria`.

## Conexiones y límites

`DomBridge` admite texto, email, teléfono, URL, búsqueda, textarea, selects, checkbox y radio. `BoundField` usa la conexión por identificador. Para un botón, declara una acción con su elemento original y usa `BoundButton binding="continuar"` o `bridge.activate('continuar')`. Si la web oficial usa un elemento no nativo como botón (un `<div>` con `onclick`), revísalo y decláralo con `custom: true`: activarlo es un `click()` sobre ese elemento.

Los controles permanecen en su formulario y lugar originales. La vista alternativa se monta junto al control y lo oculta durante la adaptación. Si hay una validación nativa en un campo oculto, el runtime restaura la interfaz antes de que el navegador intente enfocarlo.

No sustituyas CAPTCHA, firma, certificados, archivos, contraseñas o widgets de navegador con una conexión de texto. Déjalos originales. Los eventos sintéticos no equivalen a todas las interacciones del usuario; comprueba teclado, autofill, validación, dependencias entre campos, mensajes del servidor y controles de frameworks. Un control que dependa de eventos no reproducidos necesita una integración específica o permanecer original.

No clones formularios completos ni reproduzcas las peticiones HTTP. No extraigas tokens, cookies o datos de sesión. No añadas código remoto, telemetría ni persistencia de campos.

## Comprobaciones

```sh
npm run lint
npm run format
npm run check
npm run test:e2e
```

`npm run lint` ejecuta Oxlint con diez reglas básicas y dos reglas anti-slop: `no-chained-type-assertions` y `no-widen-then-assert`. Prettier sigue siendo el formateador y TypeScript comprueba los tipos. `npm run check` incluye el lint, por lo que el CI existente también lo exige.

La configuración está en `oxlint.config.ts`. Solo carga el plugin anti-slop de Ultracite; no hereda sus presets completos. Las reglas de hooks se aplican a JSX/TSX, para no confundir el callback `use` de las fixtures de Playwright con un hook. Si añades hooks en archivos `.ts` o `.js`, amplía ese alcance al código React correspondiente. Oxlint y Ultracite tienen versiones exactas; comprueba el lint del repositorio completo al actualizarlas.

Corrige la causa de cada diagnóstico. No añadas casts, wrappers, renombres ni comentarios de desactivación para esquivar una regla. Un cambio de reglas o alcance debe formar parte del objetivo autorizado de la PR.

Las pruebas de cada portal deben cubrir coincidencia exacta de dominio/ruta, DOM ambiguo o modificado, conexión de valores y preservación de los controles originales. Las pruebas de navegador deben comprobar los comportamientos que realmente cambia la interfaz.

### Web real

`npm run site:live -- <id>`, `site:record` y `site:preview` usan el `flow.ts` del portal (contrato en `scripts/lib/flow.ts`). Abren una ventana visible, recorren una sola vez las páginas públicas y se detienen antes de datos personales, CAPTCHA, disponibilidad o reservas. En modo headless las webs oficiales muestran su comprobación anti‑bot: no intentes saltarla. No los ejecutes en bucle.

`npm run check:workspaces` verifica los límites de dependencias. Un portal puede usar paquetes comunes, pero no importar código de otro portal o de una aplicación. Las utilidades compartidas deben moverse a `packages/`.

## Revisión de código

Una PR se fusiona cuando:

1. El check `check` del CI está en verde.
2. Todos los comentarios, de personas o de la revisión automática, están resueltos: arreglados o contestados con un motivo. GitHub no deja fusionar con conversaciones abiertas.
3. Si toca una ruta de [CODEOWNERS](.github/CODEOWNERS) (CI, reglas de lint, frontera de seguridad de la extensión o base de datos), su propietario la ha aprobado.

Antes de abrir la PR, quien la escribe pasa una revisión de correctitud con contexto limpio, a ser posible con el modelo que no escribió el cambio: `/code-review` en Claude Code o `/review` en Codex. Después pasa Ponytail Review para la simplicidad. En la PR, Codex revisa automáticamente con las [Code Review Rules](AGENTS.md#code-review-rules) y solo comenta problemas graves (P0 y P1).

Para revisar una PR, lee en este orden: la descripción y sus evidencias, los cambios en los tests, los contratos (tipos públicos, esquemas, `site.config.json`, manifiesto), los comentarios abiertos y, por último, el resto del diff. Si pasa de unas 1.500 líneas escritas a mano, pide que se divida.

## Versiones de la extensión

El repositorio usa una versión de distribución en el `package.json` raíz. Los workspaces son privados: se empaquetan dentro de la extensión y no se publican individualmente en npm. Los cambios de interfaces llegan mediante una nueva versión completa de la extensión.

Actualiza la versión raíz, registra el cambio en `CHANGELOG.md`, ejecuta las comprobaciones y crea el ZIP con `npm run package`. La configuración de CI comprueba el repositorio y produce un artefacto; no publica automáticamente en Chrome Web Store.
