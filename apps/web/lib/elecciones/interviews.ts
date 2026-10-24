import { z } from 'zod';
import example from './entrevistas/ejemplo.json';

// Las entrevistas a los candidatos del 29N, revisadas con IA y confirmadas por una persona.
// El análisis sale del pipeline de El VAR Electoral: un JSON por entrevista en ./entrevistas/
// (`<ronda>-<candidato>.json`). Para publicar una, copia el JSON revisado ahí y añádelo a `files`.
const files: unknown[] = [example];

// `face`: el punto medio de los ojos y el tamaño de la cara en cada foto (fracciones de su alto,
// medidas con Vision en El VAR Electoral), para que las cuatro caras salgan igual de grandes.
// `adjust` corrige a ojo la medida automática. Las fotos son de Wikimedia Commons, recortadas del
// fondo y en blanco y negro.
export const candidates = [
  // De menos a más escaños en las generales de 2023, como el resto de la sección.
  {
    slug: 'ada-colau',
    name: 'Ada Colau',
    party: 'Frente Amplio',
    short: 'FA',
    color: '#D9701A',
    face: { x: 0.3978, y: 0.3206, size: 0.2269 },
    adjust: 1,
    credit: 'Robo71, CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Ada-Colau-Encuentro-2024.jpg',
  },
  {
    slug: 'santiago-abascal',
    name: 'Santiago Abascal',
    party: 'Vox',
    short: 'Vox',
    color: '#5BA83A',
    face: { x: 0.5356, y: 0.2839, size: 0.3125 },
    adjust: 1,
    credit: 'Gage Skidmore, CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Santiago_Abascal_(54349274173)_(cropped).jpg',
  },
  {
    slug: 'pedro-sanchez',
    name: 'Pedro Sánchez',
    party: 'PSOE',
    short: 'PSOE',
    color: '#D8342B',
    face: { x: 0.5252, y: 0.3156, size: 0.3086 },
    adjust: 1.08,
    credit: 'Pool Moncloa / Carlos Spottorno de las Morenas',
    source: 'https://commons.wikimedia.org/wiki/File:Pedro_S%C3%A1nchez_in_2026.jpg',
  },
  {
    slug: 'alberto-nunez-feijoo',
    name: 'Alberto Núñez Feijóo',
    party: 'Partido Popular',
    short: 'PP',
    color: '#2C7BC4',
    face: { x: 0.5086, y: 0.2541, size: 0.2122 },
    adjust: 1,
    credit: 'Partido Popular, CC0',
    source: 'https://commons.wikimedia.org/wiki/File:ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg',
  },
] as const;
export type Candidate = (typeof candidates)[number];

// Una ronda: las entrevistas a los cuatro que se publican y se revisan juntas.
export const rounds = [
  {
    id: '13n',
    title: 'The Wild Project',
    date: '2026-11-13',
    text: 'Jordi Wild entrevista a los cuatro candidatos por separado, sin preguntas pactadas y con dos periodistas comprobando datos en el plató. Se publican el mismo día.',
  },
] as const;

const verdict = z.enum(['legal', 'amarilla', 'fuera', 'roja']);
const criterion = z.enum([
  'veracidad',
  'alGrano',
  'concrecion',
  'sustancia',
  'juegoLimpio',
  'claridad',
]);
const answer = z.enum(['directa', 'parcial', 'evasiva', 'cambio']);
const moment = z.enum(['anuncio', 'choque', 'titular', 'rectificacion']);

export const criterionIds = criterion.options;

export const verdicts = {
  legal: { name: 'Cierto', text: 'Es verdad', color: '#2F7A4A' },
  amarilla: { name: 'Con matices', text: 'Impreciso o incompleto', color: 'var(--brand-yellow)' },
  fuera: { name: 'Engañoso', text: 'Fuera de contexto o engañoso', color: 'var(--brand-orange)' },
  roja: { name: 'Falso', text: 'Es falso', color: 'var(--brand)' },
} as const satisfies Record<z.infer<typeof verdict>, object>;

export const criteria = {
  veracidad: {
    name: 'Veracidad',
    weight: 25,
    text: 'Si lo que afirma es cierto, según fuentes oficiales',
  },
  alGrano: { name: 'Al grano', weight: 25, text: 'Si responde a lo que se le pregunta' },
  concrecion: {
    name: 'Concreción',
    weight: 20,
    text: 'Si sus propuestas dicen qué, cuánto, cuándo y cómo',
  },
  sustancia: {
    name: 'Sustancia',
    weight: 15,
    text: 'Tiempo en propuestas, datos y argumentos frente a relleno',
  },
  juegoLimpio: {
    name: 'Tono',
    weight: 10,
    text: 'Críticas argumentadas frente a descalificaciones',
  },
  claridad: { name: 'Claridad', weight: 5, text: 'Si se le entiende' },
} as const satisfies Record<z.infer<typeof criterion>, object>;

export const answers = {
  directa: 'Directa',
  parcial: 'Parcial',
  evasiva: 'Evasiva',
  cambio: 'Cambio de tema',
} as const satisfies Record<z.infer<typeof answer>, string>;

