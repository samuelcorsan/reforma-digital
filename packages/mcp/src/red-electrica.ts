// Servidor MCP de Red Eléctrica: el precio de la luz (PVPC) y la generación por tecnología, de la
// API REData (https://apidatos.ree.es), pública y sin clave. La API responde 400 «no disponible» a
// casi todo lo que no admite (un rango largo, un sistema que el widget no tiene, una fecha sin
// datos): por eso se comprueban aquí las fechas y los sistemas antes de pedir nada.
import { z } from 'zod';
import { get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const API = 'https://apidatos.ree.es/es/datos';
const SOURCE = 'Fuente: Red Eléctrica (REData, apidatos.ree.es).';
// Los primeros días que tiene la API: el PVPC 2.0TD empezó el 1 de junio de 2021; el mercado
// diario está desde 2014 y la generación desde 2011.
const PVPC_DESDE = '2021-06-01';
const MERCADO_DESDE = '2014-01-01';
const MERCADO_CUARTOS = '2025-10-01';
const GENERACION_DESDE = '2011-01-01';

const INSTRUCTIONS = `Datos de Red Eléctrica (REE): el precio de la luz y cómo se genera la electricidad en España.
- precio_luz da el PVPC de un día hora a hora, en €/kWh (como se lee en la factura) y en €/MWh (como lo publica REE), con las horas más baratas y más caras; precio_luz_periodo da medias por día o por mes; generacion da la electricidad generada por tecnología, el porcentaje renovable y la demanda.
- El PVPC es el término de energía de la tarifa regulada 2.0TD (hasta 15 kW): coste de la energía más peajes y cargos, sin impuestos ni término de potencia. No es el precio del mercado diario (mayorista), que se da aparte y no lo paga ningún consumidor tal cual. Desde 2024 (Real Decreto 446/2023) el coste de la energía del PVPC mezcla el mercado diario con futuros: 25 % en 2024, 40 % en 2025 y 55 % desde 2026, así que el PVPC de antes y de después de 2024 no se calcula igual. La API tiene el PVPC desde el ${PVPC_DESDE} y el mercado diario desde 2014.
- Las medias de precio son medias simples de las horas, no ponderadas por consumo.
- Las horas son la hora oficial peninsular (Europe/Madrid). El último domingo de marzo tiene 23 horas (no hay 02:00) y el último domingo de octubre 25 (la 02:00 se repite: primero +02:00, luego +01:00).
- El PVPC de mañana se publica hacia las 20:30 del día anterior; el mercado diario, hacia las 13:15. Si aún no está, dilo así: no uses el de hoy.
- Los precios son del sistema peninsular: REData no los da para Canarias, Baleares, Ceuta ni Melilla. La generación sí se da por sistema eléctrico. Los datos de generación de los últimos días son provisionales.
${SOURCE}`;

type Valor = { value: number; datetime: string };
type Serie = {
  id: string;
  attributes: { title: string; type: string; 'last-update': string; values: Valor[] };
};
type Respuesta = { included: Serie[] };

const SISTEMAS = {
  nacional: '',
  peninsular: 8741,
  canarias: 8742,
  baleares: 8743,
  ceuta: 8744,
  melilla: 8745,
} as const;
type Sistema = keyof typeof SISTEMAS;

/** Hoy en la península, como AAAA-MM-DD. */
const hoy = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const masDias = (fecha: string, dias: number) =>
  new Date(Date.parse(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;

/** Las horas de un día peninsular: 23 el último domingo de marzo, 25 el de octubre. */
function horasDelDia(fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number) as [number, number, number];
  const ultimoDomingo = (mes: number) => {
    const fin = new Date(Date.UTC(y, mes, 0));
    return fin.getUTCDate() - fin.getUTCDay();
  };
  if (m === 3 && d === ultimoDomingo(3)) return 23;
  if (m === 10 && d === ultimoDomingo(10)) return 25;
  return 24;
}

/**
 * El minuto en que acaba el último día pedido. REData guarda cada respuesta unas 24 horas, con la
 * URL como clave, y no la renueva al publicar: pedido el PVPC de mañana a mediodía, seguiría
 * faltando hasta el día siguiente. Para mañana (precios por publicar) y ayer (generación por
 * cerrar), la URL cambia cada dos horas, entre las 23:45 y las 23:56 para que entre el último
 * cuarto de hora. Hoy y los días cerrados van a las 23:59: esa URL de hoy no se pidió ayer, cuando
 * hoy era mañana, así que no puede traer la respuesta de antes de publicarse.
 */
function finDelDia(dia: string) {
  if (dia !== masDias(hoy(), 1) && dia !== masDias(hoy(), -1)) return '23:59';
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  return `23:${45 + Math.floor(hora / 2)}`;
}

async function ree(
  fetchImpl: Fetch,
  widget: string,
  desde: string,
  hasta: string,
  trunc: 'hour' | 'day' | 'month',
  sistema: Sistema = 'nacional',
) {
  const geo = SISTEMAS[sistema];
  const url =
    `${API}/${widget}?start_date=${desde}T00:00&end_date=${hasta}T${finDelDia(hasta)}&time_trunc=${trunc}` +
    (geo ? `&geo_trunc=electric_system&geo_limit=${sistema}&geo_ids=${geo}` : '');
  let response: Response;
  try {
    response = await get(fetchImpl, url);
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    // REData responde 400 a lo que no tiene; otro código es un fallo suyo, no del periodo pedido.
    throw new SourceError(
      error.status === 400
        ? 'REE no da esos datos (respondió 400). Puede que aún no estén publicados o que el periodo sea demasiado largo; prueba un periodo más corto o más antiguo.'
        : error.status
          ? `REE no está disponible ahora (respondió ${error.status}). Prueba más tarde.`
          : 'REE no ha respondido: puede estar caída o tardar con periodos largos. Prueba más tarde o con un periodo más corto.',
    );
  }
  const body = (await response.json()) as Partial<Respuesta>;
  if (!Array.isArray(body.included))
    throw new SourceError('REE respondió sin series de datos. Prueba más tarde.');
  return body.included;
}

const redondea = (n: number, decimales: number) => Number(n.toFixed(decimales));
const suma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);
const media = (valores: number[]) => suma(valores) / valores.length;

/** Los valores de cada día (o de cada mes, con `largo` 7). */
function porDia(valores: Valor[], largo = 10) {
  const dias = new Map<string, Valor[]>();
  for (const v of valores) {
    const dia = v.datetime.slice(0, largo);
    const lista = dias.get(dia) ?? [];
    lista.push(v);
    dias.set(dia, lista);
  }
  return dias;
}

function comprobarDia(fecha: string, horas: Valor[] | undefined, serie: string, porHora: number[]) {
  const esperadas = horasDelDia(fecha);
  const n = horas?.length ?? 0;
  // Cada valor tiene su hora o su cuarto, distintos también el día de 25 horas (+02:00 y +01:00):
  // una hora repetida y otra que falta darían la cuenta sin estar el día entero.
  const distintas = new Set(horas?.map((v) => v.datetime)).size;
  if (distintas !== n || !porHora.some((k) => n === esperadas * k))
    throw new SourceError(
      `REE ha publicado ${n} valores de ${serie} para el ${fecha}, que tiene ${esperadas} horas: el día está incompleto y no se da como si estuviera entero.`,
    );
}

const pvpcEnFecha = (fecha: string) => fecha >= PVPC_DESDE;
const PVPC = '1001';
const MERCADO = '600';

export async function precioLuz(fetchImpl: Fetch, fecha: string | undefined, sistema: Sistema) {
  if (sistema !== 'peninsular')
    throw new SourceError(
      `REData solo publica el PVPC y el precio del mercado del sistema peninsular, no de ${sistema}. Para la generación de ${sistema}, usa generacion.`,
    );
  const dia = fecha ?? hoy();
  const manana = masDias(hoy(), 1);
  if (dia > manana)
    throw new SourceError(
      `No hay precios del ${dia}: REE publica el PVPC de mañana (${manana}) hacia las 20:30 del día anterior, y nunca más adelante.`,
    );
  if (dia < MERCADO_DESDE)
    throw new SourceError(`REData no tiene precios anteriores al ${MERCADO_DESDE}.`);
  const series = await ree(fetchImpl, 'mercados/precios-mercados-tiempo-real', dia, dia, 'hour');
  const pvpc = series.find((s) => s.id === PVPC);
  const mercado = series.find((s) => s.id === MERCADO);
  const horas = horasDelDia(dia);
  // Solo lo de mañana puede faltar por no estar publicado aún; lo de antes, falta por un fallo.
  if (dia !== manana && ((!pvpc && pvpcEnFecha(dia)) || !mercado))
    throw new SourceError(`REE no ha devuelto todos los precios del ${dia}. Prueba más tarde.`);
  const nota = [
    horas === 23 && 'Día de 23 horas: no hay 02:00 (se pasa de 01:59 a 03:00).',
    horas === 25 && 'Día de 25 horas: la 02:00 se repite, primero con +02:00 y luego con +01:00.',
    !pvpc &&
      (pvpcEnFecha(dia)
        ? `El PVPC de mañana (${dia}) aún no está publicado: REE lo publica hacia las 20:30 de hoy y puede tardar hasta dos horas más en salir aquí. No es el de hoy.`
        : `REData no tiene el PVPC antes del ${PVPC_DESDE} (cuando empezó la tarifa 2.0TD). Solo hay el precio del mercado diario, que no es lo que paga un consumidor.`),
    !mercado &&
      `El precio del mercado diario del ${dia} aún no está publicado (sale hacia las 13:15 del día anterior, y puede tardar hasta dos horas más en salir aquí).`,
  ].filter(Boolean);
  if (!pvpc && !mercado) throw new SourceError(nota.join(' '));
  return {
    fecha: dia,
    sistema,
    horas_del_dia: horas,
    nota: nota.length ? nota.join(' ') : undefined,
    pvpc: pvpc && pvpcDelDia(dia, pvpc),
    mercado_diario: mercado && mercadoDelDia(dia, mercado),
  };
}

const hora = (v: { datetime: string }) => ({
  hora: v.datetime.slice(11, 16),
  inicio: v.datetime.replace('.000', ''),
});

function pvpcDelDia(dia: string, serie: Serie) {
  const valores = serie.attributes.values;
  comprobarDia(dia, porDia(valores).get(dia), 'PVPC', [1]);
  const horas = valores.map((v) => ({
    ...hora(v),
    eur_kwh: redondea(v.value / 1000, 5),
    eur_mwh: v.value,
  }));
  const orden = [...horas].sort((a, b) => a.eur_mwh - b.eur_mwh);
  const m = media(valores.map((v) => v.value));
  return {
    descripcion: 'PVPC 2.0TD, término de energía: energía, peajes y cargos, sin impuestos.',
    media_eur_kwh: redondea(m / 1000, 5),
    media_eur_mwh: redondea(m, 2),
    mas_baratas: orden.slice(0, 3).map(({ hora, inicio, eur_kwh }) => ({ hora, inicio, eur_kwh })),
    mas_caras: orden
      .slice(-3)
      .reverse()
      .map(({ hora, inicio, eur_kwh }) => ({ hora, inicio, eur_kwh })),
    horas,
    actualizado: serie.attributes['last-update'],
  };
}

// Desde el 1 de octubre de 2025 el mercado diario casa cada cuarto de hora (REData da cuatro valores
// por hora también algunos meses antes, repetidos): se usa la media de los cuartos de cada hora,
// para ponerlo al lado del PVPC y para que una media de varios días no pese más unos días que otros.
function porHoras(valores: Valor[]) {
  const horas = new Map<string, { datetime: string; cuartos: number[] }>();
  for (const v of valores) {
    const clave = v.datetime.slice(0, 13) + v.datetime.slice(23);
    const h = horas.get(clave) ?? { datetime: v.datetime, cuartos: [] };
    h.cuartos.push(v.value);
    horas.set(clave, h);
  }
  return [...horas.values()].map((h) => ({ datetime: h.datetime, value: media(h.cuartos) }));
}

function mercadoDelDia(dia: string, serie: Serie) {
  const valores = serie.attributes.values;
  comprobarDia(dia, porDia(valores).get(dia), 'el mercado diario', [1, 4]);
  const horas = porHoras(valores);
  return {
    descripcion: 'Precio del mercado diario (mayorista), no lo que paga un consumidor.',
    resolucion: dia >= MERCADO_CUARTOS ? 'cuarto de hora (se da la media de cada hora)' : 'hora',
    media_eur_mwh: redondea(media(horas.map((v) => v.value)), 2),
    horas: horas.map((v) => ({ ...hora(v), eur_mwh: redondea(v.value, 2) })),
    actualizado: serie.attributes['last-update'],
  };
}

const finDeMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** Los meses naturales que toca un rango, recortados al rango: la API da como mucho 31 días por hora. */
function meses(desde: string, hasta: string) {
  const out: { desde: string; hasta: string }[] = [];
  for (let inicio = desde; inicio <= hasta;) {
    const finMes = finDeMes(inicio.slice(0, 7));
    const fin = finMes < hasta ? finMes : hasta;
    out.push({ desde: inicio, hasta: fin });
    inicio = masDias(fin, 1);
  }
  return out;
}

/** Las series de varios trozos del mismo periodo, cada una con sus valores seguidos. */
function juntar(trozos: Serie[][]) {
  const porId = new Map<string, Serie>();
  for (const s of trozos.flat()) {
    const antes = porId.get(s.id);
    if (antes) antes.attributes.values.push(...s.attributes.values);
    else porId.set(s.id, s);
  }
  return [...porId.values()];
}

function comprobarRango(
  desde: string,
  hasta: string,
  primero: string,
  ultimo: string,
  max: number,
) {
  if (desde > hasta) throw new SourceError('`desde` va después de `hasta`.');
  if (desde < primero) throw new SourceError(`REData no tiene estos datos antes del ${primero}.`);
  if (hasta > ultimo)
    throw new SourceError(`Aún no hay datos después del ${ultimo}: pide hasta esa fecha.`);
  if (diasEntre(desde, hasta) > max)
    throw new SourceError(
      `Son ${diasEntre(desde, hasta)} días y el máximo es ${max}: divide el periodo.`,
    );
}

/** El periodo del que habla una fila, y si no lo cubre entero. */
function periodo(clave: string, agrupacion: 'dia' | 'mes', desde: string, hasta: string) {
  if (agrupacion === 'dia') return { periodo: clave };
  const inicio = `${clave}-01`;
  const fin = finDeMes(clave);
  const parcial = inicio < desde || fin > hasta;
  return {
    periodo: clave,
    parcial: parcial
      ? `solo del ${inicio < desde ? desde : inicio} al ${fin > hasta ? hasta : fin}`
      : undefined,
  };
}

export async function precioLuzPeriodo(
  fetchImpl: Fetch,
  desde: string,
  hasta: string,
  agrupacion: 'dia' | 'mes',
) {
  comprobarRango(desde, hasta, PVPC_DESDE, masDias(hoy(), 1), 366);
  const trozos = await Promise.all(
    meses(desde, hasta).map((t) =>
      ree(fetchImpl, 'mercados/precios-mercados-tiempo-real', t.desde, t.hasta, 'hour'),
    ),
  );
  const pvpc = trozos.flatMap((s) => s.find((x) => x.id === PVPC)?.attributes.values ?? []);
  const mercadoCrudo = trozos.flatMap(
    (s) => s.find((x) => x.id === MERCADO)?.attributes.values ?? [],
  );
  const pvpcDias = porDia(pvpc);
  const mercadoDias = porDia(mercadoCrudo);
  const mercado = porHoras(mercadoCrudo);
  if (hasta === masDias(hoy(), 1) && !pvpcDias.has(hasta))
    throw new SourceError(
      `El PVPC de mañana (${hasta}) aún no está publicado (sale hacia las 20:30, y puede tardar hasta dos horas más en salir aquí): pide hasta hoy.`,
    );
  // Un día que falta o viene a medias haría una media que parece buena: mejor decirlo.
  for (let dia = desde; dia <= hasta; dia = masDias(dia, 1)) {
    comprobarDia(dia, pvpcDias.get(dia), 'PVPC', [1]);
    comprobarDia(dia, mercadoDias.get(dia), 'el mercado diario', [1, 4]);
  }
  const largo = agrupacion === 'dia' ? 10 : 7;
  const mercadoGrupos = porDia(mercado, largo);
  const valores = (vs: Valor[] | undefined) => (vs ?? []).map((v) => v.value);
  return {
    desde,
    hasta,
    agrupacion,
    sistema: 'peninsular',
    descripcion:
      'Medias simples por hora: PVPC 2.0TD (término de energía, sin impuestos) y mercado diario (mayorista).',
    pvpc_media_eur_kwh: redondea(media(pvpc.map((v) => v.value)) / 1000, 5),
    mercado_media_eur_mwh: redondea(media(mercado.map((v) => v.value)), 2),
    // Cada día ya se ha comprobado entero en las dos series: cada periodo tiene las dos.
    periodos: [...porDia(pvpc, largo)].map(([k, vs]) => {
      const g = valores(vs);
      return {
        ...periodo(k, agrupacion, desde, hasta),
        pvpc_media_eur_kwh: redondea(media(g) / 1000, 5),
        pvpc_min_eur_kwh: redondea(Math.min(...g) / 1000, 5),
        pvpc_max_eur_kwh: redondea(Math.max(...g) / 1000, 5),
        mercado_media_eur_mwh: redondea(media(valores(mercadoGrupos.get(k))), 2),
      };
    }),
  };
}

export async function generacion(
  fetchImpl: Fetch,
  desde: string,
  hasta: string,
  agrupacion: 'dia' | 'mes',
  sistema: Sistema,
) {
  const ayer = masDias(hoy(), -1);
  if (hasta > ayer)
    throw new SourceError(
      `La generación del día en curso no está cerrada: REE da el balance del día al día siguiente. Pide hasta ayer (${ayer}).`,
    );
  comprobarRango(desde, hasta, GENERACION_DESDE, ayer, agrupacion === 'dia' ? 31 : 366);
  const trunc = agrupacion === 'dia' ? 'day' : 'month';
  // REE tarda unos 9 s por trimestre sin caché y más de 30 s por año: se pide de tres en tres meses.
  const todos = meses(desde, hasta);
  const trimestres = Array.from({ length: Math.ceil(todos.length / 3) }, (_, i) => {
    const t = todos.slice(i * 3, i * 3 + 3);
    return { desde: t[0]!.desde, hasta: t.at(-1)!.hasta };
  });
  const pedir = (widget: string) =>
    Promise.all(trimestres.map((t) => ree(fetchImpl, widget, t.desde, t.hasta, trunc, sistema)));
  const [tecnologias, demanda] = (
    await Promise.all([pedir('generacion/estructura-generacion'), pedir('demanda/evolucion')])
  ).map(juntar) as [Serie[], Serie[]];
  const clave = (v: Valor) => v.datetime.slice(0, agrupacion === 'dia' ? 10 : 7);
  const total = tecnologias.find((s) => s.attributes.type === 'total');
  const demandaSerie = demanda.find((s) => s.attributes.title === 'Demanda');
  const esperados = agrupacion === 'dia' ? diasEntre(desde, hasta) : todos.length;
  if (!total || total.attributes.values.length !== esperados)
    throw new SourceError(
      `REE ha devuelto la generación total de ${total?.attributes.values.length ?? 0} de los ${esperados} periodos pedidos: los datos están incompletos.`,
    );
  if (!demandaSerie || demandaSerie.attributes.values.length !== esperados)
    throw new SourceError('REE ha devuelto la demanda incompleta para ese periodo.');
  const renovable = new Map<string, number>();
  const sumaPorPeriodo = new Map<string, number>();
  const mix = tecnologias
    .filter((s) => s !== total)
    .map((s) => {
      let mwh = 0;
      for (const v of s.attributes.values) {
        mwh += v.value;
        sumaPorPeriodo.set(clave(v), (sumaPorPeriodo.get(clave(v)) ?? 0) + v.value);
        if (s.attributes.type === 'Renovable')
          renovable.set(clave(v), (renovable.get(clave(v)) ?? 0) + v.value);
      }
      return { tecnologia: s.attributes.title, renovable: s.attributes.type === 'Renovable', mwh };
    });
  // Las tecnologías suman el total de REE; si no, falta alguna y el mix y el % renovable mentirían.
  for (const v of total.attributes.values)
    if (Math.abs((sumaPorPeriodo.get(clave(v)) ?? 0) - v.value) > Math.abs(v.value) * 0.001)
      throw new SourceError(
        `REE ha devuelto un desglose por tecnologías de ${clave(v)} que no suma su generación total: faltan datos y no se da el mix.`,
      );
  const generado = suma(total.attributes.values.map((v) => v.value));
  const renovableTotal = suma([...renovable.values()]);
  const pct = (parte: number, todo: number) => redondea((parte / todo) * 100, 1);
  const demandaPorPeriodo = new Map(demandaSerie.attributes.values.map((v) => [clave(v), v.value]));
  const demandaDe = (k: string) => {
    const mwh = demandaPorPeriodo.get(k);
    if (mwh === undefined) throw new SourceError(`REE no ha devuelto la demanda de ${k}.`);
    return redondea(mwh, 1);
  };
  return {
    sistema,
    desde,
    hasta,
    agrupacion,
    unidad: 'MWh',
    generacion_mwh: redondea(generado, 1),
    renovable_pct: pct(renovableTotal, generado),
    demanda_mwh: redondea(suma(demandaSerie.attributes.values.map((v) => v.value)), 1),
    tecnologias: mix
      .sort((a, b) => b.mwh - a.mwh)
      .map((t) => ({ ...t, mwh: redondea(t.mwh, 1), pct: pct(t.mwh, generado) })),
    periodos: total.attributes.values.map((v) => ({
      ...periodo(clave(v), agrupacion, desde, hasta),
      generacion_mwh: redondea(v.value, 1),
      renovable_pct: pct(renovable.get(clave(v)) ?? 0, v.value),
      demanda_mwh: demandaDe(clave(v)),
    })),
    nota: [
      'Los datos recientes son provisionales: REE los revisa después.',
      mix.some((t) => t.mwh < 0) &&
        'Un valor negativo es el consumo propio de esas centrales, mayor que lo que generaron.',
    ]
      .filter(Boolean)
      .join(' '),
    actualizado: total.attributes['last-update'],
  };
}

const fecha = z.iso.date();
const sistemaPrecio = z
  .enum(Object.keys(SISTEMAS).filter((s) => s !== 'nacional') as [Sistema, ...Sistema[]])
  .default('peninsular')
  .describe('Sistema eléctrico. REData solo da precios del peninsular.');

export function createRedElectricaMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-red-electrica', title: 'Red Eléctrica' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'precio_luz',
        {
          title: 'Precio de la luz',
          description:
            'El PVPC (tarifa regulada 2.0TD) de un día hora a hora, en €/kWh y €/MWh, con las tres horas más baratas y más caras y la media, y aparte el precio del mercado diario. Por defecto, hoy. El de mañana sale hacia las 20:30: si aún no está, lo dice.',
          inputSchema: z.object({
            fecha: fecha
              .optional()
              .describe('Día, AAAA-MM-DD. Por defecto, hoy (hora peninsular).'),
            sistema: sistemaPrecio,
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ fecha, sistema }) => run(SOURCE, () => precioLuz(fetchImpl, fecha, sistema)),
      );
      s.registerTool(
        'precio_luz_periodo',
        {
          title: 'Precio de la luz en un periodo',
          description: `Las medias del PVPC (€/kWh, con mínimo y máximo) y del mercado diario (€/MWh) por día o por mes, de ${PVPC_DESDE} en adelante y como mucho 366 días. Un mes que el rango no cubre entero sale marcado como parcial.`,
          inputSchema: z.object({
            desde: fecha.describe('Primer día, AAAA-MM-DD.'),
            hasta: fecha.describe('Último día, AAAA-MM-DD.'),
            agrupacion: z.enum(['dia', 'mes']).default('dia'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ desde, hasta, agrupacion }) =>
          run(SOURCE, () => precioLuzPeriodo(fetchImpl, desde, hasta, agrupacion)),
      );
      s.registerTool(
        'generacion',
        {
          title: 'Generación eléctrica',
          description: `La electricidad generada por tecnología (eólica, nuclear, solar, ciclo combinado…), el porcentaje renovable y la demanda, en MWh, de un día o un periodo hasta ayer, por día (hasta 31 días) o por mes (hasta 366 días). Desde ${GENERACION_DESDE}. Por sistema eléctrico: nacional (por defecto), peninsular, canarias, baleares, ceuta o melilla.`,
          inputSchema: z.object({
            desde: fecha.describe('Primer día, AAAA-MM-DD.'),
            hasta: fecha
              .optional()
              .describe('Último día, AAAA-MM-DD. Por defecto, el mismo que `desde`.'),
            agrupacion: z.enum(['dia', 'mes']).default('dia'),
            sistema: z.enum(Object.keys(SISTEMAS) as [Sistema, ...Sistema[]]).default('nacional'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ desde, hasta, agrupacion, sistema }) =>
          run(SOURCE, () => generacion(fetchImpl, desde, hasta ?? desde, agrupacion, sistema)),
      );
    },
  );
}
