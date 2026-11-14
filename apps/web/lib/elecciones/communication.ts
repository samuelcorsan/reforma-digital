import { z } from 'zod';
import adaColau from './comunicacion/13n-ada-colau.json';
import albertoNunezFeijoo from './comunicacion/13n-alberto-nunez-feijoo.json';
import pedroSanchez from './comunicacion/13n-pedro-sanchez.json';
import { decimal } from './format';
import type { Mark } from './interviews';

// El análisis de comunicación de una entrevista: cómo se pregunta y se responde, la voz, las trabas,
// los silencios y los movimientos de la cara, con las mismas medidas para todos. Un JSON por
// entrevista en ./comunicacion/, con el mismo id que su entrevista (`<ronda>-<candidato>`). Los
// escribe apps/ingestion/entrevistas/comunicacion.py a partir de las medidas; aquí solo se validan.
// Ninguna de estas medidas sirve para saber si alguien dice la verdad.

const who = z.enum(['invitado', 'jordi']);
const hardness = z.enum(['insistencia', 'repregunta', 'incomoda', 'neutra', 'comoda']);
const reply = z.enum([
  'responde',
  'en_parte',
  'otra_pregunta',
  'ataca_pregunta',
  'cambia_tema',
  'sin_respuesta',
]);
const rapport = z.enum([
  'risa_o_broma',
  'roce',
  'halago',
  'acuerdo_explicito',
  'pregunta_devuelta',
  'anecdota_personal',
  'interrupcion_notable',
]);

// El texto del informe, en bloques. Dentro de un texto: **negrita**, *cursiva*, [enlaces](url) y
// minutos del vídeo (73:05), que la página enlaza.
const block = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('parrafo'), texto: z.string() }),
  z.object({ tipo: z.literal('subtitulo'), texto: z.string() }),
  z.object({ tipo: z.literal('lista'), ordenada: z.boolean(), items: z.array(z.string()) }),
  z.object({
    tipo: z.literal('tabla'),
    cabecera: z.array(z.string()),
    filas: z.array(z.array(z.string())),
  }),
]);
export type Block = z.infer<typeof block>;

// Lo medido de cada persona, con las mismas reglas para las dos.
const speaker = z.object({
  palabras: z.number(),
  // Su parte de las palabras de los dos, en %.
  parte: z.number(),
  minutos: z.number(),
  palabrasPorMinuto: z.number(),
  trabasPor100: z.number(),
  pausasPor1000: z.number(),
  // Fotogramas en los que sale su cara, en %: depende de la realización.
  pantalla: z.number(),
});

// En el orden en que salen en la página.
export const sectionIds = [
  'habla',
  'preguntas',
  'sintonia',
  'temas',
  'merito',
  'promesas',
  'trabas',
  'silencios',
  'voz',
  'cara',
  'datos',
  'momentos',
  'espectador',
] as const;

