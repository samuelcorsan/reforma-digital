// Cliente de la API nueva de Renfe (api.rsv.renfe.com), sin cuenta, como la web antes de iniciar sesión (port de
// renfe-cli `client.py`):
//   1. GET de la configuración pública de la web, de la que se lee la x-api-key;
//   2. GET /tokens/public con esa clave: un token anónimo de 30 minutos;
//   3. llamadas con el bearer, la clave, `channel: VLP`, el terminal del token y un id de sesión.
// La CLI guarda la sesión en un fichero; aquí vive en memoria del proceso y la comparten las peticiones de una misma
// instancia. Si Renfe responde 401 a una sesión heredada, se cambia y la llamada se reenvía una vez.

import * as config from './config';
import {
  ApiShapeError,
  AuthError,
  BlockedError,
  ChallengePage,
  RenfeError,
  type Retry,
  UpstreamError,
  UsageError,
} from './errors';
import * as retry from './retry';

const RENFE_CODE = /^[A-Z][A-Z0-9_]{1,59}$/;
const TERMINAL_ID = /^[A-Za-z0-9]{1,32}$/;
const API_KEY = /^[A-Za-z0-9]{20,80}$/;
const RETRY_AFTER = /^[0-9]{1,5}$/;
const JWT = /^[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,8192}\.[A-Za-z0-9_-]{1,4096}$/;
const TOKEN_MARGIN = 60_000;
const TOKEN_MAX_LIFETIME = 1_800_000;
const MINT_COOLDOWN = 30_000;

type Session = { apiKey: string; token: string; expiresAt: number; sessionId: string };
/** La sesión de la última instancia que acuñó una: el equivalente del fichero `session.json` de la CLI. */
let saved: Session | undefined;

export const BASE_HEADERS = {
  'user-agent': config.USER_AGENT,
  'accept-language': config.ACCEPT_LANGUAGE,
};

function claims(token: string): Record<string, unknown> {
  try {
    const value = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function terminal(token: string): string | undefined {
  const value = claims(token)['custom:terminal_id'];
  return typeof value === 'string' && TERMINAL_ID.test(value) ? value : undefined;
}

function valid(session: Session | undefined): Session | undefined {
  const now = Date.now();
  if (!session || !(now < session.expiresAt && session.expiresAt <= now + TOKEN_MAX_LIFETIME))
    return undefined;
  const exp = claims(session.token).exp;
  return typeof exp === 'number' && exp * 1000 - TOKEN_MARGIN <= now ? undefined : session;
}

/** Una petición con timeout; los fallos de red se convierten en UpstreamError, como en la CLI. */
export async function request(
  url: string,
  label: string,
  init: RequestInit,
  timeout = config.REQUEST_TIMEOUT,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: { ...BASE_HEADERS, ...(init.headers as Record<string, string>) },
    });
  } catch (error) {
    if (retry.isTimeout(error)) throw new UpstreamError(`${label}: Renfe did not answer in time`);
    const transient = retry.connectionFailure(error);
    throw new UpstreamError(
      `${label}: request failed (${transient?.match(/\((\w+)\)/)?.[1] ?? 'Error'})`,
      {
        transient,
      },
    );
  }
}

export async function checkedJson(response: Response, label: string): Promise<unknown> {
  const status = response.status;
  const ctype = (response.headers.get('content-type') ?? '').toLowerCase();
  if (ctype.includes('html'))
    throw new ChallengePage(`${label}: got an HTML page instead of JSON (bot protection?)`, {
      status,
    });
  if (status >= 300 && status < 400)
    throw new BlockedError(
      `${label}: Renfe redirected the request (${status}); bot protection or a moved endpoint`,
      { status },
    );
  const text = await response.text();
  if (status >= 200 && status < 300) {
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiShapeError(`${label}: response is not JSON`, { status });
    }
  }
  if (status === 403 || status === 429) {
    const wait = response.headers.get('retry-after') ?? '';
    const hint = RETRY_AFTER.test(wait) ? `; retry after ${wait} s` : '';
    throw new BlockedError(
      `${label}: Renfe refused the request (${status})${hint}; wait before trying again`,
      {
        status,
      },
    );
  }
  if (status === 401)
    throw new AuthError(`${label}: Renfe refused the anonymous session (401)`, { status });
  if (status >= 500)
    throw new UpstreamError(`${label}: Renfe returned a server error (${status})`, {
      status,
      transient: retry.statusFailure(status),
    });
  if ([400, 404, 409, 422].includes(status)) {
    let code: string | undefined;
    try {
      const value = (JSON.parse(text) as { codeError?: unknown }).codeError;
      code = typeof value === 'string' && RENFE_CODE.test(value) ? value : undefined;
    } catch {}
    throw new UsageError(`${label}: Renfe rejected the request (${status})`, { status, code });
  }
  throw new ApiShapeError(`${label}: unexpected HTTP status ${status}`, { status });
}

export class RsvClient {
  retries: Retry[] = [];
  private session: Session | undefined;
  private fromSaved = false;
  private generation = 0;
  private minting: Promise<void> | undefined;
  private mintError: { error: RenfeError; at: number } | undefined;

