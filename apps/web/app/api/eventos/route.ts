import { z } from 'zod';
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
  const res = await fetch('https://eu.i.posthog.com/i/v0/e/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: clave,
      event: evento,
      distinct_id: sesion,
      properties: {
        $current_url: new URL(ruta, siteUrl).href,
        $pathname: ruta,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((error: unknown) => {
    // Sin conexión o PostHog tarda más de 5 s: se responde 502.
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'TimeoutError')
    )
      return null;
    throw error;
  });
  return new Response(null, { status: res?.ok ? 204 : 502 });
}
