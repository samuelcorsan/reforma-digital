import { z } from 'zod';
import { buscarConExa } from '@reforma-digital/agent/research';
import { admitir, leerCuerpo, reservar } from '../../../../lib/escritorio';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * La búsqueda de la app de escritorio: Exa con la clave del servidor. La consulta llega sin datos
 * personales (el agente la limpia) y no se guarda.
 */
const peticionEsquema = z.object({
  consulta: z.string().trim().min(3).max(300),
  dominios: z
    .array(
      z
        .string()
        .regex(/^[\p{L}\d-]+(\.[\p{L}\d-]+)+$/u)
        .max(100),
    )
    .max(10)
    .default([]),
});

/** Lo que se reserva por búsqueda y lo que cuenta si Exa no dice lo que ha costado. */
const BUSQUEDA_CARA = 0.025;

export async function POST(request: Request) {
  const clave = process.env.EXA_API_KEY;
  if (!clave) return Response.json({ error: 'El buscador no está configurado.' }, { status: 503 });
  const quien = await admitir(request);
  if (quien instanceof Response) return quien;
  const texto = await leerCuerpo(request, 4000);
  if (texto === null) return Response.json({ error: 'Petición demasiado grande' }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const p = peticionEsquema.safeParse(json);
  if (!p.success) return Response.json({ error: 'Petición no válida' }, { status: 400 });
  const ajustar = await reservar(quien, BUSQUEDA_CARA);
  if (ajustar instanceof Response) return ajustar;
  const r = await buscarConExa(p.data.consulta, p.data.dominios, clave, 8, request.signal);
  // Exa suele decir lo que ha costado; si no, cuenta como una búsqueda cara.
  await ajustar(r.costeUsd ?? BUSQUEDA_CARA);
  return Response.json(r);
}
