# Sistema Sol: guía de uso

Fuentes de verdad, en `packages/design/sol/` (`@reforma-digital/design/sol`): `tokens.css`, `botones.css`, `campos.css`, `tailwind.css` y `components.tsx`. En esta app quedan `icon.tsx`, `logo.tsx` y las fuentes. Si algo no está aquí, usa un token y no un valor suelto.

## Montaje

`app/(search)/globals.css` importa los CSS de Sol desde el paquete y después Tailwind; también declara los estilos de `.sol-salto`, `.marca` e `.icono`. El layout de `app/layout.tsx` importa ese archivo y monta `fuentesSol` (Geist y Geist Mono con `next/font`) y `.sol-raiz` una sola vez. Las páginas no importan las fuentes ni crean otro contenedor de tema. Usa `Header`, `Footer` e `InfoPage` para las páginas interiores. La cabecera del hero sigue dentro del propio gradiente. `Header` ya trae «Participar» como `Button variant="secondary"`, que se lee sobre el rojo y sobre el blanco; pasa `action` solo para sustituirla.

La referencia general es [DESIGN.md](../../../../DESIGN.md#8-web-pública-sistema-sol). No se mantienen rutas de variantes o prototipos.

## Tipografía

| Rol                                                              | Clase o token                     | Familia                                     |
| ---------------------------------------------------------------- | --------------------------------- | ------------------------------------------- |
| Titular de portada                                               | `.t-titular-xl` (44–92 px)        | `--font-titular` (FFF Tool Serif Text Book) |
| Titular de sección                                               | `.t-titular-m` (32–52 px)         | FFF Tool Serif Text Book                    |
| Titular de tarjeta                                               | `.t-titular-s` (24–30 px)         | FFF Tool Serif Text Book                    |
| Entradilla                                                       | `.t-texto-l` (17–19 px)           | `--font-texto` (Geist)                      |
| Cuerpo, botones, menús y chat                                    | `.t-texto` (16 px)                | `--font-texto` (Geist 400 y 500)            |
| Cifra grande de marca (89, 83, 20)                               | `.t-cifra`                        | `--font-cifra` (hoy FFF Tool Serif Text)    |
| Dato operativo: contadores, «3 de 89», fechas, dominios, puestos | `.t-dato`                         | `--font-mono` (Geist Mono)                  |
| Etiqueta de estado o de sección                                  | `.t-etiqueta` (12 px, mayúsculas) | Geist Mono                                  |
| Logotipo                                                         | `.marca`                          | `--font-logo` (Ufficio)                     |

- La serif va solo en titulares y cifras grandes, nunca en botones, menús ni texto corrido.
- `h1` y `h2` salen en FFF Tool Serif Text por defecto. `h3` en adelante sale en Geist.
- FFF Tool Serif Text y Ufficio no se sirven hoy (DESIGN.md §8.1): quien no las tenga instaladas ve Georgia en los titulares y Geist en el logotipo.
- El logotipo siempre con el componente `Logo` (R roja sobre claro; en currentColor sobre rojo, tinta o amarillo).
- Para probar las cifras en mono basta con cambiar `--font-cifra: var(--font-mono)` en `packages/design/sol/tokens.css`.
- Por debajo de 14 px, solo `.t-etiqueta`, que va en mayúsculas.
- Pon un ancho máximo a los párrafos: entre 58 y 65 ch.

## Color

Rojo `--rojo`, doblez `--doblez`, amarillo `--amarillo`, tinta `--tinta` / `--tinta-2` / `--tinta-3`, superficie `--superficie`, blanco `--blanco`, línea `--linea`, ámbar `--ambar-claro` / `--ambar-texto`, azul `--azul` / `--azul-claro`, apagado `--apagado` / `--apagado-texto` y foco `--foco` (tinta; blanco dentro de `.caja-tinta`).

Mandan los nombres del código. En Paper, `rojo-oscuro` es `--doblez` y `amarillo-claro` es `--ambar-claro`.

- El naranja `--naranja` va solo dentro de degradados: `--atardecer` (hero y fondos grandes) y `--atardecer-boton`.
- Sobre naranja o amarillo, el texto va siempre en tinta, nunca en blanco (blanco sobre naranja da 2,61).
- El texto rojo pequeño sobre `--superficie` no llega a 4,5. Usa `--doblez` o pon el texto sobre blanco.
- El azul es el color de «resuelto»: paso completado, dato verificado y enlace secundario (`.enlace`). No sirve como color de marca ni para botones.
- Para el estado desactivado se usan `--apagado` y `--apagado-texto`, nunca opacidad.

Contraste WCAG medido:

| Par                                   | Ratio       | Uso permitido               |
| ------------------------------------- | ----------- | --------------------------- |
| `--azul` #2346E8 sobre blanco         | 6,75        | texto e iconos              |
| `--azul` sobre `--superficie` #F2F2F2 | 6,03        | texto e iconos              |
| `--azul` sobre `--azul-claro` #EDF1FE | 5,98        | texto en `.caja-resuelto`   |
| `--azul` sobre `--ambar-claro`        | 6,10        | texto                       |
| blanco sobre `--rojo`                 | 4,92        | texto (AA justo)            |
| `--rojo` sobre blanco                 | 4,92        | texto e iconos              |
| `--rojo` sobre `--superficie`         | 4,39        | solo ≥ 24 px o iconos       |
| `--doblez` sobre `--superficie`       | 7,03        | texto                       |
| tinta sobre `--amarillo`              | 9,56        | texto                       |
| tinta sobre `--naranja`               | 6,10        | texto                       |
| blanco sobre `--naranja`              | 2,61        | **prohibido**               |
| `--ambar-texto` sobre `--ambar-claro` | 7,29        | texto                       |
| `--tinta-2` sobre `--superficie`      | 7,55        | texto secundario            |
| `--tinta-3` sobre blanco / superficie | 5,33 / 4,76 | marcadores, texto terciario |
| blanco sobre `--tinta`                | 15,91       | texto                       |

El azul es un cobalto propio, `oklch(0.492 0.244 266.4)`. No es el azul de la AEAT (#0B57A8).

## Forma y espaciado

- Radios: `--r-12`, `--r-16`, `--r-20`, `--r-28` y `--r-pildora` (999 px).
- Espaciado en pasos de 4: `--e-4`, `--e-8`, `--e-12`, `--e-16`, `--e-20`, `--e-24`, `--e-32`, `--e-40`, `--e-48`, `--e-64`, `--e-80`, `--e-96` y `--e-120`.
- Sombras: `--sombra-suave` y `--sombra-flota`. Degradados: `--atardecer` y `--atardecer-boton`.

## Tailwind

`apps/web` usa Tailwind v4 sin preflight, con los nombres de Sol definidos en `tailwind.css`. Cada utilidad apunta a la variable de Sol (`bg-rojo` → `var(--rojo)`), así que el valor sigue viviendo solo en `tokens.css`. Tailwind busca clases en los `.ts` y `.tsx` de la app.

| Familia   | Utilidades                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color     | `bg-` / `text-` / `border-` / `outline-` con `rojo`, `doblez`, `amarillo`, `tinta`, `tinta-2`, `tinta-3`, `superficie`, `blanco`, `linea`, `ambar-claro`, `ambar-texto`, `azul`, `azul-claro`, `apagado`, `apagado-texto` y `foco` |
| Degradado | `bg-atardecer`, `bg-atardecer-boton`                                                                                                                                                                                               |
| Familia   | `font-titular`, `font-texto`, `font-mono`, `font-cifra`, `font-logo`                                                                                                                                                               |
| Radio     | `rounded-12`, `rounded-16`, `rounded-20`, `rounded-28`, `rounded-pildora`                                                                                                                                                          |
| Sombra    | `shadow-suave`, `shadow-flota`                                                                                                                                                                                                     |
| Curva     | `ease-salida`, `ease-cajon` (con `duration-160` o `duration-200`)                                                                                                                                                                  |
| Retícula  | `max-w-ancho`; el espaciado es el de Tailwind, 4 px por paso (`p-5` = `--e-20`)                                                                                                                                                    |

- No hay `text-naranja`: el naranja solo vive en los degradados. Tampoco existen la paleta, las familias, los radios ni las sombras por defecto de Tailwind (`text-red-500`, `rounded-lg`, `shadow-md`).
- Para la tipografía, usa las clases `.t-*`.
- Las utilidades van después de los CSS de Sol y sin capa: ajustan una clase del sistema (`boton mt-6`). El CSS de una página sigue ganando a las utilidades.

## Cajas

Todas: radio 20 y relleno 24 (20 en móvil). El prefijo `caja-` está reservado.

| Clase            | Cuándo                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `.caja-plana`    | Tarjeta sobre blanco con línea: listas, opciones, fuentes                                              |
| `.caja-gris`     | Agrupar sin elevar; fondo de bloques secundarios                                                       |
| `.caja-sol`      | Un único dato o llamada destacada por vista                                                            |
| `.caja-tinta`    | Cierres y llamadas fuertes. Cambia `--foco` a blanco                                                   |
| `.caja-flota`    | Lo que flota sobre otra cosa: el chat, los paneles y las tarjetas de ilustración (sombra cálida)       |
| `.caja-aviso`    | Aclaración o aviso sin urgencia (ámbar)                                                                |
| `.caja-error`    | Fallo. Siempre con `<Icon name="error" />`, un titular en `<strong>` (sale en doblez) y una salida     |
| `.caja-resuelto` | Paso completado o dato verificado. Con `<Icon name="hecho" />`; el icono y el `<strong>` salen en azul |

**Anidado:** si una caja contiene directamente otra, el contenedor pasa solo a radio 28 y relleno 12, y la hija a radio 16 (28 − 12). Así no hay que tocar nada. No anides más de dos niveles.

## Botones

| Clase             | Cuándo                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.boton`          | Acción principal. **Uno por vista.** Tinta; al pasar el ratón sube el atardecer                                               |
| `.boton-claro`    | Acción secundaria, y la principal sobre rojo                                                                                  |
| `.boton-fantasma` | Terciaria o enlace con forma de botón; hereda el color del fondo                                                              |
| `.boton-icono`    | 44×44, solo icono. **Obligatorio `aria-label`** con la acción («Copiar respuesta»)                                            |
| `.boton-enviar`   | Círculo de 52 px en tinta con el mismo atardecer. `aria-label` obligatorio. El compositor del chat aún no lo usa (ver Campos) |
| `.pildora`        | Preguntas de ejemplo y citas de fuentes. 36 px a la vista y 44 de área táctil. Para dominios, añade `.t-dato`                 |

- En React, `<Button variant="primary|secondary|ghost|icon|send">` de `@reforma-digital/design/sol` (por defecto, `primary`). Solo pone la clase y pasa las demás props y la ref al elemento: con `href` es un `<a>` (navegar), sin él un `<button>` (actuar). Con `icon` y `send`, TypeScript exige `aria-label`. No depende de Next: para `<Link>`, usa `className="boton"`.
- Los botones nunca llevan subrayado; el subrayado es solo para enlaces de texto (`.enlace`). Si una acción subrayada es un `<button>`, usa `.boton-claro` o `.boton-fantasma`.
- Todos los botones tienen un área táctil mínima de 44 px, se encogen a 0,96 al pulsarlos y muestran el foco con `--foco`.
- Para desactivarlos se usa el atributo `disabled`, no una clase. Salen en `--apagado` con `--apagado-texto`. La excepción es `.boton-enviar`, que sigue en tinta con el icono al 45 %.
- Sobre el rojo del hero, el hover de `.boton` se confunde con el fondo. Ahí usa `.boton-claro` y pon `--foco: var(--blanco)` en el contenedor rojo.
- El hover vive en una capa `::before` (opacity y transform). En `.boton` y `.boton-enviar` es un degradado radial de bordes suaves, sin `filter`, que en reposo queda entero bajo el borde inferior. Al pasar el ratón sube en 420 ms (opacidad en 280); al salir se pone: baja en 200 ms (`--t-medio`, `ease`) mientras la opacidad cae en lineal, así no se ven tonos pardos. Si el ratón vuelve a mitad, el sol sube desde donde está. El degradado se dibuja en al menos 134 px de ancho, así que en botones cortos es la misma franja que en los largos. Sin movimiento, entra y sale solo con opacidad. El texto queda siempre sobre tinta o rojo. La capa ocupa el botón y hereda su radio para conservar el recorte en Safari. No añadas `transition: all` ni animes colores.
- Si toda la tarjeta es el enlace, ponle `.tarjeta-enlace`: el botón que contiene (un `<span>` decorativo, p. ej. `<span className="boton-icono">`) muestra su capa al pasar el ratón por la tarjeta o al enfocarla con teclado, y se encoge a 0,96 al pulsarla. El resto de la señal (elevar la imagen, subrayar el nombre) es de cada tarjeta. Ejemplo: `/equipo`.
- Da clase a cada botón y reutiliza los estilos del sistema; el reset global no añade animaciones.

## Campos

`.campo` vale para `input`, `select` y `textarea`. En React, `<Field>` es un `<input>` con esa clase que pasa las props y la ref; para `select` y `textarea`, usa `className="campo"`.

- Al menos 44 px de alto, radio 12, relleno 12 y texto de 16 px (así iOS no amplía la página).
- Borde `--tinta-3` sobre blanco: 5,33, por encima del 3:1 que pide un control. `--linea` es decorativa y no sirve como borde de campo.
- El foco es el anillo común de `.sol-raiz`: 2 px de `--foco`, separado 2 px. Desactivado, con `disabled`: fondo y borde `--apagado` y texto `--apagado-texto`.
- Etiqueta visible siempre (`<label htmlFor>`); el placeholder, en `--tinta-3`, solo pone ejemplos.

El compositor del chat es composición de la app (`app/(search)/chat/chat-view.css` sobre `components/chat.css`): radio 28, borde `--linea` que pasa a `--tinta` mientras se escribe, `--sombra-flota` y botón de enviar `.chat-send` de 52 px en tinta, apagado (`--apagado`) hasta que hay texto y con `--atardecer-boton` al pasar el ratón.

## Chat

`@reforma-digital/design/sol/chat` (estilos en `sol/chat.css`) tiene las piezas que no dependen de la app; los iconos se pasan como props porque `Icon` vive aquí. La composición sigue la página Chat de Paper («Reforma Digital Sol»).

| Pieza                                                    | Uso                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Question`, `QuestionDetail`                             | La pregunta es el titular del turno (Geist, 34–52 px). Debajo, líneas cortas: datos ocultados al modelo y «Respuesta verificada con N fuentes oficiales»                              |
| `Thinking`                                               | «Preparando todo…» o «Pensando…» con brillo; `stage` nombra la etapa y cambia con un fundido                                                                                          |
| `Answer`, `StepList`/`Step`, `Fact`                      | Pasos con número rojo y párrafos (DESIGN.md §8.3)                                                                                                                                     |
| `DetailGrid`/`DetailCard`                                | Documentación, Coste y Plazos en tarjetas `.caja-gris`; Coste va en `.caja-sol` (`highlight`) con la cifra en grande                                                                  |
| `WhereCard`                                              | «Dónde se hace»: la página oficial del primer paso, con el botón que la abre                                                                                                          |
| `SourceChip`                                             | Cita en línea con el organismo; abre el fragmento en la hoja de fuentes                                                                                                               |
| `Monogram`, `SourcesButton`                              | Iniciales del organismo, dibujadas en local (sin pedir favicons), y «Fuentes · N»                                                                                                     |
| `SourceSheet`, `SourceDetail`, `SourceList`/`SourceCard` | Hoja lateral (en móvil, inferior) con el fragmento citado, sus datos, el botón al documento oficial y las otras fuentes. En móvil se cierra arrastrando la barra superior hacia abajo |
| `Notice`                                                 | `tone`: `info` (`.caja-plana`), `warning` (`.caja-aviso`) o `error` (`.caja-error`). Con icono, titular y acciones                                                                    |
| `Response`                                               | Markdown con Streamdown. `streaming` revela por palabra; `skipHtml` para fragmentos oficiales; `renderCitation` pinta la cita en línea                                                |
| `Suggestions`/`Suggestion`                               | Preguntas de ejemplo y de seguimiento; `index` escalona la entrada                                                                                                                    |
| `IconSwap`                                               | Dos glifos en un mismo control (enviar/detener, copiar/copiado)                                                                                                                       |
| `JumpButton`                                             | Ir al último mensaje; siempre montado, `visible` lo muestra                                                                                                                           |

- `.chat-enter` es la entrada de una sola vez (sube 6 px desde un desenfoque de 3 px). No la pongas en nada que se repita al teclear.
- El compositor (una fila: adjuntar, pregunta y enviar), las acciones y el mapa siguen siendo composición de la app.

## Iconos

`<Icon name="…" size={14–20} />` (por defecto 18). Los chevrons (`derecha`, `izquierda`, `abajo`, `enviar`), `mas` (cinco puntos en cruz, que girado 45° cierra el menú) y `menos` (los tres de la fila central) son pixelados; no uses los chevrons de Nucleo. Las flechas rectas `arrowUp` y `arrowUpRight` están dibujadas en la rejilla de Nucleo (18, trazo 1,5); el resto usa Nucleo UI Essential outline 18. Los iconos son decorativos (`aria-hidden`); el nombre lo da el texto o el `aria-label` del control.

Nombres: enviar, detener, copiar, util, noUtil, reintentar, nueva · cerrar, abajo, derecha, izquierda, mas, menos, arrowUp, arrowUpRight, paperclip · buscar, fuentes, contacto, externo, descargar · protegido, info, error, nunca, hecho, candado · calendario, documento, ubicacion, usuario, tarjeta, telefono. Solo los que se usan: si necesitas otro, añádelo desde la misma familia.

Sustituciones: `detener` es un cuadrado redondeado propio; `noUtil`, el pulgar de `util` girado 180°; `nunca`, la equis; `externo`, el eslabón.

Si falta un icono, búscalo primero en `nucleo-ui-essential-outline-18`. Nucleo es la única familia: no mezcles Feather ni Lucide en Sol.

## Retícula

Todas las secciones usan `max-width: var(--ancho)` (1200 px, con el margen dentro) y `padding-inline: var(--margen)` (20–24 px). Los titulares arrancan en la misma línea; el pie la sigue con su relleno lateral.

## Movimiento y superficies

- `--t-rapido` (160 ms: hover, pulsación), `--t-medio` (200 ms: capas, aparición), `--curva-salida` (entradas), `--curva-cajon` (paneles). Solo `transform` y `opacity`; toda animación con alternativa quieta bajo `prefers-reduced-motion: reduce`. Al pulsar, 0,96.
- Nada se anima al ritmo del scroll. En el recorrido, `IntersectionObserver` solo decide qué escena está activa y el cambio es una transición de duración fija. Las secuencias de más de 5 s deben ofrecer pausa (WCAG 2.2.2); las demás se reproducen una vez y paran.
- Los cuatro tokens de movimiento viven en `:root` (no en `.sol-raiz`) para que lleguen a los `::view-transition-*`, que cuelgan de `<html>`. Transición de página de `/equipo` (entre documentos, activada en `layout.tsx`): solo se anima su contenido; entra con opacidad 0 → 1 y `translateY(8px)` → 0 en `--t-medio` y sale con opacidad 1 → 0 en `--t-rapido`, ambas con `--curva-salida`; el resto cambia al instante. Con `prefers-reduced-motion: reduce` no hay transición.
- Sombras: solo `--sombra-suave` o `--sombra-flota` (marrón cálido, por capas). Listas y tablas se separan con `--linea`; las tarjetas se elevan con sombra.
- Capturas oficiales: `outline: 1px solid rgba(0,0,0,.1); outline-offset: -1px`. Nunca se recolorean.
