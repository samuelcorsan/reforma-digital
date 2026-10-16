import { cache } from 'react';
import { z } from 'zod';
import { connection } from '@reforma-digital/db';
import { getIndex, publication } from './data';
import {
  extraSchema,
  interventionSchema,
  lawCardSchema,
  lawsSchema,
  municipalitiesSchema,
  municipalityVotesSchema,
  organsSchema,
  proposalsSchema,
  quotesSchema,
  radarSchema,
  sessionCardSchema,
  sessionSchema,
  topicSchema,
  voteCardSchema,
  voteSchema,
  weeksSchema,
} from './schema';

// Las vistas que usan una parte de los datos la piden a Postgres: filtrar, ordenar y paginar
// ocurre en la base de datos y solo viaja lo que se pinta. Cada consulta llama a
// `congreso_publication`, que falla si la publicación ha cambiado desde el inicio del render.
export const PAGE_SIZE = 24;
type Limit = number | null;

const like = (query: string) => `%${query.replace(/[\\%_]/g, '\\$&')}%`;
const offset = (page: number, limit: Limit) => (limit ? (page - 1) * limit : 0);
async function scope() {
  return { sql: connection(), current: await publication() };
}
// Solo las claves del contrato: los ficheros traen campos que la web no usa.
type Sql = ReturnType<typeof connection>;
function fields(sql: Sql, schema: z.ZodObject, value = sql`content`) {
  return sql`(SELECT jsonb_object_agg(f.key, f.value) FROM jsonb_each(${value}) AS f
    WHERE f.key = ANY(${Object.keys(schema.shape)}))`;
}
function paged<T>(schema: z.ZodType<T>, rows: readonly unknown[]) {
  const parsed = z.array(z.object({ content: schema, total: z.number() })).parse(rows);
  return { total: parsed[0]?.total ?? 0, rows: parsed.map((row) => row.content) };
}
function single<T>(schema: z.ZodType<T>, rows: readonly unknown[]) {
  const content = z.object({ content: z.unknown() }).optional().parse(rows[0])?.content;
  return content === undefined || content === null ? null : schema.parse(content);
}

export async function periodMonths(period: string) {
  const months = (await getIndex()).meses.map(({ mes }) => mes).sort();
  if (period === 'todo') return months;
  if (period === 'reciente') return months.slice(-3);
  if (months.includes(period)) return [period];
  throw new Error('Periodo desconocido');
}
// `indice.json` ya cuenta sesiones, votaciones e intervenciones de cada mes.
export async function periodCounts(period: string) {
  const months = await periodMonths(period);
  const selected = (await getIndex()).meses.filter(({ mes }) => months.includes(mes));
  const sum = (key: 'sesiones' | 'votaciones' | 'intervenciones') =>
    selected.reduce((total, month) => total + month[key], 0);
  return {
    sesiones: sum('sesiones'),
    votaciones: sum('votaciones'),
    intervenciones: sum('intervenciones'),
  };
}

export async function sessions(
  { period, q = '', ids }: { period?: string; q?: string; ids?: string[] },
  page = 1,
  limit: Limit = PAGE_SIZE,
) {
  const { sql, current } = await scope();
  const months = period && (await periodMonths(period));
  return paged(
    sessionCardSchema,
    await sql`SELECT ${fields(sql, sessionCardSchema)} AS content, count(*) OVER ()::int AS total
      FROM congreso_month_sessions
      WHERE congreso_publication(${current})
        ${months ? sql`AND month = ANY(${months})` : sql``}
        ${q ? sql`AND search ILIKE ${like(q)}` : sql``}
        ${ids ? sql`AND id = ANY(${ids})` : sql``}
      ORDER BY date DESC, position LIMIT ${limit} OFFSET ${offset(page, limit)}`,
  );
}
export async function findSession(id: string) {
  const { sql, current } = await scope();
  return single(
    sessionSchema,
    await sql`SELECT ${fields(sql, sessionSchema)} AS content FROM congreso_month_sessions
      WHERE congreso_publication(${current}) AND lower(id) = ${id} LIMIT 1`,
  );
}

