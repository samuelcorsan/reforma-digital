// @vitest-environment node
// ALSA sin red: respuestas sintéticas para lo que la web podría devolver mal y nunca debe acabar como datos.
import { expect, it, vi } from 'vitest';
import { AlsaClient } from './client';
import { run, searchInput } from './search';

type Reply = { status?: number; body?: string; type?: string; headers?: [string, string][] };

const HOME = "<script>Liferay.authToken = 'abcd1234';</script>";
const RESULTS = `<script>params["errorMessageKey"] = '';</script>`;
const args = searchInput.parse({ origin: '155', destination: '99084', date: '2026-12-06' });

/** Un fetch falso que responde según la URL y anota cada petición con las cookies que lleva. */
function fakeAlsa(reply: (url: URL) => Reply) {
  const seen: { url: URL; cookie: string | null }[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    seen.push({ url, cookie: new Headers(init?.headers).get('cookie') });
    const { status = 200, body = '', type = 'text/html', headers = [] } = reply(url);
    return new Response(body, { status, headers: [['content-type', type], ...headers] });
  });
  return { client: new AlsaClient(fetchImpl), seen };
}

it('rejects a journey list without journeys and keeps only cookies meant for ALSA', async () => {
  let queued = false;
  const { client, seen } = fakeAlsa((url) => {
    if (url.hostname.endsWith('queue-it.net'))
      return {
        status: 302,
        headers: [
          ['location', 'https://www.alsa.es/?queueittoken=t'],
          ['set-cookie', 'injected=1; Domain=.alsa.es'],
        ],
      };
    if (url.pathname === '/' && !queued) {
      queued = true;
      return { status: 302, headers: [['location', 'https://alsa.queue-it.net/?c=alsa']] };
    }
    if (url.pathname === '/')
      return {
        body: HOME,
        headers: [
          ['set-cookie', 'ok=1; Domain=.alsa.es'],
          ['set-cookie', 'gone=1; Domain=.alsa.es'],
        ],
      };
    if (url.searchParams.get('p_p_lifecycle') === '1')
      return { body: RESULTS, headers: [['set-cookie', 'gone=; Max-Age=0']] };
    return { body: '{"journeys": null}', type: 'application/json' };
  });
  await expect(run(client, args)).rejects.toMatchObject({
    kind: 'api_changed',
    message: 'GetJourneyListResource changed shape',
  });
  expect(seen.at(-1)?.cookie).toBe('ok=1');
});

it('never follows a redirect out of alsa.es', async () => {
  const { client, seen } = fakeAlsa((url) => {
    if (url.pathname === '/') return { body: HOME };
    if (url.searchParams.get('p_p_lifecycle') === '1') return { body: RESULTS };
    return { status: 302, headers: [['location', 'https://www.alsa.es.example.com/journeys']] };
  });
  await expect(run(client, args)).rejects.toMatchObject({
    kind: 'api_changed',
    message: 'GetJourneyListResource answered 302',
  });
  expect(seen.every(({ url }) => url.hostname === 'www.alsa.es')).toBe(true);
});

it('gives up on a queue-it redirect loop', async () => {
  const { client, seen } = fakeAlsa((url) => ({
    status: 302,
    headers: [
      ['location', url.hostname === 'www.alsa.es' ? 'https://alsa.queue-it.net/?c=alsa' : url.href],
    ],
  }));
  await expect(run(client, args)).rejects.toMatchObject({
    kind: 'upstream_unavailable',
    message: "queue-it didn't answer (TooManyRedirects)",
  });
  expect(seen.length).toBeLessThan(30);
});
