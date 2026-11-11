---
name: segunda-revision
description: Comprobación a mano, opcional, de las verificaciones de una entrevista ya analizada (apps/ingestion/entrevistas). Abre cada fuente, busca la oficial si falta y deja una nota en cada verificación. Úsala con el identificador de la entrevista, por ejemplo "/segunda-revision 13n-pedro-sanchez".
---

# Segunda revisión a mano

El pipeline de las entrevistas ya verifica cada afirmación y la pasa por una segunda revisión de IA que la
confirma, corrige o descarta: lo que queda se publica sin que nadie lo revise. Esta skill es una comprobación
extra, cuando hay tiempo o algo parece raro. **No cambias nada de lo publicado**: solo dejas una nota en cada
verificación y un resumen de lo que habría que corregir.

## Entrada

El argumento es el identificador de la entrevista, `<ronda>-<candidato>` (por ejemplo `13n-pedro-sanchez`). El
análisis está en `apps/web/lib/elecciones/entrevistas/<identificador>.json`; quién entrevista y en qué medio, en su
campo `entrevista`.

Para probar con un ensayo, el argumento puede ser su carpeta (`ensayo-…`): el análisis está entonces en
`apps/ingestion/.cache/entrevistas/<carpeta>/analisis.json`. Todo lo demás es igual.

## Pasos

1. Lee el JSON y quédate con las verificaciones (`revisiones`) que no estén `descartada`. Ordénalas: primero
   `roja` (Falso) y `fuera` (Engañoso), luego `amarilla` (Con matices) y al final `legal` (Cierto). Si hay más de
   seis, reparte el trabajo en subagentes en paralelo (unas cinco cada uno) con estas mismas instrucciones.
2. Para cada verificación:
   - Lee la `cita`, el `veredicto`, la `explicacion`, las `fuentes` y la nota de `segundaRevision`. Mira también
     los segmentos de la transcripción alrededor de `segundo` para entender el contexto.
   - Abre cada fuente con WebFetch. Comprueba si dice lo que afirma la explicación, con el dato, el periodo y el
     organismo correctos.
   - Si faltan fuentes o no sirven, busca la fuente oficial primaria (INE, Eurostat, BOE, Congreso, Seguridad
     Social, AIReF, Banco de España, ministerios…) con WebSearch y cítala en la nota. Nunca prensa si hay fuente
     oficial, y nunca vídeos, redes sociales ni Wikipedia.
   - Decide si el veredicto se sostiene: `legal` (Cierto), `amarilla` (Con matices), `fuera` (Engañoso), `roja`
     (Falso). Si las fuentes no permiten concluir, dilo.
3. Anota cada verificación, desde `apps/ingestion`:

   ```sh
   ../../.cache/congreso-python/bin/python -m entrevistas anotar <id> <revisión> --fuentes ok|mal --nota "…" [--sugerencia legal|amarilla|fuera|roja]
   ```

   - `--fuentes ok` si las fuentes respaldan la explicación; `mal` si no, o si no hay.
   - `--sugerencia` solo si propones un veredicto distinto al publicado.
   - La nota: dos frases como máximo, neutral, sin adjetivos, en español. Si citas una fuente nueva, incluye su URL.
4. Termina con un resumen: qué verificaciones se sostienen, cuáles habría que corregir y por qué, en una lista corta
   ordenada por urgencia.

## Reglas

- Mismo rigor para todos los candidatos. No valoras ideas ni ideología: solo si los datos se sostienen.
- No toques `estado`, `veredicto`, `explicacion` ni `fuentes`: solo `anotar`.
- No hagas commit ni push: la persona decide qué corregir y cómo.
- Si algo parece un error del pipeline (cita mal transcrita, minuto equivocado), dilo en la nota.
- Si la cita no es de la entrevista (un corte de otra emisión, un resumen al principio del programa) o repite otra
  verificación, dilo en la nota.
