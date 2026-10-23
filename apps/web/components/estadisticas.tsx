'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** El identificador de esta pestaña, solo en memoria: no se guarda y cambia al recargar. */
const sesion = crypto.randomUUID();

/** Cuenta un evento en las estadísticas de uso (api/eventos), que solo admite los de su lista. */
export function contar(evento: string, datos: Record<string, string> = {}) {
  navigator.sendBeacon('/api/eventos', JSON.stringify({ ...datos, evento, sesion }));
}

/** Cuenta cada página vista, sin la query ni el fragmento. */
export function Estadisticas() {
  const ruta = usePathname();
  useEffect(() => contar('$pageview', { ruta }), [ruta]);
  return null;
}
