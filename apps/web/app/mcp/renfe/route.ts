import { createRenfeMcp } from '@reforma-digital/renfe';

export const runtime = 'nodejs';

const mcp = createRenfeMcp();

// Sin sesiones, GET y DELETE no tienen uso: Next responde 405 por sí solo.
export const POST = (request: Request) => mcp.fetch(request);
