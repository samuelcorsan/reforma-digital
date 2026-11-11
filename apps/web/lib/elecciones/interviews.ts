import { z } from 'zod';
import { longDate } from './format';
import { candidates, type Candidate } from './candidates';
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
export const verdictIds = verdict.options;
export const answerIds = answer.options;
export const visualIds = ['verificador', 'rotulo', 'documento', 'accion'] as const;

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
// las verificaciones, solo con al menos una fuente. Lo que aún no ha pasado por ella sale como
// provisional (`estado: 'propuesta'`) y cuenta como pendiente: mientras quede algo, el informe y su
// valoración son provisionales.
export function publish(raw: unknown) {
  const a = interviewSchema.parse(raw);
  const id = a.id ?? `${a.jornada}-${a.candidato}`;
  const revisiones = a.revisiones.filter(
    (r) => r.estado !== 'descartada' && r.fuentes.some(validSource),
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
// Todas las verificaciones publicadas: de la entrevista más reciente a la más antigua y, dentro de
// cada una, en el orden en que se dijeron.
export const allVerifications = () =>
  [...interviews]
    .sort((x, y) => y.publicado.localeCompare(x.publicado))
    .flatMap((interview) =>
      interview.revisiones.map((verification) => ({ interview, verification })),
    );
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
export type Mark = {
  id: string;
  second: number;
  lane: keyof typeof lanes;
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
    | keyof typeof visuals;
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
export function speakingShare(a: Interview, who: Interview['segmentos'][number]['hablante']) {
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
    pace: words.length / minutes,
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
// (repreguntas, evasivas, ataques personales, calificaciones que no son «Cierto» y choques), sobre
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
  const tension = [
    ...a.preguntas.filter(
      (p) => p.repregunta || p.respuesta === 'evasiva' || p.respuesta === 'cambio',
    ),
    ...a.ataques.filter((x) => x.tipo === 'personal'),
    ...a.revisiones.filter((r) => r.veredicto !== 'legal'),
    ...a.momentos.filter((m) => m.tipo === 'choque'),
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
    cuts: a.interrupciones.filter((x) => x.quien === 'jordi').length,
    wordsPerQuestion: a.preguntas.length ? words / a.preguntas.length : 0,
  };
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

// El vídeo en YouTube (en su segundo) o, si no está allí, el original en la web del medio.
export const videoUrl = (a: Interview, second = 0) =>
  a.youtubeId
    ? `https://www.youtube.com/watch?v=${a.youtubeId}${second ? `&t=${Math.floor(second)}s` : ''}`
    : a.entrevista?.url || null;
