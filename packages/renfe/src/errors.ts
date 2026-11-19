// Errores tipados (port de renfe-cli `errors.py`). Los mensajes nunca llevan la clave, el token ni cuerpos de
// respuesta: como mucho un código de error de Renfe permitido y el estado HTTP.

export type Retry = { request: string; tries: number; errors: string[]; recovered: boolean };

export class RenfeError extends Error {
  kind = 'internal';
  exitCode = 1;
  status: number | undefined;
  code: string | undefined;
  /** Qué falló, cuando otro intento puede funcionar (retry.ts); no sale en el resultado. */
  transient: string | undefined;
  retries: Retry[] = [];

  constructor(message: string, opts: { status?: number; code?: string; transient?: string } = {}) {
    super(message);
    this.status = opts.status;
    this.code = opts.code;
    this.transient = opts.transient;
  }

  toDict(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      type: this.kind,
      message: this.message,
      exit_code: this.exitCode,
    };
    if (this.status !== undefined) out.http_status = this.status;
    if (this.code) out.renfe_code = this.code;
    if (this.retries.length) out.retries = this.retries;
    return out;
  }
}

export class UsageError extends RenfeError {
  override kind = 'usage';
  override exitCode = 2;
}

/** Ninguna estación coincide con la consulta (frente a varias que coinciden). */
export class NoMatch extends UsageError {}

export class AuthError extends RenfeError {
  override kind = 'auth';
  override exitCode = 3;
}

/** 403, 429 o una página HTML en vez de JSON: parar y esperar, nunca reintentar. */
export class BlockedError extends RenfeError {
  override kind = 'blocked';
  override exitCode = 5;
}

/** 5xx, timeout o conexión cortada de Renfe, tras los reintentos. */
export class UpstreamError extends BlockedError {
  override kind = 'upstream_unavailable';
}

/** Estado o forma de respuesta inesperados: probablemente Renfe cambió su API. */
export class ApiShapeError extends RenfeError {
  override kind = 'api_changed';
  override exitCode = 7;
  hint = "Renfe's web API may have changed; re-capture the request and update renfe/search.py.";

  override toDict() {
    return { ...super.toDict(), hint: this.hint };
  }
}

/** Una página HTML donde se esperaba JSON: protección anti-bots, nunca una sesión caducada. */
export class ChallengePage extends BlockedError {}
