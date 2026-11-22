// La web de ALSA como la usan sus propias páginas (port de queguagua `alsa/client.py`). Es un portal Liferay: las
// búsquedas son acciones de portlet (`p_p_lifecycle=1`, con el token CSRF `p_auth`) que guardan el estado en la sesión,
// y recursos de portlet (`p_p_lifecycle=2`) que lo devuelven en JSON. Delante están Imperva y queue-it: sin cola
// activa, queue-it redirige a sí mismo y vuelve enseguida con un `queueittoken`, y se sigue ese rebote. Una sala de
// espera real, el desafío de Imperva, un 403 o un 429 paran la herramienta: nunca se intenta saltarlos.
//
// A diferencia de la CLI, cada llamada usa una sesión anónima nueva que no se guarda en ningún sitio.

import { ApiShapeError, BlockedError, MaintenanceError, type Retry, UpstreamError } from './errors';

const BASE = 'https://www.alsa.es';
export const PURCHASE_PORTLET = 'com_babel_alsa_espania_purchase_web_PurchasePortlet';
export const JOURNEY_SEARCH_PORTLET =
  'com_babel_alsa_espania_journeysearch_web_JourneySearchPortlet_INSTANCE_21651890';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const TIMEOUT = 25_000;
// Para toda la herramienta, reintentos y paquetes incluidos: que una llamada no retenga la función minutos.
const DEADLINE = 60_000;

