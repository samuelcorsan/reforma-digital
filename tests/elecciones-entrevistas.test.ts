import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import example from '../apps/web/lib/elecciones/entrevistas/ejemplo.json';
import {
  intensityScale,
  interviewsOf,
  perMinute,
  publish,
  publishedOn,
  speech,
} from '../apps/web/lib/elecciones/interviews';
import { generateMetadata } from '../apps/web/app/(search)/elecciones/entrevistas/[[...path]]/page';
import sitemap from '../apps/web/app/sitemap';
import { candidates } from '../apps/web/lib/elecciones/candidates';

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
      ['comparar', 'x'],
      ['verificaciones', 'x'],
      ['pedro-sanchez', 'r1'],
      ['ejemplo', 'r99'],
    ])
      await expect(generateMetadata(params(path))).rejects.toThrow();
    const paths = sitemap().map(({ url }) => new URL(url).pathname);
    expect(paths).toContain('/elecciones/entrevistas');
    expect(paths).toContain('/elecciones/entrevistas/metodologia');
    expect(paths).toContain('/elecciones/entrevistas/comparar');
    expect(paths).toContain('/elecciones/entrevistas/verificaciones');
  });

  it('comparte cada candidato con su imagen, generada con pnpm landing:og', async () => {
    for (const c of candidates) {
      const { openGraph } = await generateMetadata(params([c.slug]));
      const image = `/og/entrevistas-${c.slug}.jpg`;
      expect(JSON.stringify(openGraph?.images)).toContain(image);
      expect(existsSync(new URL(`../apps/web/public${image}`, import.meta.url))).toBe(true);
    }
  });

  it('acepta entrevistas sin fecha de publicación, como las de RTVE Play', () => {
    expect(publishedOn(publish({ ...example, publicado: '' }))).toBeNull();
    expect(publishedOn(publish(example))).toBe('13 de noviembre de 2026');
  });

  // Una entrevista mínima: sin preguntas, marcas ni silencios, para contar a mano.
  const quiet = {
    ...example,
    duracion: 180,
    preguntas: [],
    propuestas: [],
    ataques: [],
    revisiones: [],
    momentos: [],
    interrupciones: [],
    silencios: [],
  };

  it('mide la intensidad de cada minuto: turnos, 3 × interrupciones y 2 × tensión', () => {
    const [verification] = example.revisiones;
    const a = publish({
      ...quiet,
      segmentos: [
        { inicio: 0, fin: 30, hablante: 'jordi', texto: '¿Qué hará con la vivienda?' },
        {
          inicio: 31,
          fin: 90,
          hablante: 'candidato',
          texto: 'Construiremos cien mil pisos públicos al año.',
        },
        // Un cambio de turno de menos de cuatro palabras no suma.
        { inicio: 90, fin: 92, hablante: 'jordi', texto: 'Ya.' },
      ],
      interrupciones: [{ segundo: 70, quien: 'jordi' }],
      revisiones: [{ ...verification, segundo: 150, veredicto: 'roja', estado: 'aprobada' }],
    });
    expect(perMinute(a)).toEqual([
      { start: 0, candidate: 29, interviewer: 30, intensity: 1 / intensityScale },
      { start: 60, candidate: 30, interviewer: 2, intensity: 3 / intensityScale },
      { start: 120, candidate: 0, interviewer: 0, intensity: 2 / intensityScale },
    ]);
  });

  it('cuenta muletillas, titubeos y la pausa antes de responder', () => {
    const a = publish({
      ...quiet,
      segmentos: [
        { inicio: 0, fin: 10, hablante: 'jordi', texto: '¿Y la vivienda?' },
        {
          inicio: 12,
          fin: 72,
          hablante: 'candidato',
          texto: 'Eh, pues, o sea, la la vivienda es clave, ¿no?',
        },
      ],
      silencios: [[10, 12]],
    });
    expect(speech(a)).toEqual({
      pace: 10,
      fillers: 3,
      stutters: 1,
      pause: 2,
      top: [
        ['eh', 1],
        ['o sea', 1],
        ['¿no?', 1],
      ],
    });
  });
});
