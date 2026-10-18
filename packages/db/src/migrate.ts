import { readFile } from 'node:fs/promises';
import { connection, closeDb } from './index';
const sql = connection();
try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(492771)`;
    for (const id of [
      '0001_initial',
      '0002_applicability',
      '0004_retire_document_index',
      '0005_congreso',
      '0006_congreso_month_rows',
      '0007_congreso_search',
    ]) {
      const done = await tx`SELECT id FROM schema_migrations WHERE id=${id}`;
      if (!done.length) {
        await tx.unsafe(
          await readFile(new URL('../migrations/' + id + '.sql', import.meta.url), 'utf8'),
        );
        await tx`INSERT INTO schema_migrations(id) VALUES(${id})`;
      }
    }
  });
  console.log('Migraciones aplicadas.');
} finally {
  await closeDb();
}
