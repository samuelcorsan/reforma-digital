'use client';

import { useSyncExternalStore } from 'react';
import { toDay } from '../../lib/elecciones/format';

// Hoy en Madrid. Las páginas de las entrevistas se guardan en caché, así que la cuenta se hace en el
// navegador; en el servidor no se pinta nada.
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const noop = () => () => {};

// « · mañana», « · en 3 días»…; nada si la fecha ya ha pasado.
export function DaysUntil({ date }: { date: string }) {
  const now = useSyncExternalStore(noop, today, () => null);
  if (!now) return null;
  const days = toDay(date) - toDay(now);
  if (days < 0) return null;
  return <> · {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}</>;
}
