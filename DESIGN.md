# Reforma Digital · Sistema de diseño

Versión 3.0 · 2026‑10‑13

Toda la UI propia de la web, extensión y playground usa shadcn/ui con Base UI (`base-nova`) y Tailwind v4. La marca y la composición conservan su identidad. Las primitivas usan los estilos generados por el CLI, con el tema neutral de shadcn; no se retocan globalmente para reproducir Sol.

| Qué                             | Fuente de verdad                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Tokens y movimiento             | [`packages/design/styles/theme.css`](packages/design/styles/theme.css)           |
| Primitivas shadcn/Base UI       | [`packages/design/ui`](packages/design/ui)                                       |
| Composición de trámites         | [`packages/design/src/ui/components.tsx`](packages/design/src/ui/components.tsx) |
| Campos sincronizados            | [`packages/react`](packages/react/src/index.tsx)                                 |
| Adaptación de contenido oficial | `sites/<portal>/src/styles/*.ts`, utilidades retiradas al restaurar              |

Los controles oficiales de seguridad y los originales de las fixtures se conservan nativos. La frontera Shadow DOM mantiene su hoja de entrada; las pantallas propias se componen con utilidades Tailwind y los componentes compartidos.

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

Los valores están en `packages/design/styles/theme.css` como canales RGB (`--bg-brand-600: 20 20 20`). El contraste está medido sobre blanco salvo que se indique otra cosa.

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
2. Si no existe, añádelo **aquí primero** (tabla correspondiente), después en `styles/theme.css` o en un componente compartido, y por último úsalo.
3. Revisa el resultado con `npm run site:preview -- <portal>`, que reproduce una visita grabada con `site:record` sin conexión y guarda capturas a 1280 y 390 px en `.cache/preview/<portal>/`. Para los campos conectados, usa el laboratorio (`npm run dev`).
4. Un PR que cambie el diseño debe incluir capturas y, si toca tokens de color, el contraste medido.

## 8. Web pública: sistema Sol

Sol es el diseño definitivo de `apps/web`, no una variante de portada. Las rutas públicas son `/` (iniciativa y proyectos), `/congreso` (actividad parlamentaria y datos electorales), `/equipo` y `/privacy`. Las páginas de error usan el mismo sistema. No se mantienen catálogos de variantes ni demos de chat con respuestas simuladas.

Las primitivas viven en `packages/design/ui`, los bloques del chat en `packages/design/chat.tsx` y la marca en `apps/web/components/brand`. El layout importa `@reforma-digital/design/web.css` y monta las fuentes una sola vez. Las páginas componen las primitivas con utilidades Tailwind; no añaden hojas de estilos propias.

### 8.1 Tipografía y retícula

