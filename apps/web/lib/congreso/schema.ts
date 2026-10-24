import { z } from 'zod';

const count = z.number().int().nonnegative();
const date = z.iso.date();
const sourceUrl = z.url({ protocol: /^https$/ });
const group = z.object({
  nombre: z.string(),
  color: z.string().regex(/^#[\da-f]{6}$/i),
  escanos: count,
});
const deputy = z
  .tuple([
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.number().nullable(),
    z.number().nullable(),
    z.union([z.number(), z.string()]).nullable(),
    z.string(),
  ])
  .transform(([nombre, grupo, provincia, formacion, alta, x, y, codigo, baja]) => ({
    nombre,
    grupo,
    provincia,
    formacion,
    alta,
    x,
    y,
    codigo,
    baja,
  }));

export const indexSchema = z.object({
  meta: z.object({
    generado: date,
    datos_hasta: date,
    legislatura: z.string(),
    periodo: z.string(),
  }),
  grupos: z.record(z.string(), group),
  diputados: z.array(deputy),
  meses: z.array(
    z.object({
      mes: z.string().regex(/^\d{4}-\d{2}$/),
      sesiones: count,
      votaciones: count,
      intervenciones: count,
    }),
  ),
  hemiciclo: z.object({ ancho: z.number().positive(), alto: z.number().positive() }),
  agenda: z.object({
    plenos: z.array(z.object({ fecha: date, puntos: z.array(z.object({ titulo: z.string() })) })),
  }),
});

export const voteSchema = z.object({
  id: z.string(),
  fecha: date,
  tipo: z.string(),
  titulo: z.string(),
  texto: z.string(),
  proponente: z.string(),
  exp: z.string(),
  si: count,
  no: count,
  abst: count,
  novota: count,
  grupos: z.record(z.string(), z.string()),
  v: z.string().regex(/^[SNAX-]*$/),
  cg: z.record(z.string(), z.string()).optional(),
  tm: z.array(z.string()).optional(),
  json: z.union([sourceUrl, z.literal('')]),
});
const analysisSchema = z.object({
  provider: z.string(),
  model: z.string(),
  served_model: z.string().optional(),
  prompt: z.string(),
  input_sha256: z.string().optional(),
  cache_key: z.string().optional(),
});
export const sessionSchema = z.object({
  fuente: z.string().optional(),
  ia: analysisSchema.optional(),
  id: z.string(),
  fecha: date,
  organo: z.string(),
  sesion: z.string(),
  titular: z.string().optional(),
  resumen: z.string(),
  ds: sourceUrl.nullable(),
  puntos: z.array(z.object({ titulo: z.string(), tipo: z.string(), votos: z.array(z.string()) })),
});
export const interventionSchema = z.object({
  ia: analysisSchema.optional(),
  s: z.string(),
  item: z.union([z.string(), count]),
  orador: z.string(),
  g: z.string(),
  tono: z.string(),
  int: z.number(),
  temas: z.array(z.string()),
  cita: z.string().nullable().optional(),
  frase: z.string().optional(),
  resumen: z.string().optional(),
});
export const monthSchema = z
  .object({
    sesiones: z.array(sessionSchema),
    votaciones: z.array(voteSchema),
    intervenciones: z.array(interventionSchema),
    items: z.array(z.string()).optional(),
  })
  .superRefine((month, ctx) => {
    month.intervenciones.forEach((intervention, i) => {
      if (typeof intervention.item === 'number' && !month.items?.[intervention.item])
        ctx.addIssue({
          code: 'custom',
          path: ['intervenciones', i, 'item'],
          message: 'Asunto inexistente',
        });
    });
  });
export const lawsSchema = z.object({
  iniciativas: z.array(
    z.object({
      exp: z.string(),
      tipo: z.string(),
      titulo: z.string(),
      presentada: date,
      estado: z.string(),
      autores: z.array(z.string()),
      comision: z.string(),
      situacion: z.string(),
      etapa: count,
      bocg: z.union([sourceUrl, z.literal('')]),
      tm: z.array(z.string()),
      fases: z.array(z.tuple([z.string(), z.string(), z.string(), z.string()])),
    }),
  ),
  aprobadas: z.array(z.object({ titulo: z.string(), fecha: date, pdf: sourceUrl })),
});
export const questionsSchema = z.object({
  generado: date,
  total: count,
  estados: z.record(z.string(), count),
  grupos: z.record(z.string(), z.tuple([count, count, count])),
  diputados: z.record(z.string(), z.tuple([count, count, count])),
  demora: z.object({ n: count, mediana: z.number().nullable() }),
});
export const organsSchema = z.object({
  actualizado: date,
  cifras: z.object({ cargos_ocupados: count, ministerios: count, cambios_30: count }),
  cargos: z.record(
    z.string(),
    z.object({
      cargo: z.string(),
      ministerio: z.string(),
      mandatos: z.array(
        z.object({
          persona: z.string(),
          desde: date.nullable(),
          hasta: z.string().nullable(),
          boe: z.string().nullable(),
        }),
      ),
    }),
  ),
  cambios: z.array(
    z.object({
      fecha: date,
      tipo: z.string(),
      cargo: z.string(),
      persona: z.string(),
      boe: z.string(),
      cargo_id: z.string(),
    }),
  ),
});
export const weeksSchema = z.array(
  z.object({
    id: z.string(),
    desde: date,
    hasta: date,
    titular: z.string(),
    votaciones: z.array(z.string()),
    sesiones: z.array(z.string()),
    intervenciones: count,
    citas: z.array(
      z.object({ orador: z.string(), g: z.string(), cita: z.string(), s: z.string() }),
    ),
  }),
);
export const geographySchema = z.object({
  fuentes: z.record(z.string(), z.union([z.number(), z.string()])),
  provincias: z.record(
    z.string(),
    z.object({
      n: z.string(),
      pob: count,
      esc: count,
      renta: z.number(),
      edad: z.number(),
      dens: z.number(),
    }),
  ),
  ccaa: z.record(
    z.string(),
    z.object({ n: z.string(), pob: count, provincias: z.array(z.string()) }),
  ),
});
export const electionsSchema = z.object({
  convocatoria: date,
  votacion: date,
  decreto: z.object({ rd: z.string(), boe: z.string() }),
  calendario: z.array(
    z.object({
      fecha: date,
      hasta: date.optional(),
      hito: z.string(),
      detalle: z.string().optional(),
    }),
  ),
  escanos: z.record(z.string(), count),
  escanos_cambian: z.array(z.tuple([z.string(), count, count])),
});
export const pollsSchema = z.object({
  actualizado: date,
  eleccion: date,
  veda: z.tuple([date, z.string()]),
  fuente: sourceUrl,
  partidos: z.array(
    z.object({ id: z.string(), nombre: z.string(), color: z.string().regex(/^#[\da-f]{6}$/i) }),
  ),
  encuestas: z.array(
    z.object({
      empresa: z.string(),
      medio: z.string(),
      ini: date,
      fin: date,
      n: z.number().nullable(),
      part: z.number().nullable(),
      v: z.record(z.string(), z.number()),
      // Horquilla de escaños de cada partido.
      e: z.record(z.string(), z.tuple([count, count])),
      // El CIS y los agregadores no entran en la media.
      cis: z.boolean(),
      agregador: z.boolean().optional(),
    }),
  ),
  // La media día a día de cada partido (`m`) y cuánto se separan las encuestas (`s`).
  media: z.object({
    dias: z.array(date),
    partidos: z.record(
      z.string(),
      z.object({ m: z.array(z.number().nullable()), s: z.array(z.number().nullable()) }),
    ),
  }),
  resultado2023: z.object({
    fecha: date,
    v: z.record(z.string(), z.number()),
    e: z.record(z.string(), z.tuple([count, count])),
    part: z.number(),
  }),
});
export const historySchema = z.object({
  familias: z.array(
    z.object({ id: z.string(), nombre: z.string(), color: z.string().regex(/^#[\da-f]{6}$/i) }),
  ),
  elecciones: z.array(
    z.object({
      id: z.string(),
      fecha: date,
      censo: count,
      votantes: count,
      validos: count,
      blancos: count,
      nulos: count,
      // La legislatura que salió de la elección, quién la presidió y cuándo acabó.
      legislatura: z.string(),
      presidentes: z.array(z.string()),
      hasta: date,
      fam: z.record(z.string(), z.tuple([count, count])),
      partidos: z.array(z.tuple([z.string(), z.string(), z.string(), count, count])),
      prov: z.record(
        z.string(),
        z.object({
          e: count,
          censo: count,
          votantes: count,
          validos: count,
          // Votos y escaños de cada familia política en la provincia.
          fam: z.record(z.string(), z.tuple([count, count])),
        }),
      ),
      // Índices de la elección; la volatilidad no existe para la primera.
      metricas: z.object({
        nep_votos: z.number(),
        nep_escanos: z.number(),
        gallagher: z.number(),
        pedersen: z.number().optional(),
        sin_escano: count,
      }),
    }),
  ),
});
// Lo que pintan los listados; las fichas usan el contrato completo.
export const voteCardSchema = voteSchema.pick({
  id: true,
  fecha: true,
  tipo: true,
  titulo: true,
  si: true,
  no: true,
  abst: true,
  novota: true,
  grupos: true,
});
export const sessionCardSchema = sessionSchema.pick({
  id: true,
  fecha: true,
  organo: true,
  sesion: true,
  titular: true,
  resumen: true,
});
export const lawCardSchema = lawsSchema.shape.iniciativas.element.pick({
  exp: true,
  tipo: true,
  titulo: true,
  estado: true,
  situacion: true,
});
export type CongressIndex = z.infer<typeof indexSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type VoteCard = z.infer<typeof voteCardSchema>;
export type SessionCard = z.infer<typeof sessionCardSchema>;
export type LawCard = z.infer<typeof lawCardSchema>;
export type Intervention = z.infer<typeof interventionSchema>;

// El resto de los conjuntos públicos conserva su contrato JSON original para descarga y reutilización.
export const jsonSchema = z.json();
export const datasetSchemas = new Map<string, z.ZodType>([
  ['indice.json', indexSchema],
  ['leyes.json', lawsSchema],
  ['preguntas.json', questionsSchema],
  ['organigrama.json', organsSchema],
  ['semanas.json', weeksSchema],
  ['geografia/territorios.json', geographySchema],
  ['elecciones/elecciones.json', electionsSchema],
  ['encuestas/encuestas.json', pollsSchema],
  ['elecciones/historico.json', historySchema],
]);
export function schemaForDataset(path: string) {
  return /^\d{4}-\d{2}\.json$/.test(path) ? monthSchema : (datasetSchemas.get(path) ?? jsonSchema);
}

export const topicSchema = z.record(
  z.string(),
  z.object({
    nombre: z.string(),
    preguntas: z.number(),
    leyes: z.array(z.string()),
    votos: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
);

export const rawQuestionSchema = z.object({
  exp: z.string(),
  presentada: z.iso.date(),
  titulo: z.string(),
  estado: z.string(),
  autores: z.array(z.tuple([z.string(), z.string()])),
});

export const rawSessionSchema = z.object({
  id: z.string().regex(/^DSCD-\d+-(PL|CO)-\d+$/),
  fecha: z.iso.date().nullable(),
  ds: z.url({ protocol: /^https$/ }),
  intervenciones: z.array(
    z.object({
      orador: z.string(),
      grupo: z.string(),
      texto: z.string(),
      item: z.string().nullable(),
    }),
  ),
});

export const extraSchema = z.record(
  z.string(),
  z.object({
    bio: z.string(),
    comisiones: z.array(z.tuple([z.string(), z.string()])),
    turnos: z.record(z.string(), z.number()),
    intereses: z
      .record(
        z.string(),
        z.union([z.string(), z.array(z.union([z.string(), z.array(z.string())]))]),
      )
      .optional(),
  }),
);

export const quotesSchema = z.array(
  z.tuple([z.string(), z.string(), z.string(), z.string(), z.iso.date()]),
);

export const proposalsSchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.object({
      total: z.number(),
      lineas: z.array(
        z.object({
          titulo: z.string(),
          n: z.number(),
          ejemplos: z.array(z.tuple([z.string(), z.string(), z.string(), z.iso.date()])),
        }),
      ),
    }),
  ),
);

export const responsesSchema = z.object({
  ministros: z.array(
    z.object({
      orador: z.string(),
      rol: z.string(),
      n: z.number(),
      si: z.number(),
      parcial: z.number(),
      no: z.number(),
      casos: z.array(
        z.tuple([
          z.iso.date(),
          z.string(),
          z.string(),
          z.string(),
          z.string(),
          z.string(),
          z.string(),
        ]),
      ),
    }),
  ),
});

export const radarSchema = z.object({
  temas: z.record(
    z.string(),
    z.object({
      tema: z.string(),
      n: z.number(),
      primera: z.iso.date(),
      serie: z.array(z.number()),
    }),
  ),
});

const range = { med: z.number(), p05: z.number(), p95: z.number() };
export const projectionSchema = z.object({
  fecha: z.iso.date(),
  central: z.record(z.string(), z.number()),
  media: z.record(z.string(), z.number()),
  provincias: z.record(z.string(), z.record(z.string(), z.number())),
  // Parte del voto de cada partido en cada provincia y el último escaño: quién lo gana, quién
  // queda segundo y cuántos puntos le faltan.
  votos: z.record(z.string(), z.record(z.string(), z.number())),
  ultimos: z.record(
    z.string(),
    z.object({ gana: z.string(), segundo: z.string(), falta: z.number() }),
  ),
  bloques: z.record(z.string(), z.array(z.string())),
  // Las simulaciones: `hist[n]` es la parte de ellas en que se sacan n escaños.
  simulacion: z.object({
    n: count,
    partidos: z.record(
      z.string(),
      z.object({ ...range, media: z.number(), hist: z.array(z.number()) }),
    ),
    bloques: z.record(
      z.string(),
      z.object({
        ...range,
        partidos: z.array(z.string()),
        p176: z.number(),
        hist: z.array(z.number()),
      }),
    ),
    primero: z.record(z.string(), z.number()),
    solo176: z.record(z.string(), z.number()),
  }),
  // La proyección más probable con la media de cada semana.
  serie: z.array(z.tuple([date, z.record(z.string(), count)])),
});

export const marketsSchema = z.object({
  actualizado: date,
  veda: z.tuple([date, z.string()]),
  mercados: z.array(
    z.object({
      slug: z.string(),
      pregunta: z.string(),
      // Quién gana, quién preside o cuándo deja de presidir Sánchez.
      tipo: z.enum(['ganador', 'presidente', 'fuera']),
      url: z.url({ protocol: /^https$/ }),
      volumen: z.number(),
      inicio: date,
      opciones: z.array(
        z.object({
          nombre: z.string(),
          p: z.number(),
          vol: z.number(),
          // El precio de cada día; solo en las seis opciones principales.
          hist: z.array(z.tuple([date, z.number()])).optional(),
        }),
      ),
    }),
  ),
});

export const accuracySchema = z.object({
  elecciones: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      fecha: z.iso.date(),
      // Error medio en puntos por partido y cuánto se pasó (+) o se quedó corta (−) la media
      // con cada uno.
      media_mae: z.number(),
      media_dif: z.record(z.string(), z.number()),
      partidos: z.array(z.string()),
      rotulos: z.record(z.string(), z.string()),
      resultado: z.record(z.string(), z.number()),
      media: z.record(z.string(), z.number()),
      escanos: z.record(z.string(), count),
      encuestas: z.array(
        z.object({
          empresa: z.string(),
          medio: z.string(),
          fin: date,
          v: z.record(z.string(), z.number()),
          cis: z.boolean(),
          agregador: z.boolean(),
        }),
      ),
    }),
  ),
  ranking: z.array(
    z.object({
      empresa: z.string(),
      n: count,
      mae: z.number(),
      elecciones: z.array(z.object({ id: z.string(), mae: z.number() })),
    }),
  ),
  // La proyección de hoy corregida con el error de cada elección.
  escenarios: z.record(
    z.string(),
    z.object({ escanos: z.record(z.string(), count), ppvox: count }),
  ),
});

// El viaje de cada proyecto y proposición de ley de la legislatura: las fechas de cada etapa
// (vacías si no llegó), cómo acabó y cuándo.
const optionalDate = z.union([z.iso.date(), z.literal('')]);
export const journeysSchema = z.object({
  inicio: z.iso.date(),
  disolucion: z.iso.date(),
  leyes: z.array(
    z.tuple([
      z.string(),
      z.string(),
      z.string(),
      z.string(),
      z.array(z.string()),
      z.string(),
      z.iso.date(),
      z.array(optionalDate),
      z.string(),
      optionalDate,
      z.number(),
    ]),
  ),
});

// La legislatura día a día (votaciones, leyes, decretos-leyes y preguntas de cada día) y cada
// votación nominal con su resultado: [id, fecha, título, sí, no].
export const legislatureSchema = z.object({
  desde: date,
  hasta: date,
  dias: z.record(z.iso.date(), z.tuple([count, count, count, count])),
  votos: z.array(z.tuple([z.string(), z.iso.date(), z.string(), count, count])),
});

export const mapSchema = z.object({
  ancho: z.number(),
  alto: z.number(),
  canarias: z.string(),
  provincias: z.record(
    z.string(),
    z.object({
      n: z.string(),
      d: z.string(),
      c: z.tuple([z.number(), z.number()]),
      circ: z.string(),
      corto: z.string(),
    }),
  ),
});

export const historicalProvinceSchema = z.object({
  id: z.string(),
  prov: z.record(
    z.string(),
    z.object({
      e: z.number(),
      validos: z.number(),
      blancos: z.number(),
      sin_escano: z.number(),
      c: z.array(z.tuple([z.string(), z.string(), z.number(), z.number()])),
      ultimo: z.object({ gana: z.string(), segundo: z.string(), faltan: z.number() }).optional(),
    }),
  ),
});

export const municipalitiesSchema = z.object({
  // El padrón de hoy y el de referencia para medir cuánto ha crecido o se ha vaciado cada uno.
  anio: z.number(),
  anio0: z.number(),
  orden: z.array(z.string()),
  // [nombre, x, y, km², población, población en `anio0`, renta, edad media, % con 65 o más,
  // familia más votada el 23J (índice en `orden` de los resultados)].
  m: z.record(
    z.string(),
    z.tuple([
      z.string(),
      z.number(),
      z.number(),
      z.number().nullable(),
      z.number(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
      z.number().nullable(),
    ]),
  ),
});

export const balanceSchema = z.object({
  balance: z.object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
    plenos: z.number(),
    votaciones: z.number(),
    sesiones: z.number(),
    intervenciones: z.number(),
    leyes: z.number(),
    leyes_organicas: z.number(),
    decretos_ley: z.number(),
    preguntas: z.number(),
    sin_respuesta: z.number(),
    mas_ajustada: z.object({ si: z.number(), no: z.number() }).optional(),
  }),
  caducan: z.object({
    total: z.number(),
    proyectos: z.number(),
    proposiciones: z.number(),
    por_origen: z.record(z.string(), z.number()),
    lista: z.array(
      z.tuple([
        z.string(),
        z.string(),
        z.string(),
        z.string(),
        z.array(z.string()),
        z.iso.date(),
        z.number(),
        z.number(),
        z.number(),
        z.string(),
      ]),
    ),
  }),
  convalidar: z.array(
    z.object({
      numero: z.string(),
      titulo: z.string(),
      fecha: z.iso.date(),
      pdf: z.url({ protocol: /^https$/ }),
      limite_aprox: z.iso.date(),
    }),
  ),
  hay: z.object({ candidaturas: z.boolean(), resultados: z.boolean() }),
  // Población de cada provincia en el padrón que fija el reparto de escaños.
  padron: z.object({ anio: count, pob: z.record(z.string(), count) }),
  // Quién dejó el escaño y quién entró por la lista: [sale, entra, fecha, provincia, formación].
  relevos: z.object({
    personas: count,
    salidas: z.array(z.tuple([z.string(), z.string(), date, z.string(), z.string()])),
  }),
});

export const metricsSchema = z.object({
  elecciones: z.array(
    z.object({
      id: z.string(),
      fecha: z.iso.date(),
      censo: z.number(),
      votantes: z.number(),
      metricas: z.record(z.string(), z.number().nullable()),
    }),
  ),
});

export const municipalityVotesSchema = z.object({
  orden: z.array(z.string()),
  municipios: z.record(z.string(), z.array(z.number())),
});

export const municipalityNamesSchema = municipalitiesSchema;
// El contorno de cada municipio en el plano del mapa de España: [nombre, trazado SVG].
export const geoMunicipalitiesSchema = z.object({
  ancho: z.number(),
  alto: z.number(),
  municipios: z.record(z.string(), z.tuple([z.string(), z.string()])),
});

export const ageSchema = z.object({
  fuente: z.string(),
  url: z.url({ protocol: /^https$/ }),
  edades: z.array(z.string()),
  // Entrevistados de cada edad; el voto escalado al resultado del 23J y lo que dijeron.
  n: z.array(count),
  ajustado: z.array(z.record(z.string(), z.number())),
  crudo: z.array(z.record(z.string(), z.number())),
  no_voto: z.array(z.number()),
});

datasetSchemas.set('temas.json', topicSchema);
datasetSchemas.set('diputados-extra.json', extraSchema);
datasetSchemas.set('explora-citas.json', quotesSchema);
datasetSchemas.set('explora-propuestas.json', proposalsSchema);
datasetSchemas.set('explora-contesta.json', responsesSchema);
datasetSchemas.set('explora-radar.json', radarSchema);
datasetSchemas.set('encuestas/proyeccion.json', projectionSchema);
datasetSchemas.set('encuestas/mercados.json', marketsSchema);
datasetSchemas.set('encuestas/aciertos.json', accuracySchema);
datasetSchemas.set('geografia/municipios.json', municipalitiesSchema);
datasetSchemas.set('elecciones/geo-provincias.json', mapSchema);
datasetSchemas.set('elecciones/elecciones.json', electionsSchema.and(balanceSchema));
datasetSchemas.set('elecciones/historico.json', historySchema.and(metricsSchema));
datasetSchemas.set('elecciones/municipios-202307.json', municipalityVotesSchema);
datasetSchemas.set('elecciones/municipios-201911.json', municipalityVotesSchema);
datasetSchemas.set('elecciones/geo-municipios.json', geoMunicipalitiesSchema);
datasetSchemas.set('elecciones/voto-edad.json', ageSchema);
datasetSchemas.set('elecciones/viajes.json', journeysSchema);
datasetSchemas.set('elecciones/legislatura.json', legislatureSchema);
