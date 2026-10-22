'use client';

import { useEffect, useState } from 'react';

// La R como puzle: 8 fichas en un tablero de 3 × 4 (casilla = fila * 3 + columna). La ficha 0 es
// la del doblez. Al pasar el ratón, las fichas se separan, se desordenan deslizándose a casillas
// vecinas vacías y vuelven a la R por el camino más corto.
const R = [0, 1, 3, 5, 6, 7, 9, 11];
const PASOS_DESORDEN = 10;
const PASO_MS = 400;
const PAUSA_PASOS = 3;

type Mov = [desde: number, hasta: number];

const vecinos = (c: number) =>
  [c - 3, c + 3, c % 3 > 0 ? c - 1 : -1, c % 3 < 2 ? c + 1 : -1].filter((n) => n >= 0 && n < 12);
const mascara = (pos: readonly number[]) => pos.reduce((m, c) => m | (1 << c), 0);
const libre = (m: number, c: number) => ((m >> c) & 1) === 0;
export const mover = (pos: readonly number[], [desde, hasta]: Mov) =>
  pos.map((c) => (c === desde ? hasta : c));
const enR = (pos: readonly number[]) => pos[0] === 0 && mascara(pos) === mascara(R);

// Las fichas son iguales salvo la del doblez, así que una posición es qué casillas están ocupadas
// y dónde está el doblez.
const clave = (pos: readonly number[]) => mascara(pos) * 12 + (pos[0] ?? 0);

function deslizamientos(pos: readonly number[]): Mov[] {
  const m = mascara(pos);
  return pos.flatMap((c) => vecinos(c).flatMap((v): Mov[] => (libre(m, v) ? [[c, v]] : [])));
}

// Desliza fichas al azar sin repetir posiciones ni mover dos veces seguidas la misma ficha.
export function desordenar(pos: readonly number[], pasos: number): Mov[] {
  const vistas = new Set([clave(pos)]);
  const ruta: Mov[] = [];
  let actual = pos;
  for (let i = 0; i < pasos; i++) {
    const ultima = ruta.at(-1)?.[1];
    const opciones = deslizamientos(actual).filter(
      (mov) => mov[0] !== ultima && !vistas.has(clave(mover(actual, mov))),
    );
    const mov = opciones[Math.floor(Math.random() * opciones.length)];
    if (!mov) break;
    ruta.push(mov);
    actual = mover(actual, mov);
    vistas.add(clave(actual));
  }
  return ruta;
}

// Camino más corto de vuelta a la R: búsqueda en anchura sobre 4096 × 12 posiciones como mucho.
export function ordenar(pos: readonly number[]): Mov[] {
  const origen = new Map<number, [number, Mov] | null>([[clave(pos), null]]);
  const cola = [pos];
  for (const actual of cola) {
    if (enR(actual)) {
      const ruta: Mov[] = [];
      for (let paso = origen.get(clave(actual)); paso; paso = origen.get(paso[0])) {
        ruta.unshift(paso[1]);
      }
      return ruta;
    }
    for (const mov of deslizamientos(actual)) {
      const siguiente = mover(actual, mov);
      if (origen.has(clave(siguiente))) continue;
      origen.set(clave(siguiente), [clave(actual), mov]);
      cola.push(siguiente);
    }
  }
  return [];
}

type Estado = { pos: number[]; plan: Mov[]; espera: number };

function paso({ pos, plan, espera }: Estado): Estado {
  const [mov, ...resto] = plan;
  if (mov) return { pos: mover(pos, mov), plan: resto, espera };
  if (espera > 0) return { pos, plan, espera: espera - 1 };
  return { pos, plan: ordenar(pos), espera };
}

export function LogoPuzle({ size }: { size: number }) {
  const [dentro, setDentro] = useState(false);
  const [estado, setEstado] = useState<Estado>({ pos: R, plan: [], espera: 0 });
  const enMarcha = estado.plan.length > 0 || estado.espera > 0 || !enR(estado.pos);
  const modulo = size / 4;

  useEffect(() => {
    if (!enMarcha) return;
    const id = setInterval(() => setEstado(paso), PASO_MS);
    return () => clearInterval(id);
  }, [enMarcha]);

  return (
    <span
      aria-hidden="true"
      className={'relative block shrink-0'}
      style={{ width: modulo * 3, height: size }}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return;
        }
        setDentro(true);
        setEstado(({ pos }) => ({
          pos,
          plan: desordenar(pos, PASOS_DESORDEN),
          espera: PAUSA_PASOS,
        }));
      }}
      onPointerLeave={() => {
        // Al salir se abandona lo que quede y la R se ordena por el camino más corto.
        setDentro(false);
        setEstado(({ pos }) => ({ pos, plan: ordenar(pos), espera: 0 }));
      }}
    >
      {estado.pos.map((c, ficha) => (
        <span
          key={ficha}
          className={
            'absolute top-0 left-0 [transition:translate_520ms_var(--ease-brand),scale_480ms_var(--ease-brand)] motion-reduce:transition-none'
          }
          style={{
            width: modulo,
            height: modulo,
            translate: `${(c % 3) * modulo}px ${Math.floor(c / 3) * modulo}px`,
            scale: dentro || enMarcha ? 0.86 : 1,
            background: ficha === 0 ? undefined : 'var(--logo-color, currentColor)',
          }}
        >
          {ficha === 0 && (
            <svg className={'block size-full'} viewBox="0 0 48 48">
              <path fill="var(--brand-dark, #a50e0e)" d="M0 48L48 0V48Z" />
            </svg>
          )}
        </span>
      ))}
    </span>
  );
}
