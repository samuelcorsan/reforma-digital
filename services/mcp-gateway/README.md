# Gateway MCP unificado · SSE heredado

Servidor MCP unificado que expone **26 herramientas de siete módulos** de Reforma Digital mediante el transporte histórico **HTTP + SSE** (`GET /sse` + `POST /message?sessionId=...`). Implementado en TypeScript, Node.js, Express, Zod y `@modelcontextprotocol/sdk@1.32.2`.

## Por qué este transporte

La rama oficial `@modelcontextprotocol/sdk` 1.x conserva `SSEServerTransport`. En 2026 el SDK principal es v2 (`@modelcontextprotocol/server`) y **recomienda Streamable HTTP**. SSE de dos rutas es un protocolo anterior que se mantiene exclusivamente para clientes que lo necesitan. **Una URL SSE no equivale al transporte Streamable HTTP moderno**; si un cliente solo admite Streamable HTTP, el gateway necesita añadir la ruta moderna `/mcp` o usar directamente las siete direcciones de Reforma Digital.

## Estructura

```text
services/mcp-gateway/
├── src/
│   ├── server.ts                # Express, handshake SSE, sesiones, SDK, registro
│   ├── config.ts                # Configuración/validación de entorno
│   ├── upstream.ts              # Cliente HTTP, timeout, retries, tamaño máximo
│   └── modules/
│       ├── common.ts            # Utilidades Zod y tipos compartidos
│       ├── index.ts             # Registro unificado
│       ├── renfe.ts             # 4 herramientas
│       ├── carburantes.ts       # 2 herramientas
│       ├── ine.ts               # 4 herramientas
│       ├── boe.ts               # 4 herramientas
│       ├── alsa.ts              # 2 herramientas
│       ├── congreso.ts          # 7 herramientas
│       └── eustat.ts            # 3 herramientas
├── test/integration.test.mjs    # Cliente real MCP y upstream local simulado
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── railway.json
└── fly.toml
```

## Ubicación en el monorepositorio

Este servicio vive en `services/mcp-gateway` y mantiene un `package.json` independiente del workspace pnpm de la raíz. El transporte SSE necesita un proceso HTTP persistente; no se incorpora a `apps/web` (Next.js/Vercel) ni modifica el pipeline de la extensión. La separación evita cambiar el lockfile y los checks de los paquetes existentes.

## Instalación y ejecución local

```bash
node --version                  # Node >= 22.18
npm install                     # Instala dependencias del servicio independiente
npm run check
npm test                        # Integración sin acceso a Reforma Digital
npm run dev                     # http://localhost:8080/sse
# o compilado:
npm run build
npm start
```

La integración simula el backend HTTP con el servidor local del test, abre una conexión SSE usando **SSEClientTransport** del SDK y prueba `initialize`, `tools/list` y `tools/call`, con los 26 registros y filtros estructurados de Eustat. Para hacer una prueba contra Reforma Digital hay que ejecutar el gateway en una máquina con salida a Internet y llamar a una herramienta real.

Comprobar salud y handshake SSE:

```bash
curl -fsS http://localhost:8080/healthz
curl -iN -H 'Accept: text/event-stream' http://localhost:8080/sse
# El evento "endpoint" devuelve la URL POST con sessionId.
# El cliente MCP usa esa URL para initialize, tools/list y tools/call.
```

### Configuración en Poke y Cursor

Configura un único servidor MCP remoto tipo **SSE / HTTP+SSE** con la URL `https://TU-DOMINIO/sse`. La ruta `/message` se anuncia durante el handshake y **no debe configurarse manualmente en el cliente**. Si el cliente permite headers y has configurado `GATEWAY_TOKEN`, añade `Authorization: Bearer <token>` tanto a GET como a POST.

Cursor (la documentación oficial acepta esta configuración tanto para HTTP como SSE, aunque algunas versiones pueden fallar al negociar el transporte):

```json
{
  "mcpServers": {
    "reforma-digital": {
      "url": "https://TU-DOMINIO/sse"
    }
  }
}
```

Algunas versiones de Cursor han presentado problemas al negociar automáticamente SSE a partir de `url`. Si falla, utiliza la configuración stdio con `mcp-remote` que aparece a continuación o añade un endpoint Streamable HTTP moderno; no basta con renombrar `/sse`.

```json
{
  "mcpServers": {
    "reforma-digital": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://TU-DOMINIO/sse", "--transport", "sse-only"]
    }
  }
}
```

**Nota:** `mcp-remote` documenta `--transport sse-only`; verifica que tu versión del paquete lo admita. La opción más simple para un cliente que lo soporte es SSE nativo.

## Herramientas públicas

| Módulo | Herramientas |
|---|---|
| renfe | `renfe_find_stations`, `renfe_search_trains`, `renfe_train_status`, `renfe_list_delays` |
| carburantes | `carburantes_buscar_municipio`, `carburantes_gasolineras_baratas` |
| ine | `ine_buscar_operacion`, `ine_buscar_tabla`, `ine_datos_tabla`, `ine_datos_serie` |
| boe | `boe_sumario_boe`, `boe_buscar_legislacion`, `boe_indice_norma`, `boe_ver_bloque` |
| alsa | `alsa_find_stops`, `alsa_search_buses` |
| congreso | `congreso_indice_congreso`, `congreso_buscar_votaciones`, `congreso_ver_votacion`, `congreso_buscar_preguntas`, `congreso_buscar_sesiones`, `congreso_ver_sesion`, `congreso_ver_conjunto` |
| eustat | `eustat_buscar_tabla`, `eustat_ver_tabla`, `eustat_datos_tabla` |