type VoteFilter = {
  period?: string;
  q?: string;
  ids?: string[];
  initiative?: string;
  topic?: string;
};
export async function votes(
  { period, q = '', ids, initiative, topic }: VoteFilter,
  page = 1,
  limit: Limit = PAGE_SIZE,
) {
  const { sql, current } = await scope();
  const months = period && (await periodMonths(period));
  return paged(
    voteCardSchema,
    await sql`SELECT ${fields(sql, voteCardSchema)} AS content, count(*) OVER ()::int AS total
      FROM congreso_month_votes
      WHERE congreso_publication(${current})
        ${months ? sql`AND month = ANY(${months})` : sql``}
        ${q ? sql`AND search ILIKE ${like(q)}` : sql``}
        ${ids ? sql`AND id = ANY(${ids})` : sql``}
        ${initiative === undefined ? sql`` : sql`AND initiative = ${initiative}`}
        ${topic === undefined ? sql`` : sql`AND ${topic} = ANY(topics)`}
      ORDER BY date DESC, position LIMIT ${limit} OFFSET ${offset(page, limit)}`,
  );
}
// `deputy` es la posición del diputado en `indice.json`; cada votación guarda su voto en esa
// posición de `v`.
export async function deputyVotes(period: string, deputy: number, page: number) {
  const { sql, current } = await scope();
  return paged(
    voteCardSchema.extend({ voto: z.string() }),
    await sql`SELECT ${fields(sql, voteCardSchema)} || jsonb_build_object('voto', ballot) AS content,
        count(*) OVER ()::int AS total
      FROM congreso_month_votes, LATERAL (SELECT substr(content->>'v', ${deputy + 1}, 1) AS ballot) b
      WHERE congreso_publication(${current}) AND month = ANY(${await periodMonths(period)})
        AND ballot NOT IN ('', '-')
      ORDER BY date DESC, position LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  );
}
export async function findVote(id: string) {
  const { sql, current } = await scope();
  return single(
    voteSchema,
    await sql`SELECT ${fields(sql, voteSchema)} AS content FROM congreso_month_votes
      WHERE congreso_publication(${current}) AND id = ${id} LIMIT 1`,
  );
}

const resolvedInterventionSchema = interventionSchema.extend({ item: z.string() });
export async function interventions(
  {
    period,
    q = '',
    session,
    speaker,
    group = '',
  }: { period?: string; q?: string; session?: string; speaker?: string; group?: string },
  page = 1,
  limit: Limit = PAGE_SIZE,
) {
  const { sql, current } = await scope();
  const months = period && (await periodMonths(period));
  return paged(
    resolvedInterventionSchema,
    await sql`SELECT ${fields(sql, interventionSchema)} AS content, count(*) OVER ()::int AS total
      FROM congreso_interventions
      WHERE congreso_publication(${current})
        ${months ? sql`AND month = ANY(${months})` : sql``}
        ${q ? sql`AND search ILIKE ${like(q)}` : sql``}
        ${session === undefined ? sql`` : sql`AND session_id = ${session}`}
        ${speaker === undefined ? sql`` : sql`AND speaker = ${speaker}`}
        ${group ? sql`AND parliamentary_group = ${group}` : sql``}
      ORDER BY month, position LIMIT ${limit} OFFSET ${offset(page, limit)}`,
  );
}
export async function interventionsByGroup(period: string) {
  const { sql, current } = await scope();
  const rows = z.array(z.object({ group: z.string(), total: z.number() })).parse(
    await sql`SELECT parliamentary_group AS group, count(*)::int AS total
        FROM congreso_interventions
        WHERE congreso_publication(${current}) AND month = ANY(${await periodMonths(period)})
        GROUP BY parliamentary_group`,
  );
  return new Map(rows.map(({ group, total }) => [group, total]));
}

const cargoSchema = organsSchema.shape.cargos.valueType;
export const organsSummary = cache(async () => {
  const { sql, current } = await scope();
  const summary = single(
    organsSchema.pick({ actualizado: true, cifras: true }),
    await sql`SELECT jsonb_build_object('actualizado', content->'actualizado',
        'cifras', content->'cifras') AS content
      FROM congreso_datasets
      WHERE congreso_publication(${current}) AND path = 'organigrama.json'`,
  );
  if (!summary) throw new Error('Conjunto de datos no importado: organigrama.json');
  return summary;
});
export async function cargos(q: string, page: number) {
  const { sql, current } = await scope();
  return paged(
    z.tuple([z.string(), cargoSchema]),
    await sql`SELECT jsonb_build_array(c.key, c.value) AS content, count(*) OVER ()::int AS total
      FROM congreso_datasets d, jsonb_each(d.content->'cargos') WITH ORDINALITY AS c(key, value, n)
      WHERE congreso_publication(${current}) AND d.path = 'organigrama.json'
        ${
          q
            ? sql`AND concat_ws(' ', c.value->>'cargo', c.value->>'ministerio',
                (SELECT string_agg(m->>'persona', ' ') FROM jsonb_array_elements(c.value->'mandatos') m)
              ) ILIKE ${like(q)}`
            : sql``
        }
      ORDER BY c.n LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  );
}
export async function findCargo(id: string) {
  const { sql, current } = await scope();
  return single(
    cargoSchema,
    await sql`SELECT content->'cargos'->${id} AS content FROM congreso_datasets
      WHERE congreso_publication(${current}) AND path = 'organigrama.json'`,
  );
}