const schema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  // El tramo analizado, en segundos del vídeo: lo anterior es la introducción común.
  inicio: z.number(),
  fin: z.number(),
  titular: z.string(),
  entrada: z.array(z.string()).min(1),
  frase: z.string().nullable(),
  claves: z.array(z.string()),
  limites: z.array(z.string()),
  referencias: z.array(z.string()),
  secciones: z.partialRecord(z.enum(sectionIds), z.array(block)),
  habla: z.object({ invitado: speaker, jordi: speaker }),
  // Cada intervención del entrevistador que pide respuesta, y cómo se respondió.
  preguntas: z.array(
    z.object({
      // El número de la pregunta en la lectura (`c12`): lo usan las preguntas comunes de la ronda.
      id: z.string(),
      segundo: z.number(),
      tema: z.string(),
      texto: z.string(),
      dureza: hardness,
      respuesta: reply,
      // Si la respuesta propone algo propio, critica a otros, las dos cosas o ninguna.
      orientacion: z.enum(['propone', 'critica', 'ambas', 'ninguna']),
      // A quién critica la respuesta, si critica a alguien.
      aQuienCritica: z.array(z.string()),
      // Quién cierra el intercambio: el invitado o el entrevistador, con un corte o un comentario suyo.
      cierra: who,
    }),
  ),
  temas: z.array(z.object({ inicio: z.number(), fin: z.number(), tema: z.string(), quien: who })),
  // Los compromisos que recoge y cuántos tienen un objeto que se podrá comprobar.
  promesas: z.object({ total: z.number(), verificables: z.number() }),
  // Cada compromiso: verificable si tiene un objeto que se podrá comprobar (una cifra, una ley o una
  // decisión de sí o no), con su plazo y su condición si los dice.
  compromisos: z.array(
    z.object({
      segundo: z.number(),
      cita: z.string(),
      compromiso: z.string(),
      verificable: z.boolean(),
      plazo: z.string().nullable(),
      condicion: z.string().nullable(),
    }),
  ),
  // Los momentos de relación entre los dos, y quién inicia cada uno.
  sintonia: z.array(z.object({ tipo: rapport, quien: who })),
  // Del invitado: repeticiones y frases que se cortan, y pausas de más de 0,4 s.
  trabas: z.array(z.object({ segundo: z.number(), tipo: z.string(), contexto: z.string() })),
  pausas: z.array(z.object({ segundo: z.number(), duracion: z.number(), carga: z.boolean() })),
  // La intensidad de su voz minuto a minuto, respecto a su propia media (0). Sin frases, `null`.
  voz: z.array(z.number().nullable()),
  // La voz tras una pregunta dura frente al resto, con la misma definición para todos.
  presion: z.object({
    medidas: z.array(
      z.object({
        nombre: z.string(),
        unidad: z.string(),
        duras: z.number(),
        resto: z.number(),
        d: z.number(),
      }),
    ),
    trabasPor100: z.object({ duras: z.number(), resto: z.number() }),
  }),
  // Unidades de acción FACS: movimientos de la cara, nunca emociones. De cada persona, los
  // episodios por cada 10 minutos con su cara en pantalla.
  cara: z.array(
    z.object({ au: z.string(), nombre: z.string(), invitado: z.number(), jordi: z.number() }),
  ),
  // Donde coinciden varias señales. `cita`: lo que se oye en ese minuto.
  momentos: z.array(
    z.object({ segundo: z.number(), quien: who, titulo: z.string(), cita: z.string().nullable() }),
  ),
  // Los paquetes de datos para descargar, en /datos/comunicacion/<archivo>.
  datos: z.array(
    z.object({
      nombre: z.string(),
      archivo: z.string().regex(/^[a-z0-9-]+\.zip$/),
      bytes: z.number(),
      archivos: z.number(),
    }),
  ),
  publico: z
    .object({
      lectura: z.string(),
      vistas: z.number(),
      meGusta: z.number(),
      comentarios: z.number(),
      conMinuto: z.number(),
      citados: z.array(z.object({ segundo: z.number(), veces: z.number() })),
    })
    .nullable(),
});
export type Communication = z.infer<typeof schema>;
export type Question = Communication['preguntas'][number];

const analyses = [adaColau, albertoNunezFeijoo, pedroSanchez].map((raw) => schema.parse(raw));

// El apartado de una entrevista en el que vive: /elecciones/entrevistas/<entrevista>/comunicacion.
export const communicationPath = 'comunicacion';
export const getCommunication = (id: string) => analyses.find((c) => c.id === id);
export const allCommunication = () => analyses;

// De la que más aprieta a la que menos.
export const hardnessIds = hardness.options;
export const hardnessNames = {
  insistencia: 'Insistencia',
  repregunta: 'Repregunta',
  incomoda: 'Incómoda',
  neutra: 'Neutra',
  comoda: 'Cómoda',
} as const satisfies Record<z.infer<typeof hardness>, string>;
export const replyIds = reply.options;
export const replyNames = {
  responde: 'Responde a lo preguntado',
  en_parte: 'Responde en parte',
  otra_pregunta: 'Contesta a otra pregunta',
  ataca_pregunta: 'Ataca la pregunta',
  cambia_tema: 'Cambia de tema',
  sin_respuesta: 'No le dejan contestar',
} as const satisfies Record<z.infer<typeof reply>, string>;
export const rapportIds = rapport.options;
export const rapportNames = {
  risa_o_broma: 'Bromas',
  roce: 'Roces',
  halago: 'Halagos',
  acuerdo_explicito: 'Acuerdos explícitos',
  pregunta_devuelta: 'Preguntas devueltas',
  anecdota_personal: 'Anécdotas personales',
  interrupcion_notable: 'Interrupciones notables',
} as const satisfies Record<z.infer<typeof rapport>, string>;