El gateway se basa en las rutas GET documentadas por Reforma Digital: `https://reforma-digital.es/mcp/<módulo>/<herramienta>?parámetros`. Los tipos y nombres de herramientas se tomaron de las fichas `https://reforma-digital.es/developers/mcp/<módulo>.md`, no se descubren dinámicamente. Si Reforma Digital cambia la interfaz de una herramienta, será necesario actualizar su esquema.

**Importante**: `https://reforma-digital.es/developers/api.md` documenta específicamente la API REST del Congreso. Las otras seis familias se consultan por las rutas GET de herramienta documentadas en sus fichas MCP. En `eustat_datos_tabla`, el argumento `filtros` se serializa como un objeto JSON en el query string; confirma que la implementación de GET upstream acepte ese formato al hacer el smoke test real.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `8080` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `UPSTREAM_BASE_URL` | `https://reforma-digital.es/mcp` | Base de las rutas GET; configurable para pruebas |
| `UPSTREAM_TIMEOUT_MS` | `20000` | Timeout de cada GET |
| `UPSTREAM_MAX_BYTES` | `4194304` | Límite en bytes por respuesta upstream |
| `UPSTREAM_RETRIES` | `1` | Reintentos para fallos de red y HTTP 429/5xx |
| `MAX_SESSIONS` | `100` | Sesiones SSE concurrentes por proceso |
| `MAX_INFLIGHT_TOOLS` | `25` | Consultas upstream simultáneas por proceso |
| `SSE_HEARTBEAT_MS` | `15000` | Intervalo keepalive, `0` para desactivar |
| `GATEWAY_TOKEN` | sin auth | Bearer token opcional de entrada |
| `ALLOWED_ORIGINS` | vacío | Lista exacta de Origins separados por coma; si vacío bloquea solicitudes con Origin |
| `ALLOWED_HOSTS` | vacío | Lista de cabeceras Host admitidas (si se define) |
| `TRUST_PROXY` | `false` | Confianza en un reverse proxy, habilitar solo si existe |

## Docker

```bash
docker build -t reforma-mcp .
docker run --rm -p 8080:8080 --env-file .env reforma-mcp
# o sin archivo .env:
docker run --rm -p 8080:8080 reforma-mcp
```

**Reproducibilidad:** después de `npm install` genera y sube un `package-lock.json` para fijar dependencias transitivas. El Dockerfile usa versiones directas fijas, pero sin lockfile la resolución de dependencias transitivas no es reproducible. Antes de fusionar conviene generar `package-lock.json` con npm y cambiar la instalación a `npm ci`.

## Railway

Usa un servicio persistente basado en Dockerfile (no función serverless):

1. Configura en Railway la carpeta raíz `services/mcp-gateway` (Root Directory).
2. En Railway elige **New Project → Deploy from GitHub Repo** y selecciona el repositorio. Detectará `railway.json` y el Dockerfile.
3. Configura las variables si procede y usa **Generate Domain**.
4. Añade `https://DOMINIO.up.railway.app/sse` al cliente MCP.

También funciona `cd services/mcp-gateway && railway login && railway init && railway up` desde la CLI. Si se ejecutan varias réplicas, configura afinidad por sesión para que cada POST `/message?sessionId=...` llegue al proceso que abrió `/sse`; lo más sencillo es **una sola réplica**.

## Fly.io

Edita `app` en `fly.toml` para que tenga un nombre globalmente único:

```bash
fly auth login
fly launch --no-deploy
fly deploy
fly status
```

La configuración mantiene una máquina activa (`auto_stop_machines="off"`) porque SSE necesita conexiones largas. Para varias máquinas hay que resolver la afinidad de sesiones HTTP; mantén una instancia para este diseño.

## Vercel

**No recomendable para esta variante SSE**: las funciones serverless tienen un tiempo de vida limitado y no comparten en memoria el mapa `sessionId → SSEServerTransport`. No sería honesto proporcionar un `vercel.json` que prometa el protocolo de dos rutas sin disponer de un runtime persistente. Para Vercel conviene crear una variante stateless con Streamable HTTP moderno, que es otro transporte y requiere diseño independiente.

## Operación y seguridad

- Los datos upstream son públicos y las operaciones están documentadas como **solo lectura**.
- Activa un `GATEWAY_TOKEN` fuerte si el cliente permite autenticar tanto GET como POST. Si Poke no admite esa cabecera, protege la URL con las medidas de red/proveedor y limita cuotas.
- Para un gateway expuesto en Internet aplica límites de conexiones y de solicitudes en el balanceador; `MAX_SESSIONS` y `MAX_INFLIGHT_TOOLS` limitan el proceso, pero **no sustituyen un rate limiter por IP**.
- SSE depende de conexiones persistentes. Evita proxy buffering, interrupciones de 30–60 segundos y horizontal scaling sin sticky sessions.
- `GET /healthz` prueba que el gateway está activo; no verifica que Reforma Digital esté disponible.
- El gateway no transforma ni verifica el contenido de los datos públicos. Mantén su atribución/licencia si reutilizas la información; la API del Congreso documenta CC BY 4.0 para sus datasets, con excepciones.
- Para producción real, incorpora supervisión de latencia y errores, pruebas periódicas contra upstream y revisión de dependencias con `npm audit`.

## Referencias

- Documentación oficial: https://reforma-digital.es/developers/mcp.md
- REST Congreso: https://reforma-digital.es/developers/api.md
- SDK v1: https://ts.sdk.modelcontextprotocol.io/server
- SSE legacy (v2): https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md
