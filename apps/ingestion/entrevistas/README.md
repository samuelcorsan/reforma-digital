# Cómo analizar una entrevista

Este pipeline convierte una entrevista en vídeo en lo que se ve en `/elecciones/entrevistas`: la transcripción, las
preguntas y cómo se responden, las propuestas, las críticas, la línea de tiempo, los momentos clave y las
afirmaciones verificadas con sus fuentes. Escribe el resultado directamente en la web y lo da de alta: para
publicarlo solo hay que hacer commit y push.

Viene de El VAR Electoral, donde se probó con las entrevistas de octubre.

## Qué hace, paso a paso

```
YouTube ─► yt-dlp (audio) ─► ffmpeg (trozos de 5 min) ─► Gemini: transcripción con quién habla
                           (a la vez, Gemini ve el vídeo: contrasta las citas y anota lo que solo se ve)
        ─► Gemini: temas, preguntas, propuestas, críticas, afirmaciones comprobables y momentos clave
        ─► cada cita se busca palabra por palabra en la transcripción: si no está, se descarta
        ─► verificación: Gemini busca en Google y lee las páginas, con fuentes oficiales
        ─► segunda revisión: otro paso de Gemini abre cada fuente, busca la oficial por su cuenta
           y confirma, corrige o descarta
        ─► valoración y cifras calculadas con código
        ─► apps/web/lib/elecciones/entrevistas/<ronda>-<candidato>.json + su alta en index.ts
```

**Nadie revisa a mano lo que sale**, y la web lo dice así. Por eso las dos pasadas de IA siguen las mismas reglas
estrictas (`REGLAS_FUENTES` en [`prompts.py`](prompts.py)):

- Todas las afirmaciones sobre hechos se buscan a fondo, también las anécdotas sobre hechos o personas públicas.
- Fuente oficial y primaria siempre que exista (los dominios de `OFICIALES` en [`modelo.py`](modelo.py) van
  primero); si no, prensa de referencia, citando el medio.
- Si no aparece ninguna fuente que la confirme o la desmienta, la afirmación sale como **Sin fuente**: sin
  calificar y sin contar en la valoración. Nunca se califica algo sin al menos una fuente enlazada.
- Si el modelo copia mal una cita, se usa el tramo de la transcripción que más se le parece, tal como se dijo. Solo
  se descarta lo que no se parece a nada, y lo que la segunda revisión ve que no es una afirmación (una opinión,
  una promesa).

El tiempo de palabra, la intensidad y las interrupciones no los decide el modelo: salen de reglas fijas.

Usa Gemini y no NaN, como el resto de Reforma Digital, porque necesita un modelo que escuche el audio, vea el vídeo y
busque en la web. Solo recibe vídeos públicos de entrevistas, nunca datos de nadie.

## 1. Lo que necesitas

- macOS o Linux con **Python 3.12 o más** (`python3 --version`). En macOS, si sale una versión vieja:
  `brew install python@3.14`.
