import { useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Icono } from './icono';

/**
 * El icono de la web, del servicio de favicons de Google a través del servidor de Reforma Digital
 * (`/icono` en el proceso principal). Solo se envía el origen, sin ruta, y al mostrarse; si no
 * carga, se dibuja un globo.
 */
export function Favicon({ url, className }: { url: string; className?: string }) {
  const [falla, setFalla] = useState(false);
  const base = cn('size-5 shrink-0 rounded-full bg-background', className);
  if (falla)
    return (
      <span className={cn(base, 'grid place-items-center bg-muted text-muted-foreground')}>
        <Icono nombre="web" size={12} />
      </span>
    );
  return (
    <img
      src={`/icono?origen=${encodeURIComponent(URL.parse(url)?.origin ?? '')}`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      onError={() => setFalla(true)}
      className={base}
    />
  );
}
