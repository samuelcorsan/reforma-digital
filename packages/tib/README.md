# @reforma-digital/tib

Servidor MCP con las líneas, paradas y horarios del transporte público de Mallorca (TIB: bus, tren y
metro), publicado por la web en `https://reforma-digital.es/mcp/tib`. No es oficial: usa el GTFS
abierto del Consorci de Transports de Mallorca.

El feed es un zip estático (CC BY 4.0, sin clave) que se descarga una vez por proceso y se indexa en
memoria. Son horarios **programados** (sin tiempo real): los retrasos no se ven.

| Herramienta     | Qué hace                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `find_routes`   | Líneas de bus, tren y metro por número o nombre (sin consulta, todas)    |
| `find_stops`    | Paradas por nombre o código, la mejor primero                             |
| `route_stops`   | Paradas de una línea en orden, por sentido (ida y vuelta)                 |
| `stop_times`    | Salidas programadas de una parada en una fecha, filtrables por línea/hora |

## Datos

- **Fuente:** Consorci de Transports de Mallorca, GTFS abierto en `tib.org` (CC BY 4.0).
- **Feed:** `https://www.tib.org/documents/20124/478141/ctm-mallorca-es.zip`
- `src/gtfs.ts` parsea el CSV (comillas RFC 4180) e indexa rutas, paradas, viajes, `stop_times`,
  `calendar` y `calendar_dates`. Las funciones puras se prueban con un fixture local en
  `src/gtfs.test.ts`, sin tocar la red.

## Mantenerlo al día

El feed cambia con los horarios (varias veces al año). El zip se descarga en cada proceso, así que no
hay nada que actualizar salvo la URL si el Consorci la cambia. `activeServicesOn` aplica el calendario
y las excepciones (`calendar_dates`) para decir qué viajes circulan una fecha concreta.

## Despliegue

Va dentro de la web, como `@reforma-digital/renfe`, sin nada aparte. Dos cosas a revisar en Vercel:

- **Región de las funciones.** El zip se sirve desde España; conviene una región europea (por ejemplo
  `cdg1`) para descargarlo rápido.
- **Cortafuegos.** `/mcp/tib` necesita una regla que deje pasar a los clientes MCP sin el desafío
  anti-bots, con límite de peticiones (igual que `/mcp/renfe`).
