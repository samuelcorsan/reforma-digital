# Reforma Digital · Sistema de diseño

Versión 2.0 · 2026‑10‑06

Este documento es la referencia visual de Reforma Digital. Los dos ámbitos viven en `packages/design` (`@reforma-digital/design`) y no comparten tokens: la extensión y las adaptaciones de sedes oficiales usan `src/`, el preset y `themes/` (§§1–7); la web pública usa **Sol** (`sol/`, §8), el sistema de la portada definitiva, el buscador y las páginas informativas. Cada ámbito reutiliza sus tokens y componentes; las capturas y ejemplos de sedes conservan su identidad oficial.

| Qué                                    | Dónde vive en el código                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens (color, forma, tipografía)      | [`packages/design/src/tokens.css`](packages/design/src/tokens.css)                                                                                                                                                                                                            |
| Componentes (botones, campos, avisos…) | [`packages/design/tailwind-preset.js`](packages/design/tailwind-preset.js)                                                                                                                                                                                                    |
| Componentes React                      | [`packages/design/src/ui/components.tsx`](packages/design/src/ui/components.tsx) · campos conectados en [`packages/react`](packages/react/src/index.tsx)                                                                                                                      |
| Temas para webs oficiales              | [`themes/morfos.css`](packages/design/themes/morfos.css) (framework Morfos de la AGE) · [`themes/aeat.css`](packages/design/themes/aeat.css) (Agencia Tributaria) · [`themes/sede-interior.css`](packages/design/themes/sede-interior.css) (Sede del Ministerio del Interior) |

Los componentes se definen **una sola vez** en el preset. Los paneles los usan como clases (`bg-btn bg-btn-primary`) y los temas los aplican a los elementos oficiales con `@apply`. Así, un botón oficial y un botón del panel son idénticos por construcción.

---

## 1. Principios

1. **La web oficial manda.** Toda la información sale de la página oficial y todas las acciones ejecutan controles oficiales. El diseño lo deja claro: etiqueta «Interfaz comunitaria · sitio oficial», dominio visible y bloques de «Información oficial».
2. **Una sola voz visual.** Mientras la mejora está activa, toda la página (panel, contenido oficial, cabecera, pie) usa los mismos tokens y componentes. No hay «islas» con estilos distintos.
3. **Claridad antes que decoración.** Una acción principal por pantalla, jerarquía tipográfica corta, mucho aire y nada de ornamentos.
4. **Nada importante se oculta.** Los avisos legales, errores, condiciones y requisitos se re‑maquetan, pero nunca se esconden, se acortan ni se reordenan.
5. **Accesible por defecto.** Todo cumple WCAG 2.2 AA: contraste, foco visible, objetivos de 44 px y controles nativos.
6. **Privado por diseño.** La extensión no carga fuentes, imágenes ni scripts remotos: todo va dentro del paquete. Las dependencias externas de la web pública se describen en §8 y en `/privacy`.

## 2. Tokens

### 2.1 Color

Los valores están en `packages/design/src/tokens.css` como canales RGB (`--bg-brand-600: 20 20 20`). El contraste está medido sobre blanco salvo que se indique otra cosa.

