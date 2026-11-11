# Las entrevistas: cómo se publica una

Cada entrevista es un JSON que genera el pipeline de El VAR Electoral (repositorio aparte) y que aquí
solo se valida y se pinta. El contrato está en `../interviews.ts` (`interviewSchema`): si un JSON no
lo cumple, la web falla al arrancar en lugar de publicar algo a medias.

Aquí solo entra lo que ha pasado por una persona. Nunca se copian los ensayos ni la vista previa
(`data/raw/` del VAR): son análisis de la IA sin revisar.

## Qué se ve en cuanto se publica

- Lo que la IA saca con reglas fijas se ve desde el primer momento: transcripción, temas, preguntas y
  cómo se respondieron, propuestas, críticas, línea de tiempo y la valoración, marcada como
  **provisional**.
- Las **verificaciones** y los **momentos clave** solo se ven si una persona los aprobó (`estado:
"aprobada"`) y, las verificaciones, con al menos una fuente enlazada. Lo que queda en `propuesta`
  cuenta como pendiente y la cabecera avisa de cuántos quedan.

## El día de una ronda (13N)

En el repositorio del VAR (`pipeline/`):

1. **El día antes:** `.venv/bin/pip install -U "yt-dlp[default]"`.
2. **Analizar** cada entrevista (unos 4 min y menos de 1 USD por 90 min de vídeo):

   ```sh
   .venv/bin/python -m var_electoral analizar "https://www.youtube.com/watch?v=…" --candidato pedro-sanchez
   ```

   Sale `web/data/entrevistas/13n-<candidato>.json`. Los `<candidato>` son los `slug` de
   `../candidates.ts`.

3. **Segundo VAR:** en Claude Code, `/segundo-var 13n-<candidato>` deja una sugerencia en cada
   verificación. Nunca aprueba nada.
4. **Revisar** en `/admin` del VAR (`npm run dev` en `web/`): aprobar, corregir o descartar cada
   verificación y cada momento. Sin fuente no se puede aprobar.
5. **Recalcular la valoración** con lo aprobado:
   `.venv/bin/python -m var_electoral nota 13n-<candidato>`.

En este repositorio:

6. **Copiar** el JSON revisado a esta carpeta con el mismo nombre (`13n-<candidato>.json`).
7. **Darlo de alta** en `../interviews.ts`: un `import` y añadirlo a `files`.

   ```ts
   import sanchez13n from './entrevistas/13n-pedro-sanchez.json';
   const files: unknown[] = [example, sanchez13n];
   ```

8. **Comprobarlo:** `pnpm --filter @reforma-digital/web dev` y abrir
   `/elecciones/entrevistas/13n-<candidato>`; después `pnpm exec vitest run
tests/elecciones-entrevistas.test.ts`.
9. **Publicar:** commit (`feat(elecciones): publica la entrevista del 13N a <candidato>`), push y
   despliegue, con las reglas de `AGENTS.md`.

Cada tanda de revisiones en `/admin` repite los pasos 5, 6, 8 y 9: se vuelve a copiar el JSON entero
y el historial de Git guarda cada corrección. Cuando no queda nada pendiente, la valoración deja de
ser provisional sola.

## Preguntas comunes

Con dos o más entrevistas de la ronda, en el VAR: `comunes --jornada 13n`. Copia
`web/data/comunes/13n.json` aquí como `comunes-13n.json` y dalo de alta en `../interviews.ts`:

```ts
import comunes13n from './entrevistas/comunes-13n.json';
const commonFiles: Record<string, unknown> = { '13n': comunes13n };
```

Aparecen en «Los cuatro, lado a lado» de esa ronda.

## Otra ronda u otro medio

Cada ronda está en `rounds`, en `../interviews.ts`: su `id` es el prefijo de los JSON
(`<ronda>-<candidato>`). Si los cuatro no tienen el mismo formato y quien entrevista,
`comparable: false` y una `note` que diga por qué: la web avisa de que sus cifras no se comparan.

Un vídeo que no está en YouTube (RTVE Play…) llega con `youtubeId: null` y su enlace en
`entrevista.url`, a veces sin fecha de publicación: la web lo enlaza y lo recorre con su propio reloj.

## Lo que no se hace

- Publicar nada nuevo en la jornada de reflexión (28 de noviembre).
- Copiar un JSON sin pasar por `/admin`, ni retocarlo a mano aquí: las correcciones se hacen en el VAR
  y se vuelven a copiar.
- Inventar datos para un candidato real: la entrevista de ejemplo es ficticia, está marcada y no se
  indexa.
