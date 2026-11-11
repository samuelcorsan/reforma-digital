# Las entrevistas publicadas

Cada JSON de esta carpeta es una entrevista publicada (`<ronda>-<candidato>.json`), y `comunes-<ronda>.json`, las
preguntas que se hicieron a varios candidatos de una ronda. Los escribe el pipeline de
[`apps/ingestion/entrevistas`](../../../../ingestion/entrevistas/README.md), que también regenera `index.ts`, el
índice que los da de alta en la web. Ahí está cómo se analiza una entrevista el día de una ronda.

La web solo valida y pinta. El contrato está en `../interviews.ts` (`interviewSchema`): si un JSON no lo cumple, la
web falla al arrancar en lugar de publicar algo a medias. `ejemplo.json` es la entrevista de ejemplo, con un
candidato ficticio.

## Qué se ve

- Todo lo que saca el análisis: transcripción, temas, preguntas y cómo se respondieron, propuestas (cada una con lo
  que dice y lo que le falta), críticas, línea de tiempo, verificaciones y momentos clave.
- Las verificaciones son las que confirmó o corrigió la segunda revisión de IA, siempre con al menos una fuente.
  Lo que descartó no se publica. Nadie las revisa a mano, y la web lo dice así.
- Si la segunda revisión no llegó a terminar, lo pendiente (`estado: "propuesta"`) sale marcado como **sin
  revisar** y la valoración como **provisional**, hasta repetirla con `revisar`.

## Otra ronda u otro medio

Cada ronda está en `rounds`, en `../interviews.ts`: su `id` es el prefijo de los JSON (`<ronda>-<candidato>`). Si
no todos tienen el mismo formato y quien entrevista, `comparable: false` y una `note` que diga por qué: la web
avisa de que sus cifras no se comparan. Si se cancela la entrevista de alguien, va en `cancelled`.

Un vídeo que no está en YouTube (RTVE Play…) llega con `youtubeId: null` y su enlace en `entrevista.url`, a veces
sin fecha de publicación: la web lo enlaza y recorre la entrevista con su propio reloj.

## Lo que no se hace

- Publicar nada nuevo en la jornada de reflexión (28 de noviembre).
- Retocar un JSON a mano: se corrige en el pipeline (prompts, reglas) y se vuelve a analizar o revisar.
- Copiar aquí un ensayo: los ensayos se quedan en `apps/ingestion/.cache/` y el índice nunca los da de alta.
- Inventar datos para un candidato real: la entrevista de ejemplo es ficticia, está marcada y no se indexa.
