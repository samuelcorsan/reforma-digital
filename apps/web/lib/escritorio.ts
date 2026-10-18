import { createHmac } from 'node:crypto';
import { connection, databaseAvailable } from '@reforma-digital/db';
import { CABECERA_INSTALACION } from '@reforma-digital/agent/models';

/**
 * El servidor de la app de escritorio guarda las claves del modelo (NaN Builders) y del buscador
 * (Exa): una app que se reparte no puede guardar secretos. Lo que impide el abuso es un gasto
 * máximo al día por persona (cada instalación de la app) y por IP.
 */
export const LIMITES = {
  /** Dólares al día por instalación. */
  usdPorUsuario: 0.5,
  /** Dólares al día por IP: quien reinstale la app para empezar de cero sigue contando aquí. */
  usdPorIp: 2.5,
};

/**
 * Lo que vale un millón de tokens de NaN Builders. No cobra por token: la suscripción cuesta
 * 70 € al mes con 3.000 millones de tokens de deepseek-v4-flash (nan.builders, octubre de 2026),
 * unos 0,027 $ por millón. Se redondea hacia arriba.
 */
export const USD_POR_MILLON_DE_TOKENS = 0.03;

const DIA = 86_400_000;
const hoy = () => Math.floor(Date.now() / DIA);
const memoria = new Map<string, { dia: number; cuenta: number }>();

/**
 * Suma `cuanto` al contador del día (UTC) y devuelve el total: en Postgres si lo hay, si no (en
 * local) en memoria. El gasto se cuenta en millonésimas de dólar, porque el contador es un entero.
 * `cuanto` es negativo al devolver lo reservado de más; un día nuevo no empieza por debajo de 0.
 */
async function sumar(clave: string, cuanto: number): Promise<number> {
  if (databaseAvailable()) {
    const filas = await connection()`INSERT INTO request_buckets(key, window_start, count)
      VALUES (${clave}, date_trunc('day', now()), GREATEST(${cuanto}, 0))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN request_buckets.window_start < date_trunc('day', now())
          THEN GREATEST(${cuanto}, 0) ELSE request_buckets.count + ${cuanto} END,
        window_start = date_trunc('day', now())
      RETURNING count`;
    return Number(filas[0]?.count);
  }
  const dia = hoy();
  const fila = memoria.get(clave);
  const cuenta = fila?.dia === dia ? fila.cuenta + cuanto : Math.max(cuanto, 0);
  memoria.set(clave, { dia, cuenta });
  return cuenta;
}

/** Lo que lleva hoy un contador, sin crearlo: lo que se rechaza no deja filas. */
async function gastado(clave: string): Promise<number> {
  if (databaseAvailable()) {
    const filas = await connection()`SELECT count FROM request_buckets
      WHERE key = ${clave} AND window_start = date_trunc('day', now())`;
    return Number(filas[0]?.count ?? 0);
  }
  const fila = memoria.get(clave);
  return fila?.dia === hoy() ? fila.cuenta : 0;
}

/**
 * El contador de algo sin guardarlo tal cual (ni la IP ni el identificador de la instalación). La
 * clave del proveedor hace de secreto: está siempre que el servidor funciona y no sale de él.
 */
const contador = (tipo: string, valor: string) =>
  `escritorio:${tipo}:${createHmac('sha256', process.env.NAN_API_KEY ?? '')
    .update(valor)
    .digest('hex')}`;

/** Quien hace la petición: su instalación y su IP, ya como contadores. */
export type Quien = { usuario: string; ip: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los contadores de quien pide, cada uno con su límite en millonésimas de dólar. */
const contadores = (quien: Quien) =>
  [
    [quien.usuario, LIMITES.usdPorUsuario * 1e6],
    [quien.ip, LIMITES.usdPorIp * 1e6],
  ] as const;

const agotado = () =>
  Response.json(
    { error: 'Has llegado al límite de uso del asistente por hoy. Vuelve a intentarlo mañana.' },
    { status: 429 },
  );

/**
 * Antes de leer una petición: la instalación tiene que identificarse y no haber gastado su límite
 * del día, ni su IP el suyo. Devuelve quién es, o la respuesta de rechazo.
 */
export async function admitir(request: Request): Promise<Quien | Response> {
  const instalacion = request.headers.get(CABECERA_INSTALACION) ?? '';
  if (!UUID.test(instalacion))
    return Response.json({ error: 'Falta la instalación de la app.' }, { status: 400 });
  // La cabecera de IP solo es fiable en Vercel; fuera, todas cuentan juntas.
  const ip = process.env.VERCEL
    ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida')
    : 'local';
  const quien = { usuario: contador('usuario', instalacion), ip: contador('ip', ip) };
  for (const [clave, limite] of contadores(quien))
    if ((await gastado(clave)) >= limite) return agotado();
  return quien;
}

/**
 * Antes de llamar al proveedor, aparta en cada contador lo más que puede costar la petición. Así
 * las peticiones en paralelo no pasan todas, y quien corte la conexión antes de saber el uso paga
 * lo reservado. Si algún contador se pasaría de su límite, lo devuelve y responde el rechazo. Si
 * no, devuelve con qué ajustar la reserva a lo que costó de verdad; sin ajuste, queda lo reservado.
 */
export async function reservar(
  quien: Quien,
  usd: number,
): Promise<Response | ((real: number) => Promise<void>)> {
  const micro = Math.ceil(usd * 1e6);
  const lista = contadores(quien);
  const sumarATodos = (cuanto: number) => Promise.all(lista.map(([clave]) => sumar(clave, cuanto)));
  const pasados = await Promise.all(
    lista.map(async ([clave, limite]) => (await sumar(clave, micro)) > limite),
  );
  if (pasados.includes(true)) {
    await sumarATodos(-micro);
    return agotado();
  }
  return async (real) => {
    const diferencia = Math.round(real * 1e6) - micro;
    if (diferencia) await sumarATodos(diferencia);
  };
}

/** Lee el cuerpo sin pasar de `max` bytes; `null` si es más grande. */
export async function leerCuerpo(request: Request, max: number) {
  if (Number(request.headers.get('content-length') ?? 0) > max) return null;
  const texto = await request.text();
  return Buffer.byteLength(texto) > max ? null : texto;
}