export async function deputyExtra(name: string) {
  const { sql, current } = await scope();
  return single(
    extraSchema.valueType,
    await sql`SELECT content->${name} AS content FROM congreso_datasets
      WHERE congreso_publication(${current}) AND path = 'diputados-extra.json'`,
  );
}

const lawSchema = lawsSchema.shape.iniciativas.element;
export type LawFilter = {
  q?: string;
  exps?: string[];
  status?: string;
  type?: string;
  year?: string;
  order?: 'recientes' | 'antiguas';
};
export async function laws(
  { q = '', exps, status, type, year, order }: LawFilter,
  page = 1,
  limit: Limit = PAGE_SIZE,
) {
  const { sql, current } = await scope();
  const sort = {
    recientes: sql`l.law->>'presentada' DESC, l.n DESC`,
    antiguas: sql`l.law->>'presentada', l.n`,
  };
  return paged(
    lawCardSchema,
    await sql`SELECT ${fields(sql, lawCardSchema, sql`l.law`)} AS content, count(*) OVER ()::int AS total
      FROM congreso_datasets d, jsonb_array_elements(d.content->'iniciativas') WITH ORDINALITY AS l(law, n)
      WHERE congreso_publication(${current}) AND d.path = 'leyes.json'
        ${q ? sql`AND concat_ws(' ', l.law->>'titulo', l.law->>'estado') ILIKE ${like(q)}` : sql``}
        ${exps ? sql`AND l.law->>'exp' = ANY(${exps})` : sql``}
        ${status ? sql`AND l.law->>'estado' = ${status}` : sql``}
        ${type ? sql`AND l.law->>'tipo' = ${type}` : sql``}
        ${year ? sql`AND left(l.law->>'presentada', 4) = ${year}` : sql``}
      ORDER BY ${order ? sort[order] : sql`l.n`} LIMIT ${limit} OFFSET ${offset(page, limit)}`,
  );
}
// Valores presentes en `leyes.json` para ofrecerlos como filtros.
export async function lawFacets() {
  const { sql, current } = await scope();
  const list = z.array(z.string()).nullable();
  const row = z.object({ estados: list, tipos: list, anios: list }).parse(
    (
      await sql`SELECT array_agg(DISTINCT l.law->>'estado' ORDER BY l.law->>'estado') AS estados,
          array_agg(DISTINCT l.law->>'tipo' ORDER BY l.law->>'tipo') AS tipos,
          array_agg(DISTINCT left(l.law->>'presentada', 4) ORDER BY left(l.law->>'presentada', 4) DESC)
            AS anios
        FROM congreso_datasets d, jsonb_array_elements(d.content->'iniciativas') AS l(law)
        WHERE congreso_publication(${current}) AND d.path = 'leyes.json'`
    )[0],
  );
  return {
    estados: row.estados ?? [],
    tipos: row.tipos ?? [],
    anios: (row.anios ?? []).filter(Boolean),
  };
}
// La URL sustituye la primera barra del expediente por un guion.
export async function findLaw(slug: string) {
  const { sql, current } = await scope();
  return single(
    lawSchema,
    await sql`SELECT l.law AS content
      FROM congreso_datasets d, jsonb_array_elements(d.content->'iniciativas') WITH ORDINALITY AS l(law, n)
      WHERE congreso_publication(${current}) AND d.path = 'leyes.json'
        AND regexp_replace(l.law->>'exp', '/', '-') = ${slug}
      ORDER BY l.n LIMIT 1`,
  );
}
export async function approvedLaws() {
  const { sql, current } = await scope();
  return (
    single(
      lawsSchema.shape.aprobadas,
      await sql`SELECT content->'aprobadas' AS content FROM congreso_datasets
        WHERE congreso_publication(${current}) AND path = 'leyes.json'`,
    ) ?? []
  );
}

