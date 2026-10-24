// Iconos Sol: chevrons pixelados y Nucleo UI Essential (outline 18). Decorativos: el texto o el
// aria-label del control que los contiene da el nombre.
import type { ComponentType } from 'react';
import {
  IconBoltOutline18,
  IconCalendarOutline18,
  IconCheckOutline18,
  IconCircleHalfDottedCheckOutline18,
  IconCircleInfoOutline18,
  IconClipboardOutline18,
  IconCreditCardOutline18,
  IconEyeClosedOutline18,
  IconFileContentOutline18,
  IconInboxArrowDownOutline18,
  IconLinkOutline18,
  IconLocation2Outline18,
  IconLockOutline18,
  IconMagnifierOutline18,
  IconMicrophoneSlashOutline18,
  IconMsgsOutline18,
  IconPhoneOutline18,
  IconRefresh2Outline18,
  IconScaleOutline18,
  IconScissorsOutline18,
  IconStarOutline18,
  IconTargetOutline18,
  IconTriangleWarningOutline18,
  IconUserOutline18,
  IconXmarkOutline18,
} from 'nucleo-ui-essential-outline-18';

type Svg = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: true }>;

const iconos = {
  descargar: IconInboxArrowDownOutline18,
  externo: IconLinkOutline18,
  copiar: IconClipboardOutline18,
  buscar: IconMagnifierOutline18,
  contacto: IconMsgsOutline18,
  info: IconCircleInfoOutline18,
  nunca: IconXmarkOutline18,
  hecho: IconCheckOutline18,
  candado: IconLockOutline18,
  calendario: IconCalendarOutline18,
  documento: IconFileContentOutline18,
  ubicacion: IconLocation2Outline18,
  usuario: IconUserOutline18,
  tarjeta: IconCreditCardOutline18,
  telefono: IconPhoneOutline18,
  // Las marcas de la línea de tiempo de las entrevistas.
  estrella: IconStarOutline18,
  diana: IconTargetOutline18,
  casi: IconCircleHalfDottedCheckOutline18,
  balanza: IconScaleOutline18,
  aviso: IconTriangleWarningOutline18,
  repetir: IconRefresh2Outline18,
  esquiva: IconEyeClosedOutline18,
  rayo: IconBoltOutline18,
  tijeras: IconScissorsOutline18,
  silencio: IconMicrophoneSlashOutline18,
} satisfies Record<string, Svg>;

const pixelTurn = { derecha: 0, abajo: 90, izquierda: 180, arriba: 270 } as const;
// Reproducir y pausa, en píxel como los chevrons: Nucleo no los tiene.
const pixelGlyph = {
  reproducir: 'M4 2h3v12H4zM7 4h3v8H7zM10 6h3v4h-3z',
  pausa: 'M3 2h4v12H3zM9 2h4v12H9z',
} as const;

export type IconName =
  keyof typeof iconos | keyof typeof pixelTurn | keyof typeof pixelGlyph | 'mas';
const isPixel = (name: IconName): name is keyof typeof pixelTurn => name in pixelTurn;
const isGlyph = (name: IconName): name is keyof typeof pixelGlyph => name in pixelGlyph;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  // «Más»: cinco puntos en cruz; girado 45° hace de cierre.
  if (name === 'mas') {
    return (
      <svg
        className={'icono shrink-0'}
        width={size}
        height={size}
        viewBox="0 0 15 15"
        fill="currentColor"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d="M6 0h3v3H6zM0 6h3v3H0zM6 6h3v3H6zM12 6h3v3h-3zM6 12h3v3H6z" />
      </svg>
    );
  }
  if (isGlyph(name)) {
    return (
      <svg
        className={'icono shrink-0'}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="currentColor"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d={pixelGlyph[name]} />
      </svg>
    );
  }
  if (isPixel(name)) {
    return (
      <svg
        className={'icono shrink-0'}
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="currentColor"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path
          transform={`rotate(${pixelTurn[name]} 8 8)`}
          d="M4 0h3v3H4zM7 3h3v3H7zM10 6h3v3h-3zM7 9h3v3H7zM4 12h3v3H4z"
        />
      </svg>
    );
  }
  const Componente: Svg = iconos[name];
  return <Componente size={size} className="icono" aria-hidden />;
}
