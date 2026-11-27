import { z } from 'zod';
import { capturar } from '../../../lib/posthog';
import { siteUrl } from '../../../lib/site';

/**
 * Las estadísticas de uso de la web, que se ven en PostHog (UE). Solo pasan las páginas vistas,
 * con la ruta y el identificador aleatorio de una pestaña, que solo vive en memoria. PostHog
 * recibe la petición de este servidor, así que no ve la IP ni el navegador de nadie, y no crea
 * perfiles de persona.
 */
const eventoEsquema = z.strictObject({
  sesion: z.uuid(),
  evento: z.literal('$pageview'),
  ruta: z
    .string()
    .max(200)
    .regex(/^\/[\w\-/%.~]*$/),
});

/** Lee el cuerpo sin pasar de `max` bytes; `null` si es más grande, sin leer el resto. */
async function leerCuerpo(request: Request, max: number) {
  if (Number(request.headers.get('content-length') ?? 0) > max) return null;
  const trozos: Uint8Array[] = [];
  let bytes = 0;
  for await (const trozo of request.body ?? []) {
    bytes += trozo.byteLength;
    if (bytes > max) return null;
    trozos.push(trozo);
  }
  return new TextDecoder().decode(Buffer.concat(trozos));
}

export async function POST(request: Request) {
  const clave = process.env.POSTHOG_KEY;
  if (!clave) return new Response(null, { status: 204 });
  const texto = await leerCuerpo(request, 1000);
  if (texto === null) return new Response(null, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 400 });
  }
  const e = eventoEsquema.safeParse(json);
  if (!e.success) return new Response(null, { status: 400 });
  const { evento, sesion, ruta } = e.data;
  const aceptado = await capturar(clave, evento, sesion, {
    $current_url: new URL(ruta, siteUrl).href,
    $pathname: ruta,
  });
  return new Response(null, { status: aceptado ? 204 : 502 });
}