const topicSummarySchema = topicSchema.valueType
  .omit({ votos: true, leyes: true })
  .extend({ votos: z.number(), leyes: z.array(z.string()) });
export async function topics() {
  const { sql, current } = await scope();
  return z
    .array(z.object({ content: topicSummarySchema.extend({ id: z.string() }) }))
    .parse(
      await sql`SELECT jsonb_build_object('id', t.key, 'nombre', t.value->'nombre',
          'preguntas', t.value->'preguntas', 'leyes', t.value->'leyes',
          'votos', jsonb_array_length(t.value->'votos')) AS content
        FROM congreso_datasets d, jsonb_each(d.content) WITH ORDINALITY AS t(key, value, n)
        WHERE congreso_publication(${current}) AND d.path = 'temas.json'
        ORDER BY t.n`,
    )
    .map((row) => row.content);
}
export async function findTopic(id: string) {
  const { sql, current } = await scope();
  return single(
    topicSummarySchema,
    await sql`SELECT jsonb_build_object('nombre', t->'nombre', 'preguntas', t->'preguntas',
        'leyes', t->'leyes', 'votos', jsonb_array_length(t->'votos')) AS content
      FROM congreso_datasets d, LATERAL (SELECT d.content->${id} AS t) topic
      WHERE congreso_publication(${current}) AND d.path = 'temas.json' AND t IS NOT NULL`,
  );
}

const weekSchema = weeksSchema.element;
export async function weeks() {
  const { sql, current } = await scope();
  return z
    .array(z.object({ content: weekSchema.pick({ id: true, desde: true, titular: true }) }))
    .parse(
      await sql`SELECT jsonb_build_object('id', w->'id', 'desde', w->'desde',
          'titular', w->'titular') AS content
        FROM congreso_datasets d, jsonb_array_elements(d.content) WITH ORDINALITY AS t(w, n)
        WHERE congreso_publication(${current}) AND d.path = 'semanas.json'
        ORDER BY t.n`,
    )
    .map((row) => row.content);
}
// Sin identificador, la semana más reciente.
export async function findWeek(id?: string) {
  const { sql, current } = await scope();
  return single(
    weekSchema,
    await sql`SELECT t.w AS content
      FROM congreso_datasets d, jsonb_array_elements(d.content) WITH ORDINALITY AS t(w, n)
      WHERE congreso_publication(${current}) AND d.path = 'semanas.json'
        ${id === undefined ? sql`` : sql`AND t.w->>'id' = ${id}`}
      ORDER BY ${id === undefined ? sql`t.n DESC` : sql`t.n`} LIMIT 1`,
  );
}