| Token              | Hex                               | Uso                                                                      | Contraste             |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------ | --------------------- |
| `ink`              | `#141414`                         | Texto principal, títulos                                                 | 18.4:1 sobre blanco   |
| `ink-muted`        | `#555555`                         | Texto secundario, ayudas                                                 | 7.5:1 sobre blanco    |
| `ink-subtle`       | `#696969`                         | Metadatos, eyebrow                                                       | 5.5:1 sobre blanco    |
| `canvas`           | `#F7F7F8`                         | Fondo de página                                                          | —                     |
| `surface`          | `#FFFFFF`                         | Tarjetas, campos                                                         | —                     |
| `surface-muted`    | `#F4F4F5`                         | Zonas secundarias, avisos neutros                                        | —                     |
| `line`             | `#EBEBEB`                         | Bordes de tarjeta, separadores                                           | decorativo            |
| `line-strong`      | `#DCDCDC`                         | Borde de opciones seleccionables                                         | decorativo            |
| `line-control`     | `#808080`                         | Borde de campos y botón secundario                                       | 3.9:1 sobre blanco    |
| `brand-600`        | `#141414`                         | **Acción principal**, enlaces, foco                                      | 18.4:1 sobre blanco   |
| `brand-700`        | `#2D2D2D`                         | Hover de acción/enlace                                                   | 13.8:1 sobre blanco   |
| `brand-50/100/200` | `#F7F7F7` `#EEEEEE` `#CDCDCD`     | Badge, selección y paso actual (`100`), anillo de foco de campos (`200`) | —                     |
| `brand-900`        | `#141414`                         | Texto sobre `brand-50`                                                   | 17.2:1 sobre brand-50 |
| `info-*`           | `#EFF6FF` · `#BFDBFE` · `#1E3A8A` | Aviso informativo (fondo · borde · texto)                                | 9.5:1                 |
| `warning-*`        | `#FFFBEB` · `#FCD34D` · `#78350F` | «Lee esto antes de continuar»                                            | 8.8:1                 |
| `danger-*`         | `#FEF2F2` · `#FCA5A5` · `#991B1B` | Errores y énfasis rojo de la web oficial                                 | 7.6:1                 |
| `success-*`        | `#ECFDF3` · `#A6F4C5` · `#05603A` | Confirmaciones                                                           | 7.3:1                 |

Reglas:

- Solo hay **un color de acción**: `brand-600`. No hay botones rojos, verdes ni del color corporativo de la web oficial.
- El color nunca es el único indicador: la selección lleva borde, fondo **y** peso de fuente; el estado del paso lleva número o ✓ **y** texto oculto para lectores de pantalla.
- Modo oscuro: **no** en la v1. El contenido oficial (tablas, imágenes, estilos inline) no se puede invertir con garantías.

### 2.2 Tipografía

Fuente: Helvetica Neue, Helvetica y Arial como alternativa. No se cargan fuentes remotas (§1.6).

| Clase                  | Tamaño / interlineado       | Peso | Uso                                                 |
| ---------------------- | --------------------------- | ---- | --------------------------------------------------- |
| `bg-h1`                | 28/1.2 (24 en móvil)        | 500  | Título del panel, uno por página                    |
| `bg-h2`                | 20/1.3                      | 650  | Secciones, títulos oficiales re‑maquetados          |
| `bg-h3`                | 17/1.4                      | 600  | Subsecciones, grupos de opciones                    |
| `bg-lead`              | 17/1.6                      | 400  | Entradilla bajo el título                           |
| `bg-text`              | 16/1.6                      | 400  | Cuerpo. **Mínimo absoluto para lectura**            |
| `bg-small` / `bg-hint` | 14/1.5                      | 400  | Ayudas y metadatos. Nunca para información esencial |
| `bg-eyebrow`           | 12/1.4, mayúsculas, +0.06em | 600  | Rótulos («Información oficial», «Paso 2 de 5»)      |

- Las líneas de lectura no pasan de unos 75 caracteres (`max-width: 70ch` en el cuerpo).
- Los textos oficiales en MAYÚSCULAS se muestran tal cual: no se reescriben.

### 2.3 Espaciado, forma y elevación

- Retícula de **4 px**. Escala habitual: 4, 8, 12, 16, 20, 24, 32, 48.
- Entre bloques de un panel: 20 px. Relleno de tarjeta: 16 px en móvil y 24 px desde 640 px.
- `--bg-radius-control`: **16 px** (campos, opciones, avisos, pasos). `--bg-radius-card`: **24 px** (tarjetas y panel). Píldora (`999px`) para botones, buscador y badge.
- Tarjetas **sin borde ni sombra**: una superficie blanca sobre el `canvas` gris. La línea (`line`) solo separa elementos dentro de una tarjeta. `shadow-raised` queda para el aviso flotante de fallback; nada más flota.
- Ancho máximo del contenido: **1120 px** (`--bg-content-max`).
- Puntos de corte: `sm` 640 px (una a varias columnas) y `lg` 1024 px (aparece la barra lateral oficial). Todo se diseña primero a **375 px**.