- Titulares y cifras grandes en `--font-brand-heading`: Host Grotesk Medium, sin espaciado añadido; nunca va en botones, menús ni texto corrido. Solo se carga el grosor 500, así que los titulares no usan otro aunque pidan `font-normal`. Todo lo demás (cuerpo, entradillas `.t-texto-l`, interfaz, botones, menús y chat) en `--font-texto` (Geist 400 y 500). Datos, números y etiquetas en `--font-mono` (Geist Mono 400 y 500). El logotipo no usa ninguna fuente: «Reforma Digital» va contorneado en Cassette SemiBold (`Logotipo`, de `@reforma-digital/design/ui/logotipo`). Host Grotesk, Geist y Geist Mono son OFL; Next las empaqueta y las sirve desde la propia web, y las imágenes OG (`og/template.html`) usan las mismas.
- Portada: titular centrado de 36–72 px; páginas informativas, de 36–60 px. Titulares de sección de 32–52 px, tarjetas de 24–30 px. Texto de lectura desde 16 px; ayudas y metadatos desde 14 px. Solo las etiquetas cortas en mayúsculas pueden medir 12 px.
- Retícula común de 1200 px, con márgenes laterales de 20–24 px. Los artículos informativos limitan la lectura a 760 px y los párrafos a unas 65 letras de ancho. Las rejillas de colaboradores se separan con bordes compartidos, sin huecos ni sombras por celda. El equipo conserva cinco tarjetas por fila en escritorio.
- La cabecera es la misma en todas las páginas, mide 80 px y se queda fija al bajar, sin barra detrás: cada pieza flota sola. Los enlaces son pastillas de cristal de 34 px (14 px de texto, `secondary` al 60 % con el fondo desenfocado y sin borde, para que el canto sea igual en todas) y «Participar» es la única opaca, con borde. Al pasar el ratón la pieza se oscurece un 6 %, igual que la página actual; el foco es un contorno de tinta de 2 px, visible sobre blanco y sobre el rojo, y la zona de clic llega a 40 px. Al bajar los primeros 40 px, «Reforma Digital» se pliega y la R, sin encoger (36 px), queda centrada en un icono blanco de 56 × 56 px con el borde de «Participar», con su borde superior a la altura del de los enlaces. Desplegado, el logo lleva a la portada; plegado, un clic vuelve arriba. Con el botón derecho (o pulsación larga) abre un menú con iconos de píxel: «Copiar el logo» (la R en SVG) y «Visitar la app» (`ContextMenu` de `@reforma-digital/design`); lo mueve el propio scroll (`animation-timeline`), sin JavaScript. La cabecera no lleva `view-transition-name`, porque cortaría el desenfoque: en `/equipo` queda fuera del `ViewTransition`. Los destinos de sección y el escenario de proyectos reservan sus 80 px, y la columna de El Congreso se pega a 96 px. Hasta 640 px, la navegación pasa a un `<dialog>` modal a pantalla completa (`mobile-menu.tsx`) que se abre con un círculo blanco con «+» y se despliega hacia abajo. Es amarilla para no confundirse con el rojo de la web: filas separadas por línea fina, sin números, y «Participar» en `primary` al pie. Objetivos de al menos 44 px.

### 8.2 Color y superficies

- Marca roja `--rojo`, tinta `--tinta`, fondo blanco, superficie neutra `--superficie` y bordes `--linea`. Rojo, naranja y amarillo se combinan en `--atardecer` para el hero y las ilustraciones; el pie invierte ese recorrido con texto en tinta. El naranja no se usa como texto ni color de acción aislado. El logo lleva el doblez a la vista siempre que se pueda: R roja con doblez `--brand-dark` en la cabecera, el menú móvil y el pie; negro o blanco planos solo para imprimir a una tinta.
- Texto blanco sobre rojo; tinta sobre amarillo y naranja. El color no sustituye la etiqueta de un estado. La guía registra los pares de contraste medidos.
- Acciones principales en tinta, con el degradado de Sol al pasar el ratón; al pulsar, todos los controles se encogen a 0,96. El foco usa `--foco`; los controles desactivados, `--apagado` y `--apagado-texto`, sin reducir la opacidad de todo el control. Errores y estados conservan texto e icono.
- Los botones nunca se subrayan; el subrayado queda para los enlaces de texto. Punto abierto: en la extensión, `LinkButton` (§3) es un `<button>` subrayado; Sol no lo cubre y queda sin decidir si se alinea.
- Los campos (`.campo`) miden al menos 44 px, con radio 12, borde `--tinta-3` (`--linea` no llega a 3:1) y texto de 16 px.
- Radios de 12, 16, 20 y 28 px. El hero tiene 28 px y un margen exterior de 8 px. Solo las superficies flotantes llevan `--sombra-suave` o `--sombra-flota`.
- La marca se pinta con `Logo`: la R de esquina doblada (3 × 4 módulos) y, a un módulo, «Reforma Digital» en dos líneas, de la mayúscula de «Reforma» a la base de «Digital» con el mismo alto que la R. La versión de una línea (mayúsculas de 3 módulos, base en la de la R) es para espacios anchos y bajos. La caja del logo es la de la R: la «g» sobresale por debajo. Con la R roja, el doblez va en `--brand-dark`; con la R blanca, es translúcido al 15 % para adaptarse al fondo: negro sobre color (rojo, degradados, fotos) y blanco sobre negro. Los contornos de Cassette necesitan licencia de logotipo de Displaay antes de publicarse. Los chevrons son pixelados; los demás iconos son Nucleo UI Essential outline 18, a través de `Icon`. Nucleo es la única familia: ni Feather ni Lucide, tampoco en páginas nuevas.

