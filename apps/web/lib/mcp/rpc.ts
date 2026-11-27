import { z } from 'zod';

const mensaje = z.object({
  result: z.looseObject({ isError: z.boolean().optional() }).optional(),
  error: z.object({ message: z.string() }).optional(),
});

/**
 * El mensaje JSON-RPC de una respuesta del SDK MCP. Aun con `responseMode: 'json'`, sin sesión puede
 * responder como evento SSE: el JSON va en la línea `data:`.
 */
export const mensajeRpc = (texto: string) =>
  mensaje.parse(JSON.parse(/^data: (.*)$/m.exec(texto)?.[1] ?? texto));
