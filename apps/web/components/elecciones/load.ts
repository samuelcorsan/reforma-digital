import type { z } from 'zod';

// Un conjunto de datos publicado, desde el navegador, validado con su esquema.
export const load = async <T>(path: string, schema: z.ZodType<T>) => {
  const response = await fetch(`/api/congreso/datasets/${path}`);
  if (!response.ok) throw new Error(`No se ha podido cargar ${path}`);
  return schema.parse(await response.json());
};