export const moments = {
  anuncio: {
    name: 'Anuncio',
    text: 'Dice algo nuevo: una medida, un compromiso o un dato que no había contado',
  },
  choque: {
    name: 'Choque',
    text: 'Tensión con el entrevistador o una pregunta incómoda que marca la entrevista',
  },
  titular: { name: 'Titular', text: 'La frase que mejor resume su postura en un tema' },
  rectificacion: { name: 'Rectificación', text: 'Reconoce un error, matiza o cambia de postura' },
} as const satisfies Record<z.infer<typeof moment>, object>;

// La IA propone y una persona aprueba o descarta. Sin estado, el pipeline lo da por aprobado.
const state = z.enum(['propuesta', 'aprobada', 'descartada']).default('aprobada');
const source = z.object({ titulo: z.string(), url: z.string() });

const interviewSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  jornada: z.string().optional(),
  entrevista: z
    .object({ entrevistador: z.string(), medio: z.string(), programa: z.string().optional() })
    .nullish(),
  candidato: z.string(),
  titulo: z.string(),
  youtubeId: z.string().nullable(),
  publicado: z.string(),
  duracion: z.number(),
  ficticio: z.boolean().optional(),
  nota: z.object({
    global: z.number(),
    margen: z.number(),
    criterios: z.record(criterion, z.number()),
  }),
  stats: z.object({ alGrano: z.number() }),
  // La transcripción: quién habla y de qué segundo a qué segundo.
  segmentos: z.array(
    z.object({
      inicio: z.number(),
      fin: z.number(),
      hablante: z.enum(['jordi', 'candidato', 'verificador', 'otro']),
      texto: z.string(),
    }),
  ),
  temas: z.array(z.object({ tema: z.string(), inicio: z.number(), fin: z.number() })),
  preguntas: z.array(
    z.object({
      id: z.string(),
      segundo: z.number(),
      texto: z.string(),
      respuesta: answer,
      repregunta: z.boolean().optional(),
    }),
  ),
  propuestas: z.array(
    z.object({
      id: z.string(),
      segundo: z.number(),
      texto: z.string(),
      que: z.boolean(),
      cuanto: z.boolean(),
      cuando: z.boolean(),
      como: z.boolean(),
    }),
  ),
  ataques: z.array(
    z.object({
      id: z.string(),
      segundo: z.number(),
      objetivo: z.string(),
      tipo: z.enum(['politica', 'personal']),
      texto: z.string(),
    }),
  ),
  revisiones: z.array(
    z.object({
      id: z.string(),
      segundo: z.number(),
      cita: z.string(),
      veredicto: verdict,
      explicacion: z.string(),
      fuentes: z.array(source),
      pilladoEnDirecto: z.boolean().optional(),
      estado: state,
    }),
  ),
  // Quién corta al otro antes de que termine: el candidato o el entrevistador.
  interrupciones: z
    .array(z.object({ segundo: z.number(), quien: z.enum(['candidato', 'jordi']) }))
    .default([]),
  momentos: z
    .array(
      z.object({
        id: z.string(),
        segundo: z.number(),
        tipo: moment,
        titulo: z.string(),
        cita: z.string(),
        porQue: z.string(),
        estado: state,
      }),
    )
    .default([]),
});

// Una fuente publicable: título y enlace http(s).
const validSource = (f: z.infer<typeof source>) =>
  f.titulo.trim().length > 0 && /^https?:\/\/\S+\.\S+/.test(f.url);

// Lo que se publica de una entrevista: solo las verificaciones aprobadas por una persona y con al
// menos una fuente, y los momentos aprobados. Lo que la IA propuso y nadie ha revisado cuenta como
// pendiente: mientras quede algo, el informe es provisional.
export function publish(raw: unknown) {
  const a = interviewSchema.parse(raw);
  const id = a.id ?? `${a.jornada}-${a.candidato}`;
  return {
    ...a,
    id,
    revisiones: a.revisiones.filter((r) => r.estado === 'aprobada' && r.fuentes.some(validSource)),
    momentos: a.momentos.filter((m) => m.estado === 'aprobada'),
    pending: [...a.revisiones, ...a.momentos].filter((x) => x.estado === 'propuesta').length,
  };
}
export type Interview = ReturnType<typeof publish>;

const interviews = files.map(publish);

export const getInterview = (id: string) => interviews.find((a) => a.id === id);
export const getCandidate = (slug: string) => candidates.find((c) => c.slug === slug);
// El nombre del candidato, o el título de la entrevista de ejemplo.
export const interviewName = (a: Interview) => getCandidate(a.candidato)?.name ?? a.titulo;
// Las de un candidato real, de la más reciente a la más antigua. La de ejemplo nunca aparece aquí.
export const interviewsOf = (slug: string) =>
  interviews
    .filter((a) => !a.ficticio && a.candidato === slug)
    .sort((x, y) => y.publicado.localeCompare(x.publicado));

