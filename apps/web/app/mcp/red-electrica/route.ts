import { createRedElectricaMcp } from '@reforma-digital/mcp';
import { openInBrowser } from '../../../lib/mcp/rutas';
import { contarUso } from '../../../lib/mcp/uso';

export const runtime = 'nodejs';

const mcp = createRedElectricaMcp();

export const POST = contarUso('red-electrica', (request) => mcp.fetch(request));
// Sin sesiones, GET no sirve a los clientes MCP: un navegador va a la ficha y el resto recibe 405.
export const GET = openInBrowser('red-electrica');
