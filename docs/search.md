# España, en claro

El pipeline de búsqueda (`packages/ai`) busca información de trámites españoles en la web y responde con fuentes oficiales. La web ya no lo expone: se ejecuta desde las evaluaciones (`pnpm eval`) y `pnpm doctor`. Es un proyecto independiente, no una sede del Gobierno.

## Puesta en marcha

Requiere Node 22+, pnpm 11 y, para el modo real, `NAN_API_KEY` y `EXA_API_KEY`.

```sh
pnpm install --frozen-lockfile
cp .env.example .env  # Configura NAN_API_KEY y EXA_API_KEY; el .env no se sube al repositorio.
pnpm eval --mode preview --retrieval-only --limit 5
```

`--mode live` usa la búsqueda web; `--mode preview` usa los ejemplos locales y no hace llamadas a proveedores ni genera respuestas. Sin `--mode`, `SEARCH_MODE=live` elige el modo real y cualquier otro valor, los ejemplos locales.

PostgreSQL es opcional para guardar informes. La búsqueda y la generación no dependen de la base. Para configurar ese almacenamiento:

```sh
docker compose up -d
pnpm db:migrate
```

Las instalaciones existentes aplican una migración que retira las tablas del antiguo índice. Las bases nuevas crean únicamente las tablas de consultas, feedback, informes y límites de peticiones.

## Modelos y fuentes

Los modelos son de [NaN Builders](https://nan.builders), con Vercel AI SDK, y la búsqueda web es de Exa. `deepseek-v4-flash`, con razonamiento `high`, clasifica, genera y verifica las citas; los evaluadores usan `glm5.3-flash`, de otra familia, para que el modelo no se califique a sí mismo. NaN solo impone el esquema JSON en peticiones sin streaming, así que la respuesta llega entera y después se verifica bloque a bloque.

1. Resolver referencias a preguntas anteriores con el modelo y clasificar la comunidad o ciudad autónoma del trámite mediante una salida estructurada. El código se valida contra las 19 zonas del mapa; `null` significa ámbito estatal, ubicación insuficiente o varias comunidades sin un destino claro. La comunidad identificada prevalece sobre las menciones del texto; un municipio reconocido solo se conserva si pertenece a ella. Comprender el trámite y el año solicitado y pedir contexto cuando sea imprescindible.
2. Buscar en Exa, limitado a los dominios oficiales registrados y al ámbito compatible.
3. Convertir los fragmentos de las páginas que devuelve Exa en hasta ocho evidencias. Descartar dominios no autorizados, duplicados, ámbitos incompatibles y resultados sin fragmento.
4. Generar afirmaciones estructuradas con referencias a esas evidencias. El servidor resuelve los enlaces y el texto citado.
5. Comprobar formato, dominio, jurisdicción y respaldo de cada afirmación antes de publicarla. Si falta evidencia, abstenerse o indicar que la respuesta es parcial.

Las preguntas anteriores y los documentos del usuario sirven como contexto, nunca como evidencia oficial. Una fecha de consulta reciente no demuestra que un plazo o una norma sigan vigentes.

La clasificación territorial comparte la llamada que resuelve el contexto y también se ejecuta en la primera consulta real, con su coste y latencia. Sin historial ni documento, la pregunta se conserva intacta para la búsqueda. El modelo elige el territorio; no habilita dominios. En `preview` no se llama al modelo ni se simula esta clasificación.

## Credenciales

- `NAN_API_KEY`: llamadas de modelos.
- `EXA_API_KEY`: búsqueda web.
- `DATABASE_URL`: almacenamiento opcional en PostgreSQL.
- `APP_ORIGIN`: origen público de la web (URLs canónicas y sitemap).
- `POSTHOG_KEY`: estadísticas de uso de la web y de la app de escritorio (`/api/eventos`); sin ella no se envían.

NaN no cobra por token: el coste de los modelos es desconocido y se muestra como N/A. El de Exa sale de su respuesta.

## Evaluación

```sh
pnpm test
pnpm typecheck
pnpm eval --mode preview --retrieval-only --limit 5
pnpm eval --mode live --dataset regressions --judges
pnpm eval --mode live --dataset golden --judges --save-baseline
```

Las evaluaciones reales requieren NaN Builders y Exa, sin depender de un índice ni de PostgreSQL. Los informes se guardan en `artifacts/runs/` y, si se configura la base, también en PostgreSQL. Incluyen modelo, configuración, versión y hash del dataset, código, fuentes autorizadas, latencias, tokens y costes. Los resultados de búsqueda web pueden cambiar entre ejecuciones.

`--retrieval-only` ejecuta la búsqueda sin generar respuestas ni llamar a los evaluadores de respuestas. Las métricas de documentos requieren referencias revisadas que correspondan a las fuentes web actuales; los datasets pendientes no certifican calidad. El baseline del sistema anterior se ha retirado y debe generarse y revisarse uno nuevo antes de habilitar la puerta de calidad real.

`pnpm eval:approve` sigue requiriendo una persona identificada y casos revisados. Los evaluadores y las comprobaciones de citas se mantienen porque verifican el comportamiento actual del pipeline de búsqueda.
