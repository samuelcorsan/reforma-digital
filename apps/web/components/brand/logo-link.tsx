'use client';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@reforma-digital/design/ui/context-menu';
import Link from 'next/link';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { LogoMark, logoSvg } from './logo';

// Plegado, el logotipo es un icono: un clic vuelve arriba en vez de cambiar de página. Con el
// botón derecho (o pulsación larga) se copia la R en SVG.
export function LogoLink({ className, children }: { className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copia, setCopia] = useState<'copiado' | 'error' | null>(null);

  function onClick(event: MouseEvent) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified || window.scrollY < 40) return;
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  // El menú se queda abierto un momento para que se vea que se ha copiado.
  async function copiar() {
    try {
      await navigator.clipboard.writeText(logoSvg);
      setCopia('copiado');
    } catch {
      setCopia('error');
    }
    setTimeout(() => setOpen(false), 900);
  }

  return (
    <ContextMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCopia(null);
      }}
    >
      <ContextMenuTrigger
        render={
          <Link
            href="/"
            aria-label="Reforma Digital, portada de la iniciativa"
            className={className}
            onClick={onClick}
          />
        }
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem closeOnClick={false} onClick={copiar}>
          <span className="flex w-4 justify-center">
            <LogoMark size={14} />
          </span>
          {copia === 'copiado'
            ? 'Logo copiado'
            : copia === 'error'
              ? 'No se ha podido copiar'
              : 'Copiar el logo'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
