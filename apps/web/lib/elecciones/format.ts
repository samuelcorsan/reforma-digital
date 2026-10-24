// es-ES no agrupa los números de cuatro cifras («1340»); aquí siempre llevan punto de miles.
export const thousands = (value: number) =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// «12,3»: siempre con `digits` decimales.
export const decimal = (n: number, digits = 1) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
// «12,3 %» a partir de una parte (0,123).
export const percent = (share: number, digits = 1) => `${decimal(share * 100, digits)}\u00a0%`;
// «+1,2», «−0,4» o «±0,0».
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${decimal(Math.abs(n))}`;
// Lo probable que es algo, sin decir nunca 0 ni 100 %.
export const chance = (p: number) =>
  p >= 0.995 ? '> 99\u00a0%' : p <= 0.005 ? '< 1\u00a0%' : `${Math.round(p * 100)}\u00a0%`;

// Los días desde 1970 de una fecha ISO, para medir distancias entre fechas.
export const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 864e5;
// Una fecha ISO como año con decimales, para los ejes de tiempo.
export const time = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return y + (m - 1) / 12 + (d - 1) / 365;
};
// Una fecha ISO con el formato que se pida.
export const formatDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...options }).format(
    new Date(`${iso}T00:00:00Z`),
  );
// «29 sept 2026» y «29 de septiembre de 2026». Fijos para los gráficos, que formatean muchas fechas.
const short = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const shortDate = (iso: string) => short.format(new Date(`${iso}T00:00:00Z`));
const long = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
export const longDate = (iso: string) => long.format(new Date(`${iso}T00:00:00Z`));

// El color de una provincia en un mapa de intensidad: de apenas visible (t = 0) al color entero
// (t = 1). En tinta para los votos por escaño y en rojo para los votos que no sirvieron.
export const ramp = (mode: 'price' | 'lost', t: number) =>
  `color-mix(in oklab, ${mode === 'price' ? 'var(--foreground)' : 'var(--brand)'} ${Math.round(12 + 78 * Math.max(0, Math.min(1, t)))}%, var(--muted))`;

// Texto oscuro o claro sobre un color de fondo (en `#rrggbb`): el de más contraste según WCAG.
export const ink = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // #1A1A1A tiene una luminancia de 0,0103.
  return (l + 0.05) / 0.0603 > 1.05 / (l + 0.05) ? '#1A1A1A' : '#FFFFFF';
};

// El año de una elección y, si ese año hubo dos (2019), también el mes.
const shortMonth = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'short' });
export const electionLabel = (all: { fecha: string }[], fecha: string) =>
  all.filter((x) => x.fecha.slice(0, 4) === fecha.slice(0, 4)).length > 1
    ? `${fecha.slice(0, 4)} ${shortMonth.format(new Date(`${fecha}T00:00:00Z`))}`
    : fecha.slice(0, 4);
