import { after } from 'next/server';
import { z } from 'zod';
import { capturar } from '../posthog';
import { mensajeRpc } from './rpc';

const llamadaHerramienta = z.object({
  method: z.literal('tools/call'),
  params: z.object({ name: z.string() }),
});

/**
 * El POST de un servidor MCP, que cuenta cada llamada a una herramienta en PostHog: el servidor,
 * la herramienta, si falló y cuánto tardó. Nunca los argumentos, que pueden llevar direcciones o
 * referencias catastrales. Cada evento lleva su propio identificador, así que no se enlaza con
 * nada. Lo aplica `servidores.ts` a todos; por aquí pasan también las llamadas por URL
 * (`/mcp/<id>/<herramienta>`). Los lotes JSON-RPC, que la especificación ya no admite, no se
 * cuentan.
 */
export function contarUso(
  id: string,
  handler: (request: Request) => Promise<Response>,
  // `after` solo funciona dentro de una petición de Next; los tests pasan el suyo.
  programar: (tarea: () => Promise<void>) => void = after,
) {
  return async (request: Request) => {
    const clave = process.env.POSTHOG_KEY;
    if (!clave) return handler(request);
    const cuerpo: unknown = await request
      .clone()
      .json()
      .catch((error: unknown) => {
        // Un cuerpo que no es JSON lo rechaza el SDK; aquí solo no se cuenta.
        if (error instanceof SyntaxError) return undefined;
        throw error;
      });
    const llamada = llamadaHerramienta.safeParse(cuerpo);
    if (!llamada.success) return handler(request);
    const inicio = performance.now();
    const response = await handler(request);
    const duracionMs = Math.round(performance.now() - inicio);
    // Una notificación (202, sin cuerpo) o una petición que el SDK rechaza no llegó a la herramienta.
    if (response.status !== 200) return response;
    const copia = response.clone();
    programar(async () => {
      // Solo cuenta si la herramienta existe: una que no, responde un error JSON-RPC sin `result`, y
      // así un nombre inventado, que podría ser cualquier texto, no llega a PostHog.
      const { result } = mensajeRpc(await copia.text());
      if (!result) return;
      await capturar(clave, 'mcp_tool_call', crypto.randomUUID(), {
        servidor: id,
        herramienta: llamada.data.params.name,
        resultado: result.isError === true ? 'error' : 'ok',
        duracionMs,
      });
    });
    return response;
  };
}