  private async sendOnce(
    method: string,
    url: string,
    label: string,
    headers: Record<string, string>,
    body?: unknown,
  ) {
    const response = await request(url, label, {
      method,
      headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return checkedJson(response, label);
  }

  private send(method: string, url: string, label: string, headers: Record<string, string>) {
    return retry.call(label, () => this.sendOnce(method, url, label, headers), this.retries);
  }

  private async fetchApiKey(): Promise<string> {
    const cfg = (await this.send('GET', config.WEB_CONFIG_URL, 'web config', {
      accept: 'application/json',
    })) as {
      arch?: { security?: { apiKey?: unknown } };
    };
    const key = cfg?.arch?.security?.apiKey;
    if (typeof key !== 'string' || !API_KEY.test(key))
      throw new ApiShapeError('web config: no usable api key at arch.security.apiKey');
    return key;
  }

  private async mint(): Promise<void> {
    if (this.mintError && Date.now() - this.mintError.at < MINT_COOLDOWN)
      throw this.mintError.error;
    let key: string, token: unknown, lifetime: unknown;
    try {
      key = await this.fetchApiKey(); // se relee en cada acuñado: una clave rotada se arregla sola
      const body = (await this.send(
        'GET',
        config.API_BASE + config.PUBLIC_TOKEN_PATH,
        'anonymous token',
        {
          accept: 'application/json',
          'x-api-key': key,
          channel: config.CHANNEL,
        },
      )) as { accessToken?: unknown; expiresIn?: unknown };
      token = body?.accessToken;
      lifetime = body?.expiresIn;
      if (typeof token !== 'string' || !JWT.test(token))
        throw new ApiShapeError('anonymous token: no accessToken in the response');
    } catch (error) {
      if (error instanceof RenfeError) this.mintError = { error, at: Date.now() };
      throw error;
    }
    this.mintError = undefined;
    const life =
      typeof lifetime === 'number' && Number.isInteger(lifetime) && lifetime > 0
        ? Math.min(lifetime * 1000, TOKEN_MAX_LIFETIME)
        : TOKEN_MAX_LIFETIME;
    this.session = {
      apiKey: key,
      token,
      expiresAt: Date.now() + Math.max(life - TOKEN_MARGIN, 30_000),
      sessionId: crypto.randomUUID(),
    };
    this.fromSaved = false;
    this.generation += 1;
    saved = this.session;
  }

  private adopt(session: Session) {
    this.session = session;
    this.fromSaved = true;
    this.generation += 1;
  }

  /** Una sesión válida en memoria; devuelve su generación. Las llamadas en paralelo comparten el acuñado. */
  private async ensureSession(): Promise<number> {
    if (!this.session || Date.now() >= this.session.expiresAt) {
      const inherited = valid(saved);
      if (inherited) this.adopt(inherited);
      else {
        this.minting ??= this.mint().finally(() => (this.minting = undefined));
        await this.minting;
      }
    }
    return this.generation;
  }

  async apiKey() {
    await this.ensureSession();
    return this.session?.apiKey ?? '';
  }

  private async apiHeaders(): Promise<[Record<string, string>, number]> {
    const generation = await this.ensureSession();
    const s = this.session!;
    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      authorization: `Bearer ${s.token}`,
      'x-api-key': s.apiKey,
      channel: config.CHANNEL,
      'session-id': s.sessionId,
      origin: config.WEB_ORIGIN,
      referer: `${config.WEB_ORIGIN}/`,
    };
    const id = terminal(s.token);
    if (id) headers['x-terminal-id'] = id;
    return [headers, generation];
  }

  /** ¿Reenviar con otra sesión? Solo tras un 401 a una sesión heredada. Un 403 sigue siendo un bloqueo. */
  private stale(err: RenfeError, generation: number): boolean {
    if (err instanceof ChallengePage || (err.status !== 401 && err.status !== 403)) return false;
    if (generation !== this.generation) return err.status === 401;
    if (!this.fromSaved) return false;
    const newer = valid(saved);
    const isNewer = newer !== undefined && newer.token !== this.session?.token;
    if (err.status === 403) {
      if (!isNewer) saved = undefined;
      return false;
    }
    if (isNewer) this.adopt(newer);
    else {
      saved = undefined;
      this.session = undefined;
      this.fromSaved = false;
      this.generation += 1;
    }
    return true;
  }

  private call(
    method: string,
    path: string,
    label: string,
    body?: unknown,
    mayResend?: () => boolean,
  ) {
    const url = config.API_BASE + path;
    const state = { generation: 0, sent: false, resent: false };
    return retry.call(
      label,
      async () => {
        state.sent = false;
        const [headers, generation] = await this.apiHeaders();
        state.generation = generation;
        state.sent = true;
        return this.sendOnce(method, url, label, headers, body);
      },
      this.retries,
      {
        resend: (err) => {
          if (
            !state.sent ||
            state.resent ||
            !(err instanceof AuthError || err instanceof BlockedError) ||
            !this.stale(err, state.generation)
          )
            return undefined;
          state.resent = true;
          return `session refused (${err.status}), sent again with another`;
        },
        describe: (err) => (state.sent ? undefined : `new session failed: ${err.message}`),
        mayRetry: () => state.sent && (mayResend === undefined || mayResend()),
      },
    );
  }

  get(path: string, label = path) {
    return this.call('GET', path, label);
  }

  post(path: string, body: unknown, label = path, mayResend?: () => boolean) {
    return this.call('POST', path, label, body, mayResend);
  }
}
