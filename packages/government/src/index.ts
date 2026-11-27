import type { Source } from '@reforma-digital/core';
const define = (
  id: string,
  name: string,
  baseUrl: string,
  hosts: string[],
  jurisdictionValue: string,
): Source => ({
  id,
  name,
  baseUrl,
  hosts,
  organization: name,
  jurisdictionType:
    jurisdictionValue === 'ES'
      ? 'country'
      : jurisdictionValue === 'ES-MD'
        ? 'region'
        : 'municipality',
  jurisdictionValue,
  authorityScore: id === 'administracion' ? 80 : 100,
  enabled: true,
});
export const sources: Source[] = [
  define(
    'administracion',
    'Punto de Acceso General',
    'https://administracion.gob.es',
    ['administracion.gob.es'],
    'ES',
  ),
  define(
    'interior',
    'Ministerio del Interior',
    'https://www.interior.gob.es',
    ['www.interior.gob.es', 'interior.gob.es'],
    'ES',
  ),
  define('boe', 'Boletín Oficial del Estado', 'https://www.boe.es', ['www.boe.es', 'boe.es'], 'ES'),
  define(
    'aeat',
    'Agencia Tributaria',
    'https://sede.agenciatributaria.gob.es',
    ['sede.agenciatributaria.gob.es', 'www3.agenciatributaria.gob.es'],
    'ES',
  ),
  define(
    'seg-social',
    'Seguridad Social · Importass',
    'https://portal.seg-social.gob.es',
    ['portal.seg-social.gob.es', 'www.seg-social.es', 'sede.seg-social.gob.es'],
    'ES',
  ),
  define(
    'dgt',
    'Dirección General de Tráfico',
    'https://sede.dgt.gob.es',
    ['sede.dgt.gob.es', 'www.dgt.es'],
    'ES',
  ),
  define(
    'sepe',
    'Servicio Público de Empleo Estatal',
    'https://www.sepe.es',
    ['www.sepe.es', 'sede.sepe.gob.es'],
    'ES',
  ),
  define(
    'educacion',
    'Ministerio de Educación',
    'https://www.becaseducacion.gob.es',
    ['www.becaseducacion.gob.es', 'www.educacionfpydeportes.gob.es', 'sede.educacion.gob.es'],
    'ES',
  ),
  define(
    'comunidad-madrid',
    'Comunidad de Madrid',
    'https://www.comunidad.madrid',
    ['www.comunidad.madrid', 'sede.comunidad.madrid'],
    'ES-MD',
  ),
  define(
    'ayuntamiento-madrid',
    'Ayuntamiento de Madrid',
    'https://sede.madrid.es',
    ['sede.madrid.es', 'www.madrid.es'],
    'ES-MD-MADRID',
  ),
];
export function approvedSource(url: string, sourceId?: string): Source | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return;
    return sources.find(
      (s) => s.enabled && (!sourceId || s.id === sourceId) && s.hosts.includes(u.hostname),
    );
  } catch {
    return;
  }
}
export function canonicalize(url: string): string {
  const u = new URL(url);
  u.hash = '';
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid|gclid|print$|imprimir$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.toString();
}
export function sourceById(id: string): Source {
  const s = sources.find((s) => s.id === id && s.enabled);
  if (!s) throw new Error('Fuente no aprobada: ' + id);
  return s;
}
/** decodeURI throws on a literal "%" ("IVA del 21%") or a non-UTF-8 escape; keep the raw text. */
function safeDecodeURI(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}
export function documentJurisdiction(source: Source, title: string, url: string): string {
  if (source.jurisdictionValue !== 'ES') return source.jurisdictionValue;
  const scope = `${safeDecodeURI(title)} ${safeDecodeURI(url)}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const regions: [RegExp, string][] = [
    [/asturias/, 'ES-AS'],
    [/andalucia/, 'ES-AN'],
    [/aragon/, 'ES-AR'],
    [/illes.balears|islas.baleares/, 'ES-IB'],
    [/canarias/, 'ES-CN'],
    [/cantabria/, 'ES-CB'],
    [/castilla.la.mancha/, 'ES-CM'],
    [/castilla.y.leon/, 'ES-CL'],
    [/cataluna|catalunya/, 'ES-CT'],
    [/comunitat.valenciana|comunidad.valenciana/, 'ES-VC'],
    [/extremadura/, 'ES-EX'],
    [/galicia/, 'ES-GA'],
    [/comunidad.de.madrid|comunidad-autonoma-madrid/, 'ES-MD'],
    [/region.de.murcia/, 'ES-MC'],
    [/navarra/, 'ES-NC'],
    [/pais.vasco|euskadi/, 'ES-PV'],
    [/la.rioja/, 'ES-RI'],
    [/ceuta/, 'ES-CE'],
    [/melilla/, 'ES-ML'],
  ];
  const matches = regions.filter(([re]) => re.test(scope));
  return matches.length === 1 ? matches[0]![1] : source.jurisdictionValue;
}
export function documentYear(title: string, url: string): number | null {
  const match = (title + ' ' + url).match(
    /(?:irpf[ -]|manual[^/]*?|renta[ -]|curso[ -])(20\d{2})/i,
  );
  return match ? Number(match[1]) : null;
}
