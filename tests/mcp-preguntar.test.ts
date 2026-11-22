import { describe, expect, it } from 'vitest';
import { queServidor } from '../apps/web/lib/mcp/preguntar';

/**
 * Qué servidor responde a una pregunta, con el catálogo real y un modelo de decisión de prueba que
 * cumple la interfaz del SDK: elige `choice` con el reparto dado, y lo que sobra va a partes iguales
 * a las demás opciones.
 */
function modelo(choice: string, reparto: Record<string, number>) {
  const vistas: string[][] = [];
  return {
    vistas,
    specificationVersion: 'v4' as const,
    provider: 'prueba',
    modelId: 'prueba',
    supportedQuestionTypes: ['choice' as const],
    doDecide: async ({
      questions,
    }: {
      questions: Readonly<Record<string, { criteria?: unknown }>>;
    }) => {
      const opciones = Object.keys(Object(questions.servidor?.criteria));
      vistas.push(opciones);
      const fijadas = Object.values(reparto);
      const resto = (1 - fijadas.reduce((a, b) => a + b, 0)) / (opciones.length - fijadas.length);
      return {
        answers: {
          servidor: {
            type: 'choice' as const,
            choice,
            probabilities: Object.fromEntries(opciones.map((o) => [o, reparto[o] ?? resto])),
          },
        },
        warnings: [],
      };
    },
  };
}

const pregunta = (m: ReturnType<typeof modelo>) =>
  queServidor('¿Qué es un gran tenedor?', new AbortController().signal, m);

describe('preguntar a la biblioteca MCP', () => {
  it('offers every catalog server and «ninguno», and says which one answers', async () => {
    const m = modelo('boe', { boe: 0.92 });
    expect(await pregunta(m)).toEqual({ servidor: 'boe', seguro: true });
    expect(m.vistas[0]).toEqual([
      'congreso',
      'renfe',
      'boe',
      'ine',
      'eustat',
      'carburantes',
      'alsa',
      'contratacion',
      'radioterapia',
      'ninguno',
    ]);
  });

  it('answers «maybe» when the model is unsure about a server', async () => {
    expect(await pregunta(modelo('boe', { boe: 0.4 }))).toEqual({ servidor: 'boe', seguro: false });
  });

  it('only says no server has the data when the model is sure of it', async () => {
    expect(await pregunta(modelo('ninguno', { ninguno: 0.9 }))).toEqual({
      servidor: null,
      seguro: true,
    });
    // Duda entre «ninguno» y el INE: el INE, como «puede que».
    expect(await pregunta(modelo('ninguno', { ninguno: 0.45, ine: 0.35 }))).toEqual({
      servidor: 'ine',
      seguro: false,
    });
    // Duda, pero ningún servidor destaca: ninguno, sin darlo por seguro.
    expect(await pregunta(modelo('ninguno', { ninguno: 0.5 }))).toEqual({
      servidor: null,
      seguro: false,
    });
  });
});
