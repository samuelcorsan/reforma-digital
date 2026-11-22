import { createCongresoMcp } from '@reforma-digital/mcp';
import { GET as congreso } from '../../api/congreso/[[...path]]/route';
import { openInBrowser } from '../../../lib/mcp/rutas';

export const runtime = 'nodejs';

// Cada herramienta llama a la ruta de la API en el mismo proceso: no sale a internet ni pasa
// otra vez por el cortafuegos, y la API sigue siendo la única que valida y aplica la veda.
const mcp = createCongresoMcp((path, query) =>
  congreso(new Request(`http://localhost/api/congreso?${query}`), {
    params: Promise.resolve({ path }),
  }),
);

export const POST = (request: Request) => mcp.fetch(request);
// Sin sesiones, GET no sirve a los clientes MCP: un navegador va a la ficha y el resto recibe 405.
export const GET = openInBrowser('congreso');
