import { z } from 'zod';
import { longDate } from './format';
import { candidates, type Candidate } from './candidates';
import { getCommunication, isHard } from './communication';
import { commonFiles, files } from './entrevistas';

// Las entrevistas a los candidatos del 29N, analizadas y revisadas con IA. Las publica el pipeline de
// apps/ingestion/entrevistas: un JSON por entrevista en ./entrevistas/ (`<ronda>-<candidato>.json`),
// las preguntas comunes de cada ronda (`comunes-<ronda>.json`) y su alta en ./entrevistas/index.ts,
// que genera él.

// Una ronda: una entrevista larga a cada uno de los cuatro, en un medio nacional, que se revisan
// juntas. Puede ser el mismo programa para los cuatro o medios distintos; solo las `comparable`
// (mismo formato y quien entrevista) se ponen lado a lado. `note` explica por qué una no lo es.
type Round = {
  id: string;
  title: string;
  date: string;
  text: string;
  comparable: boolean;
  note?: string;
  // Los candidatos cuya entrevista de esta ronda se canceló.
  cancelled?: Candidate['slug'][];
};
export const rounds: Round[] = [
  {
    id: '13n',
    title: 'The Wild Project',
    date: '2026-11-13',
    text: 'Jordi Wild entrevista a los candidatos por separado, sin preguntas pactadas y con dos periodistas comprobando datos en el plató. Se publican el mismo día.',
    comparable: true,
    cancelled: ['santiago-abascal'],
  },
];

// `sinfuente`: nada encontrado la confirma ni la desmiente. Se publica sin calificar y no cuenta en la nota.
const verdict = z.enum(['legal', 'amarilla', 'fuera', 'roja', 'sinfuente']);
const criterion = z.enum([
  'veracidad',
  'alGrano',
  'concrecion',
  'propone',
  'sustancia',
  'juegoLimpio',
  'claridad',
]);
const answer = z.enum(['directa', 'parcial', 'evasiva', 'cambio']);
const moment = z.enum(['anuncio', 'choque', 'titular', 'rectificacion']);

export const criterionIds = criterion.options;
export const verdictIds = verdict.options;
export const answerIds = answer.options;
export const visualIds = ['verificador', 'rotulo', 'documento', 'accion'] as const;

export const verdicts = {
  legal: { name: 'Cierto', text: 'Es verdad', color: '#2F7A4A' },
  amarilla: {
    name: 'Con matices',
    text: 'Es verdad a medias: impreciso, exagerado o incompleto',
    color: 'var(--brand-yellow)',
  },
  fuera: {
    name: 'Engañoso',
    text: 'Saca el dato de contexto o lleva a engaño',
    color: 'var(--brand-orange)',
  },
  roja: { name: 'Falso', text: 'Es falso', color: 'var(--brand)' },
  sinfuente: {
    name: 'Sin fuente',
    text: 'Ninguna fuente lo confirma ni lo desmiente',
    color: 'var(--muted-foreground)',
  },
} as const satisfies Record<z.infer<typeof verdict>, object>;

