'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';

import { Icon } from '../../../components/brand/icon';
import { plataformas, type Sistema } from './descargas';

/** El sistema del visitante, o null en el móvil (el iPad se presenta como Mac) y en ChromeOS. */
function detectar(): Sistema | null {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|CrOS/.test(ua)) return null;
  if (/Mac/.test(ua)) return navigator.maxTouchPoints > 1 ? null : 'macos';
  if (/Win/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return null;
}
const sinCambios = () => () => {};

const boton = (variant: 'sunset' | 'outline') => ({
  'data-slot': 'button',
  'data-variant': variant,
  className: cn(buttonVariants({ variant, size: 'xl' })),
});

/** El botón principal descarga la app para tu sistema; los demás sistemas van como secundarios. */
export function Descargar() {
  const sistema = useSyncExternalStore(sinCambios, detectar, () => null);
  const tuya = plataformas.find((p) => p.id === sistema);

  if (!tuya)
    return (
      <a href="#descargar" {...boton('sunset')}>
        Descargar <Icon name="abajo" size={16} />
      </a>
    );
  return (
    <>
      <a href={tuya.archivos[0]?.url} {...boton('sunset')}>
        Descargar para {tuya.nombre} <Icon name="descargar" size={16} />
      </a>
      {plataformas
        .filter((p) => p !== tuya)
        .map((p) => (
          <a
            key={p.id}
            href={p.archivos[0]?.url}
            aria-label={`Descargar para ${p.nombre}`}
            {...boton('outline')}
          >
            {p.nombre}
          </a>
        ))}
    </>
  );
}
