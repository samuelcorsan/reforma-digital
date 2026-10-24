import { describe, expect, it } from 'vitest';
import example from '../apps/web/lib/elecciones/entrevistas/ejemplo.json';
import { interviewsOf, publish } from '../apps/web/lib/elecciones/interviews';
import { generateMetadata } from '../apps/web/app/(search)/elecciones/entrevistas/[[...path]]/page';
import sitemap from '../apps/web/app/sitemap';

const params = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('las entrevistas', () => {
  it('publica solo lo aprobado por una persona y con fuente, y cuenta lo pendiente', () => {
    const [first, second, third, ...rest] = example.revisiones;
    const raw = {
      ...example,
      revisiones: [
        { ...first, estado: 'propuesta' },
        { ...second, estado: 'descartada' },
        { ...third, fuentes: [{ titulo: 'Sin enlace', url: 'no es una url' }] },
        ...rest,
      ],
      momentos: example.momentos.map((m, i) => (i ? m : { ...m, estado: 'propuesta' })),
    };
    const a = publish(raw);
    expect(a.revisiones.map((r) => r.id)).toEqual(rest.map((r) => r.id));
    expect(a.momentos).toHaveLength(example.momentos.length - 1);
    expect(a.pending).toBe(2);
  });

  it('no mezcla la entrevista de ejemplo con los candidatos reales', async () => {
    expect(interviewsOf('ejemplo')).toEqual([]);
    const metadata = await generateMetadata(params(['ejemplo']));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('rechaza rutas inventadas e incluye los apartados en el sitemap', async () => {
    for (const path of [
      ['nadie'],
      ['metodologia', 'x'],
      ['pedro-sanchez', 'r1'],
      ['ejemplo', 'r99'],
    ])
      await expect(generateMetadata(params(path))).rejects.toThrow();
    const paths = sitemap().map(({ url }) => new URL(url).pathname);
    expect(paths).toContain('/elecciones/entrevistas');
    expect(paths).toContain('/elecciones/entrevistas/metodologia');
  });
});
