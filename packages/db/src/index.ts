import postgres from 'postgres';
let client: ReturnType<typeof postgres> | undefined;
export function databaseAvailable(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (process.env.VERCEL && /@(?:127\.0\.0\.1|localhost)(?::|\/|$)/.test(url)) return false;
  return true;
}
export function connection() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada');
  client ??= postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}
export async function closeDb() {
  await client?.end();
  client = undefined;
}
