# Datos parlamentarios

Recolector Python adaptado de [Escaño Abierto](https://github.com/jorgegarcelan/escano-abierto), revisión `ba240791820b423503f69bb88406b51a25487083`, licencia MIT incluida en `LICENSE`. Conserva los parsers, las fuentes, la verificación de citas, las estadísticas, las encuestas y las proyecciones. Se sustituyen el generador HTML, Gemini/Anthropic y los commits diarios por Next.js, NaN, Postgres y Vercel Blob.

## Dónde vive cada cosa

- Git: código, esquema SQL y workflows. Ningún histórico descargado.
- Postgres: conjuntos JSON publicados, diputados históricos, votaciones, votos individuales, **todas** las preguntas escritas y sesiones completas con su texto extraído. Las proyecciones JSON conservan los contratos originales; las tablas permiten búsquedas y paginación. Un trigger expande cada fichero mensual en `congreso_month_sessions`, `congreso_month_votes` y `congreso_interventions` dentro de la misma transacción que lo publica: la web consulta esas filas y recorta en SQL los documentos grandes en lugar de descargarlos enteros.
- Un **Vercel Blob privado**: originales descargados por hash, checkpoint de procesamiento y archivo descargable. La API de Next autentica las descargas; el navegador nunca recibe la clave de escritura.
- Directorio `CONGRESS_WORKDIR` (por defecto `apps/ingestion/.cache`): trabajo temporal, ignorado por Git.

`CONGRESS_DATABASE_URL` en `.env` y GitHub Secrets debe apuntar a un rol de escritura del Postgres de Congreso. El runner la utiliza si está configurada; en su ausencia usa `DATABASE_URL`. La web usa `DATABASE_URL` con permisos de lectura en estas tablas; limita sus consultas con `ALTER ROLE <rol de lectura> SET statement_timeout = '5s'`, porque el pooler de Neon rechaza ese parámetro en la URL. Se puede usar Neon o cualquier Postgres estándar; solo requiere la extensión `pg_trgm`, incluida en Postgres, y ningún otro servicio de consultas. Para migrar, usa un rol propietario y el comando existente `pnpm db:migrate`; con Neon, utiliza la conexión directa para los trabajos largos y la conexión agrupada para Next.js.

## Configuración real

Crea un almacén **privado** en Vercel Blob, vincúlalo al proyecto web y añade `BLOB_READ_WRITE_TOKEN` tanto a Vercel como a GitHub Secrets. Añade `CONGRESS_DATABASE_URL` y `NAN_API_KEY` a GitHub Secrets. En la web configura `DATABASE_URL`. Las claves se configuran en los paneles o archivos `.env` ignorados, nunca en Git ni en el chat.

El modelo inicial es `deepseek-v4-flash`, cubierto por los planes de NaN según su [documentación](https://nan.builders/docs). Se elige por su capacidad con documentos largos; no se ha medido su calidad en estos textos todavía. `NAN_MODEL` permite comparar otro modelo cubierto. No hay fallback a modelos de pago por token. La salida JSON se valida y las citas se comprueban contra el Diario. Se guardan proveedor, modelo, versión del prompt y hash de entrada junto al análisis.

Las primeras ejecuciones usan los análisis importados. `reanalyze` pide nuevos análisis a NaN, hasta `--limit`, y reutiliza el trabajo guardado al relanzarlo. El build usa primero el modelo nuevo y, si falta, la caché importada. Una publicación puede contener ambos; la UI lo explica. Un análisis nuevo no debe interpretarse como una corrección verificada del anterior.

## Importación inicial

Necesitas Python 3.12+, Node 24, pnpm y `pdftotext` (Poppler).

```sh
python3 -m venv .cache/congreso-python
.cache/congreso-python/bin/python -m pip install -r apps/ingestion/requirements.txt
pnpm install --frozen-lockfile
pnpm db:migrate
.cache/congreso-python/bin/python apps/ingestion/run.py bootstrap
```

El bootstrap descarga **solo los datos** del commit fijado, fuera de Git, y los importa. No ejecuta código remoto. No sobrescribe una instalación publicada. El histórico upstream no contiene todos los PDF originales: se conservan sus JSON y textos extraídos; los originales nuevos se guardan en Blob. `reparse` solo puede reconstruir a partir de los originales disponibles, no recuperar por arte de magia PDF ausentes.

Para desarrollo sin servicios externos, usa el Postgres del `compose.yaml` existente y una copia local del commit fijado:

```sh
docker compose -p reforma-escano up -d postgres
export DATABASE_URL=postgres://gov:gov@127.0.0.1:5442/gov
export CONGRESS_DATABASE_URL="$DATABASE_URL"
pnpm db:migrate
CONGRESS_WORKDIR="$PWD/.cache/congreso-data" .cache/congreso-python/bin/python apps/ingestion/run.py bootstrap --local --source /ruta/a/escano-abierto
pnpm --filter @reforma-digital/web dev
```

`--local` importa datos reales en la DB de desarrollo y deja la descarga Blob sin configurar. Solo funciona con `bootstrap --source`; no permite que un cron omita la persistencia.

## Actualización y recuperación

`.github/workflows/congreso.yml` ejecuta `update` de lunes a sábado a las 05:17 UTC y `polls` a las 06:40 y 19:40 UTC. Configura `CONGRESS_INGESTION_ENABLED=true` como variable del repositorio **después** del bootstrap y de configurar los secretos. Las ejecuciones manuales están disponibles antes. No hace commits, pushes ni redeploys.

Cada ejecución restaura el checkpoint privado, recoge datos, valida los conjuntos y publica dentro de una transacción. Un bloqueo de Postgres y la concurrencia del workflow impiden escritores simultáneos. Si falla la recogida o la inferencia, conserva el checkpoint para reanudar y mantiene el snapshot público anterior. Una publicación fallida revierte todas las tablas. El timestamp del snapshot no indica que todas las fuentes estén actualizadas: se conservan sus fechas propias.

El límite cuenta los intentos de petición, incluidos los reintentos y la normalización de temas, lugares y propuestas. Se reserva parte del presupuesto para normalizar; si se agota, se publica con la caché disponible. El procesamiento se detiene a las cuatro horas con margen para guardar el checkpoint antes del timeout de Actions. Un corte abrupto del runner puede repetir trabajo posterior al último checkpoint.

El reanálisis es acotado y reanudable:

```sh
.cache/congreso-python/bin/python apps/ingestion/run.py reanalyze --limit 100 --since 2026-09-01
.cache/congreso-python/bin/python apps/ingestion/run.py rebuild
```

También se mantienen `geography`, `elections`, `promises` y `reparse`. Los comandos de adquisición individuales siguen disponibles con `python -m escano` desde `apps/ingestion`; para publicarlos con persistencia usa el runner. El bootstrap conserva elecciones, geografía, normalización y promesas previas aunque no llames a un modelo. El juego «¿Quién lo dijo?» está retirado: al archivar o publicar se eliminan sus archivos históricos (`retos.json` y `explora-retos.json`); la publicación también retira el conjunto antiguo de Postgres. Las citas de Explora se conservan.

La política de encuestas importada se aplica tanto en UI como en API; la descarga completa se bloquea durante esa ventana porque contiene encuestas. El recolector deja de actualizarlas desde el inicio de la ventana, como upstream. Al cambiar de convocatoria/legislatura hay que actualizar las constantes de los módulos correspondientes, revisar los parsers y hacer una migración deliberada; no se infiere una legislatura nueva automáticamente.

Los objetos originales se conservan. Se conservan las siete publicaciones más recientes y el checkpoint de recuperación; el runner elimina snapshots antiguos al publicar. Los originales se conservan por hash con su historial en el manifiesto. Configura el presupuesto de Blob según el histórico y el tráfico. El volumen de una descarga completa crece con el histórico y el coste depende de almacenamiento y transferencia, no del número de ficheros en Git.

## API y web

- `/congreso`: web pública con los datos propios, el diseño de Pablo y las vistas de actividad, diputados, elecciones y geografía.
- `/api/congreso`: catálogo y publicación actual.
- `/api/congreso/datasets/<ruta.json>`: contrato original, ETag y `X-Congreso-Publication`.
- `/api/congreso/votaciones`, `/preguntas`, `/sesiones`: `pagina`, `limite` (1–100), `q`, `legislatura`, `desde`, `hasta`; preguntas admite `estado`.
- `/api/congreso/sesiones/<DSCD-id>`: sesión completa, incluidas intervenciones sin análisis.
- `/api/congreso/descarga`: archivo de JSON públicos completos, con datos de origen y proyecciones. No incluye claves, manifiesto privado ni caché interna de IA.

La API es de lectura y admite CORS público. Los parámetros SQL son parametrizados, las rutas no admiten traversal y el proxy de descarga solo acepta el dominio privado de Vercel Blob. No expone endpoints de escritura.

## Verificación

```sh
.cache/congreso-python/bin/python -m pytest apps/ingestion/tests
pnpm exec tsx apps/web/scripts/validate-congreso.ts /ruta/a/site/datos
pnpm --filter @reforma-digital/web typecheck
pnpm lint
```

Una prueba local no verifica las credenciales reales de Blob ni la calidad de NaN. Esas comprobaciones requieren los servicios configurados; tampoco demuestran que todas las fuentes oficiales continúen teniendo el mismo HTML.