export const criteria = {
  veracidad: {
    name: 'Veracidad',
    weight: 25,
    text: 'Si lo que afirma es cierto, según fuentes oficiales',
  },
  alGrano: {
    name: 'Al grano',
    weight: 20,
    text: 'Si responde a lo que se le pregunta; contestar a una pregunta dura cuenta el doble',
  },
  concrecion: {
    name: 'Concreción',
    weight: 15,
    text: 'Si sus compromisos se podrán comprobar (una cifra, una ley o un sí o un no) y si dicen cuándo',
  },
  propone: {
    name: 'Propone',
    weight: 10,
    text: 'Respuestas que proponen algo propio frente a las que solo critican a otros',
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

export const visuals = {
  verificador: {
    name: 'Verificadores en plató',
    text: 'Los verificadores aparecen o el entrevistador les pide comprobar un dato',
  },
  rotulo: { name: 'En pantalla', text: 'Rótulos, gráficos o cifras sobreimpresos en el vídeo' },
  documento: {
    name: 'Lo enseña',
    text: 'Alguien muestra a cámara un papel, un gráfico u otro objeto',
  },
  accion: {
    name: 'Acción',
    text: 'Algo físico y concreto: consulta sus notas, se levanta, señala un gráfico',
  },
} as const;

// La segunda revisión de IA aprueba o descarta lo que propone la verificación. Sin estado, se da por
// aprobado.
const state = z.enum(['propuesta', 'aprobada', 'descartada']).default('aprobada');
const source = z.object({ titulo: z.string(), url: z.string() });

const interviewSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  jornada: z.string().optional(),
  entrevista: z
    .object({
      entrevistador: z.string(),
      medio: z.string(),
      programa: z.string().optional(),
      // El vídeo original, también cuando no está en YouTube.
      url: z.string().optional(),
    })
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
    // «Propone» solo existe si la entrevista tiene análisis de comunicación.
    criterios: z.partialRecord(criterion, z.number()),
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
      // Si es una de las preguntas que se hicieron a los cuatro.
      comun: z.boolean().optional(),
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
      // La segunda revisión: la de IA o, si su nota empieza por «Revisión a mano», la de una persona.
      // `sugerencia`: la calificación que tenía antes, si se corrigió.
      segundaRevision: z
        .object({ sugerencia: verdict.nullable(), fuentesOk: z.boolean(), nota: z.string() })
        .nullable()
        .optional(),
      estado: state,
    }),
  ),
  // Lo que solo se ve en el vídeo: hechos observables, nunca gestos ni aspecto.
  visuales: z
    .array(
      z.object({
        segundo: z.number(),
        tipo: z.enum(['verificador', 'rotulo', 'documento', 'accion']),
        descripcion: z.string(),
      }),
    )
    .default([]),
  // Silencios reales del audio [inicio, fin], para medir la pausa antes de responder.
  silencios: z.array(z.tuple([z.number(), z.number()])).default([]),
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

// Lo que se publica de una entrevista: todo menos lo que la segunda revisión de IA ha descartado, y
// las verificaciones calificadas, solo con al menos una fuente (las «Sin fuente», sin ella). Lo que
// aún no ha pasado por ella sale como
// provisional (`estado: 'propuesta'`) y cuenta como pendiente: mientras quede algo, el informe y su
// valoración son provisionales.
export function publish(raw: unknown) {
  const a = interviewSchema.parse(raw);
  const id = a.id ?? `${a.jornada}-${a.candidato}`;
  // De cada verificación, solo las fuentes con título y enlace web: las demás no se pintan.
  const revisiones = a.revisiones
    .map((r) => ({ ...r, fuentes: r.fuentes.filter(validSource) }))
    .filter(
      (r) => r.estado !== 'descartada' && (r.veredicto === 'sinfuente' || r.fuentes.length > 0),
    );
  const momentos = a.momentos.filter((m) => m.estado !== 'descartada');
  // Cuánto de lo publicado ha pasado ya la segunda revisión.
  const total = revisiones.length + momentos.length;
  const reviewed = [...revisiones, ...momentos].filter((x) => x.estado === 'aprobada').length;
  return {
    ...a,
    id,
    revisiones,
    momentos,
    review: { reviewed, total },
    pending: total - reviewed,
  };
}
export type Interview = ReturnType<typeof publish>;

const interviews = files.map(publish);

export const getInterview = (id: string) => interviews.find((a) => a.id === id);
// Todas las verificaciones publicadas de candidatos reales (la entrevista de ejemplo nunca entra): de
// la más reciente a la más antigua y, dentro de cada una, en el orden en que se dijeron.
export const allVerifications = () =>
  interviews
    .filter((a) => !a.ficticio)
    .sort((x, y) => y.publicado.localeCompare(x.publicado))
    .flatMap((interview) =>
      interview.revisiones.map((verification) => ({ interview, verification })),
    );
// Si una persona la revisó a mano después de la IA.
export const handReviewed = (r: Interview['revisiones'][number]) =>
  !!r.segundaRevision?.nota.startsWith('Revisión a mano');
