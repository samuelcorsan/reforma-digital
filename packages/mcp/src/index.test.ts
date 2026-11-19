// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createCongresoMcp } from './index';

async function callTool(api: Parameters<typeof createCongresoMcp>[0], name: string, args: object) {
  const response = await createCongresoMcp(api).fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  const data = (await response.text()).match(/^data: (.*)$/m)?.[1];
  return JSON.parse(data ?? 'null').result;
}

it('asks the API for the matching path and query', async () => {
  const api = vi.fn(async () => Response.json({ id: 'v1' }));
  const result = await callTool(api, 'ver_votacion', { id: 'v1', legislatura: 'XIV' });
  expect(api).toHaveBeenCalledWith(
    ['votaciones', 'v1'],
    new URLSearchParams({ legislatura: 'XIV' }),
  );
  expect(result.isError).toBe(false);
  expect(result.content[0].text).toBe('{"id":"v1"}');
  expect(result.content[1].text).toContain('CC BY 4.0');
});

it('keeps dataset paths as segments for the API to validate', async () => {
  const api = vi.fn(async () => Response.json({ error: 'Encuestas ocultas' }, { status: 451 }));
  const result = await callTool(api, 'ver_conjunto', { ruta: 'encuestas/encuestas.json' });
  expect(api).toHaveBeenCalledWith(
    ['datasets', 'encuestas', 'encuestas.json'],
    new URLSearchParams(),
  );
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('Encuestas ocultas');
});