### 8.3 Chat y privacidad

- La web ya no incluye el chat. Los bloques de `packages/design/chat.tsx` se conservan para otras aplicaciones y siguen estas reglas.
- La respuesta se compone con un catálogo cerrado de bloques: el modelo elige el `kind` de cada claim y la interfaz decide el componente. `step` es un paso con número rojo; `document`, `cost` y `deadline` son las tarjetas «Documentación», «Coste» (`.caja-sol`, con la cifra en grande solo si es un fragmento literal del claim) y «Plazos»; `warning` es un `.caja-aviso` (como máximo uno) y `fact` un párrafo. La pregunta es el titular del turno, con «Respuesta verificada con N fuentes oficiales» debajo, y la página del primer paso aparece como «Dónde se hace». Cada cita abre su fragmento en una hoja lateral (inferior en móvil) con el documento oficial y las otras fuentes de la respuesta. El modelo nunca escribe marcado; el servidor aplica las reglas y descarta lo que no cumple.
- Los claims y los fragmentos oficiales se pintan con Streamdown. La cita va en línea al final de su claim mediante una etiqueta propia que añade la interfaz, nunca el modelo. El HTML de las webs oficiales no se pinta.
- Las imágenes oficiales conservan sus colores. Los avatares de `/equipo` vienen de GitHub a través del optimizador de imágenes (`/_next/image`), así que el navegador no contacta con GitHub, y los contributors se consultan en el servidor con caché y validación. El fallo de esa consulta se muestra; no se inventan perfiles.

### 8.4 Movimiento

- Nada se anima al ritmo del scroll (sin parallax ni animaciones ligadas a la posición). Los proyectos acompañan el scroll, sin controlarlo: el texto sigue el flujo normal e `IntersectionObserver` solo decide qué escena está activa; el cambio es una transición de duración fija. En móvil, la representación aparece con cada proyecto.
- Animar solo `transform` y `opacity`, con los tiempos y curvas de Sol. Las secuencias decorativas de más de cinco segundos tienen pausa; con `prefers-reduced-motion`, quedan quietas. La maqueta de contribución es un formulario real que abre en GitHub, en una pestaña nueva, una issue con el título y la descripción rellenos; no publica nada por sí misma: la persona la revisa y la envía allí. Avisa de que la issue es pública y de que no incluya datos personales.
- Chat (`packages/design/chat.tsx`): cada bloque verificado entra una vez, subiendo 6 px desde un desenfoque de 3 px (360 ms, `--curva-salida`); el desenfoque disimula que el bloque llega entero. La pregunta entra con el mismo movimiento (420 ms) y las sugerencias se escalonan 50 ms. La hoja de fuentes entra desde el lado con la curva de cajón (360 ms); en móvil sube desde abajo y se cierra arrastrando su barra superior hacia abajo (basta un gesto rápido o recorrer un cuarto de la hoja; hacia arriba ofrece resistencia) y, al pasar de la lista a un fragmento, el contenido se desliza en el sentido del recorrido. El indicador de trabajo conserva su brillo y la etapa cambia con un fundido corto.
- En el pie, la R del logo mide 48 px y es un puzle (`logo-puzle.tsx`): al pasar el ratón, sus ocho fichas se separan (escala 0,86), dan diez deslizamientos al azar a casillas vecinas vacías y, tras una pausa, vuelven a la R por el camino más corto (un paso cada 400 ms). Al salir, la R termina de ordenarse y las fichas se juntan. Solo reacciona al ratón; con `prefers-reduced-motion` se queda quieta.
- Lo que alterna usa transiciones interrumpibles, no animaciones: ir abajo, enviar/detener y copiar/copiado (los glifos se cruzan con escala y desenfoque, 180 ms). Escribir y enviar con Intro no se animan.
- Con `prefers-reduced-motion` quedan los fundidos y desaparecen desplazamientos, escalas, desenfoques y el brillo.

### 8.5 Tailwind y componentes React

