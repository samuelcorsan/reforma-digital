// Quién presenta las leyes que caducan, con su color: el mismo en la portada y en «Lo que caduca».
export const origins = [
  ['GRUPOS', 'Grupos', '#2A7DB5'],
  ['GOB', 'Gobierno', '#7152A8'],
  ['SEN', 'Senado', '#C9962A'],
  ['CCAA', 'CCAA', '#83AE6E'],
] as const;
export const originColor = (id: string) => origins.find(([o]) => o === id)?.[2] ?? '#888888';

// Hasta dónde llegó una ley (la `etapa` de los datos): en plural para contarlas y en singular para
// una sola. La etapa 5 es ley.
export const stages = [
  'Presentadas',
  'Admitidas a debate',
  'Informe en comisión',
  'Aprobadas en el Congreso',
  'Pasaron por el Senado',
  'Leyes',
] as const;
export const stage = [
  'Presentada, sin admitir a debate',
  'Admitida a debate',
  'Con informe en comisión',
  'Aprobada en el Congreso',
  'Pasó por el Senado',
  'Ley',
] as const;

// Quién la presentó: el Gobierno, un grupo, el Senado, un parlamento autonómico o varios grupos juntos.
export const presenter = (authors: readonly string[]) =>
  authors.length === 1 && authors[0] ? authors[0] : 'VARIOS';
const names: Record<string, string> = {
  GOB: 'Gobierno',
  SEN: 'Senado',
  CCAA: 'Parlamentos autonómicos',
  VARIOS: 'Varios grupos',
  MIXTO: 'Grupo Mixto',
  SUMAR: 'Sumar',
  VOX: 'Vox',
  BILDU: 'EH Bildu',
  JUNTS: 'Junts',
};
export const presenterName = (id: string) => names[id] ?? id;
export const presenterColor = (id: string, groups: Record<string, { color: string }>) =>
  id === 'VARIOS' ? '#A7A9AE' : (groups[id]?.color ?? originColor(id));