// El tema que suena en el segundo de una verificación.
export const topicAt = (a: Interview, second: number) =>
  topicsOf(a).find((t) => t.inicio <= second && second < t.fin)?.tema;
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
  plato: 'En plató',
} as const;
// Los carriles que salen del análisis de comunicación, si la entrevista lo tiene. Sus momentos, sus
// compromisos y sus preguntas sustituyen a los del análisis.
export const communicationLanes = {
  propuestas: 'Compromisos',
  preguntas: 'Preguntas duras sin respuesta clara',
  pausas: 'Pausas de un segundo o más',
  trabas: 'Trabas',
  comentados: 'Lo más comentado',
} as const;
export type Mark = {
  id: string;
  second: number;
  lane: keyof typeof lanes | keyof typeof communicationLanes;
  kind:
    | 'momento'
    | 'completa'
    | 'casi'
    | 'incompleta'
    | z.infer<typeof verdict>
    | 'repregunta'
    | 'evasiva'
    | 'critica'
    | 'ataque'
    | 'interrumpe'
    | 'interrumpido'
    | keyof typeof visuals
    | 'comprobable'
    | 'compromiso'
    | 'dura'
    | 'pausa'
    | 'traba'
    | 'comentado';
  label: string;
  text: string;
  detail?: string;
  color?: string;
  // Propuesto por la IA y sin revisar todavía.
  provisional?: boolean;
};

const missing = {
  que: 'el qué',
  cuanto: 'el cuánto',
  cuando: 'el cuándo',
  como: 'el cómo',
} as const;

// La etiqueta de lo que la IA propuso y nadie ha revisado todavía.
export const unreviewed = (label: string, estado: string) =>
  estado === 'propuesta' ? `${label} · sin revisar` : label;

// Cómo de completa es una propuesta: dice qué, cuánto, cuándo y cómo (completa), tres de esas
// cuatro cosas (casi completa) o menos (incompleta). Todas se publican, con lo que les falta.
export const proposalKinds = {
  completa: 'Propuesta completa',
  casi: 'Casi completa',
  incompleta: 'Propuesta incompleta',
} as const;
export const proposalKind = (p: Interview['propuestas'][number]): keyof typeof proposalKinds => {
  const score = proposalScore(p);
  return score === 4 ? 'completa' : score === 3 ? 'casi' : 'incompleta';
};
// «Le falta el cuándo y el cómo», o qué dice si no le falta nada.
export function lacking(p: Interview['propuestas'][number]) {
  const lacks = (['que', 'cuanto', 'cuando', 'como'] as const)
    .filter((k) => !p[k])
    .map((k) => missing[k]);
  const last = lacks.pop();
  if (!last) return 'Dice qué, cuánto, cuándo y cómo';
  return `Le falta ${lacks.length ? `${lacks.join(', ')} y ${last}` : last}`;
}

