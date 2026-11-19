// Fechas y horas con zona, como las usa renfe-cli con zoneinfo. Un instante es un número de milisegundos UTC; un día
// es 'AAAA-MM-DD'. Basta Intl: no hace falta ninguna dependencia.

import { TIMEZONE } from './config';

export const MADRID = TIMEZONE;
const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const formats = new Map<string, Intl.DateTimeFormat>();
function format(tz: string) {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formats.set(tz, f);
  }
  return f;
}

export type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number };

/** La hora de pared de un instante en una zona. */
export function wall(ms: number, tz = MADRID): Wall {
  const parts = Object.fromEntries(
    format(tz)
      .formatToParts(new Date(ms))
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    y: parts.year!,
    mo: parts.month!,
    d: parts.day!,
    h: parts.hour!,
    mi: parts.minute!,
    s: parts.second!,
  };
}

/** Minutos de diferencia con UTC en ese instante. */
export function offset(ms: number, tz = MADRID): number {
  const w = wall(ms, tz);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MINUTE);
}

/** El instante de una hora de pared en una zona (en un cambio de hora, la primera que existe). */
export function zoned(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, tz = MADRID): number {
  const utc = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = utc - offset(utc, tz) * MINUTE;
  return utc - offset(first, tz) * MINUTE;
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

export function offsetText(minutes: number) {
  return `${minutes < 0 ? '-' : '+'}${pad(Math.trunc(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

/** Como `datetime.isoformat()` de Python para una hora con zona: 2027-01-29T08:57:00+01:00. */
export function iso(ms: number, tz = MADRID): string {
  const w = wall(ms, tz);
  const frac = ((ms % 1000) + 1000) % 1000;
  const micro = frac ? `.${pad(frac, 3)}000` : '';
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${micro}${offsetText(offset(ms, tz))}`;
}

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,6}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** Como `datetime.fromisoformat`: el instante y si traía zona. Sin zona, se lee como hora de `tz`. */
export function parseIso(text: string, tz = MADRID): { ms: number; aware: boolean } | undefined {
  const m = ISO.exec(text);
  if (!m) return undefined;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const frac = m[7] ? Math.floor(Number(`0.${m[7]}`) * 1000) : 0;
  if (!m[8]) return { ms: zoned(y, mo, d, h, mi, s, tz) + frac, aware: false };
  const zone = m[8];
  let shift = 0;
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    const digits = zone.slice(1).replace(':', '');
    shift = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || '0'));
  }
  return { ms: Date.UTC(y, mo - 1, d, h, mi, s) + frac - shift * MINUTE, aware: true };
}

/** La hora local escrita en un texto ISO, en minutos desde medianoche (lo que da `.time()` en Python). */
export function minutesOfDay(text: string) {
  return Number(text.slice(11, 13)) * 60 + Number(text.slice(14, 16));
}

export function today(ms: number, tz = MADRID): string {
  const w = wall(ms, tz);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function dayParts(day: string): [number, number, number] {
  return day.split('-').map(Number) as [number, number, number];
}

/** Medianoche de un día en una zona. */
export function midnight(day: string, tz = MADRID): number {
  const [y, mo, d] = dayParts(day);
  return zoned(y, mo, d, 0, 0, 0, tz);
}

/** `midnight(day) + timedelta(seconds)` como lo suma Python: en hora de pared, y luego se vuelve a la zona. */
export function wallPlus(day: string, seconds: number, tz = MADRID): number {
  const [y, mo, d] = dayParts(day);
  const naive = new Date(Date.UTC(y, mo - 1, d) + seconds * 1000);
  return zoned(
    naive.getUTCFullYear(),
    naive.getUTCMonth() + 1,
    naive.getUTCDate(),
    naive.getUTCHours(),
    naive.getUTCMinutes(),
    naive.getUTCSeconds(),
    tz,
  );
}

/** Un instante movido `days` días enteros en hora de pared (como restar `timedelta(days=n)` en Python). */
export function shiftDays(ms: number, days: number, tz = MADRID): number {
  const w = wall(ms, tz);
  const day = addDays(`${w.y}-${pad(w.mo)}-${pad(w.d)}`, days);
  return wallPlus(day, w.h * 3600 + w.mi * 60 + w.s, tz) + (((ms % 1000) + 1000) % 1000);
}

/** `round()` de Python: a par en el empate. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function weekday(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0, como date.weekday()
}
