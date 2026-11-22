// Errores tipados (port de queguagua `alsa/errors.py`). Los mensajes nunca llevan cookies ni cuerpos de respuesta:
// como mucho el texto breve con el que ALSA explica un rechazo y el estado HTTP.

export type Retry = { request: string; tries: number; errors: string[]; recovered: boolean };

export class AlsaError extends Error {
  kind = 'internal';
  exitCode = 1;
  hint: string | undefined;
  status: number | undefined;
  alsaMessage: string | undefined;
  details: Record<string, unknown>;
  retries: Retry[] = [];

  constructor(
    message: string,
    opts: { status?: number; alsaMessage?: string; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.status = opts.status;
    this.alsaMessage = opts.alsaMessage;
    this.details = opts.details ?? {};
  }

  toDict(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      type: this.kind,
      message: this.message,
      exit_code: this.exitCode,
    };
    if (this.status !== undefined) out.http_status = this.status;
    if (this.alsaMessage) out.alsa_message = this.alsaMessage;
    Object.assign(out, this.details);
    if (this.retries.length) out.retries = this.retries;
    if (this.hint) out.hint = this.hint;
    return out;
  }
}

/** Entrada errónea: una parada desconocida, una fecha mal escrita o una búsqueda que ALSA rechaza. */
export class UsageError extends AlsaError {
  override kind = 'usage';
  override exitCode = 2;
}

/** 403, 429, el desafío de Imperva o la sala de espera de queue-it: parar, nunca reintentar. */
export class BlockedError extends AlsaError {
  override kind = 'blocked';
  override exitCode = 5;
}

/** 5xx, timeout o conexión cortada de ALSA, tras los reintentos. */
export class UpstreamError extends BlockedError {
  override kind = 'upstream_unavailable';
}

/** La página «estamos realizando mejoras en nuestro sistema»: la web está en mantenimiento. */
export class MaintenanceError extends UpstreamError {
  override kind = 'maintenance';
  override hint = 'ALSA usually does this at night for a while; try again later.';
}

/** Estado o forma de página inesperados: probablemente ALSA cambió su web. */
export class ApiShapeError extends AlsaError {
  override kind = 'api_changed';
  override exitCode = 7;
  override hint = "ALSA's website may have changed; re-capture the request and update the CLI.";
}
