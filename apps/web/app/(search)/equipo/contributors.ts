import { z } from 'zod';
import { links } from '../../../lib/site';

const contributorsSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    login: z.string().min(1).max(100),
    type: z.string(),
  }),
);

export const coreTeam = [
  { name: 'Leo', login: 'mrloldev', id: 65485999 },
  { name: 'Samu', login: 'samuelcorsan', id: 120322525 },
  { name: 'Pablo', login: 'pdepablocom', id: 262992558 },
  { name: 'Roger', login: 'rogerkernel', id: 45967941 },
];

const coreLogins = new Set(coreTeam.map(({ login }) => login.toLowerCase()));

export async function getContributors() {
  try {
    // Hasta 100 perfiles en esta vista; el enlace a GitHub permite consultar la lista completa.
    const response = await fetch(
      `https://api.github.com/repos${new URL(links.repo).pathname}/contributors?per_page=100`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return null;
    if (response.status === 204) return [];
    const parsed = contributorsSchema.safeParse(await response.json());
    return parsed.success
      ? parsed.data.filter(
          ({ type, login }) => type === 'User' && !coreLogins.has(login.toLowerCase()),
        )
      : null;
  } catch (error) {
    // Sin conexión, GitHub tarda más de 5 s o no responde JSON: la página sale sin la lista.
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      (error instanceof DOMException && error.name === 'TimeoutError')
    )
      return null;
    throw error;
  }
}
