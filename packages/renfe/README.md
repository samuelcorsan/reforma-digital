# @reforma-digital/renfe

Servidor MCP con estaciones, horarios y precios de Renfe y retrasos en directo, publicado por la web en
`https://reforma-digital.es/mcp/renfe`. No es oficial: usa la API pública de la web de Renfe.

Es un port a TypeScript de la parte de [renfe-cli](https://github.com/luisgonzaleznf/renfe-cli) de Luis
González (MIT, ver `data/LICENSE-renfe-cli`) que usan sus herramientas, a partir del commit `ac226de`. Cada
herramienta devuelve el mismo JSON que el comando `renfe` equivalente:

| Herramienta     | Comando de renfe-cli | Qué hace                                                     |
| --------------- | -------------------- | ------------------------------------------------------------ |
| `find_stations` | `renfe stations`     | Estaciones y grupos de ciudad por nombre o código            |
| `search_trains` | `renfe search`       | Trenes, horarios y precios para un adulto en una fecha       |
| `train_status`  | `renfe status`       | Retraso en directo y próxima estación de un tren que circula |
| `list_delays`   | `renfe delays`       | Todos los trenes con retraso en el mapa en directo           |

Cada módulo de `src/` dice de qué fichero de renfe-cli viene. Diferencias deliberadas: la sesión anónima, la lista
de estaciones de Renfe y el horario GTFS se guardan en memoria del proceso en vez de en disco, y no hay ritmo entre
peticiones (en la CLI está desactivado por defecto).

## Mantenerlo al día

renfe-cli cambia a menudo para seguir a Renfe. Para traer un cambio, compara su diff con el módulo equivalente de
`src/` y actualiza el commit de arriba. `data/stations.json` y `data/train-number-groups.ts` son copias literales
de sus ficheros de datos. `port.test.ts` comprueba con valores obtenidos de la CLI las partes donde es fácil
divergir sin darse cuenta.

La tienda antigua (`legacy.ts`) solo sirve para viajes antes del 25 de enero de 2027: después se puede borrar,
como hará renfe-cli.

## Despliegue

Va dentro de la web, sin nada aparte. Dos cosas a revisar en Vercel:

- **Región de las funciones.** Renfe responde desde España; desde otras regiones no está comprobado. Si las
  funciones del proyecto corren en EE. UU., conviene elegir una europea (por ejemplo `cdg1`).
- **Cortafuegos.** Los clientes MCP son automáticos: `/mcp/renfe` necesita una regla que lo deje pasar sin el
  desafío anti-bots, con límite de peticiones.
