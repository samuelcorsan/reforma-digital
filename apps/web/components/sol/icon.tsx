// Iconos Sol: chevrons pixelados y Nucleo UI Essential (outline 18). Decorativos: el texto o el
// aria-label del control que los contiene da el nombre.
import type { ComponentType } from 'react';
import {
  IconBookOpenOutline18,
  IconCalendarOutline18,
  IconCheckOutline18,
  IconCircleCompose2Outline18,
  IconCircleInfoOutline18,
  IconClipboardOutline18,
  IconCreditCardOutline18,
  IconFileContentOutline18,
  IconInboxArrowDownOutline18,
  IconLinkOutline18,
  IconLocation2Outline18,
  IconLockOutline18,
  IconMagnifierOutline18,
  IconMsgsOutline18,
  IconPaperclipOutline18,
  IconPhoneOutline18,
  IconRefresh2Outline18,
  IconShieldCheckOutline18,
  IconThumbsUpOutline18,
  IconTriangleWarningOutline18,
  IconUserOutline18,
  IconXmarkOutline18,
} from 'nucleo-ui-essential-outline-18';

type Svg = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: true }>;

// Nucleo UI no trae «detener»: cuadrado redondeado propio sobre la misma rejilla de 18.
function Detener({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" className={className} aria-hidden="true">
      <rect x="4.5" y="4.5" width="9" height="9" rx="2" fill="currentColor" />
    </svg>
  );
}

// Nucleo UI Essential has no straight arrows: same 18 grid, 1.5 stroke and round caps as its chevrons.
const arrow = (d: string) =>
  function Arrow({ size, className }: { size?: number; className?: string }) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" className={className} aria-hidden="true">
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

const iconos = {
  arrowUp: arrow('M9 15V3.5M4 8.25 9 3.25l5 5'),
  arrowUpRight: arrow('M5 13 13 5M6.5 5H13v6.5'),
  paperclip: IconPaperclipOutline18,
  detener: Detener,
  descargar: IconInboxArrowDownOutline18,
  externo: IconLinkOutline18,
  copiar: IconClipboardOutline18,
  util: IconThumbsUpOutline18,
  noUtil: IconThumbsUpOutline18,
  reintentar: IconRefresh2Outline18,
  nueva: IconCircleCompose2Outline18,
  cerrar: IconXmarkOutline18,
  buscar: IconMagnifierOutline18,
  fuentes: IconBookOpenOutline18,
  contacto: IconMsgsOutline18,
  protegido: IconShieldCheckOutline18,
  info: IconCircleInfoOutline18,
  error: IconTriangleWarningOutline18,
  nunca: IconXmarkOutline18,
  hecho: IconCheckOutline18,
  candado: IconLockOutline18,
  calendario: IconCalendarOutline18,
  documento: IconFileContentOutline18,
  ubicacion: IconLocation2Outline18,
  usuario: IconUserOutline18,
  tarjeta: IconCreditCardOutline18,
  telefono: IconPhoneOutline18,
} satisfies Record<string, Svg>;

const pixelTurn = { derecha: 0, abajo: 90, izquierda: 180, enviar: -90 } as const;

// «Más»: cinco puntos en cruz; girado 45° hace de cierre. «Menos»: los tres de la fila central.
const pixelSigno = {
  mas: 'M6 0h3v3H6zM0 6h3v3H0zM6 6h3v3H6zM12 6h3v3h-3zM6 12h3v3H6z',
  menos: 'M0 6h3v3H0zM6 6h3v3H6zM12 6h3v3h-3z',
} as const;

export type IconName = keyof typeof iconos | keyof typeof pixelTurn | keyof typeof pixelSigno;
const isPixel = (name: IconName): name is keyof typeof pixelTurn => name in pixelTurn;
const isSigno = (name: IconName): name is keyof typeof pixelSigno => name in pixelSigno;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  if (isSigno(name)) {
    return (
      <svg
        className="icono"
        width={size}
        height={size}
        viewBox="0 0 15 15"
        fill="currentColor"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d={pixelSigno[name]} />
      </svg>
    );
  }
  if (isPixel(name)) {
    return (
      <svg
        className="icono"
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
  // «No útil» es el pulgar de «útil» girado: Nucleo UI no trae pulgar abajo.
  const clase = name === 'noUtil' ? 'icono icono-girado' : 'icono';
  return <Componente size={size} className={clase} aria-hidden />;
}
