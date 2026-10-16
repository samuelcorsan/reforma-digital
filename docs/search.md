# España, en claro

El chat busca información de trámites españoles en la web y responde con fuentes oficiales. Es un proyecto independiente, no una sede del Gobierno.

## Puesta en marcha

Requiere Node 22+, pnpm 11 y `OPENROUTER_API_KEY`.

```sh
pnpm install --frozen-lockfile
cp .env.example .env  # Configura OPENROUTER_API_KEY; el .env no se sube al repositorio.
pnpm dev
```

Con una clave configurada, la web utiliza el modo real automáticamente. `SEARCH_MODE=preview` selecciona explícitamente los ejemplos locales y no hace llamadas a proveedores ni genera respuestas. `SEARCH_MODE=live` fuerza la búsqueda web.

PostgreSQL es opcional para guardar consultas, feedback e informes y compartir los límites de peticiones. La búsqueda y la generación no dependen de la base. Para configurar ese almacenamiento:

```sh
docker compose up -d
pnpm db:migrate
```

Las instalaciones existentes aplican una migración que retira las tablas del antiguo índice. Las bases nuevas crean únicamente las tablas de consultas, feedback, informes y límites de peticiones.

## Modelos y fuentes

Toda la IA utiliza OpenRouter mediante Vercel AI SDK. El modelo por defecto es `openai/gpt-6-luna`, con razonamiento `high`, para búsqueda, generación, verificación de citas y evaluadores.

1. Resolver referencias a preguntas anteriores con el modelo y clasificar la comunidad o ciudad autónoma del trámite mediante una salida estructurada. El código se valida contra las 19 zonas del mapa; `null` significa ámbito estatal, ubicación insuficiente o varias comunidades sin un destino claro. La comunidad identificada prevalece sobre las menciones del texto; un municipio reconocido solo se conserva si pertenece a ella. Comprender el trámite y el año solicitado y pedir contexto cuando sea imprescindible.
2. Buscar mediante `openrouter:web_search` con el motor Parallel. La búsqueda se limita a los dominios oficiales registrados y al ámbito compatible.
3. Convertir los fragmentos originales de las citas web en hasta ocho evidencias. Descartar dominios no autorizados, duplicados, ámbitos incompatibles y resultados sin fragmento original. No usar el resumen generado como evidencia.
4. Generar afirmaciones estructuradas con referencias a esas evidencias. El servidor resuelve los enlaces y el texto citado.
5. Comprobar formato, dominio, jurisdicción y respaldo de cada afirmación antes de publicarla. Si falta evidencia, abstenerse o indicar que la respuesta es parcial.

La API transmite etapas, evidencias y afirmaciones completas mediante SSE. Detener una respuesta cancela las llamadas en curso. Las preguntas anteriores y los documentos del usuario sirven como contexto, nunca como evidencia oficial. Una fecha de consulta reciente no demuestra que un plazo o una norma sigan vigentes.

La clasificación territorial comparte la llamada que resuelve el contexto y también se ejecuta en la primera consulta real, con su coste y latencia. Sin historial ni documento, la pregunta protegida se conserva intacta para la búsqueda. El aviso de cobertura muestra el recuento del registro para comunidades con 0–2 fuentes territoriales y permite abrir esa zona en el mapa. El modelo elige el territorio; no inventa el recuento ni habilita dominios. En `preview` no se llama al modelo ni se simula esta clasificación: el mapa sigue disponible desde el menú.

## Datos personales

Antes de enviar, el navegador aplica a la consulta, a las preguntas anteriores y al texto del PDF las reglas de DNI, NIE, IBAN, correo y teléfono, y después [Rampart](https://github.com/nationaldesignstudio/rampart) (CC BY 4.0), que sustituye los identificadores detectados por marcadores como `[GIVEN_NAME_1]`. De lo que detecta Rampart se descartan dos confusiones conocidas: un número de portal o de piso sin una calle en el mismo texto, porque así marca los números de modelo («modelo 303»), y un correo sin «@». Un número de portal suelto no se oculta. Puede pasar por alto datos: no garantiza anonimización. Si Rampart no carga, falla o supera los 60 segundos para el lote completo, la consulta no se envía. Detener libera el chat y descarta resultados tardíos; no interrumpe necesariamente la descarga interna de Rampart. El modelo se descarga de `huggingface.co` y su runtime de `cdn.jsdelivr.net` en cuanto se empieza a escribir la pregunta, para que suelan estar listos al enviar; con el ahorro de datos del navegador activado, esperan al envío.

Los límites originales del formulario (1.200 caracteres) y del PDF (6.000) se mantienen. La API permite hasta 6.000 caracteres por pregunta protegida y 30.000 de PDF protegido, seis preguntas de contexto y 300.000 bytes por cuerpo JSON, para permitir la expansión de marcadores sin aceptar cuerpos ilimitados. Si se supera ese margen, se rechaza la petición; no se recortan los marcadores.

El servidor repite las reglas de patrones, pero no ejecuta Rampart: una petición directa a la API solo recibe esa capa. Es reducción de daño, no anonimización.

Tras proteger una pregunta, el chat subraya los fragmentos retirados del envío y muestra su cantidad. Cada marca explica, al pasar el cursor o enfocarla con el teclado, que ese dato no se ha enviado al modelo. Los originales y sus posiciones se conservan solo en el navegador; la API recibe el texto protegido, sin estos metadatos. El contador corresponde a la pregunta visible, no al historial ni al PDF. No se marca texto si no se puede reconstruir con certeza su correspondencia con el resultado protegido.

Los favicons de las fuentes se cargan en el navegador desde Google S2, con carga diferida y sin cabecera `Referer`. El parámetro enviado es únicamente el hostname de la fuente, nunca la ruta, los parámetros, la pregunta ni los documentos. Google recibe el dominio solicitado y la dirección IP del visitante. Si falla la imagen, se muestran las iniciales del organismo.

## Credenciales

- `OPENROUTER_API_KEY`: búsqueda web y llamadas de modelos.
- `DATABASE_URL`: almacenamiento opcional en PostgreSQL.
- `FEEDBACK_SECRET`: firma del feedback y anonimización de los límites de peticiones.
- `ADMIN_TOKEN`: acceso al laboratorio; no se incorpora al navegador.
- `APP_ORIGIN`: origen autorizado del frontend.

Los costes proceden de los metadatos reales de OpenRouter; un coste desconocido se muestra como N/A.

## Evaluación

```sh
pnpm test
pnpm typecheck
pnpm eval --mode preview --retrieval-only --limit 5
pnpm eval --mode live --dataset regressions --judges
pnpm eval --mode live --dataset golden --judges --save-baseline
```

Las evaluaciones reales requieren OpenRouter, sin depender de un índice ni de PostgreSQL. Los informes se guardan en `artifacts/runs/` y, si se configura la base, también en PostgreSQL. Incluyen modelo, configuración, versión y hash del dataset, código, fuentes autorizadas, latencias, tokens y costes. Los resultados de búsqueda web pueden cambiar entre ejecuciones.

`--retrieval-only` ejecuta la búsqueda sin generar respuestas ni llamar a los evaluadores de respuestas. Las métricas de documentos requieren referencias revisadas que correspondan a las fuentes web actuales; los datasets pendientes no certifican calidad. El baseline del sistema anterior se ha retirado y debe generarse y revisarse uno nuevo antes de habilitar la puerta de calidad real.

`pnpm eval:approve` sigue requiriendo una persona identificada y casos revisados. Los evaluadores y las comprobaciones de citas se mantienen porque verifican el comportamiento actual del chat.