const ALSA = 'alsa.es';
const QUEUE = 'queue-it.net';
const CHALLENGE = /_Incapsula_Resource|Incapsula incident ID|Request unsuccessful\. Incapsula/i;
const MAINTENANCE = /estamos realizando mejoras en nuestro sistema/i;
const RETRYABLE = new Set([500, 502, 503, 504]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_TRIES = 3;
const HTML = 'text/html,application/xhtml+xml';

type Page = { status: number; url: string; location: string | null; html: boolean; text: string };
type Cookie = { name: string; value: string; domain: string; hostOnly: boolean };

const redirect = (r: Page) =>
  REDIRECTS.has(r.status) && r.location ? new URL(r.location, r.url).href : undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sends = (host: string, c: Cookie) =>
  host === c.domain || (!c.hostOnly && host.endsWith(`.${c.domain}`));

function within(url: string, domain: string) {
  const { protocol, hostname } = new URL(url);
  return protocol === 'https:' && (hostname === domain || hostname.endsWith(`.${domain}`));
}

function networkError(err: unknown) {
  if (err instanceof DOMException && err.name === 'TimeoutError') return 'TimeoutError';
  if (err instanceof TypeError && (err.message === 'fetch failed' || err.message === 'terminated'))
    return err.cause instanceof Error ? err.cause.name : 'TypeError';
  return undefined;
}

function authToken(html: string) {
  return (
    /Liferay\.authToken\s*=\s*'([A-Za-z0-9]{4,32})'/.exec(html)?.[1] ??
    /[?&]p_auth=([A-Za-z0-9]{4,32})/.exec(html)?.[1]
  );
}

function checkBlock(r: Page) {
  if (r.html && MAINTENANCE.test(r.text.slice(0, 3000)))
    throw new MaintenanceError(
      'ALSA is down for maintenance ("estamos realizando mejoras en nuestro sistema")',
      { status: r.status },
    );
  if (r.status === 403 || r.status === 429)
    throw new BlockedError(`ALSA refused the request (${r.status})`, { status: r.status });
  if (
    r.html &&
    ((r.status >= 400 && CHALLENGE.test(r.text.slice(0, 5000))) ||
      (r.text.length < 4000 && CHALLENGE.test(r.text)))
  )
    throw new BlockedError('Imperva/Incapsula bot protection answered instead of ALSA', {
      status: r.status,
    });
}

export class AlsaClient {
  retries: Retry[] = [];
  private pAuthToken: string | undefined;
  // ponytail: sin rutas de cookie; la sesión dura una sola herramienta.
  private jar = new Map<string, Cookie>();
  private deadline = AbortSignal.timeout(DEADLINE);

  constructor(private fetchImpl: typeof fetch = fetch) {}

  private store(host: string, headers: Headers) {
    for (const line of headers.getSetCookie()) {
      const [pair = '', ...attributes] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      const cookie = {
        name: pair.slice(0, eq).trim(),
        value: pair.slice(eq + 1).trim(),
        domain: host,
        hostOnly: true,
      };
      let gone = false;
      for (const attribute of attributes) {
        const i = attribute.indexOf('=');
        const key = (i < 0 ? attribute : attribute.slice(0, i)).trim().toLowerCase();
        const value = i < 0 ? '' : attribute.slice(i + 1).trim();
        if (key === 'domain' && value) {
          cookie.domain = value.replace(/^\./, '').toLowerCase();
          cookie.hostOnly = false;
        }
        if (key === 'max-age' && Number(value) <= 0) gone = true;
        if (key === 'expires' && Date.parse(value) < Date.now()) gone = true;
      }
      // Como un navegador: una cookie para otro dominio se descarta.
      if (!sends(host, cookie)) continue;
      if (!gone) this.jar.set(`${cookie.domain};${cookie.name}`, cookie);
      else
        for (const [key, c] of this.jar)
          if (c.name === cookie.name && sends(host, c)) this.jar.delete(key);
    }
  }

  private async request(url: string, accept: string, headers: Record<string, string> = {}) {
    const host = new URL(url).hostname;
    const cookie = [...this.jar.values()]
      .filter((c) => sends(host, c))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const response = await this.fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.any([this.deadline, AbortSignal.timeout(TIMEOUT)]),
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'es-ES,es;q=0.9',
        accept,
        ...headers,
        ...(cookie ? { cookie } : {}),
      },
    });
    this.store(host, response.headers);
    return {
      status: response.status,
      url,
      location: response.headers.get('location'),
      html: (response.headers.get('content-type') ?? '').toLowerCase().includes('html'),
      text: await response.text(),
    };
  }

  private absorb(r: Page) {
    if (!r.html || r.status !== 200) return;
    const token = authToken(r.text);
    if (token) this.pAuthToken = token;
  }

  /** Sigue el rebote de queue-it. Sin cola activa vuelve enseguida a www.alsa.es. */
  private async passQueue(location: string) {
    let r: Page;
    try {
      r = await this.request(location, 'text/html');
      for (let hops = 0, next = redirect(r); next; hops++, next = redirect(r)) {
        // Como httpx, que corta a las 20 redirecciones.
        if (hops >= 20) throw new UpstreamError("queue-it didn't answer (TooManyRedirects)");
        if (!within(next, QUEUE) && !within(next, ALSA))
          throw new BlockedError('queue-it redirected outside ALSA');
        r = await this.request(next, 'text/html');
      }
    } catch (err) {
      const name = networkError(err);
      if (name === undefined) throw err;
      throw new UpstreamError(`queue-it didn't answer (${name})`);
    }
    if (within(r.url, QUEUE))
      throw new BlockedError('ALSA has a queue-it waiting room active right now; try again later', {
        details: { waiting_room: true },
      });
    checkBlock(r);
    this.absorb(r);
  }

  private async send(
    url: string,
    what: string,
    accept: string,
    headers: Record<string, string> = {},
  ) {
    const errors: string[] = [];
    let passes = 0;
    for (let tries = 1; ; tries++) {
      const retry = async (reason: string, failure: UpstreamError) => {
        errors.push(reason);
        if (tries < MAX_TRIES) return sleep(tries * 1000);
        this.retries.push({ request: what, tries, errors, recovered: false });
        throw failure;
      };
      let r: Page;
      try {
        r = await this.request(url, accept, headers);
        let hops = 0;
        for (let next = redirect(r); next && hops < 8; next = redirect(r)) {
          if (within(next, QUEUE)) {
            if (passes >= 2)
              throw new BlockedError('queue-it keeps redirecting; ALSA may have a waiting room');
            passes++;
            await this.passQueue(next);
            r = await this.request(url, accept, headers); // se repite la petición original
            hops = 0;
          } else if (within(next, ALSA)) {
            r = await this.request(next, accept);
            hops++;
          } else break;
        }
      } catch (err) {
        const name = networkError(err);
        if (name === undefined) throw err;
        if (name === 'TimeoutError') throw new UpstreamError(`ALSA didn't answer ${what} in time`);
        await retry(
          `connection dropped (${name})`,
          new UpstreamError(`couldn't reach ALSA for ${what} (${name})`),
        );
        continue;
      }
      if (RETRYABLE.has(r.status) && !(r.html && CHALLENGE.test(r.text.slice(0, 5000)))) {
        await retry(
          `server error (${r.status})`,
          new UpstreamError(`ALSA failed ${what} (${r.status})`, { status: r.status }),
        );
        continue;
      }
      checkBlock(r);
      if (errors.length) this.retries.push({ request: what, tries, errors, recovered: true });
      this.absorb(r);
      return r;
    }
  }

  private async pAuth() {
    if (!this.pAuthToken) {
      let r = await this.send(`${BASE}/`, 'home page', HTML);
      if (redirect(r)) {
        // Con un tarro de cookies nuevo, Imperva o queue-it a veces piden una vuelta más.
        await sleep(1000);
        r = await this.send(`${BASE}/`, 'home page', HTML);
      }
      if (r.status !== 200)
        throw new ApiShapeError('unexpected status for home page', { status: r.status });
    }
    if (!this.pAuthToken) throw new ApiShapeError("no Liferay auth token on ALSA's home page");
    return this.pAuthToken;
  }

  private portlet(path: string, query: Record<string, string>, what: string, accept: string) {
    return this.send(`${BASE}${path}?${new URLSearchParams(query)}`, what, accept, {
      origin: BASE,
      referer: BASE + path,
    });
  }

  async resourceJson(
    path: string,
    portlet: string,
    resourceId: string,
    params: Record<string, string> = {},
  ) {
    const r = await this.portlet(
      path,
      {
        p_p_id: portlet,
        p_p_lifecycle: '2',
        p_p_state: 'normal',
        p_p_mode: 'view',
        p_p_resource_id: resourceId,
        p_p_cacheability: 'cacheLevelPage',
        ...params,
      },
      resourceId,
      'application/json, text/plain, */*',
    );
    if (r.status !== 200)
      throw new ApiShapeError(`${resourceId} answered ${r.status}`, { status: r.status });
    try {
      return JSON.parse(r.text) as unknown;
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      if (r.html) throw new BlockedError(`${resourceId} returned an HTML page instead of JSON`);
      throw new ApiShapeError(`${resourceId} didn't return JSON`);
    }
  }

  async action(path: string, portlet: string, action: string, params: Record<string, string>) {
    const r = await this.portlet(
      path,
      {
        p_p_id: portlet,
        p_p_lifecycle: '1',
        p_p_state: 'normal',
        p_p_mode: 'view',
        [`_${portlet}_javax.portlet.action`]: action,
        p_auth: await this.pAuth(),
        ...params,
      },
      action,
      HTML,
    );
    if (r.status !== 200 && !redirect(r))
      throw new ApiShapeError(`${action} answered ${r.status}`, { status: r.status });
    return r;
  }
}