// Una pregunta dura: incómoda, repregunta o insistencia.
export const isHard = (q: Question) => q.dureza !== 'neutra' && q.dureza !== 'comoda';

// Las cifras del titular: cuántas preguntas fueron duras y a cuántas de esas contestó.
export function pressure(c: Communication) {
  const hard = c.preguntas.filter(isHard);
  return {
    questions: c.preguntas.length,
    hard: hard.length,
    answered: hard.filter((q) => q.respuesta === 'responde').length,
  };
}

// Los minutos de cada tema, de más a menos.
export function topicMinutes(c: Communication) {
  const seconds = new Map<string, number>();
  for (const t of c.temas) seconds.set(t.tema, (seconds.get(t.tema) ?? 0) + t.fin - t.inicio);
  return [...seconds]
    .map(([topic, total]) => ({ topic, minutes: total / 60 }))
    .sort((x, y) => y.minutes - x.minutes);
}

// El plazo y la condición de un compromiso, si los dice: «Plazo: el primer año · Si gana con mayoría».
export const commitmentDetail = (x: Communication['compromisos'][number]) =>
  [x.plazo && `Plazo: ${x.plazo}`, x.condicion && `Condición: ${x.condicion}`]
    .filter(Boolean)
    .join(' · ') || 'Sin plazo ni condición';

// Una pausa larga: de un segundo o más, como las cuenta el análisis.
const longPause = 1;

// Lo que el análisis de comunicación pone en el minuto a minuto de la entrevista: las preguntas duras
// que no se contestan del todo, las pausas largas y las trabas, y los minutos que más cita el público.
export function communicationMarks(c: Communication): Mark[] {
  return [
    ...c.momentos.map((m, i) => ({
      id: `cm${i + 1}`,
      second: m.segundo,
      lane: 'momentos' as const,
      kind: 'momento' as const,
      label: m.quien === 'jordi' ? 'Momento clave · del entrevistador' : 'Momento clave',
      text: m.titulo,
      detail: m.cita ? `«${m.cita}»` : undefined,
    })),
    ...c.compromisos.map((x, i) => ({
      id: `cc${i + 1}`,
      second: x.segundo,
      lane: 'propuestas' as const,
      kind: x.verificable ? ('comprobable' as const) : ('compromiso' as const),
      label: x.verificable ? 'Compromiso comprobable' : 'Compromiso sin objeto comprobable',
      text: x.compromiso,
      detail: commitmentDetail(x),
    })),
    ...c.preguntas.flatMap((q, i) =>
      isHard(q) && q.respuesta !== 'responde'
        ? {
            id: `cq${i + 1}`,
            second: q.segundo,
            lane: 'preguntas' as const,
            kind: 'dura' as const,
            label: replyNames[q.respuesta],
            text: q.texto,
            detail: `Pregunta ${hardnessNames[q.dureza].toLowerCase()} · ${q.tema}`,
          }
        : [],
    ),
    ...c.pausas.flatMap((p, i) =>
      p.duracion >= longPause
        ? {
            id: `cp${i + 1}`,
            second: p.segundo,
            lane: 'pausas' as const,
            kind: 'pausa' as const,
            label: `Pausa de ${decimal(p.duracion)} s`,
            text: p.carga ? 'Antes de una frase con carga' : 'Un silencio largo en su respuesta',
          }
        : [],
    ),
    ...c.trabas.map((t, i) => ({
      id: `ct${i + 1}`,
      second: t.segundo,
      lane: 'trabas' as const,
      kind: 'traba' as const,
      label: `Traba: ${t.tipo}`,
      text: `«${t.contexto}»`,
    })),
    ...(c.publico?.citados ?? []).map((x, i) => ({
      id: `cv${i + 1}`,
      second: x.segundo,
      lane: 'comentados' as const,
      kind: 'comentado' as const,
      label: 'Lo más comentado',
      text: `${x.veces} comentarios de YouTube citan este minuto`,
    })),
  ];
}
