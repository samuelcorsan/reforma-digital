/**
 * Un evento a PostHog (UE) desde este servidor, así que no ve la IP ni el navegador de nadie. Va
 * sin perfil de persona ni GeoIP. `true` si PostHog lo aceptó; `false` si no, o si no hay conexión
 * o tarda más de 5 s.
 */
export async function capturar(
  clave: string,
  evento: string,
  distinctId: string,
  propiedades: Record<string, string | number>,
) {
  const res = await fetch('https://eu.i.posthog.com/i/v0/e/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: clave,
      event: evento,
      distinct_id: distinctId,
      properties: { ...propiedades, $process_person_profile: false, $geoip_disable: true },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((error: unknown) => {
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'TimeoutError')
    )
      return null;
    throw error;
  });
  return res?.ok === true;
}
