import { createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { connection, databaseAvailable } from '@reforma-digital/db';
import { CABECERA_INSTALACION } from '@reforma-digital/agent/models';

/**
 * El servidor de la app de escritorio guarda las claves del modelo (NaN Builders) y del buscador
 * (Exa): una app que se reparte no puede guardar secretos. Lo que acota el abuso es un gasto
 * máximo al día por IP y, entre todos, por servicio. El de cada instalación es solo una cortesía
 * para repartir: el identificador lo elige la app y basta con cambiarlo para empezar de cero.
 */
export const LIMITES = {
  /** Dólares al día por instalación. */
  usdPorUsuario: 0.5,
  /** Dólares al día por IP (las IPv6, por su /64): no se salta con otra instalación. */
  usdPorIp: 2.5,
  /** Dólares al día entre todas las peticiones, por servicio, que se paga aparte. */
  usdEntreTodos: {
    /**
     * La parte de un día de la cuota de NaN Builders (3.000 millones de tokens al mes, ver
     * `USD_POR_MILLON_DE_TOKENS`): 100 millones de tokens, para que no se acabe antes de fin de mes.
     */
    modelo: 3,
    /** Exa cobra cada búsqueda aparte. */
    busqueda: 3,
  },
};

/** Lo que se paga aparte: el modelo (NaN Builders) y el buscador (Exa). */
type Servicio = keyof typeof LIMITES.usdEntreTodos;

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

/** Borra los contadores del escritorio de días anteriores: ya no se leen. */
async function limpiar() {
  if (databaseAvailable())
    await connection()`DELETE FROM request_buckets
      WHERE key LIKE 'escritorio:%' AND window_start < date_trunc('day', now())`;
}

/**
 * El contador de algo sin guardarlo tal cual (ni la IP ni el identificador de la instalación). La
 * clave del proveedor hace de secreto: está siempre que el servidor funciona y no sale de él.
 */
const contador = (tipo: string, valor: string) =>
  `escritorio:${tipo}:${createHmac('sha256', process.env.NAN_API_KEY ?? '')
    .update(valor)
    .digest('hex')}`;

/**
 * La red de una IP para su límite: una IPv6 cuenta por su /64, que es lo que suele tener cada
 * conexión; una IPv4, tal cual, también si llega como IPv6 (`::ffff:192.0.2.1`).
 */
function red(ip: string) {
  if (!isIPv6(ip)) return ip;
  // Los 16 bits de cada grupo; una IPv4 al final son dos.
  const grupos = (parte = '') =>
    parte
      .split(':')
      .filter(Boolean)
      .flatMap((g) => {
        if (!g.includes('.')) return [parseInt(g, 16)];
        const [a = 0, b = 0, c = 0, d = 0] = g.split('.').map(Number);
        return [a * 256 + b, c * 256 + d];
      });
  const [cabeza, cola] = ip.split('::');
  const delante = grupos(cabeza);
  const detras = grupos(cola);
  const todos = [
    ...delante,
    ...Array<number>(8 - delante.length - detras.length).fill(0),
    ...detras,
  ];
  const [, , , , , mapeada, alto = 0, bajo = 0] = todos;
  if (mapeada === 0xffff && todos.slice(0, 5).every((g) => g === 0))
    return [alto >> 8, alto & 255, bajo >> 8, bajo & 255].join('.');
  return `${todos
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}

/** Quien hace la petición: su instalación y su IP, ya como contadores, y el servicio que pide. */
export type Quien = { usuario: string; ip: string; servicio: Servicio };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los contadores de quien pide, cada uno con su límite en millonésimas de dólar. */
const contadores = (quien: Quien) =>
  [
    [quien.usuario, LIMITES.usdPorUsuario * 1e6],
    [quien.ip, LIMITES.usdPorIp * 1e6],
    [`escritorio:global:${quien.servicio}`, LIMITES.usdEntreTodos[quien.servicio] * 1e6],
  ] as const;

const agotado = () =>
  Response.json(
    { error: 'Has llegado al límite de uso del asistente por hoy. Vuelve a intentarlo mañana.' },
    { status: 429 },
  );

/**
 * Antes de leer una petición: la instalación tiene que identificarse y no haber gastado su límite
 * del día, ni su IP el suyo, ni entre todos el del servicio. Devuelve quién es, o el rechazo.
 */
export async function admitir(request: Request, servicio: Servicio): Promise<Quien | Response> {
  // La cabecera de IP solo es fiable en Vercel; fuera, en desarrollo, todas cuentan juntas.
  const ip = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    : 'local';
  // En producción no pasa nada sin Postgres (cada función contaría por su cuenta) ni sin la IP que
  // da Vercel (todas contarían juntas).
  if (process.env.NODE_ENV === 'production' && (!databaseAvailable() || !process.env.VERCEL || !ip))
    return Response.json(
      { error: 'El servidor del asistente no está configurado.' },
      { status: 503 },
    );
  const instalacion = request.headers.get(CABECERA_INSTALACION) ?? '';
  if (!UUID.test(instalacion))
    return Response.json({ error: 'Falta la instalación de la app.' }, { status: 400 });
  const quien = {
    usuario: contador('usuario', instalacion),
    ip: contador('ip', red(ip || 'desconocida')),
    servicio,
  };
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
    lista.map(async ([clave, limite]) => {
      const total = await sumar(clave, micro);
      // La primera reserva del día entre todos borra los contadores de días anteriores: así la
      // tabla no crece sin fin, sin borrar en cada petición.
      if (clave.startsWith('escritorio:global:') && total === micro) await limpiar();
      return total > limite;
    }),
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

/** Lee el cuerpo sin pasar de `max` bytes; `null` si es más grande, sin leer el resto. */
export async function leerCuerpo(request: Request, max: number) {
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
