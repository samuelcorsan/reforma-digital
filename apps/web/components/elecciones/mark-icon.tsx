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
};

// Sobre el verde y el rojo, el icono va en blanco; sobre el amarillo y el naranja, en tinta.
export const iconInk = (kind: Mark['kind']) =>
  kind === 'legal' || kind === 'roja' ? '#fff' : undefined;

// El icono en su círculo, con el color de la marca si lo tiene. Decorativo: el texto de al lado
// dice qué es.
export function MarkIcon({ kind, color }: { kind: Mark['kind']; color?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-background ring-1 ring-foreground/20"
      style={{ background: color, color: iconInk(kind) }}
    >
      <Icon name={markIcons[kind]} size={16} />
    </span>
  );
}
