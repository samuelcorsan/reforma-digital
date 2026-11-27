import { createTraficoMcp } from '@reforma-digital/mcp';
import { openInBrowser } from '../../../lib/mcp/rutas';
import { contarUso } from '../../../lib/mcp/uso';

export const runtime = 'nodejs';

const mcp = createTraficoMcp();

export const POST = contarUso('trafico', (request) => mcp.fetch(request));
// Sin sesiones, GET no sirve a los clientes MCP: un navegador va a la ficha y el resto recibe 405.
export const GET = openInBrowser('trafico');