### 2.4 Movimiento

- Solo transiciones de color de 150 ms en hover. Sin animaciones de entrada.
- `prefers-reduced-motion: reduce` desactiva todas las transiciones y el desplazamiento suave.

## 3. Componentes

Los nombres de clase son los del preset. En React se usan los componentes que exporta `@reforma-digital/design`.

| Componente               | Clases                                                                             | React                                   | Reglas                                                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Barra superior**       | `bg-badge` + `bg-btn-secondary`                                                    | `Shell` (runtime) + `CommunityBadge`    | La pinta el runtime en toda página mejorada: «Interfaz comunitaria · sitio oficial», el dominio actual y el botón «Ver original». Ningún portal la repite.                                                                                                         |
| **Panel**                | `bg-card`                                                                          | `Panel`                                 | Uno por página, justo después del título oficial. Contiene: `bg-h1` → `bg-lead` → progreso → contenido.                                                                                                                                                            |
| **Campo conectado**      | `bg-bound` + `bg-label` + `bg-field` + `bg-hint`                                   | `BoundField` (`@reforma-digital/react`) | Sustituye un control oficial en su sitio (slot) y lo sincroniza mediante `DomBridge`.                                                                                                                                                                              |
| **Progreso**             | `bg-step` (+`bg-step-current`, `bg-step-done`, `bg-step-todo`) + `bg-step-num`     | `ProgressSteps`                         | Fichas sin borde con `aria-current="step"` desde 640 px: el paso actual lleva fondo `brand-100`, número en negro y peso 600; los hechos, ✓. En móvil, una barra segmentada más «Paso N de M: nombre». Los pasos fuera del alcance llevan «solo en la web oficial». |
| **Botón principal**      | `bg-btn bg-btn-primary` (+`bg-btn-lg`)                                             | `PrimaryAction`                         | Uno por pantalla. Verbo más destino («Continuar con Madrid»). Deshabilitado solo con una ayuda que diga por qué. Si la web oficial ofrece opciones equivalentes (p. ej. con o sin Cl@ve), **ninguna** se destaca: todas van como secundarias.                      |
| **Botón secundario**     | `bg-btn bg-btn-secondary`                                                          | `SecondaryAction`                       | «Volver» y acciones alternativas.                                                                                                                                                                                                                                  |
| **Enlace**               | `bg-link`                                                                          | `LinkButton`, `ExternalLink`            | Siempre subrayado. Los externos llevan ↗ y «(se abre en una pestaña nueva)» para lectores de pantalla.                                                                                                                                                             |
| **Campo**                | `bg-label` + `bg-field` + `bg-hint`                                                | —                                       | Etiqueta visible siempre; el placeholder solo pone ejemplos.                                                                                                                                                                                                       |
| **Buscador**             | `bg-field bg-field-search`                                                         | `SearchField`                           | El mismo campo en píldora. Busca sin tildes ni símbolos («clave» encuentra «Cl@ve») y dice cuántos resultados hay.                                                                                                                                                 |
| **Opción seleccionable** | `bg-choice` (+`bg-choice-checked`)                                                 | `Choice`                                | `radio` nativo dentro de `label`. Seleccionada: borde `brand-600`, fondo `brand-100` y peso 600. Se usa en listas largas con buscador; con menos de 7 opciones, radios sin buscador.                                                                               |
| **Aviso**                | `bg-callout bg-callout-{info,warning,danger,success,neutral}` + `bg-callout-title` | `Callout`                               | `warning` = «lee esto antes de seguir»; `danger` = errores (con `role="alert"`); `neutral` = texto legal.                                                                                                                                                          |
| **Bloque oficial**       | `bg-eyebrow`                                                                       | `OfficialDivider`                       | Separa el panel del contenido oficial: «Información oficial de esta página».                                                                                                                                                                                       |
| **Aviso de fallback**    | `bg-card shadow-raised`                                                            | `FallbackNotice`                        | Esquina inferior izquierda, se puede cerrar y no bloquea nada.                                                                                                                                                                                                     |

