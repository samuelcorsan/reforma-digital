import { afterEach, expect, it, vi } from 'vitest';
import { getContributors } from '../apps/web/app/(search)/equipo/contributors';

afterEach(() => vi.unstubAllGlobals());

it('muestra los perfiles humanos que devuelve GitHub fuera del core team', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json([
        { id: 120322525, login: 'samuelcorsan', type: 'User' },
        { id: 49699333, login: 'dependabot[bot]', type: 'Bot' },
        { id: 65485999, login: 'MrLolDev', type: 'User' },
        { id: 1, login: 'm33i', type: 'User' },
      ]),
    ),
  );
  expect(await getContributors()).toEqual([{ id: 1, login: 'm33i', type: 'User' }]);
});

it('distingue una lista vacía de una respuesta fallida o inválida', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        Response.json([{ id: 'https://otro-host.example', login: 'perfil', type: 'User' }]),
      )
      .mockRejectedValueOnce(new TypeError('fetch failed')),
  );
  expect(await getContributors()).toEqual([]);
  expect(await getContributors()).toBeNull();
  expect(await getContributors()).toBeNull();
  expect(await getContributors()).toBeNull();
});
