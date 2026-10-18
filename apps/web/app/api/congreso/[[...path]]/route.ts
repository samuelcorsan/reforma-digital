import { connection } from '@reforma-digital/db';
import { z } from 'zod';
import { jsonSchema, schemaForDataset } from '../../../../lib/congreso/schema';
import { pollsHidden } from '../../../../lib/congreso/polls';
import { dataset } from '../../../../lib/congreso/data';
import { like } from '../../../../lib/congreso/queries';

export const runtime = 'nodejs';
const headers = { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };
// Los datos cambian unas pocas veces al día: el CDN responde a las peticiones repetidas sin
// llegar a la función ni a Postgres. Las encuestas siguen sin caché por la veda.
const cached = {
  ...headers,
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
};
const querySchema = z.object({
  // Hasta 240.000 filas de 24 en 24 (un millón de 100 en 100), para recorrer una legislatura
  // entera; más allá solo alarga el OFFSET.
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().max(200).default(''),
  legislatura: z
    .string()
    .regex(/^[IVX]+$/)
    .default('XV'),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  estado: z.string().max(50).default(''),
});
const error = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers });

async function embargo() {
  const rows =
    await connection()`SELECT content->'veda' AS veda FROM congreso_datasets WHERE path='encuestas/encuestas.json'`;
  // Si todavía no se ha importado la política, no se permiten encuestas ni archivos que las contienen.
  return !rows[0] || pollsHidden(rows[0].veda);
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  try {
    const sql = connection();
    if (path.length === 0) {
      const [datasets, publications] = await sql.begin(
        'read only isolation level repeatable read',
        (tx) =>
          Promise.all([
            tx`SELECT path,sha256,updated_at FROM congreso_datasets ORDER BY path`,
            tx`SELECT id,created_at,source_revision,counts FROM congreso_publications ORDER BY created_at DESC LIMIT 1`,
          ]),
      );
      return Response.json(
        {
          version: 1,
          atribucion: {
            origen: 'Escaño Abierto',
            url: 'https://www.escanoabierto.com',
            licencia: 'CC BY 4.0',
            encuestas: 'CC BY-SA 4.0',
          },
          publicacion: publications[0] ?? null,
          conjuntos: datasets,
          endpoints: [
            'datasets/<ruta.json>',
            'votaciones',
            'preguntas',
            'sesiones',
            'sesiones/<id>',
            'descarga',
          ],
        },
        { headers: cached },
      );
    }
    if (path[0] === 'datasets') {
      const file = path.slice(1).join('/');
      if (!/^[\w/-]+\.json$/.test(file) || file.includes('..') || file.length > 160)
        return error(400, 'Ruta de datos inválida');
      if (file.startsWith('encuestas/') && (await embargo()))
        return error(451, 'Encuestas ocultas durante el periodo de publicación restringida');
      const row = await dataset(file);
      if (!row) return error(404, 'Conjunto desconocido');
      schemaForDataset(file).parse(row.content);
      const etag = `"${row.sha256}"`;
      const responseHeaders = {
        ...(file.startsWith('encuestas/') ? { ...headers, 'Cache-Control': 'no-store' } : cached),
        ETag: etag,
        'X-Congreso-Publication': row.publication_id,
      };
      if (request.headers.get('if-none-match') === etag)
        return new Response(null, { status: 304, headers: responseHeaders });
      return Response.json(row.content, { headers: responseHeaders });
    }
    if (path[0] === 'descarga' && path.length === 1) {
      if (await embargo())
        return error(451, 'La descarga completa contiene encuestas y está temporalmente oculta');
      const rows =
        await sql`SELECT download_key FROM congreso_publications ORDER BY created_at DESC LIMIT 1`;
      if (!rows[0]?.download_key || !process.env.BLOB_READ_WRITE_TOKEN)
        return error(503, 'Descarga todavía no configurada');
      const url = z
        .url({ protocol: /^https$/, hostname: /^[a-z\d-]+\.private\.blob\.vercel-storage\.com$/ })
        .parse(rows[0].download_key);
      const result = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        cache: 'no-store',
        redirect: 'error',
      });
      if (!result.ok) return error(502, 'El archivo no está disponible');
      return new Response(result.body, {
        headers: {
          ...headers,
          'Content-Type': 'application/gzip',
          'Content-Disposition': 'attachment; filename="congreso.tar.gz"',
          'Cache-Control': 'no-store',
        },
      });
    }
    if (!['votaciones', 'preguntas', 'sesiones'].includes(path[0] || '') || path.length > 2)
      return error(404, 'Endpoint desconocido');
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return error(400, 'Filtros inválidos');
    const { pagina, limite, q, legislatura, desde, hasta, estado } = query.data;
    const offset = (pagina - 1) * limite;
    if (path.length === 2 && path[0] === 'votaciones') {
      const id = path[1];
      if (!id || !/^[a-zA-Z\d-]{1,80}$/.test(id)) return error(400, 'Identificador inválido');
      const rows = await sql`SELECT to_jsonb(v) AS votacion,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('diputado',d.name,'grupo',b.parliamentary_group,'voto',b.ballot) ORDER BY d.name)
          FROM congreso_ballots b JOIN congreso_deputies d ON d.legislature=b.legislature AND d.id=b.deputy_id
          WHERE b.legislature=v.legislature AND b.vote_id=v.id),'[]'::jsonb) AS votos
        FROM congreso_votes v WHERE v.legislature=${legislatura} AND v.id=${id}`;
      return rows[0]
        ? Response.json(jsonSchema.parse(rows[0]), { headers: cached })
        : error(404, 'Votación desconocida');
    }
    if (path.length === 2) {
      if (path[0] !== 'sesiones' || !path[1] || !/^DSCD-\d{1,2}-(PL|CO)-\d{1,5}$/.test(path[1]))
        return error(404, 'Recurso desconocido');
      const rows =
        await sql`SELECT content FROM congreso_sessions WHERE legislature=${legislatura} AND id=${path[1]}`;
      return rows[0]
        ? Response.json(jsonSchema.parse(rows[0]?.content), { headers: cached })
        : error(404, 'Sesión desconocida');
    }
    // COUNT y página pertenecen a la misma instantánea de la transacción.
    const result = await sql.begin('read only isolation level repeatable read', async (tx) => {
      if (path[0] === 'votaciones') {
        const filter = tx`legislature=${legislatura} AND title ILIKE ${like(q)}
          AND (${desde ?? null}::date IS NULL OR date>=${desde ?? null}::date)
          AND (${hasta ?? null}::date IS NULL OR date<=${hasta ?? null}::date)`;
        const count = await tx`SELECT count(*)::int AS total FROM congreso_votes WHERE ${filter}`;
        const rows =
          await tx`SELECT * FROM congreso_votes WHERE ${filter} ORDER BY date DESC NULLS LAST,id LIMIT ${limite} OFFSET ${offset}`;
        return { total: z.number().parse(count[0]?.total), resultados: rows };
      }
      if (path[0] === 'preguntas') {
        const filter = tx`legislature=${legislatura} AND title ILIKE ${like(q)}
          AND (${estado}='' OR status=${estado})
          AND (${desde ?? null}::date IS NULL OR date>=${desde ?? null}::date)
          AND (${hasta ?? null}::date IS NULL OR date<=${hasta ?? null}::date)`;
        const count =
          await tx`SELECT count(*)::int AS total FROM congreso_questions WHERE ${filter}`;
        const rows =
          await tx`SELECT content FROM congreso_questions WHERE ${filter} ORDER BY date DESC NULLS LAST,id LIMIT ${limite} OFFSET ${offset}`;
        return {
          total: z.number().parse(count[0]?.total),
          resultados: rows.map((row) => row.content),
        };
      }
      const filter = tx`legislature=${legislatura}
        AND (${desde ?? null}::date IS NULL OR date>=${desde ?? null}::date)
        AND (${hasta ?? null}::date IS NULL OR date<=${hasta ?? null}::date)
        AND content->>'organo' ILIKE ${like(q)}`;
      const count = await tx`SELECT count(*)::int AS total FROM congreso_sessions WHERE ${filter}`;
      const rows =
        await tx`SELECT id,date,content->>'organo' AS organo,jsonb_array_length(content->'intervenciones') AS intervenciones
        FROM congreso_sessions WHERE ${filter} ORDER BY date DESC NULLS LAST,id LIMIT ${limite} OFFSET ${offset}`;
      return { total: z.number().parse(count[0]?.total), resultados: rows };
    });
    return Response.json({ pagina, limite, ...result }, { headers: cached });
  } catch {
    return error(503, 'Los datos del Congreso no están disponibles temporalmente');
  }
}
