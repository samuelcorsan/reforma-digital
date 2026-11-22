import { z } from 'zod';
import { queServidor } from '../../../../lib/mcp/preguntar';

export const runtime = 'nodejs';

const esquema = z.object({ pregunta: z.string().trim().min(3).max(300) });

/**
 * «¿Qué quieres saber?» de la biblioteca MCP: qué servidor puede responderlo. La pregunta no se
 * guarda. El límite por IP lo pone una regla del firewall de Vercel sobre esta ruta, antes de que
 * llegue aquí.
 */
export async function POST(request: Request) {
  const texto = await request.text();
  if (texto.length > 2000)
    return Response.json({ error: 'Pregunta demasiado larga.' }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const p = esquema.safeParse(json);
  if (!p.success) return Response.json({ error: 'Escribe una pregunta.' }, { status: 400 });
  try {
    return Response.json(await queServidor(p.data.pregunta, request.signal));
  } catch (error) {
    // Se lee en los logs de la función; la respuesta no da detalles del proveedor.
    console.error('preguntar', error);
    return Response.json(
      { error: 'No he podido comprobarlo ahora. Prueba otra vez en un rato.' },
      { status: 502 },
    );
  }
}