## 4. Cómo se viste la web oficial

Mientras la interfaz está activa, el runtime (`packages/runtime`) añade `data-bg-site="<portal>"` y `data-bg-page="<pantalla>"` al `<html>` e inyecta los `pageStyles` de la pantalla. Al pulsar «Ver original», desactivar el portal o si falla un control oficial, **se quita todo** y la página vuelve a ser la original.

### 4.1 Qué se re‑estiliza

| Zona oficial                                                                 | Se muestra como                                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fondo, tipografía y color del texto                                          | `canvas`, `bg-text`, `ink`                                                                             |
| Cabecera (logotipos oficiales, título de la sede y menú)                     | Barra blanca con borde; los **logotipos oficiales se mantienen** intactos y el menú pasa a texto `ink` |
| Migas de pan y rótulos                                                       | `bg-small` / `bg-eyebrow`                                                                              |
| Título oficial de la página («CITA PREVIA EXTRANJERÍA»)                      | `bg-eyebrow`: queda como rótulo sobre el panel                                                         |
| Contenedor principal y barra lateral                                         | `bg-card`                                                                                              |
| Títulos oficiales (`h2`, `h3`, `.mf-paragraph-header`)                       | `bg-h2` / `bg-h3`                                                                                      |
| Párrafos y listas                                                            | `bg-text`, `max-width: 70ch`                                                                           |
| Enlaces                                                                      | `bg-link`                                                                                              |
| Notas (`.mf-note`) y listas de avisos                                        | `bg-callout-warning` o `bg-callout-neutral`                                                            |
| Aviso de protección de datos (`fieldset` con estilo inline)                  | `bg-callout-neutral`                                                                                   |
| Texto en rojo inline (`style="color: red"`)                                  | `danger-fg`: **se mantiene el énfasis**                                                                |
| Errores oficiales (`.error_list`, `.mf-msg__error`)                          | `danger-fg`                                                                                            |
| Botones oficiales (`.mf-button`, `input[type=submit]`, `input[type=button]`) | `bg-btn` primario o secundario                                                                         |
| Campos oficiales (`select`, `input`)                                         | `bg-field`                                                                                             |
| Opciones con/sin Cl@ve (`.mf-button__primary/secondary` en `acInfo`)         | `bg-card` interactiva                                                                                  |
| Barra de cookies                                                             | Tarjeta fija abajo con botones `bg-btn`. **No se oculta ni se acepta.**                                |
| Pie                                                                          | `bg-small` sobre `surface`                                                                             |

### 4.2 Controles oficiales duplicados

Si un panel ofrece un control sincronizado con uno oficial (el desplegable de provincias, el de oficinas, el de trámites o el botón «Aceptar»), el tema puede ocultar **solo ese control oficial** mientras el panel está montado. Nunca se ocultan:

- mensajes de error ni sus contenedores,
- avisos, notas, textos legales ni requisitos,
- controles oficiales que el panel no replica (p. ej. `#divSubTramites`),
- nada en pantallas que el portal no tenga registradas.

«Ver original» (barra comunitaria o popup) y «Desactivar en este portal» los recuperan al instante.

### 4.3 Lo que nunca hace un tema

- `display: none`, `visibility: hidden` u `opacity: 0` sobre contenido informativo (solo se permite en controles duplicados, §4.2).
- Truncar texto (`line-clamp`, `text-overflow`), cambiar el orden del contenido oficial o bajar de 14 px.
- Cambiar o tapar los logotipos institucionales, o imitar la identidad de la Administración en elementos propios.
- Pintar botones propios con apariencia de botón oficial fuera del panel.