export function marks(a: Interview): Mark[] {
  const list: Mark[] = [
    ...a.momentos.map((m) => ({
      id: m.id,
      second: m.segundo,
      lane: 'momentos' as const,
      kind: 'momento' as const,
      label: unreviewed(moments[m.tipo].name, m.estado),
      text: m.titulo,
      detail: `«${m.cita}»`,
      provisional: m.estado === 'propuesta',
    })),
    ...a.propuestas.map((p) => {
      const kind = proposalKind(p);
      return {
        id: p.id,
        second: p.segundo,
        lane: 'propuestas' as const,
        kind,
        label: proposalKinds[kind],
        text: p.texto,
        detail: lacking(p),
      };
    }),
    ...a.revisiones.map((r) => ({
      id: r.id,
      second: r.segundo,
      lane: 'verificaciones' as const,
      kind: r.veredicto,
      label: unreviewed(verdicts[r.veredicto].name, r.estado),
      text: `«${r.cita}»`,
      detail: r.explicacion,
      color: verdicts[r.veredicto].color,
      provisional: r.estado === 'propuesta',
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
    ...a.visuales.map((v, i) => ({
      id: `v${i + 1}`,
      second: v.segundo,
      lane: 'plato' as const,
      kind: v.tipo,
      label: visuals[v.tipo].name,
      text: v.descripcion,
    })),
  ];
  return list.sort((x, y) => x.second - y.second);
}

// Dónde se publicó («Cadena SER · Hoy por Hoy») y quién entrevista, si se sabe.
export const outlet = (a: Interview) =>
  [a.entrevista?.medio, a.entrevista?.programa].filter(Boolean).join(' · ');
export const interviewerOf = (a: Interview) => a.entrevista?.entrevistador || null;
// El día en que se publicó (AAAA-MM-DD), o nada si el pipeline no lo sabe: los vídeos fuera de
// YouTube, como los de RTVE Play, llegan sin fecha.
export const publishedDay = (a: Interview) => /^\d{4}-\d{2}-\d{2}/.exec(a.publicado)?.[0] ?? null;
// «22 de octubre de 2026», o nada.
export const publishedOn = (a: Interview) => {
  const day = publishedDay(a);
  return day && longDate(day);
};
export const roundOf = (a: Interview) => rounds.find((r) => r.id === a.jornada);

// La ronda más reciente a la que aún le falta alguna entrevista (o la de un candidato, con `slug`):
// la que está por llegar o en marcha. Sale de los datos, no del reloj.
export const pendingRound = (slug?: string) =>
  [...rounds]
    .sort((x, y) => y.date.localeCompare(x.date))
    .find((r) =>
      roundInterviews(r.id).some(
        (e) => !e.interview && !e.cancelled && (!slug || e.candidate.slug === slug),
      ),
    );
// La ronda más reciente en la que se canceló la entrevista a ese candidato.
export const cancelledRound = (slug: string) =>
  [...rounds]
    .sort((x, y) => y.date.localeCompare(x.date))
    .find((r) => r.cancelled?.some((s) => s === slug));
// La ronda comparable más reciente.
export const comparableRound = () =>
  [...rounds].sort((x, y) => y.date.localeCompare(x.date)).find((r) => r.comparable);
// La que abre «Lado a lado»: la más reciente con al menos dos entrevistas o, si no
// hay ninguna, la próxima.
export const compareRound = () => {
  const recent = [...rounds].sort((x, y) => y.date.localeCompare(x.date));
  return (
    recent.find((r) => roundInterviews(r.id).filter((e) => e.interview).length >= 2) ??
    pendingRound() ??
    recent[0]
  );
};

const commonSchema = z.array(
  z.object({
    id: z.string(),
    tema: z.string(),
    pregunta: z.string(),
    // De cada candidato, el id de su pregunta en su entrevista.
    respuestas: z.record(z.string(), z.string()),
  }),
);
export const commonQuestions = (round: string) =>
  round in commonFiles ? commonSchema.parse(commonFiles[round]) : [];

// Las entrevistas de una ronda, por candidato. Solo las reales.
export const roundInterviews = (round: string) =>
  candidates.map((c) => ({
    candidate: c,
    interview: interviews.find((a) => !a.ficticio && a.jornada === round && a.candidato === c.slug),
    cancelled: !!rounds.find((r) => r.id === round)?.cancelled?.includes(c.slug),
  }));

// Qué parte del tiempo hablado es de quien se pida, en %.
// Con análisis de comunicación, la parte de las palabras de cada uno; sin él, la del tiempo.
export function speakingShare(a: Interview, who: Interview['segmentos'][number]['hablante']) {
  const c = getCommunication(a.id);
  if (c) {
    if (who === 'candidato') return Math.round(c.habla.invitado.parte);
    return who === 'jordi' ? Math.round(c.habla.jordi.parte) : 0;
  }
  const time = (list: Interview['segmentos']) => list.reduce((t, s) => t + s.fin - s.inicio, 0);
  const total = time(a.segmentos);
  return total
    ? Math.round((time(a.segmentos.filter((s) => s.hablante === who)) / total) * 100)
    : 0;
}

// Cómo habla el candidato, sobre la transcripción literal y con las mismas reglas para los cuatro.
// Son señales observables, no un diagnóstico: no dicen si alguien está nervioso ni si es sincero.
export function speech(a: Interview) {
  const own = a.segmentos.filter((s) => s.hablante === 'candidato');
  const minutes = own.reduce((t, s) => t + s.fin - s.inicio, 0) / 60 || 1;
  const text = own
    .map((s) => s.texto)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const words = text.match(/[a-zñ0-9]+/g) ?? [];
  const flat = ` ${words.join(' ')} `;
  // Muletillas: eh, em, mm (con sus letras repetidas), «o sea», «digamos», «en plan» y la coletilla «¿no?».
  const counts = new Map<string, number>([
    ['eh', words.filter((w) => /^eh+$/.test(w)).length],
    ['em', words.filter((w) => /^e+h?m+$/.test(w)).length],
    ['mm', words.filter((w) => /^m{2,}$/.test(w)).length],
    ...['o sea', 'digamos', 'en plan'].map((e): [string, number] => [
      e,
      flat.split(` ${e} `).length - 1,
    ]),
    ['¿no?', (text.match(/[,¿]\s*no\s*\?/g) ?? []).length],
  ]);
  const fillers = [...counts.values()].reduce((n, c) => n + c, 0);
  // Titubeos: la misma palabra dos veces seguidas.
  const stutters = words.filter((w, i) => i > 0 && w === words[i - 1] && w.length < 12).length;
  // Pausa antes de responder: el silencio del audio más cercano al paso de una pregunta del
  // entrevistador a la respuesta del candidato.
  const pauses = a.segmentos.flatMap((s, i) => {
    const before = a.segmentos[i - 1];
    if (!a.silencios.length || !before || s.hablante !== 'candidato') return [];
    if (before.hablante !== 'jordi' || !before.texto.trim().endsWith('?')) return [];
    const cut = (before.fin + s.inicio) / 2;
    const near = a.silencios
      .filter(([from, to]) => to >= cut - 2 && from <= cut + 2)
      .sort((x, y) => Math.abs((x[0] + x[1]) / 2 - cut) - Math.abs((y[0] + y[1]) / 2 - cut))[0];
    return near ? Math.min(near[1] - near[0], 10) : 0;
  });
  return {
    pace: getCommunication(a.id)?.habla.invitado.palabrasPorMinuto ?? words.length / minutes,
    fillers: fillers / minutes,
    stutters: stutters / minutes,
    pause: pauses.length ? pauses.reduce((t, p) => t + p, 0) / pauses.length : null,
    // Las que más repite.
    top: [...counts]
      .filter(([, n]) => n > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3),
  };
}

// Minuto a minuto: quién tiene la palabra (segundos del candidato y del entrevistador) y la
// intensidad, con la fórmula de El VAR Electoral y la misma escala para los cuatro: cambios de turno
// entre los dos (de al menos cuatro palabras) + 3 × interrupciones + 2 × momentos de tensión
// (con análisis de comunicación, preguntas duras sin respuesta clara; sin él, repreguntas, evasivas y
// choques; y en los dos, ataques personales y calificaciones que no son «Cierto»), sobre
// 25 puntos por minuto. Mide ida y vuelta, no emociones.
export const intensityScale = 25;
export function perMinute(a: Interview) {
  const n = Math.max(1, Math.ceil(a.duracion / 60));
  const rows = Array.from({ length: n }, (_, i) => ({
    start: i * 60,
    candidate: 0,
    interviewer: 0,
    points: 0,
  }));
  const bump = (second: number, by: number) => {
    const row = rows[Math.min(n - 1, Math.max(0, Math.floor(second / 60)))];
    if (row) row.points += by;
  };
  a.segmentos.forEach((s, i) => {
    if (s.hablante === 'candidato' || s.hablante === 'jordi') {
      for (const row of rows) {
        const overlap = Math.min(s.fin, row.start + 60) - Math.max(s.inicio, row.start);
        if (overlap > 0) row[s.hablante === 'candidato' ? 'candidate' : 'interviewer'] += overlap;
      }
    }
    const before = a.segmentos[i - 1];
    const pair = new Set([s.hablante, before?.hablante]);
    if (before && before.hablante !== s.hablante && pair.has('jordi') && pair.has('candidato'))
      if (s.texto.split(/\s+/).length >= 4) bump(s.inicio, 1);
  });
  for (const x of a.interrupciones) bump(x.segundo, 3);
  // Con análisis de comunicación, la tensión de las preguntas son las duras sin respuesta clara.
  const c = getCommunication(a.id);
  const tension = [
    ...(c
      ? c.preguntas.filter((q) => isHard(q) && q.respuesta !== 'responde')
      : a.preguntas.filter(
          (p) => p.repregunta || p.respuesta === 'evasiva' || p.respuesta === 'cambio',
        )),
    ...a.ataques.filter((x) => x.tipo === 'personal'),
    ...a.revisiones.filter((r) => r.veredicto !== 'legal' && r.veredicto !== 'sinfuente'),
    ...(c ? [] : a.momentos.filter((m) => m.tipo === 'choque')),
  ];
  for (const t of tension) bump(t.segundo, 2);
  return rows.map(({ points, ...row }) => ({
    ...row,
    intensity: Math.min(1, points / intensityScale),
  }));
}
export type Minute = ReturnType<typeof perMinute>[number];

// Cómo le trató el entrevistador.
export function interviewer(a: Interview) {
  const words = a.preguntas.reduce((n, p) => n + p.texto.split(/\s+/).length, 0);
  return {
    share: speakingShare(a, 'jordi'),
    questionsPerMinute: a.preguntas.length / (a.duracion / 60 || 1),
    followUps: a.preguntas.filter((p) => p.repregunta).length,
    cuts: interruptions(a).interviewer,
    wordsPerQuestion: a.preguntas.length ? words / a.preguntas.length : 0,
  };
}

// Lo que el análisis de comunicación mide mejor, si la entrevista lo tiene; si no, lo del análisis.
// Repreguntas: con comunicación, también las insistencias (tercera vez o más).
export function followUps(a: Interview) {
  const c = getCommunication(a.id);
  return c
    ? c.preguntas.filter((q) => q.dureza === 'repregunta' || q.dureza === 'insistencia').length
    : a.preguntas.filter((p) => p.repregunta).length;
}
// Las respuestas que no contestan a lo preguntado.
export function dodges(a: Interview) {
  const c = getCommunication(a.id);
  return c
    ? c.preguntas.filter((q) =>
        ['otra_pregunta', 'ataca_pregunta', 'cambia_tema'].includes(q.respuesta),
      ).length
    : a.preguntas.filter((p) => p.respuesta === 'evasiva' || p.respuesta === 'cambio').length;
}
// La parte de las respuestas que contestan a lo preguntado (sin las que no le dejan contestar).
export function directShare(a: Interview) {
  const c = getCommunication(a.id);
  const list = c
    ? c.preguntas
        .filter((q) => q.respuesta !== 'sin_respuesta')
        .map((q) => q.respuesta === 'responde')
    : a.preguntas.map((p) => p.respuesta === 'directa');
  return list.filter(Boolean).length / (list.length || 1);
}
// A quién critica y cuántas veces: con comunicación, las respuestas que critican a cada uno; sin
// ella, las críticas y ataques del análisis.
export function criticTargets(a: Interview) {
  const c = getCommunication(a.id);
  const names = c ? c.preguntas.flatMap((q) => q.aQuienCritica) : a.ataques.map((x) => x.objetivo);
  const count = new Map<string, number>();
  for (const name of names) count.set(name, (count.get(name) ?? 0) + 1);
  return [...count].sort((x, y) => y[1] - x[1]);
}
// Los cortes: con comunicación, sus interrupciones notables y los intercambios que cierra el
// entrevistador con un corte o un comentario suyo; sin ella, las interrupciones del análisis.
export function interruptions(a: Interview) {
  const c = getCommunication(a.id);
  return c
    ? {
        candidate: c.sintonia.filter(
          (x) => x.tipo === 'interrupcion_notable' && x.quien === 'invitado',
        ).length,
        interviewer: c.preguntas.filter((q) => q.cierra === 'jordi').length,
      }
    : {
        candidate: a.interrupciones.filter((x) => x.quien === 'candidato').length,
        interviewer: a.interrupciones.filter((x) => x.quien === 'jordi').length,
      };
}
// Los compromisos que se podrán comprobar; sin comunicación, las propuestas completas.
export function checkable(a: Interview) {
  const c = getCommunication(a.id);
  return c
    ? c.compromisos.filter((x) => x.verificable).length
    : a.propuestas.filter((p) => proposalScore(p) === 4).length;
}

export const proposalScore = (p: Interview['propuestas'][number]) =>
  +p.que + +p.cuanto + +p.cuando + +p.como;

// Porcentaje del tiempo de la entrevista por tema, de mayor a menor.
// Los temas: con análisis de comunicación, los suyos, iguales para toda la ronda y con quién saca
// cada uno; sin él, los capítulos del vídeo.
export const topicsOf = (a: Interview) => getCommunication(a.id)?.temas ?? a.temas;
export function topicShare(a: Interview) {
  const total = new Map<string, number>();
  for (const t of topicsOf(a)) total.set(t.tema, (total.get(t.tema) ?? 0) + t.fin - t.inicio);
  return [...total]
    .map(([topic, seconds]) => ({ topic, share: Math.round((seconds / a.duracion) * 100) }))
    .sort((x, y) => y.share - x.share);
}

// El vídeo en YouTube (en su segundo) o, si no está allí, el original en la web del medio.
export const videoUrl = (a: Interview, second = 0) =>
  a.youtubeId
    ? `https://www.youtube.com/watch?v=${a.youtubeId}${second ? `&t=${Math.floor(second)}s` : ''}`
    : a.entrevista?.url || null;
