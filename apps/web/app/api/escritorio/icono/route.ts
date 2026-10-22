/**
 * El icono de una web para la app de escritorio, del servicio de favicons de Google. Lo pide el
 * servidor, no el ordenador de la persona: Google no sabe quién consulta qué webs. La respuesta la
 * guarda la CDN, así que cada web se le pide pocas veces.
 */
export async function GET(request: Request) {
  const origen = new URL(request.url).searchParams.get('origen') ?? '';
  if (URL.parse(origen)?.origin !== origen || !origen.startsWith('https://'))
    return new Response('Origen no válido', { status: 400 });
  const res = await fetch(
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origen)}&sz=64`,
    { signal: AbortSignal.timeout(5000) },
  ).catch(() => null);
  // Solo PNG, que es lo que da Google: un SVG servido desde este dominio podría llevar scripts.
  if (!res?.ok || res.headers.get('content-type') !== 'image/png')
    return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