## 5. Contenido y tono

- **Tú**, frases cortas y verbos en imperativo amable: «Elige la provincia», «Lee los avisos oficiales».
- Atribuye siempre: «según la web oficial», «la web oficial indica».
- No prometas nada: nunca digas «hay citas», «es rápido» ni «tendrás cita». Tampoco inventes requisitos, plazos ni documentos.
- Nombra las cosas como la web oficial («Presentación sin Cl@ve»), aunque suenen raro, para que la persona las reconozca.
- Los números de paso, en cifras: «Paso 2 de 5».

## 6. Accesibilidad (lista de comprobación)

- [ ] Contraste AA en texto (4.5:1) y bordes de controles (3:1).
- [ ] Foco visible: contorno de 3 px `brand-600` con separación de 2 px en botones y enlaces, y anillo de 3 px `brand-200` más borde `brand-600` en campos.
- [ ] Objetivos táctiles de al menos 44 × 44 px.
- [ ] Controles nativos (`button`, `select`, `input[type=radio]`, `fieldset`/`legend`).
- [ ] Un solo `h1` visual por panel; en el HTML el panel usa `h2`, porque la página oficial ya tiene su `h1`.
- [ ] Cambios dinámicos anunciados con `aria-live` o `role="alert"` (errores oficiales).
- [ ] Sin scroll horizontal a 375 px.
- [ ] Se respeta `prefers-reduced-motion`.

## 7. Cómo añadir o cambiar algo

1. ¿Existe ya un token o componente? Úsalo.
2. Si no existe, añádelo **aquí primero** (tabla correspondiente), después en `tokens.css` o en el preset, y por último úsalo.
3. Revisa el resultado con `npm run site:preview -- <portal>`, que reproduce una visita grabada con `site:record` sin conexión y guarda capturas a 1280 y 390 px en `.cache/preview/<portal>/`. Para los campos conectados, usa el laboratorio (`npm run dev`).
4. Un PR que cambie el diseño debe incluir capturas y, si toca tokens de color, el contraste medido.

## 8. Web pública: sistema Sol

Sol es el diseño definitivo de `apps/web`, no una variante de portada. Las rutas públicas son `/` (iniciativa y proyectos), `/chat` (buscador), `/equipo`, `/sources`, `/elecciones`, `/how-it-works` y `/privacy`. Las evaluaciones conservan su acceso interno en `/admin/evals`. Las páginas de error usan el mismo sistema. No se mantienen catálogos de variantes ni demos de chat con respuestas simuladas.

| Fuente de verdad                                                                | Archivo                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colores, degradados, tipografía, espaciado, radios, sombras, movimiento y cajas | [`packages/design/sol/tokens.css`](packages/design/sol/tokens.css)                                                                                                                                                    |
| Botones y campos                                                                | [`sol/botones.css`](packages/design/sol/botones.css), [`sol/campos.css`](packages/design/sol/campos.css) · en React, `Button` y `Field` de [`@reforma-digital/design/sol`](packages/design/sol/components.tsx)        |
| Piezas del chat (pregunta, bloques de respuesta, avisos, Markdown, movimiento)  | [`sol/chat.css`](packages/design/sol/chat.css) · en React, [`@reforma-digital/design/sol/chat`](packages/design/sol/chat.tsx)                                                                                         |
| Utilidades de Tailwind v4                                                       | [`sol/tailwind.css`](packages/design/sol/tailwind.css)                                                                                                                                                                |
| Fuentes (Geist y Geist Mono con `next/font`), salto, marca e icono              | [`app/(search)/globals.css`](<apps/web/app/(search)/globals.css>), [`fuentes.ts`](apps/web/components/sol/fuentes.ts), [`logo.tsx`](apps/web/components/sol/logo.tsx), [`icon.tsx`](apps/web/components/sol/icon.tsx) |
| Navegación, pie y estructura informativa                                        | [`header.tsx`](apps/web/components/sol/header.tsx), [`footer.tsx`](apps/web/components/sol/footer.tsx), [`info-page.tsx`](apps/web/components/sol/info-page.tsx)                                                      |
| Guía detallada de componentes y contraste                                       | [`GUIA.md`](apps/web/components/sol/GUIA.md)                                                                                                                                                                          |

