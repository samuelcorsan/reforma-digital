import Image from 'next/image';
import { cn } from '@reforma-digital/design/lib/utils';
import type { McpServer } from '../../lib/mcp/catalog';

/** El logo del servidor en una pieza blanca con borde. Decorativo: el nombre va al lado. */
export function ServerLogo({ logo, size = 'sm' }: { logo: McpServer['logo']; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 56 : 36;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center border border-border bg-background p-1',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-9 rounded-xl',
      )}
    >
      {/* Ficheros pequeños y locales: sin pasar por el optimizador. */}
      <Image
        src={logo.src}
        alt=""
        width={px}
        height={px}
        unoptimized
        className="size-full object-contain"
      />
    </span>
  );
}
