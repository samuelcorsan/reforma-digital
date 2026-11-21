// Servidor MCP de los precios de carburantes: la API REST del Ministerio para la Transición
// Ecológica (geoportal de gasolineras), sin clave. Los precios se actualizan varias veces al día.
import { z } from 'zod';
import { fold, get, READ_ONLY_EXTERNAL, run, server, SourceError, type Fetch } from './comun';

const API = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const SOURCE =
  'Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico, precios de carburantes en estaciones de servicio (geoportalgasolineras.es).';

const INSTRUCTIONS = `Precios de los carburantes en cada gasolinera de España, actualizados varias veces al día.
- Busca primero el municipio con buscar_municipio y usa su id en gasolineras_baratas; o usa el código de provincia (28 Madrid, 08 Barcelona…).
- Los precios son en euros por litro (por kilo en el gas) y la hora es la de la consulta del Ministerio.
${SOURCE}`;

// Los carburantes más pedidos, con el campo de precio que usa la API.
const carburantes = {
  gasolina95: 'Precio Gasolina 95 E5',
  gasolina95_e10: 'Precio Gasolina 95 E10',
  gasolina98: 'Precio Gasolina 98 E5',
  diesel: 'Precio Gasoleo A',
  diesel_premium: 'Precio Gasoleo Premium',
  glp: 'Precio Gases licuados del petróleo',
  gnc: 'Precio Gas Natural Comprimido',
  adblue: 'Precio Adblue',
} as const;
type Carburante = keyof typeof carburantes;

type Municipio = { IDMunicipio: string; Municipio: string; Provincia: string; CCAA: string };
let municipios: Promise<Municipio[]> | undefined;

export async function buscarMunicipio(fetchImpl: Fetch, nombre: string) {
  // La lista (unos 8.000) apenas cambia: se pide una vez por proceso.
  municipios ??= get(fetchImpl, `${API}/Listados/Municipios/`)
    .then((r) => r.json() as Promise<Municipio[]>)
    .catch((error: unknown) => {
      municipios = undefined;
      throw error;
    });
  const q = fold(nombre);
  const all = await municipios;
  const exact = all.filter((m) => fold(m.Municipio) === q);
  const partial = all.filter((m) => fold(m.Municipio).includes(q) && !exact.includes(m));
  return [...exact, ...partial].slice(0, 15).map((m) => ({
    id: m.IDMunicipio,
    municipio: m.Municipio,
    provincia: m.Provincia,
    comunidad: m.CCAA,
  }));
}

type Estacion = Record<string, string>;
const number = (text: string | undefined) =>
  text ? Number.parseFloat(text.replace(',', '.')) : Number.NaN;

export async function gasolinerasBaratas(
  fetchImpl: Fetch,
  where: { municipio?: string; provincia?: string },
  carburante: Carburante,
  limite: number,
) {
  const path = where.municipio
    ? `EstacionesTerrestres/FiltroMunicipio/${where.municipio}`
    : where.provincia
      ? `EstacionesTerrestres/FiltroProvincia/${where.provincia}`
      : undefined;
  if (!path) throw new SourceError('Indica un municipio (id) o una provincia (código).');
  const body = (await (await get(fetchImpl, `${API}/${path}`)).json()) as {
    Fecha: string;
    ListaEESSPrecio: Estacion[];
  };
  const field = carburantes[carburante];
  const estaciones = body.ListaEESSPrecio.map((e) => ({ e, precio: number(e[field]) }))
    .filter(({ precio }) => Number.isFinite(precio))
    .sort((a, b) => a.precio - b.precio);
  return {
    actualizado: body.Fecha,
    carburante,
    total: estaciones.length,
    gasolineras: estaciones.slice(0, limite).map(({ e, precio }) => ({
      precio,
      rotulo: e['Rótulo'],
      direccion: e['Dirección'],
      localidad: e.Localidad,
      municipio: e.Municipio,
      cp: e['C.P.'],
      horario: e.Horario,
      latitud: number(e.Latitud),
      longitud: number(e['Longitud (WGS84)']),
    })),
  };
}

export function createCarburantesMcp(fetchImpl: Fetch = fetch) {
  return server(
    { name: 'reforma-digital-carburantes', title: 'Precios de carburantes' },
    INSTRUCTIONS,
    (s) => {
      s.registerTool(
        'buscar_municipio',
        {
          title: 'Buscar municipio',
          description:
            'Municipios cuyo nombre coincide (sin distinguir tildes), con el id que usa gasolineras_baratas.',
          inputSchema: z.object({ nombre: z.string().min(2).max(80) }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ nombre }) => run(SOURCE, () => buscarMunicipio(fetchImpl, nombre)),
      );
      s.registerTool(
        'gasolineras_baratas',
        {
          title: 'Gasolineras más baratas',
          description:
            'Las gasolineras de un municipio o una provincia que venden un carburante, de la más barata a la más cara, con dirección, horario y coordenadas.',
          inputSchema: z.object({
            municipio: z
              .string()
              .regex(/^\d+$/)
              .optional()
              .describe('Id del municipio, de buscar_municipio.'),
            provincia: z
              .string()
              .regex(/^\d{2}$/)
              .optional()
              .describe('Código de provincia de dos cifras, como 28 (Madrid).'),
            carburante: z.enum(Object.keys(carburantes) as [Carburante, ...Carburante[]]),
            limite: z.number().int().min(1).max(50).default(10),
          }),
          annotations: READ_ONLY_EXTERNAL,
        },
        ({ municipio, provincia, carburante, limite }) =>
          run(SOURCE, () =>
            gasolinerasBaratas(fetchImpl, { municipio, provincia }, carburante, limite),
          ),
      );
    },
  );
}
