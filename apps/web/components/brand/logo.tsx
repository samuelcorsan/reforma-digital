import { Logotipo } from '@reforma-digital/design/ui/logotipo';
import type { ReactNode } from 'react';

const cuerpo = 'M48 0H96V48H48V96H96V144H48V192H0V48H48ZM96 48H144V96H96ZM96 144H144V192H96Z';
const doblez = 'M0 48L48 0V48Z';

// La R en SVG con los colores de marca, para copiarla desde el menú del logotipo.
export const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="192" viewBox="0 0 144 192"><path fill="#df1717" d="${cuerpo}"/><path fill="#a50e0e" d="${doblez}"/></svg>`;

// Logo: R con la esquina doblada. El cuerpo toma el color del texto; el doblez va en --doblez.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={(size * 3) / 4} height={size} viewBox="0 0 144 192" aria-hidden="true">
      <path fill="var(--logo-color, currentColor)" d={cuerpo} />
      <path fill="var(--brand-dark, #a50e0e)" d={doblez} />
    </svg>
  );
}

// Logo completo: la R y «Reforma / Digital» en dos líneas, separados por un módulo (1/4 de la R).
// `size` es el alto de la R. El tamaño de letra solo fija las medidas en em de `.marca`. `mark`
// sustituye a la R (en el pie, la R puzle).
export function Logo({ size = 28, mark }: { size?: number; mark?: ReactNode }) {
  return (
    <span className={'marca inline-flex items-center [gap:0.5em]'} style={{ fontSize: size / 2 }}>
      {mark ?? <LogoMark size={size} />}
      <span className={'marca-texto flex'}>
        <Logotipo size={size} />
      </span>
    </span>
  );
}
