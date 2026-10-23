'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { ButtonGroup } from '@reforma-digital/design/ui/button-group';

import { Icon } from '../../../components/brand/icon';
import { contar } from '../../../components/estadisticas';
import { plataformas, type Sistema } from './descargas';
import { Logo } from './logos';

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

const boton = (variant: 'sunset' | 'outline', className?: string) => ({
  'data-slot': 'button',
  'data-variant': variant,
  className: cn(buttonVariants({ variant, size: 'xl' }), className),
});

/**
 * El botón principal descarga la app para tu sistema; los demás sistemas van al lado, solo con su
 * logo, en el mismo grupo.
 */
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
    <ButtonGroup aria-label="Descargar la app">
      <a
        href={tuya.archivos[0]?.url}
        onClick={() => contar('descarga_escritorio', { sistema: tuya.id })}
        {...boton('sunset')}
      >
        <Logo sistema={tuya.id} /> Descargar para {tuya.nombre}
      </a>
      {plataformas
        .filter((p) => p !== tuya)
        .map((p) => (
          <a
            key={p.id}
            href={p.archivos[0]?.url}
            onClick={() => contar('descarga_escritorio', { sistema: p.id })}
            aria-label={`Descargar para ${p.nombre}`}
            title={p.nombre}
            {...boton('outline', 'w-11 px-0')}
          >
            <Logo sistema={p.id} />
          </a>
        ))}
    </ButtonGroup>
  );
}
