// Servidor MCP de los ayuntamientos: deuda, pago a proveedores, cuentas, presupuesto, impuestos,
// contratos, subvenciones, sueldos y transparencia de los 8.132 municipios de España, con la API
// abierta de Ayuntamientos Transparentes (https://ayuntamientostransparentes.es/api/v1), sin clave.
// Esa web junta y cruza las fuentes oficiales (Hacienda, Tribunal de Cuentas, PLACSP, BDNS, ISPA…)
// por código INE y las rehace cada semana; aquí solo se piden y se devuelven.
import { z } from 'zod';
import { READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const BASE = 'https://ayuntamientostransparentes.es/api/v1';
const SOURCE =
  'Fuente: Ayuntamientos Transparentes (ayuntamientostransparentes.es), con datos oficiales de Hacienda, el Tribunal de Cuentas, el INE, la PLACSP, la BDNS y el ISPA. Son señales para revisar, no acusaciones. Cita la ficha del municipio al usar los datos.';

const SECCIONES = [
  'cuentas',
  'presupuesto',
  'impuestos',
  'contratos',
  'subvenciones',
  'sueldos',
  'transparencia',
] as const;

const INSTRUCTIONS = `Cómo gestiona su dinero cada ayuntamiento de España (8.132 municipios), con datos oficiales cruzados por código INE y actualizados cada semana.
- Busca primero el municipio con buscar_municipio y usa su código INE (5 cifras) en ver_municipio. Si el nombre se repite, pide la provincia.
- ver_municipio da siempre el alcalde, la nota y un resumen; añade las secciones que pida la pregunta: cuentas (deuda, días de pago a proveedores, Cuenta General, obligaciones legales no cumplidas), presupuesto (gasto, inversión, personal, facturas en el cajón), impuestos (IBI, ICIO, coche, plusvalía), contratos (PLACSP: una sola oferta, negociados sin publicidad, peso de los tres mayores proveedores), subvenciones (recibidas y fondos europeos MRR), sueldos (alcalde y cargos electos frente al tope legal) y transparencia (web e información pública).
- La nota va de 0 a 99: cuántos de cada 100 municipios del mismo tamaño gestionan su dinero peor.
- Compara un dato solo con la mediana que lo acompaña y di con quién compara (comparado_con, o la comunidad en los impuestos). Si un dato no trae mediana, no inventes una referencia.
- Las secciones de sin_datos no tienen datos en la fuente: es un dato desconocido, ni bueno ni malo.
- clasificacion ordena los municipios de una provincia o comunidad por su nota.
- Son señales para revisar, nunca acusaciones: dilo así y enlaza la ficha del municipio.
${SOURCE}`;

// Los datos cambian una vez por semana: una respuesta vale una hora, como dice la propia API.
const TTL = 60 * 60 * 1000;
type Cache = Map<string, { at: number; data: Promise<unknown> }>;

async function pedir(
  fetchImpl: Fetch,
  cache: Cache,
  path: string,
  params: Record<string, string | number | undefined>,
  valida: (data: Record<string, unknown>) => boolean,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value));
  const url = `${BASE}${path}${query.size ? `?${query}` : ''}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = descargar(fetchImpl, url, valida);
  if (cache.size >= 500) cache.clear();
  cache.set(url, { at: Date.now(), data });
  data.catch(() => cache.delete(url));
  return data;
}

async function descargar(
  fetchImpl: Fetch,
  url: string,
  valida: (data: Record<string, unknown>) => boolean,
) {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError('La fuente no responde. Prueba más tarde.');
  }
  if (response.status === 429)
    throw new SourceError('Demasiadas consultas seguidas. Espera unos segundos.', 429);
  if (!response.ok) {
    // La API explica los 400 y 404 en español («no hay ningún municipio con el código INE …»).
    const esJson = response.headers.get('content-type')?.includes('application/json');
    const body = (esJson ? await response.json() : {}) as { error?: unknown };
    const motivo = typeof body.error === 'string' ? body.error.slice(0, 300) : undefined;
    throw new SourceError(motivo ?? `La fuente respondió ${response.status}.`, response.status);
  }
  const data = (await response.json()) as unknown;
  // Lo que no tiene la forma esperada es un fallo de la fuente, no una respuesta (y no se guarda).
  if (!data || typeof data !== 'object' || !valida(data as Record<string, unknown>))
    throw new SourceError('La fuente respondió algo que no se puede leer. Prueba más tarde.');
  return data;
}

const conLista = (data: Record<string, unknown>) => Array.isArray(data.municipios);
const conFicha = (data: Record<string, unknown>) => typeof data.ine === 'string';

/** Las secciones pedidas, sin repetir y en orden fijo (una sola entrada de caché); error si alguna no existe. */
function secciones(lista: string) {
  const pedidas = new Set(lista.split(','));
  const malas = [...pedidas].filter((s) => !(SECCIONES as readonly string[]).includes(s));
  if (malas.length)
    throw new SourceError(
      `Secciones desconocidas: ${malas.join(', ')}. Hay: ${SECCIONES.join(', ')}.`,
    );
  return SECCIONES.filter((s) => pedidas.has(s)).join(',');
}

// La API repite la atribución en cada respuesta; `run` ya la añade al final.
function sinFuente(data: unknown) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const resto = { ...(data as Record<string, unknown>) };
    delete resto.fuente;
    return resto;
  }
  return data;
}

export function createMunicipiosMcp(fetchImpl: Fetch = fetch) {
  const cache: Cache = new Map();
  return server(
    { name: 'reforma-digital-municipios', title: 'Ayuntamientos' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_municipio',
        {
          title: 'Buscar municipio',
          description:
            'Municipios cuyo nombre contiene todas las palabras (sin distinguir tildes), con su código INE, provincia, población y nota. Los nombres exactos salen primero, después los más poblados.',
          inputSchema: z.object({
            nombre: z.string().min(2).max(100),
            provincia: z
              .string()
              .max(60)
              .optional()
              .describe('Provincia o comunidad, para distinguir nombres repetidos.'),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ nombre, provincia }) =>
          run(SOURCE, async () =>
            sinFuente(
              await pedir(
                fetchImpl,
                cache,
                '/buscar',
                { q: nombre, provincia, limite: 10 },
                conLista,
              ),
            ),
          ),
      );
      s.registerTool(
        'ver_municipio',
        {
          title: 'Ver un municipio',
          description:
            'Ficha de un ayuntamiento: alcalde, partido, nota, resumen y las secciones pedidas, cada dato con su año, su fuente y, cuando la hay, la mediana con la que compararlo.',
          inputSchema: z.object({
            ine: z
              .string()
              .regex(/^\d{5}$/)
              .describe('Código INE de 5 cifras, de buscar_municipio (Madrid es 28079).'),
            // Texto y no lista: así también se puede pedir por GET (/mcp/municipios/ver_municipio?…).
            secciones: z
              .string()
              .regex(/^[a-z]+(,[a-z]+)*$/)
              .default('cuentas')
              .describe(
                `Secciones separadas por comas, solo las que necesita la pregunta: ${SECCIONES.join(', ')}.`,
              ),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ ine, secciones: lista }) =>
          run(SOURCE, async () =>
            sinFuente(
              await pedir(
                fetchImpl,
                cache,
                `/municipio/${ine}`,
                {
                  secciones: secciones(lista),
                },
                conFicha,
              ),
            ),
          ),
      );
      s.registerTool(
        'clasificacion',
        {
          title: 'Clasificación por nota',
          description:
            'Los municipios de una provincia o comunidad (o de toda España) ordenados por su nota, de peor a mejor o al revés.',
          inputSchema: z.object({
            zona: z
              .string()
              .max(60)
              .optional()
              .describe(
                'Nombre de una provincia o comunidad, como «Huelva» o «Comunitat Valenciana». Sin zona, toda España.',
              ),
            orden: z.enum(['peor', 'mejor']).default('peor'),
            minimo_habitantes: z
              .number()
              .int()
              .min(0)
              .optional()
              .describe('Deja fuera los municipios más pequeños, por ejemplo 20000.'),
            limite: z.number().int().min(1).max(50).default(10),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ zona, orden, minimo_habitantes, limite }) =>
          run(SOURCE, async () =>
            sinFuente(
              await pedir(
                fetchImpl,
                cache,
                '/clasificacion',
                {
                  zona,
                  orden,
                  minimo: minimo_habitantes,
                  limite,
                },
                conLista,
              ),
            ),
          ),
      );
    },
  );
}
