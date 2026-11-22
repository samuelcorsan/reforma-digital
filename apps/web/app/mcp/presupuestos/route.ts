import { createPresupuestosMcp } from '@reforma-digital/mcp';
import { openInBrowser } from '../../../lib/mcp/rutas';

export const runtime = 'nodejs';

const mcp = createPresupuestosMcp();

export const POST = (request: Request) => mcp.fetch(request);
// Sin sesiones, GET no sirve a los clientes MCP: un navegador va a la ficha y el resto recibe 405.
export const GET = openInBrowser('presupuestos');