// Lo que se marca en la línea de tiempo, con reglas fijas e iguales para los cuatro: ninguna marca
// la decide el modelo por su cuenta.
export const lanes = {
  momentos: 'Momentos clave',
  propuestas: 'Propuestas',
  verificaciones: 'Verificaciones',
  preguntas: 'Repreguntas y evasivas',
  criticas: 'Críticas e interrupciones',
} as const;
export type Mark = {
  id: string;
  second: number;
  lane: keyof typeof lanes;
  kind:
    | 'momento'
    | 'completa'
    | 'casi'
    | z.infer<typeof verdict>
    | 'repregunta'
    | 'evasiva'
    | 'critica'
    | 'ataque'
    | 'interrumpe'
    | 'interrumpido';
  label: string;
  text: string;
  detail?: string;
  color?: string;
};

const missing = {
  que: 'el qué',
  cuanto: 'el cuánto',
  cuando: 'el cuándo',
  como: 'el cómo',
} as const;

export function marks(a: Interview): Mark[] {
  const list: Mark[] = [
    ...a.momentos.map((m) => ({
      id: m.id,
      second: m.segundo,
      lane: 'momentos' as const,
      kind: 'momento' as const,
      label: moments[m.tipo].name,
      text: m.titulo,
      detail: `«${m.cita}»`,
    })),
    ...a.propuestas.flatMap((p) => {
      const score = proposalScore(p);
      if (score < 3) return [];
      const lacks = (['que', 'cuanto', 'cuando', 'como'] as const).find((k) => !p[k]);
      return {
        id: p.id,
        second: p.segundo,
        lane: 'propuestas' as const,
        kind: lacks ? ('casi' as const) : ('completa' as const),
        label: lacks ? 'Casi completa' : 'Propuesta completa',
        text: p.texto,
        detail: lacks ? `Le falta ${missing[lacks]}` : 'Qué, cuánto, cuándo y cómo',
      };
    }),
    ...a.revisiones.map((r) => ({
      id: r.id,
      second: r.segundo,
      lane: 'verificaciones' as const,
      kind: r.veredicto,
      label: verdicts[r.veredicto].name,
      text: `«${r.cita}»`,
      detail: r.explicacion,
      color: verdicts[r.veredicto].color,
    })),
    ...a.preguntas.flatMap((p) =>
      p.repregunta
        ? {
            id: p.id,
            second: p.segundo,
            lane: 'preguntas' as const,
            kind: 'repregunta' as const,
            label: 'Repregunta',
            text: p.texto,
            detail: `Respuesta: ${answers[p.respuesta].toLowerCase()}`,
          }
        : p.respuesta === 'evasiva' || p.respuesta === 'cambio'
          ? {
              id: p.id,
              second: p.segundo,
              lane: 'preguntas' as const,
              kind: 'evasiva' as const,
              label: answers[p.respuesta],
              text: p.texto,
            }
          : [],
    ),
    ...a.ataques.map((x) => ({
      id: x.id,
      second: x.segundo,
      lane: 'criticas' as const,
      kind: x.tipo === 'personal' ? ('ataque' as const) : ('critica' as const),
      label: x.tipo === 'personal' ? 'Ataque personal' : 'Crítica política',
      text: `«${x.texto}»`,
      detail: `A ${x.objetivo}`,
    })),
    ...a.interrupciones.map((x, i) => ({
      id: `i${i + 1}`,
      second: x.segundo,
      lane: 'criticas' as const,
      kind: x.quien === 'candidato' ? ('interrumpe' as const) : ('interrumpido' as const),
      label: x.quien === 'candidato' ? 'Interrumpe' : 'Le interrumpen',
      text:
        x.quien === 'candidato'
          ? 'Corta a quien habla antes de que termine'
          : 'El entrevistador le corta antes de que termine',
    })),
  ];
  return list.sort((x, y) => x.second - y.second);
}

// Las entrevistas de una ronda, por candidato. Solo las reales.
export const roundInterviews = (round: string) =>
  candidates.map((c) => ({
    candidate: c,
    interview: interviews.find((a) => !a.ficticio && a.jornada === round && a.candidato === c.slug),
  }));

// Qué parte del tiempo hablado es de quien se pida, en %.
export function speakingShare(a: Interview, who: Interview['segmentos'][number]['hablante']) {
  const time = (list: Interview['segmentos']) => list.reduce((t, s) => t + s.fin - s.inicio, 0);
  const total = time(a.segmentos);
  return total
    ? Math.round((time(a.segmentos.filter((s) => s.hablante === who)) / total) * 100)
    : 0;
}

export const proposalScore = (p: Interview['propuestas'][number]) =>
  +p.que + +p.cuanto + +p.cuando + +p.como;

// Porcentaje del tiempo de la entrevista por tema, de mayor a menor.
export function topicShare(a: Interview) {
  const total = new Map<string, number>();
  for (const t of a.temas) total.set(t.tema, (total.get(t.tema) ?? 0) + t.fin - t.inicio);
  return [...total]
    .map(([topic, seconds]) => ({ topic, share: Math.round((seconds / a.duracion) * 100) }))
    .sort((x, y) => y.share - x.share);
}

export const videoUrl = (a: Interview, second = 0) =>
  a.youtubeId &&
  `https://www.youtube.com/watch?v=${a.youtubeId}${second ? `&t=${Math.floor(second)}s` : ''}`;
