import { experimental_decide as decide } from 'ai';
import { servers } from './catalog';

/**
 * Un modelo de decisión del AI Gateway: elige una opción, no escribe texto. En una prueba con 34
 * preguntas (noviembre de 2026) acertó todas, con unos 250 ms de mediana.
 */
const MODELO = 'typesafe-ai/jev';
/** Con menos probabilidad para la opción elegida, la respuesta es «quizá». */
const SEGURO = 0.6;
/** Cuando duda entre «ninguno» y algo, el servidor más probable se propone si llega a esto. */
const ALTERNATIVA = 0.2;
const NINGUNO = 'ninguno';

type Modelo = Parameters<typeof decide>[0]['model'];

/** Qué servidor de la biblioteca puede responder ya a una pregunta (`null`, ninguno). */
export async function queServidor(pregunta: string, signal: AbortSignal, model: Modelo = MODELO) {
  // Las opciones salen del catálogo: un servidor nuevo entra solo.
  const criteria: Record<string, string> = Object.fromEntries(
    (await servers()).map((s) => [
      s.id,
      `${s.name}: ${s.summary} Herramientas: ${s.tools.map((t) => t.title).join(', ')}.`,
    ]),
  );
  criteria[NINGUNO] = 'Ninguno de los servidores anteriores tiene los datos para responder.';
  const { answers } = await decide({
    model,
    state: `Pregunta: ${pregunta}`,
    questions: {
      servidor: {
        type: 'choice',
        instructions:
          'Una persona pregunta qué quiere saber. Elige el servidor de datos con el que un asistente puede responder ya su pregunta, o «ninguno» si ninguno tiene esos datos.',
        criteria,
      },
    },
    maxRetries: 1,
    abortSignal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  const { choice, probabilities } = answers.servidor;
  // Sin la distribución no se sabe cuánto duda: cuenta como duda, no como certeza.
  const probabilidad = (id: string) => probabilities?.[id] ?? 0;
  const seguro = probabilidad(choice) >= SEGURO;
  if (choice !== NINGUNO) return { servidor: choice, seguro };
  if (seguro) return { servidor: null, seguro };
  // Un «ninguno» dudoso no vacía la lista sin más: propone el servidor más probable, como «puede que».
  const [mejor] = Object.keys(criteria)
    .filter((id) => id !== NINGUNO)
    .sort((a, b) => probabilidad(b) - probabilidad(a));
  return mejor && probabilidad(mejor) >= ALTERNATIVA
    ? { servidor: mejor, seguro: false }
    : { servidor: null, seguro: false };
}
