# @reforma-digital/alsa

Servidor MCP con las paradas, los horarios y los precios de los autobuses de ALSA, publicado por la web en
`https://reforma-digital.es/mcp/alsa`. No es oficial: usa la web pública de ALSA (`www.alsa.es`) como la usan sus
propias páginas.

Es un port a TypeScript de la parte anónima de [queguagua](https://github.com/joseluissaorin/queguagua) (MIT, ver
`data/LICENSE-queguagua`), a partir del commit `eb37f7c`. Cada herramienta devuelve el mismo JSON que el comando
`queguagua alsa` equivalente:

| Herramienta    | Comando de queguagua      | Qué hace                                                             |
| -------------- | ------------------------- | -------------------------------------------------------------------- |
| `find_stops`   | `queguagua alsa stations` | Paradas y grupos de ciudad por nombre o identificador                |
| `search_buses` | `queguagua alsa search`   | Viajes de una fecha con servicio, plazas, tarifas y bonos de la ruta |

Cada módulo de `src/` dice de qué fichero de queguagua viene. Diferencias deliberadas:

- Cada llamada abre una sesión anónima nueva en vez de guardar cookies en disco, y tiene un plazo de 60 s en total.
- Solo se siguen redirecciones https a alsa.es y queue-it.net, y solo se guardan las cookies de esos dominios.
- Una respuesta sin la lista de viajes o de paquetes, o un viaje a la venta sin tarifas, es un error `api_changed`,
  nunca una lista vacía.
- La lista actual de paradas de ALSA, que solo se pide para una parada que no está en la incluida, no se guarda entre
  llamadas, y si no llega se devuelve ese error en vez de «parada desconocida».

Se queda fuera todo lo que necesita una cuenta de Alsa Plus o un dato personal: el Abono Único, los códigos
promocionales, los asientos, la compra, los billetes y las cancelaciones. Tampoco está «Localiza tu bus»: ALSA lo
tiene en pruebas y su posición GPS llegaba vacía en todos los autobuses probados.

## Mantenerlo al día

Para traer un cambio de queguagua, compara su diff con el módulo equivalente de `src/` y actualiza el commit de
arriba. `data/stations.json` es la lista de paradas de queguagua con el formato de Prettier. `port.test.ts`
comprueba con valores obtenidos de la CLI las partes donde es fácil divergir sin darse cuenta, y `client.test.ts`, sin
red, que una respuesta rara de ALSA no acabe convertida en datos.

## Despliegue

Va dentro de la web, como Renfe, y comparte con ella las dos cosas a revisar en Vercel: una región europea para las
funciones y una regla del cortafuegos que deje pasar `/mcp/alsa` sin el desafío anti-bots, con límite de peticiones.
Delante de ALSA están Imperva y queue-it: la búsqueda anónima funcionó desde un Mac en España y desde un Worker de
Cloudflare en Madrid; desde Vercel no está comprobado. Si ALSA rechaza la petición, la herramienta devuelve un error
de tipo `blocked` y nunca intenta saltarse la protección.
