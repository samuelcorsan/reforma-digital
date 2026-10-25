import { cn } from '@reforma-digital/design/lib/utils';
import type { Mark } from '../../lib/elecciones/interviews';
import { Icon, type IconName } from '../brand/icon';

// El icono de cada marca de una entrevista: el mismo en la línea de tiempo, en la leyenda y en las
// calificaciones.
export const markIcons: Record<Mark['kind'], IconName> = {
  momento: 'estrella',
  completa: 'diana',
  casi: 'casi',
  legal: 'hecho',
  amarilla: 'balanza',
  fuera: 'aviso',
  roja: 'nunca',
  repregunta: 'repetir',
  evasiva: 'esquiva',
  critica: 'contacto',
  ataque: 'rayo',
  interrumpe: 'tijeras',
  interrumpido: 'silencio',
  verificador: 'buscar',
  rotulo: 'pantalla',
  documento: 'documento',
  accion: 'mano',
};

// Cómo responde a cada pregunta: un cuadrado de tinta (directa) a trama (cambio de tema).
export const answerStyles = {
  directa: 'bg-foreground',
  parcial: 'bg-muted-foreground/60',
  evasiva: 'bg-muted-foreground/25',
  cambio:
    'bg-[repeating-linear-gradient(45deg,var(--border)_0_3px,transparent_3px_6px)] ring-1 ring-border',
} as const;

// Un icono en su círculo. Con color (las calificaciones), una pastilla tintada: fondo claro del
// color, icono en su tono oscuro y un canto fino del mismo tono. Sin color, blanca con canto gris.
// Decorativo: el texto de al lado dice qué es.
export function IconChip({
  name,
  color,
  className,
}: {
  name: IconName;
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full',
        !color && 'bg-background text-foreground ring-1 ring-foreground/15',
        className,
      )}
      style={
        color
          ? {
              background: `color-mix(in oklab, ${color} 16%, var(--background))`,
              color: `color-mix(in oklab, ${color} 78%, black)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 40%, transparent)`,
            }
          : undefined
      }
    >
      <Icon name={name} size={15} />
    </span>
  );
}

// La marca de una entrevista con su icono.
export const MarkIcon = ({
  kind,
  ...props
}: { kind: Mark['kind'] } & Omit<Parameters<typeof IconChip>[0], 'name'>) => (
  <IconChip name={markIcons[kind]} {...props} />
);
