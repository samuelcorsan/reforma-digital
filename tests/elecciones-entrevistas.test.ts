import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import example from '../apps/web/lib/elecciones/entrevistas/ejemplo.json';
import {
  allVerifications,
  cancelledRound,
  intensityScale,
  interviewsOf,
  marks,
  perMinute,
  publish,
  pendingRound,
  publishedOn,
  roundInterviews,
  speech,
} from '../apps/web/lib/elecciones/interviews';
import { generateMetadata } from '../apps/web/app/(search)/elecciones/entrevistas/[[...path]]/page';
import sitemap from '../apps/web/app/sitemap';
import { candidates } from '../apps/web/lib/elecciones/candidates';

const params = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('las entrevistas', () => {
  it('publica lo que no se ha descartado, avisa de lo que no se ha revisado y exige fuente', () => {
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
    expect(a.revisiones.map((r) => r.id)).toEqual([first.id, ...rest.map((r) => r.id)]);
    expect(a.momentos).toHaveLength(example.momentos.length);
    expect(a.pending).toBe(2);
    expect(a.review).toEqual({
      reviewed: example.revisiones.length - 3 + example.momentos.length - 1,
      total: example.revisiones.length - 2 + example.momentos.length,
    });
    const unreviewed = marks(a).filter((m) => m.provisional);
    expect(unreviewed.map((m) => m.id).sort()).toEqual([first.id, example.momentos[0]?.id].sort());
    expect(unreviewed.every((m) => m.label.endsWith('· sin revisar'))).toBe(true);
  });

  it('publica sin fuentes lo que no tiene ninguna, como «Sin fuente»', () => {
    const [first, ...rest] = example.revisiones;
    const a = publish({
      ...example,
      revisiones: [{ ...first, veredicto: 'sinfuente', fuentes: [] }, ...rest],
    });
    expect(a.revisiones.map((r) => r.id)).toContain(first.id);
    const unsourced = marks(a).find((m) => m.id === first.id);
    expect(unsourced?.label).toBe('Sin fuente');
  });

  it('publica solo las fuentes válidas de cada verificación', () => {
    const [first, ...rest] = example.revisiones;
    const valid = first.fuentes[0];
    const a = publish({
      ...example,
      revisiones: [{ ...first, fuentes: [valid, { titulo: '', url: 'no es una url' }] }, ...rest],
    });
    expect(a.revisiones.find((r) => r.id === first.id)?.fuentes).toEqual([valid]);
  });

  it('deja la entrevista de ejemplo fuera de la lista de todas las verificaciones', () => {
    expect(allVerifications().filter(({ interview }) => interview.ficticio)).toEqual([]);
  });

  it('pone todas las propuestas en la línea de tiempo, con lo que les falta', () => {
    const a = publish({
      ...example,
      propuestas: [
        { id: 'p1', segundo: 10, texto: 'x', que: true, cuanto: true, cuando: true, como: true },
        { id: 'p2', segundo: 20, texto: 'y', que: true, cuanto: true, cuando: false, como: true },
        { id: 'p3', segundo: 30, texto: 'z', que: true, cuanto: false, cuando: false, como: false },
      ],
    });
    expect(
      marks(a)
        .filter((m) => m.lane === 'propuestas')
        .map((m) => [m.kind, m.detail]),
    ).toEqual([
      ['completa', 'Dice qué, cuánto, cuándo y cómo'],
      ['casi', 'Le falta el cuándo'],
      ['incompleta', 'Le falta el cuánto, el cuándo y el cómo'],
    ]);
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

  it('no espera la entrevista cancelada de Abascal en el 13N', () => {
    expect(pendingRound('santiago-abascal')).toBeUndefined();
    expect(cancelledRound('santiago-abascal')?.id).toBe('13n');
    expect(
      roundInterviews('13n')
        .filter((e) => e.cancelled)
        .map((e) => e.candidate.slug),
    ).toEqual(['santiago-abascal']);
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
