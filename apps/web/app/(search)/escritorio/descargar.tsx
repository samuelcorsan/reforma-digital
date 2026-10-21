'use client';

import { useSyncExternalStore, type ComponentProps } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { ButtonGroup } from '@reforma-digital/design/ui/button-group';
import { Dialog, DialogTrigger } from '@reforma-digital/design/ui/dialog';

import { Icon } from '../../../components/brand/icon';
import { plataformas, type Sistema } from './descargas';
import { Logo } from './logos';
import { GuiaMac } from './guia-mac';

export function EnlaceDescarga({ sistema, ...props }: ComponentProps<'a'> & { sistema: Sistema }) {
  if (sistema !== 'macos') return <a {...props} />;

  return (
    <Dialog>
      <DialogTrigger nativeButton={false} role="link" render={<a {...props} />} />
      <GuiaMac />
    </Dialog>
  );
}

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
      <EnlaceDescarga sistema={tuya.id} href={tuya.archivos[0]?.url} {...boton('sunset')}>
        <Logo sistema={tuya.id} /> Descargar para {tuya.nombre}
      </EnlaceDescarga>
      {plataformas
        .filter((p) => p !== tuya)
        .map((p) => (
          <EnlaceDescarga
            sistema={p.id}
            key={p.id}
            href={p.archivos[0]?.url}
            aria-label={`Descargar para ${p.nombre}`}
            title={p.nombre}
            {...boton('outline', 'w-11 px-0')}
          >
            <Logo sistema={p.id} />
          </EnlaceDescarga>
        ))}
    </ButtonGroup>
  );
}
