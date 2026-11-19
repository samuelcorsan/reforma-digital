import { createCongresoMcp } from '@reforma-digital/mcp';
import { GET as congreso } from '../api/congreso/[[...path]]/route';

export const runtime = 'nodejs';

// Cada herramienta llama a la ruta de la API en el mismo proceso: no sale a internet ni pasa
// otra vez por el cortafuegos, y la API sigue siendo la única que valida y aplica la veda.
const mcp = createCongresoMcp((path, query) =>
  congreso(new Request(`http://localhost/api/congreso?${query}`), {
    params: Promise.resolve({ path }),
  }),
);

// Sin sesiones, GET y DELETE no tienen uso: Next responde 405 por sí solo.
export const POST = (request: Request) => mcp.fetch(request);