- **ffmpeg**: `brew install ffmpeg` (en Linux, `apt install ffmpeg`).
- **Node 24 y pnpm**, para ver el resultado en la web (`pnpm install` en la raíz, como para el resto del repo).
- Una **clave de Gemini** con la facturación activa. Se crea en [Google AI Studio](https://aistudio.google.com/).
  Con el plan gratuito (cinco peticiones por minuto) el pipeline se para en seco con un aviso.

## 2. Instalación (una vez)

Desde la raíz del repositorio:

```sh
python3 -m venv .cache/congreso-python
.cache/congreso-python/bin/python -m pip install -r apps/ingestion/requirements.txt
```

Añade la clave al `.env` de la raíz (cópialo de `.env.example` si no lo tienes). El `.env` no se sube nunca: está
en `.gitignore`.

```sh
GEMINI_API_KEY=tu-clave
```

A partir de aquí, todos los comandos se lanzan desde `apps/ingestion`:

```sh
cd apps/ingestion
PY=../../.cache/congreso-python/bin/python
```

## 3. Comprueba que funciona, sin gastar nada

```sh
$PY -m pytest -q tests/test_entrevistas.py
$PY -m entrevistas simular
```

Las dos usan la entrevista de ejemplo (candidato ficticio) y un modelo simulado: no llaman a Gemini ni escriben
en la web. Si pasan, la instalación está bien.

## 4. Un ensayo, antes del día

Analiza cualquier otra entrevista para ver que la clave, la descarga y los tiempos funcionan. Con `--hasta 15`
solo procesa los primeros 15 minutos (unos céntimos):

```sh
$PY -m entrevistas analizar "https://www.youtube.com/watch?v=…" --ensayo "Nombre de la persona" --hasta 15
```

Un ensayo nunca se publica: todo se queda en `apps/ingestion/.cache/entrevistas/ensayo-<nombre>/` (el JSON en
`analisis.json`), fuera de Git. Mira en el log los avisos (sección 6) y el coste del final.

## 5. El día de la ronda

**El día antes**, actualiza yt-dlp: YouTube cambia a menudo y las versiones viejas reciben un error 403.

```sh
$PY -m pip install -U "yt-dlp[default,curl-cffi]"
```

**Para cada entrevista:**

1. **Analízala** en cuanto esté publicada:

   ```sh
   $PY -m entrevistas analizar "https://www.youtube.com/watch?v=…" --candidato pedro-sanchez
   ```

   - Los candidatos son `ada-colau`, `pedro-sanchez` y `alberto-nunez-feijoo` (y `santiago-abascal`, aunque su
     entrevista del 13N se canceló). Son los `slug` de `apps/web/lib/elecciones/candidates.ts`.
   - Por defecto es la ronda `13n` en The Wild Project. Para otra ronda u otro medio:
     `--jornada octubre --medio "Cadena SER" --programa "Hoy por Hoy" --entrevistador "Aimar Bretos"`. La ronda
     tiene que existir en `rounds`, en `apps/web/lib/elecciones/interviews.ts`.
   - Con 55 minutos de vídeo tardó 11 minutos y costó 3 USD: una entrevista de 100 minutos, unos 5 USD. Puedes lanzar las tres a la vez, en
     terminales distintas.
   - Al acabar escribe `apps/web/lib/elecciones/entrevistas/13n-pedro-sanchez.json` y actualiza `index.ts`.

2. **Lee el final del log.** Debe decir cuántas afirmaciones se verificaron, cuántas aprobó la segunda revisión y
   la comprobación de tiempos. Si sale **⚠ LOS TIEMPOS NO CUADRAN CON EL VÍDEO**, no lo publiques: repite con
   `--modo audio` (sección 6).

3. **Míralo en la web.** En otra terminal, desde la raíz:

   ```sh
   pnpm dev
   ```

   Abre `http://localhost:3000/elecciones/entrevistas/13n-pedro-sanchez` y comprueba que la transcripción, en
   dos o tres puntos de la línea de tiempo, dice lo mismo que el vídeo en ese minuto.

4. **Publícalo.** Se suben el JSON y el `index.ts`, nada más:

   ```sh
   git add apps/web/lib/elecciones/entrevistas/13n-pedro-sanchez.json apps/web/lib/elecciones/entrevistas/index.ts
   git commit -m "feat(elecciones): publica la entrevista del 13N a Pedro Sánchez"
   git push
   ```

   Después, el despliegue habitual, con las reglas de `AGENTS.md`.

**Cuando haya dos o más entrevistas de la ronda**, agrupa las preguntas que se hicieron a varios candidatos y
publica el resultado (`comunes-13n.json` e `index.ts`). Aparecen en «Lado a lado»:

```sh
$PY -m entrevistas comunes --jornada 13n
```

## 6. Si algo sale mal

| Lo que ves                                        | Qué hacer                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Falta GEMINI_API_KEY`                            | La clave no está en el `.env` de la raíz.                                                                                                                                                                                                 |
| «La clave de Gemini está en el plan gratuito»     | Activa la facturación del proyecto en Google AI Studio y vuelve a lanzarlo.                                                                                                                                                               |
| Error 403 o fallo al descargar el audio           | Actualiza yt-dlp (arriba). Si sigue, `--video`: Gemini lee el vídeo de YouTube sin descargarlo. Cuesta más y sus tiempos son algo menos precisos.                                                                                         |
| ⚠ LOS TIEMPOS NO CUADRAN CON EL VÍDEO             | La transcripción va desplazada. Repite con `--modo audio`. Para volver a comprobarlo: `$PY -m entrevistas sincronia 13n-pedro-sanchez`.                                                                                                   |
| El vídeo no está en YouTube (RTVE Play…)          | Funciona con su URL, pero no hay subtítulos con los que comparar los tiempos: compara a mano la transcripción con el vídeo en tres puntos.                                                                                                |
| ⚠ «sin la segunda revisión por errores de la API» | Un fallo de la API no para el análisis: lo afectado se publica como «sin revisar». `$PY -m entrevistas revisar 13n-pedro-sanchez` repite la segunda revisión de lo pendiente.                                                             |
| Has cambiado un prompt o una regla                | `$PY -m entrevistas reanalizar 13n-pedro-sanchez` repite análisis, verificación y revisión sin volver a transcribir. Con 90 min, unos 1,40 USD. Quita las preguntas comunes de su ronda, que dejan de cuadrar: vuelve a lanzar `comunes`. |
| Una verificación está mal                         | No retoques el JSON a mano: ajusta el prompt o la regla y usa `reanalizar`. Para una segunda opinión, `/segunda-revision 13n-pedro-sanchez` en Claude Code (abajo).                                                                       |

Los errores pasajeros de la API (límite de ritmo, sobrecarga, cortes de red) se reintentan solos. Los enlaces de
Google que no llevan a una web real se descartan.

## 7. Qué se sube y qué no

- **Sí:** `apps/web/lib/elecciones/entrevistas/<ronda>-<candidato>.json`, `comunes-<ronda>.json` e `index.ts`.
- **Nunca:** el `.env` ni nada de `apps/ingestion/.cache/` (audio, vídeo, trozos, costes y ensayos). Los dos están
  en `.gitignore`, y el índice nunca da de alta un ensayo.
- **No se publica nada nuevo en la jornada de reflexión** (28 de noviembre).

## Otros comandos

- `nota <id>`: recalcula la valoración, por ejemplo tras cambiar los pesos en `metricas.py`.
- `ensayo-general URL1 URL2 … --hasta 90`: varios ensayos a la vez, como el día de una ronda, con el tiempo y el
  coste totales.
- `analizar … --sin-comprobar`: sin verificación ni revisión, para ensayos rápidos.
- `$PY -m entrevistas --help` y `$PY -m entrevistas analizar --help`: todas las opciones.

## Comprobación a mano, opcional

Con Claude Code, `/segunda-revision 13n-pedro-sanchez` repasa las verificaciones publicadas: abre cada fuente,
busca la oficial si falta y deja una nota en cada una con `anotar`. No cambia nada de lo publicado: si encuentra
un error, lo dice para corregirlo con `reanalizar` y volver a publicar.

## Costes

Cada análisis guarda en `.cache/entrevistas/<id>/coste-<modo>.json` lo consumido en cada paso (audio, texto,
salida, razonamiento, búsquedas y segundos) y lo resume al final del log. Los precios están en
[`costes.py`](costes.py). Como referencia, 55 minutos de Feijóo en la SER costaron 2,98 USD: 0,61 la
transcripción, 1,30 la verificación y 0,89 la segunda revisión. Lo caro es leer páginas web enteras para comprobar
cada afirmación (unos 850.000 tokens en cada pasada).