- Sigue [la instalación de monorrepo](https://ui.shadcn.com/docs/monorepo) y [la instalación manual](https://ui.shadcn.com/docs/installation/manual). Ejecuta `pnpm --filter @reforma-digital/design exec shadcn add <componente> --cwd ../../apps/web`. El tema compartido importa `shadcn/tailwind.css`; `dark` depende de la clase `.dark`, no del modo del sistema.
- No alteres colores, radios o tamaños de las primitivas generadas. Usa sus variantes y tamaños. Las clases de los usos se limitan a composición; una excepción visual debe resolver un caso concreto, como contraste en un hero o información semántica.
- Excepción compartida: `secondary` usa el fondo al 30 % y al 40 % con `backdrop-blur` en hover, sin reducir la opacidad del texto.
- Excepción de la extensión: sus hojas de entrada (`shadow.css` y `popup.css`) dan un `min-height` de 44 px a `Button`, `Input`, `Select` y `Collapsible`, cuyos tamaños generados se quedan en 24–36 px. Los enlaces sueltos de «Portales incluidos» ganan el área con un `::after`; los enlaces dentro de una frase siguen siendo texto.
- Toda la UI usa Tailwind v4 y shadcn/Base UI. `Button` admite `default`, `sunset`, `outline`, `secondary`, `ghost`, `destructive` y `link`; `sunset` es la acción principal, en tinta con el sol al pasar el ratón: entra y se pone con el mismo ritmo, bajando antes de apagarse (una excepción buscada a las salidas rápidas: es un adorno de hover, no una respuesta). Los tamaños incluyen `icon` e `icon-lg`; en la web, las acciones principales y las que las acompañan usan `xl` (16 px, 44 px de alto) y los controles de menús y herramientas se quedan en 14 px.
- Para navegar, usa un enlace o `next/link` con `cn(buttonVariants(...))`. No uses Button renderizado como enlace: conserva la semántica de navegación.
- Usa `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Card`, `Collapsible`, `Dialog`, `Sheet`, `Drawer` y `Table` desde `@reforma-digital/design/ui/*`. Los selects de formularios conservan `name`, valores reales y la opción vacía.
- Los menús de la extensión se montan en el Shadow DOM mediante `PortalContainerContext`. La página oficial no recibe Preflight. El runtime retira únicamente las clases que añadió al restaurar.

### 8.6 Cambios posteriores

Antes de añadir otro valor o componente, consulta `GUIA.md` y reutiliza los tokens y piezas existentes. Documenta aquí las decisiones de sistema y en la guía los detalles de uso. Comprueba móvil, teclado, contraste y reducción de movimiento. Incluye capturas comparables antes/después cuando cambies una pantalla existente.

### 8.7 El Congreso

El Congreso (`/congreso`) es una sección pública de Reforma Digital y usa Sol sin tokens propios. Conserva el diseño de Pablo de la PR #127. Sus estilos están en [`congreso.css`](apps/web/components/congreso/congreso.css). Aquí solo se recoge lo que decide por su cuenta.

- La página es blanca de arriba abajo, también la portada. El rojo a caja completa (`--atardecer` como fondo de un hero) queda para la portada de Reforma Digital (`/`).
- La portada conserva la silueta del hero de Sol (8 px de margen, radio 28, titular centrado de 36–72 px), en blanco y con un anillo de 1 px en `--linea`. La cabecera y la barra de la sección van encima, no dentro.
- El sol pixelado es el atardecer de Sol tramado en celdas cuadradas. Usa `--rojo`, `--naranja` y `--amarillo`, de dentro afuera, con tramado ordenado de Bayer 4 × 4 entre tintas vecinas, y es transparente fuera. Las imágenes guardan una celda por píxel y se amplían con `image-rendering: pixelated`; la celda (`--celda`) mide siempre un número entero de píxeles, porque con decimales la trama se emborrona.
- Hay dos dibujos. `sol-horizonte.png` (360 × 32 celdas) es un arco bajo y ancho, solo para la portada: celda de 8 px, y de 6 px hasta 560 px de ancho. `sol-disco.png` (120 × 44 celdas) es un sol que asoma, para la cabecera de cada vista: celda de 4 px, y de 3 px cuando la columna de contenido mide menos de 1090 px.
- El sol va pegado al borde inferior de su pieza y recortado por su radio: centrado en la portada y a la derecha en las cabeceras. Nunca lleva texto encima. En la portada, el relleno inferior reserva su alto; en las cabeceras, el texto no pasa del 52 % del ancho y, cuando la columna mide menos de 820 px, ocupa todo el ancho con el sol debajo, centrado, en un hueco reservado. Encima solo van piezas opacas, como el botón claro con `--sombra-flota`. Hay uno por pantalla, no se anima y no se usa como textura de tarjetas.
- La cabecera de cada vista (`Intro` con `h1`) es una pieza blanca de radio 28 con el mismo anillo. La de la portada, con `h2`, no lleva pieza ni sol: allí ya está el horizonte.
- Para cambiarlo se editan los números de [`sol-pixel.mjs`](apps/web/scripts/sol-pixel.mjs) y se ejecuta `node apps/web/scripts/sol-pixel.mjs`. El PNG no se retoca a mano.
- La cabecera de Reforma Digital lleva «El Congreso» como un enlace más, marcado como actual dentro de la sección. Desde 1100 px, las vistas van en una columna a la izquierda de 232 px, agrupadas y todas a la vista, con la actual sobre `--superficie`; se queda pegada al bajar y una ficha mantiene marcada la vista de la que sale. Por debajo de 1100 px, las vistas están en una barra con desplegables bajo la cabecera.
- Los colores de un hemiciclo o de un resultado son datos (sí, no, abstención). Detrás no va el sol ni otro fondo de color.

## 9. App de escritorio

La app de escritorio (`apps/desktop`) usa los mismos tokens y primitivas, con la composición de un cliente de chat de escritorio.

- **Ventana.** Sin barra de título: la franja de 52 px de arriba sirve para arrastrar. En macOS lleva los semáforos a la izquierda, sobre la barra lateral; en Windows y Linux, los botones de la ventana a la derecha, del color del lienzo, y la cabecera de esa esquina les deja hueco (`.hueco-botones`). En Windows y Linux no hay barra de menú, pero sus atajos funcionan (Ctrl+N, Ctrl+,).
- **Letra.** Inter en lugar de la Geist de la web (§8.1), empaquetada dentro de la app con `@fontsource-variable/inter`; los titulares, en Host Grotesk Medium (`@fontsource/host-grotesk/500.css`), también dentro de la app.
- **Lienzo gris, superficies blancas, sin sombras.** Toda la ventana es `--muted`; lo que se lee o se rellena va en blanco: el mensaje de la persona, el compositor, las tarjetas de preguntas, el navegador del trámite y las secciones de «Mis datos» y «Ajustes» (radio 24). Nada lleva sombra, tampoco los desplegables: `desktop.css` vacía los tokens `--shadow-*`.
- **Barra lateral de 260 px**, un poco más oscura que el lienzo (`foreground` al 2,5 %). Arriba, «Nuevo trámite» y «Mis datos»; después, los fijados y los trámites en filas de 36 px con el título en una línea y, a la derecha, cuánto hace del último cambio («5 min», «12 d») o un icono con su explicación al pasar: un «!» en un círculo amarillo si el asistente ofrece hacerlo por la persona, un «!» blanco en un círculo rojo si espera otra respuesta, un punto gris que late si trabaja y un check azul si ha terminado y la persona aún no lo ha abierto. Al pasar por una fila aparece la chincheta para fijarla. Abajo, la marca y «Ajustes». Las filas se oscurecen al pasar (4 %) y la activa queda marcada (7 %).
- **Compositor** de radio 28 (§8.2): el texto arriba y, debajo, el selector de cuánto piensa el asistente, que se guarda en cada trámite, sin un segundo borde (§8.5), y el botón de enviar o detener. Mientras el asistente trabaja, lo que se escribe espera en una cola pegada encima del compositor («Añade otra petición para cuando termine»), con «Interrumpir» para mandarlo ya, antes de su siguiente paso, y la papelera; debajo de ese mensaje lo dice en gris. Si lo que espera es la tarjeta que ofrece hacer el trámite, el mensaje no va a la cola: la tarjeta queda cancelada y el mensaje abre una petición nueva, en la que el asistente vuelve a ofrecerlo si se lo pide. Al pasar por un mensaje de la persona que no es el primero sale «Volver a antes de este mensaje», que borra desde él y devuelve su texto al compositor. En la conversación, el texto se funde con el lienzo justo encima.
- **Bienvenida**, la primera vez que se abre la app y después de «Borrar todo y empezar de cero», a ventana completa y sin barra lateral: tres pasos (qué hace, por qué no un asistente general como ChatGPT, Claude o Gemini, y qué protege) con los puntos de progreso centrados arriba, «Continuar» centrado abajo y, a su izquierda, la flecha para volver atrás. La comparación es una tabla blanca con la columna de Reforma Digital teñida de `brand` al 4 %; solo dice de los asistentes generales lo que vale para todos ellos. La seguridad no va en tarjetas: una animación en bucle con el compositor (sin el selector de razonamiento) escribe una petición con datos inventados (la trimestral del IVA); al enviarla, los datos se marcan en `brand` y sus letras cambian al azar hasta quedar en su marcador amarillo. Después el compositor se desvanece y aparece una tarjeta que resume en una línea de tiempo qué ha pasado con los datos, bajo «0 datos tuyos han llegado a la IA», con los iconos alternando rojo y amarillo. La animación es decorativa (`aria-hidden`); el lector de pantalla recibe ese resumen como texto. Con `prefers-reduced-motion` se queda quieta en el resumen.
- **Inicio**: titular de 40 px, recordatorios en píldora sobre el compositor, sugerencias en píldora debajo (ponen en el compositor una petición con [huecos], con el primero seleccionado; no la envían).
- **Conversación** en una columna de 720 px: el mensaje de la persona a todo el ancho, la respuesta a 16 px con sus listas numeradas y, entre respuestas, lo que hace el asistente: «Pensando» con brillo y los segundos que lleva y, debajo, sus pasos en una línea vertical. La búsqueda lleva una lupa y las webs que encontró en fichas con su icono (cuatro y «+N más»); las demás acciones, un punto, negro y con brillo la que está en marcha. Al terminar se pliega y queda solo «Ha trabajado 8 s»; desplegado, acaba con «Listo». Debajo de la respuesta no hay lista de fuentes: las webs se ven en esos pasos. Los botones fantasma sobre el lienzo se oscurecen al pasar (6 %), porque `hover:bg-muted` no se vería.
- **Tarjetas del asistente** en blanco, sin sombra: el icono en un cuadro de 40 px con `brand` al 8 % (en los formularios, la marca de Reforma Digital sola, sin cuadro), lo que pide a 17 px («Necesito tu permiso», «El asistente puede hacerlo por ti») y debajo, en gris, qué es exactamente. Esas peticiones no cuentan entre las acciones del asistente: ya se ven como tarjeta. La que ofrece hacer el trámite llega plegada justo debajo de la respuesta, con «Ahora no» y el botón de la acción, que deja claro que lo hace el asistente («Pedir la cita por mí»); al pulsarlo se despliega (`Collapsible`) con los datos que hacen falta y el foco en el primero. Si la persona ya la aceptó, lo que el asistente pida después durante el trámite no vuelve a ofrecerse: llega desplegado como «Para seguir, el asistente necesita más datos». Con más de cuatro datos va por pasos: una franja gris con «1. Tus datos», «2. La cita»… y «Revisar» (el actual en negro) sobre un panel blanco con el paso, «Atrás» o «Ahora no» y «Continuar»; el último resume las respuestas antes del botón de la acción. Los pasos los nombra el asistente (`paso` en cada campo); si no, van de tres en tres. Como la tarjeta ya lo ofrece, el asistente no lo anuncia en el texto. Las preguntas de varias respuestas van como casillas en el mismo formato que las opciones; con más de ocho opciones (la provincia), un desplegable; y un campo que depende de otra respuesta aparece cuando se da. La llamada guiada es otra tarjeta: el teléfono grande, en la letra de los titulares, junto a «Llamar», qué preguntar (numerado), qué tener a mano, un campo para apuntar lo que le dicen y «Ya he llamado».
