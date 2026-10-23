import { z } from 'zod';
import { leerCuerpo } from '../../../lib/escritorio';
import { siteUrl } from '../../../lib/site';

/**
 * Las estadísticas de uso de la web y de la app de escritorio, que se ven en PostHog (UE). Solo
 * pasan los eventos de esta lista, con valores cerrados y el identificador aleatorio de una pestaña
 * o de una sesión de la app, que solo vive en memoria. PostHog recibe la petición de este servidor,
 * así que no ve la IP ni el navegador de nadie, y no crea perfiles de persona.
 */
const sesion = z.uuid();
const app = {
  sesion,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  plataforma: z.enum(['darwin', 'win32', 'linux']),
  proveedor: z.enum(['app', 'propio']),
};
const eventoEsquema = z.union([
  z.strictObject({
    sesion,
    evento: z.literal('$pageview'),
    ruta: z
      .string()
      .max(200)
      .regex(/^\/[\w\-/%.~]*$/),
  }),
  z.strictObject({
    sesion,
    evento: z.literal('descarga_escritorio'),
    sistema: z.enum(['macos', 'windows', 'linux']),
  }),
  z.strictObject({
    ...app,
    evento: z.enum([
      'app_abierta',
      'tramite_creado',
      'mensaje_enviado',
      'pregunta_respondida',
      'tramite_detenido',
      'tramite_borrado',
      'perfil_guardado',
    ]),
  }),
]);

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
  const { evento, sesion, ...datos } = e.data;
  const propiedades =
    'ruta' in datos
      ? { $current_url: new URL(datos.ruta, siteUrl).href, $pathname: datos.ruta }
      : datos;
  const res = await fetch('https://eu.i.posthog.com/i/v0/e/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: clave,
      event: evento,
      distinct_id: sesion,
      properties: { ...propiedades, $process_person_profile: false, $geoip_disable: true },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  return new Response(null, { status: res?.ok ? 204 : 502 });
}
