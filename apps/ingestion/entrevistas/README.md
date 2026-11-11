# Las entrevistas: el análisis

Convierte una entrevista en vídeo en el JSON que pinta `/elecciones/entrevistas`, lo verifica, lo revisa y lo da de
alta en la web. Viene de El VAR Electoral, donde se probó con las entrevistas de octubre.

```
YouTube → yt-dlp (audio) → ffmpeg (trozos de 5 min) → Gemini: transcripción con hablantes
       (en paralelo, Gemini lee el vídeo: contrasta las citas y anota lo que solo se ve)
       → Gemini: temas, preguntas, propuestas, críticas, afirmaciones comprobables y momentos clave
       → cada cita se busca literal en la transcripción: si no aparece, se descarta
       → verificación: Gemini + búsqueda de Google, con fuentes oficiales y el dato concreto citado
       → segunda revisión: otro paso de Gemini abre cada fuente, busca la oficial por su cuenta y
         confirma, corrige o descarta
       → métricas y valoración calculadas con código
       → apps/web/lib/elecciones/entrevistas/<ronda>-<candidato>.json y su alta en index.ts
```

**Nadie revisa a mano lo que sale.** Lo publicado es lo que confirma la segunda revisión de IA, y la web lo dice
así. Por eso los prompts ([`prompts.py`](prompts.py)) piden ser exhaustivo, contrastar cada dato con su fuente
primaria y citar de dónde sale cada cifra, con las mismas reglas en las dos pasadas (`REGLAS_FUENTES`):

- Las anécdotas (lo que alguien dice haber visto u oído, lo que pasó en privado) no se verifican: ninguna fuente
  puede confirmarlas ni desmentirlas.
- Lo que la primera pasada ya ve que no es comprobable se descarta ahí, sin gastar una segunda revisión.
- Una verificación sin ninguna fuente que la respalde no se publica nunca.
- Un Falso o un Engañoso necesita al menos un enlace a una fuente oficial o primaria (los dominios de `OFICIALES`
  en [`modelo.py`](modelo.py)). Si no lo hay, se descarta aunque la explicación parezca buena.
  Las métricas que no decide el modelo (tiempo de palabra, intensidad, interrupciones) salen con reglas fijas.

Usa Gemini y no NaN, como el resto de Reforma Digital, porque necesita un modelo que escuche el audio, vea el vídeo y
busque en la web. Solo recibe vídeos públicos de entrevistas, nunca datos de nadie.

## Instalación

Necesitas Python 3.12+ y `ffmpeg` (`brew install ffmpeg`). Desde la raíz del repositorio:

```sh
python3 -m venv .cache/congreso-python
.cache/congreso-python/bin/python -m pip install -r apps/ingestion/requirements.txt
```

Pon `GEMINI_API_KEY` en el `.env` de la raíz (ver `.env.example`). La clave necesita facturación activa: el plan
gratuito permite cinco peticiones por minuto y el pipeline se para en seco.

Todos los comandos se lanzan desde `apps/ingestion`:

```sh
cd apps/ingestion
PY=../../.cache/congreso-python/bin/python
```

## El día de una ronda

1. **El día antes**, actualiza yt-dlp (YouTube cambia a menudo y las versiones viejas reciben un 403):

   ```sh
   $PY -m pip install -U "yt-dlp[default,curl-cffi]"
   ```

2. **Analiza** cada entrevista. En el ensayo de La Revuelta (103 min de vídeo) tardó 6,5 min y costó 1,70 USD,
   antes de añadir la segunda revisión, que suma unos minutos y algunos céntimos más:

   ```sh
   $PY -m entrevistas analizar "https://www.youtube.com/watch?v=…" --candidato pedro-sanchez
   ```

   - Por defecto es la ronda `13n` en The Wild Project. Otra ronda u otro medio:
     `--jornada octubre --medio "Cadena SER" --programa "Hoy por Hoy" --entrevistador "Aimar Bretos"`. La ronda
     tiene que existir en `rounds` (`apps/web/lib/elecciones/interviews.ts`).
   - Los `--candidato` son los `slug` de `apps/web/lib/elecciones/candidates.ts`.
   - Escribe `apps/web/lib/elecciones/entrevistas/13n-pedro-sanchez.json` y lo da de alta en `index.ts`.

3. **Mira el log.** Si sale **⚠ LOS TIEMPOS NO CUADRAN CON EL VÍDEO**, la transcripción va desplazada respecto al
   vídeo: no lo publiques y repite con `--modo audio`. Fuera de YouTube no hay subtítulos con los que comparar:
   compara a mano la transcripción con el vídeo en tres puntos.
4. **Compruébalo** en local: `pnpm dev` y abre `/elecciones/entrevistas/13n-pedro-sanchez`.
5. **Publícalo**: commit (`feat(elecciones): publica la entrevista del 13N a <candidato>`), push y despliegue, con
   las reglas de `AGENTS.md`.
6. **Con dos o más entrevistas de la ronda**, agrupa las preguntas que se hicieron a varios y vuelve a publicar:

   ```sh
   $PY -m entrevistas comunes --jornada 13n
   ```

Si la segunda revisión se corta (red, límite de la API), repítela sobre lo que quedó pendiente:
`$PY -m entrevistas revisar 13n-pedro-sanchez`. Lo pendiente sale en la web marcado como sin revisar hasta entonces.

## Otros comandos

- `sincronia <id>`: vuelve a comparar los tiempos con los subtítulos de YouTube.
- `reanalizar <id>`: repite el análisis, la verificación y la segunda revisión sobre la transcripción ya hecha, sin
  volver a transcribir (lo caro). Para aplicar un cambio en los prompts o las reglas a una entrevista ya analizada.
  Con un ensayo, `--nombre "Nombre"`. Con 90 min de vídeo cuesta unos 0,40 USD.
- `nota <id>`: recalcula la valoración (por ejemplo, tras cambiar los pesos en `metricas.py`).
- `analizar … --ensayo "Nombre"`: analiza cualquier otra entrevista para probar. Todo se queda en
  `apps/ingestion/.cache/entrevistas/`, fuera de Git, y nunca se publica. `--hasta 30` analiza solo los primeros
  30 min y `--sin-comprobar` se salta la verificación.
- `ensayo-general URL1 URL2 … --hasta 90`: varias entrevistas a la vez, como el día de una ronda, con el tiempo y
  el coste totales.
- `--video`: Gemini lee el vídeo de YouTube por tramos, sin descargar nada. Es el plan B si YouTube bloquea la
  descarga del audio: cuesta más y sus tiempos son menos precisos.

## Comprobación a mano, opcional

Con Claude Code, `/segunda-revision 13n-pedro-sanchez` repasa las verificaciones publicadas: abre cada fuente, busca
la oficial si falta y deja una nota en cada una con `anotar`. No cambia nada de lo publicado: si encuentra un
error, lo dice para corregirlo y volver a publicar.

## Costes y errores

Cada análisis guarda en `.cache/entrevistas/<id>/coste-<modo>.json` lo consumido en cada paso (audio, texto,
salida, razonamiento, búsquedas y segundos) y lo resume en la consola. Los precios están en
[`costes.py`](costes.py). Los errores pasajeros de la API se reintentan solos, y los enlaces de Google que no llevan
a una web real se descartan.

## Pruebas sin clave ni coste

```sh
$PY -m pytest -q tests/test_entrevistas.py
$PY -m entrevistas simular
```

La simulación usa la entrevista de ejemplo (candidato ficticio) y nunca escribe en la carpeta de la web.
