import { z } from 'zod';
import { approvedSource, canonicalize } from '@reforma-digital/government';
import { isOfficial } from '@reforma-digital/government/domains';
import { CABECERA_INSTALACION, type Proveedor, type ServidorReforma } from './models';

export type Fuente = {
  id: string;
  url: string;
  titulo: string;
  /** Si el dominio está en la lista de webs de las administraciones. */
  oficial: boolean;
  /** Organismo, si el dominio es una fuente registrada del buscador de Reforma Digital. */
  organismo?: string;
  origen: 'busqueda' | 'pagina';
};

/** Webs consultadas en un trámite: se muestran debajo de cada respuesta. */
export class Fuentes {
  private porUrl = new Map<string, Fuente>();
  constructor(iniciales: Fuente[] = []) {
    for (const f of iniciales) this.porUrl.set(f.url, f);
  }
  lista = () => [...this.porUrl.values()];
  obtener = (idOUrl: string) =>
    this.porUrl.get(URL.canParse(idOUrl) ? canonicalize(idOUrl) : idOUrl) ??
    this.lista().find((f) => f.id === idOUrl.trim().toUpperCase());

  añadir(url: string, titulo: string, origen: Fuente['origen']): Fuente | undefined {
    if (!url.startsWith('https://')) return;
    const canonica = canonicalize(url);
    const previa = this.porUrl.get(canonica);
    if (previa) {
      if (origen === 'pagina') Object.assign(previa, { origen, titulo: titulo || previa.titulo });
      return previa;
    }
    const registrada = approvedSource(canonica);
    const fuente: Fuente = {
      id: `F${this.porUrl.size + 1}`,
      url: canonica,
      titulo: titulo || new URL(canonica).hostname,
      oficial: isOfficial(url),
      ...(registrada ? { organismo: registrada.organization } : {}),
      origen,
    };
    this.porUrl.set(canonica, fuente);
    return fuente;
  }
}

export type Resultado = { url: string; titulo: string; extracto: string };

/** Limpia el ruido de menús que traen los extractos: enlaces sueltos y viñetas vacías. */
export function limpiarExtracto(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !/^\s*[*+-]?\s*\[[^\]]*\]\([^)]*\)\s*$/.test(l) && l.trim() !== '...')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Busca en toda la web, o solo en `dominios` si se dan: las webs de las administraciones son
 * demasiadas para una lista. La búsqueda la ejecuta Exa, directamente o en el servidor de Reforma
 * Digital.
 */
export async function buscarEnLaWeb(
  consulta: string,
  dominios: string[],
  proveedor: Proveedor,
  signal?: AbortSignal,
): Promise<{ resultados: Resultado[]; costeUsd: number | null }> {
  const max = 8;
  const b = proveedor.busqueda;
  if (!b)
    throw new Error(
      'La búsqueda no está disponible con el proveedor elegido en Ajustes. Lee con leer_pagina la web del organismo si la conoces.',
    );
  if (b.tipo === 'exa') return buscarConExa(consulta, dominios, b.clave, max, signal);
  return buscarEnElServidor(consulta, dominios, b, signal);
}

const respuestaBoe = z.object({
  status: z.object({ code: z.string(), text: z.string().optional() }),
  // Sin resultados, `data` llega como texto vacío.
  data: z
    .union([
      z.array(
        z.object({
          identificador: z.string(),
          titulo: z.string(),
          rango: z.object({ texto: z.string() }).optional(),
          fecha_publicacion: z.string().optional(),
          vigencia_agotada: z.string().optional(),
          url_html_consolidada: z.string().optional(),
        }),
      ),
      z.literal(''),
    ])
    .nullish(),
});

/**
 * Normas estatales de la legislación consolidada del BOE (API de datos abiertos, sin clave) que
 * llevan en el título todas las palabras o expresiones dadas.
 */
export async function buscarEnElBoe(
  palabras: string[],
  soloVigentes: boolean,
  signal?: AbortSignal,
) {
  // Cada una entre comillas, sin los signos de la sintaxis de búsqueda del BOE.
  const terminos = palabras
    .map((p) =>
      p
        .replace(/[^\p{L}\p{N}\s/.-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .map((p) => `"${p}"`);
  if (!terminos.length) throw new Error('Escribe alguna palabra del título de la norma.');
  const consulta = `titulo:(${terminos.join(' and ')})${soloVigentes ? ' and vigencia_agotada:N' : ''}`;
  const res = await fetch(
    `https://www.boe.es/datosabiertos/api/legislacion-consolidada?limit=10&query=${encodeURIComponent(JSON.stringify({ query: { query_string: { query: consulta } } }))}`,
    {
      headers: { accept: 'application/json' },
      signal: AbortSignal.any([AbortSignal.timeout(20000), ...(signal ? [signal] : [])]),
    },
  );
  if (!res.ok) throw new Error(`El BOE respondió con un error ${res.status}.`);
  const r = respuestaBoe.parse(await res.json());
  if (r.status.code !== '200')
    throw new Error(`El BOE respondió: ${r.status.text ?? r.status.code}.`);
  return (r.data || []).map((n) => ({
    titulo: n.titulo,
    rango: n.rango?.texto,
    publicada: n.fecha_publicacion?.replace(/^(\d{4})(\d{2})(\d{2}).*$/, '$3/$2/$1'),
    vigente: n.vigencia_agotada !== 'S',
    url:
      n.url_html_consolidada ??
      `https://www.boe.es/buscar/act.php?id=${encodeURIComponent(n.identificador)}`,
  }));
}

const respuestaExa = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      highlights: z.array(z.string()).nullish(),
    }),
  ),
  costDollars: z.object({ total: z.number() }).partial().nullish(),
});

const respuestaServidor = z.object({
  resultados: z.array(z.object({ url: z.string(), titulo: z.string(), extracto: z.string() })),
  costeUsd: z.number().nullable(),
});

/** La búsqueda del servidor de Reforma Digital, que hace Exa con su clave (`apps/web`). */
async function buscarEnElServidor(
  consulta: string,
  dominios: string[],
  servidor: ServidorReforma,
  signal?: AbortSignal,
) {
  const res = await fetch(`${servidor.url}/api/escritorio/buscar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CABECERA_INSTALACION]: servidor.instalacion },
    body: JSON.stringify({ consulta, dominios }),
    signal: AbortSignal.any([AbortSignal.timeout(40000), ...(signal ? [signal] : [])]),
  });
  if (res.status === 429)
    throw new Error('El buscador de Reforma Digital está saturado ahora mismo. Prueba más tarde.');
  if (!res.ok)
    throw new Error(`El buscador de Reforma Digital respondió con un error ${res.status}.`);
  return respuestaServidor.parse(await res.json());
}

/** Exa: la búsqueda directa, sin pasar por un modelo, con fragmentos de cada página. */
export async function buscarConExa(
  consulta: string,
  dominios: string[],
  clave: string,
  max: number,
  signal?: AbortSignal,
): Promise<{ resultados: Resultado[]; costeUsd: number | null }> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: consulta,
      numResults: max,
      userLocation: 'ES',
      ...(dominios.length ? { includeDomains: dominios } : {}),
      contents: { highlights: { maxCharacters: 2500 } },
    }),
    signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
  });
  if (!res.ok) throw new Error(`El buscador (Exa) respondió con un error ${res.status}.`);
  const r = respuestaExa.parse(await res.json());
  return {
    resultados: r.results.map((x) => ({
      url: x.url,
      titulo: x.title ?? '',
      extracto: limpiarExtracto((x.highlights ?? []).join('\n\n')),
    })),
    costeUsd: r.costDollars?.total ?? null,
  };
}