export async function proposals(q: string, page: number) {
  const { sql, current } = await scope();
  const line = proposalsSchema.valueType.valueType.shape.lineas.element;
  return paged(
    line.extend({ topic: z.string(), group: z.string() }),
    await sql`SELECT jsonb_build_object('topic', t.key, 'group', g.key) || l.line AS content,
        count(*) OVER ()::int AS total
      FROM congreso_datasets d,
        jsonb_each(d.content) WITH ORDINALITY AS t(key, value, n),
        jsonb_each(t.value) WITH ORDINALITY AS g(key, value, n),
        jsonb_array_elements(g.value->'lineas') WITH ORDINALITY AS l(line, n)
      WHERE congreso_publication(${current}) AND d.path = 'explora-propuestas.json'
        ${q ? sql`AND concat_ws(' ', l.line->>'titulo', t.key, g.key) ILIKE ${like(q)}` : sql``}
      ORDER BY t.n, g.n, l.n LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  );
}
export async function quotes(q: string, page: number) {
  const { sql, current } = await scope();
  return paged(
    quotesSchema.element,
    await sql`SELECT c.quote AS content, count(*) OVER ()::int AS total
      FROM congreso_datasets d, jsonb_array_elements(d.content) WITH ORDINALITY AS c(quote, n)
      WHERE congreso_publication(${current}) AND d.path = 'explora-citas.json'
        ${q ? sql`AND concat_ws(' ', c.quote->>0, c.quote->>1, c.quote->>2) ILIKE ${like(q)}` : sql``}
      ORDER BY c.n LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  );
}
export async function radar(q: string, page: number) {
  const { sql, current } = await scope();
  return paged(
    z.tuple([z.string(), radarSchema.shape.temas.valueType]),
    await sql`SELECT jsonb_build_array(t.key, t.value) AS content, count(*) OVER ()::int AS total
      FROM congreso_datasets d, jsonb_each(d.content->'temas') WITH ORDINALITY AS t(key, value, n)
      WHERE congreso_publication(${current}) AND d.path = 'explora-radar.json'
        ${q ? sql`AND t.value->>'tema' ILIKE ${like(q)}` : sql``}
      ORDER BY (t.value->>'n')::numeric DESC, t.n
      LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  );
}

const municipalitySchema = municipalitiesSchema.shape.m.valueType;
export async function municipalities(q: string, page: number) {
  const { sql, current } = await scope();
  const [year, rows] = await Promise.all([
    sql`SELECT content->'anio' AS content FROM congreso_datasets
      WHERE congreso_publication(${current}) AND path = 'geografia/municipios.json'`,
    sql`SELECT jsonb_build_array(m.key, m.value) AS content, count(*) OVER ()::int AS total
      FROM congreso_datasets d, jsonb_each(d.content->'m') AS m(key, value)
      WHERE congreso_publication(${current}) AND d.path = 'geografia/municipios.json'
        ${q ? sql`AND m.value->>0 ILIKE ${like(q)}` : sql``}
      ORDER BY m.key LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  ]);
  const anio = single(municipalitiesSchema.shape.anio, year);
  if (anio === null) throw new Error('Conjunto de datos no importado: geografia/municipios.json');
  return { anio, ...paged(z.tuple([z.string(), municipalitySchema]), rows) };
}
// Resultados de 2023 por municipio, con el nombre del nomenclátor si existe.
export async function municipalityVotes(q: string, page: number) {
  const { sql, current } = await scope();
  const [order, rows] = await Promise.all([
    sql`SELECT content->'orden' AS content FROM congreso_datasets
      WHERE congreso_publication(${current}) AND path = 'elecciones/municipios-202307.json'`,
    sql`WITH places AS (
        SELECT v.key, coalesce(nullif(n.value->>0, ''), v.key) AS name, v.value
        FROM congreso_datasets d
          CROSS JOIN jsonb_each(d.content->'municipios') AS v(key, value)
          LEFT JOIN (SELECT m.key, m.value FROM congreso_datasets, jsonb_each(content->'m') AS m
            WHERE path = 'geografia/municipios.json') n ON n.key = v.key
        WHERE congreso_publication(${current}) AND d.path = 'elecciones/municipios-202307.json')
      SELECT jsonb_build_array(key, name, value) AS content, count(*) OVER ()::int AS total
      FROM places ${q ? sql`WHERE name ILIKE ${like(q)}` : sql``}
      ORDER BY key LIMIT ${PAGE_SIZE} OFFSET ${offset(page, PAGE_SIZE)}`,
  ]);
  const orden = single(municipalityVotesSchema.shape.orden, order);
  if (!orden) throw new Error('Conjunto de datos no importado: elecciones/municipios-202307.json');
  return {
    orden,
    ...paged(
      z.tuple([z.string(), z.string(), municipalityVotesSchema.shape.municipios.valueType]),
      rows,
    ),
  };
}