El paquete guarda los cimientos de Sol y `apps/web` solo los consume: `app/(search)/globals.css` importa `@reforma-digital/design/sol/*.css` y Tailwind, y el layout monta `.sol-raiz` y las fuentes una sola vez. Las páginas añaden su composición, sin volver a montar otro tema ni definir una segunda paleta. Los tokens `--bg-*` que necesitan el chat y el mapa se adaptan a Sol dentro de `sol/tokens.css`; no se cambian los tokens de la extensión. La composición propia de la web (cabecera, pie, recorrido, iniciativa, compositor del chat) sigue en `apps/web`.

### 8.1 Tipografía y retícula

- Las familias son las del sistema visual de Paper. Titulares y cifras grandes en `--font-titular` (FFF Tool Serif Text Book, alternativa Georgia); la serif nunca va en botones, menús ni texto corrido. Todo lo demás (cuerpo, entradillas `.t-texto-l`, interfaz, botones, menús y chat) en `--font-texto` (Geist 400 y 500). Datos, números y etiquetas en `--font-mono` (Geist Mono 400 y 500). Solo el logotipo usa `--font-logo` (Ufficio, alternativa Geist). Geist y Geist Mono son OFL; Next las empaqueta y las sirve desde la propia web.
- FFF Tool Serif Text ([Fonts From Folch](https://www.fontsfromfolch.com/)) y Ufficio ([Giulia Boggio](https://www.giuliaboggio.xyz/fonts/ufficio-sans), [EULA](https://www.giuliaboggio.xyz/Eula.pdf)) son de pago y hoy no se sirven. El repositorio no incluye sus archivos ni los declara, así que no hay peticiones fallidas y se ven las alternativas. Las dos exigen una licencia web por dominio, con los archivos en el servidor propio, y prohíben distribuirlos; la EULA de Ufficio nombra GitHub, pide una licencia aparte para logotipos y consentimiento escrito para usos políticos. Para activarlas:
  1. Comprar las licencias web para el dominio y, para Ufficio, la de logotipo.
  2. Copiar los WOFF2 de la licencia web en `apps/web/components/sol/fuentes/`, que git ignora. El despliegue debe aportarlos desde un almacenamiento privado: `next/font/local` detiene la compilación si faltan.
  3. En `fuentes.ts`, cargarlos con `next/font/local`: la serif con `weight: '400'`, `adjustFontFallback: 'Times New Roman'` y `variable: '--font-tool-serif'`; Ufficio solo en el peso del logotipo, con `preload: false` y `variable: '--font-ufficio'`. Añadir ambas clases a `fuentesSol`.
  4. En `packages/design/sol/tokens.css`, poner `var(--font-tool-serif)` al principio de `--font-titular` y `var(--font-ufficio)` al principio de `--font-logo`.
- Portada: titular centrado de 36–72 px; buscador, de 36–64 px; páginas informativas, de 36–60 px. Titulares de sección de 32–52 px, tarjetas de 24–30 px. Texto de lectura desde 16 px; ayudas y metadatos desde 14 px. Solo las etiquetas cortas en mayúsculas pueden medir 12 px.
- Retícula común de 1200 px, con márgenes laterales de 20–24 px. Los artículos informativos limitan la lectura a 760 px y los párrafos a unas 65 letras de ancho. Las rejillas de fuentes y colaboradores se separan con bordes compartidos, sin huecos ni sombras por celda. El equipo conserva cinco tarjetas por fila en escritorio.
- La cabecera es la misma en todas las páginas y mide 80 px, sin bordes: logotipo, enlaces `ghost` (píldora al pasar el ratón) y una acción en píldora `secondary` («Participar» o, en el chat, «Nueva conversación»). En la portada vive dentro del hero; en las páginas interiores, sobre blanco. Hasta 640 px, la navegación pasa a un `<dialog>` modal a pantalla completa (`mobile-menu.tsx`) que se abre con un círculo blanco con «+» y se despliega hacia abajo. Es amarilla para no confundirse con el rojo de la web: filas separadas por línea fina, sin números, y «Participar» en `primary` al pie; la acción propia de la página, como «Nueva conversación», sigue a la vista. Objetivos de al menos 44 px.

### 8.2 Color y superficies

- Marca roja `--rojo`, tinta `--tinta`, fondo blanco, superficie neutra `--superficie` y bordes `--linea`. Rojo, naranja y amarillo se combinan en `--atardecer` para el hero y las ilustraciones; el pie invierte ese recorrido con texto en tinta. El naranja no se usa como texto ni color de acción aislado.
- Texto blanco sobre rojo; tinta sobre amarillo y naranja. El color no sustituye la etiqueta de un estado. La guía registra los pares de contraste medidos.
- Acciones principales en tinta, con el degradado de Sol al pasar el ratón; al pulsar, todos los controles se encogen a 0,96. El foco usa `--foco`; los controles desactivados, `--apagado` y `--apagado-texto`, sin reducir la opacidad de todo el control. Errores y estados conservan texto e icono.
- Los botones nunca se subrayan; el subrayado queda para los enlaces de texto. Punto abierto: en la extensión, `LinkButton` (§3) es un `<button>` subrayado; Sol no lo cubre y queda sin decidir si se alinea.
- Los campos (`.campo`) miden al menos 44 px, con radio 12, borde `--tinta-3` (`--linea` no llega a 3:1) y texto de 16 px.
- Radios de 12, 16, 20 y 28 px. El hero tiene 28 px y un margen exterior de 8 px. El compositor del chat tiene 28 px; solo las superficies flotantes llevan `--sombra-suave` o `--sombra-flota`.
- La marca se pinta con `Logo` y la R de esquina doblada. Los chevrons son pixelados; los demás iconos son Nucleo UI Essential outline 18, a través de `Icon`. Nucleo es la única familia: ni Feather ni Lucide, tampoco en páginas nuevas.

### 8.3 Chat, fuentes y privacidad

- `/chat` reutiliza el buscador real: protección de datos personales antes del envío, PDF local, respuestas progresivas, citas y valoraciones. El modo de búsqueda se resuelve con `searchMode()`, igual que en la API. La vista previa informa de que la generación con IA no está activada.
- Al empezar, título, sugerencias y compositor se centran en el área de contenido. Con una conversación, el compositor queda fijo abajo y su altura se reserva para que no tape la respuesta. «Nueva conversación» limpia el historial en memoria y cancela el trabajo pendiente.
- La respuesta se compone con un catálogo cerrado de bloques: el modelo elige el `kind` de cada claim y la interfaz decide el componente. `step` es un paso con número rojo; `document`, `cost` y `deadline` son las tarjetas «Documentación», «Coste» (`.caja-sol`, con la cifra en grande solo si es un fragmento literal del claim) y «Plazos»; `warning` es un `.caja-aviso` (como máximo uno) y `fact` un párrafo. La pregunta es el titular del turno, con «Respuesta verificada con N fuentes oficiales» debajo, y la página del primer paso aparece como «Dónde se hace». Cada cita abre su fragmento en una hoja lateral (inferior en móvil) con el documento oficial y las otras fuentes de la respuesta. El modelo nunca escribe marcado; el servidor aplica las reglas y descarta lo que no cumple.
- Los claims y los fragmentos oficiales se pintan con Streamdown. La cita va en línea al final de su claim mediante una etiqueta propia que añade la interfaz, nunca el modelo. El HTML de las webs oficiales no se pinta.
- Las citas mantienen el fragmento y el enlace oficial. El mapa territorial muestra fuentes registradas; el número de organismos no representa cobertura de trámites ni garantiza una respuesta. Sus controles funcionan con teclado y tienen una alternativa en lista.
- Las imágenes oficiales conservan sus colores. Los avatares de `/equipo` vienen de GitHub a través del optimizador de imágenes (`/_next/image`), así que el navegador no contacta con GitHub, y los contributors se consultan en el servidor con caché y validación. El fallo de esa consulta se muestra; no se inventan perfiles. Los iconos de fuentes usan el servicio de favicons ya descrito en `/privacy`. Estas peticiones externas no incluyen la consulta del chat ni los documentos adjuntos.

### 8.4 Movimiento

- Nada se anima al ritmo del scroll (sin parallax ni animaciones ligadas a la posición). Los proyectos acompañan el scroll, sin controlarlo: el texto sigue el flujo normal e `IntersectionObserver` solo decide qué escena está activa; el cambio es una transición de duración fija. En móvil, la representación aparece con cada proyecto.
- Animar solo `transform` y `opacity`, con los tiempos y curvas de Sol. Las secuencias decorativas de más de cinco segundos tienen pausa; con `prefers-reduced-motion`, quedan quietas. La maqueta de contribución es un formulario real que abre en GitHub, en una pestaña nueva, una issue con el título y la descripción rellenos; no publica nada por sí misma: la persona la revisa y la envía allí. Avisa de que la issue es pública y de que no incluya datos personales.
- Chat: cada bloque verificado entra una vez, subiendo 6 px desde un desenfoque de 3 px (360 ms, `--curva-salida`); el desenfoque disimula que el bloque llega entero. La pregunta entra con el mismo movimiento (420 ms) y las sugerencias se escalonan 50 ms. La hoja de fuentes entra desde el lado con la curva de cajón (360 ms); en móvil sube desde abajo y se cierra arrastrando su barra superior hacia abajo (basta un gesto rápido o recorrer un cuarto de la hoja; hacia arriba ofrece resistencia) y, al pasar de la lista a un fragmento, el contenido se desliza en el sentido del recorrido. El indicador de trabajo conserva su brillo y la etapa cambia con un fundido corto.
- Lo que alterna usa transiciones interrumpibles, no animaciones: ir abajo, enviar/detener y copiar/copiado (los glifos se cruzan con escala y desenfoque, 180 ms), y el diálogo del mapa (entra en 240 ms, sale en 150 ms). Escribir y enviar con Intro no se animan.
- Con `prefers-reduced-motion` quedan los fundidos y desaparecen desplazamientos, escalas, desenfoques y el brillo.

### 8.5 Tailwind y componentes React

- `apps/web` usa Tailwind v4 sin preflight. `sol/tailwind.css` nombra los tokens de Sol en un `@theme inline reference`: `bg-rojo` compila a `background-color: var(--rojo)`, así que los valores siguen estando una sola vez en `sol/tokens.css` y el CSS existente sigue usando `var(--rojo)`. La paleta, las familias, los radios, las sombras y las curvas por defecto de Tailwind se vacían; el espaciado (4 px por paso) y los puntos de corte se mantienen. El preset de Tailwind v3 de la extensión no cambia.
- `Button` (`variant`: `primary`, `secondary`, `ghost`, `icon`, `send`) y `Field` solo ponen la clase de Sol y pasan las props y la ref al elemento nativo. `Button` con `href` es un `<a>`; sin él, un `<button>`.

### 8.6 Cambios posteriores

Antes de añadir otro valor o componente, consulta `GUIA.md` y reutiliza los tokens y piezas existentes. Documenta aquí las decisiones de sistema y en la guía los detalles de uso. Comprueba móvil, teclado, contraste y reducción de movimiento. Incluye capturas comparables antes/después cuando cambies una pantalla existente.
