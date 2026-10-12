'use client';

import { useState, type CSSProperties } from 'react';
import { Button } from '@reforma-digital/design/sol';
import { Icon } from '../../../components/sol/icon';
import { barrier, dhondtOrder, type Quotient } from '../../../lib/congreso';

// Candidaturas de ejemplo, sin nombres ni colores de partido. La E empieza por debajo del 3 %.
const candidaturas = ['A', 'B', 'C', 'D', 'E'];
const iniciales = [42_000, 28_000, 15_000, 9_000, 2_500];
const MAX_VOTOS = 100_000;
const MAX_ESCANOS = 40;

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Reparte los escaños de una provincia entre candidaturas de ejemplo con dhondtOrder (art. 163). */
export function SimuladorDhondt({ provincia }: { provincia?: { name: string; seats: number } }) {
  const [votos, setVotos] = useState(iniciales);
  const [escanos, setEscanos] = useState(provincia?.seats ?? 5);

  const total = votos.reduce((sum, v) => sum + v, 0);
  const minimo = barrier(votos, 0, escanos);
  let orden: Quotient[] | undefined;
  try {
    orden = total > 0 ? dhondtOrder(votos, 0, escanos) : undefined;
  } catch {
    // Empate exacto en el último escaño: la ley lo resuelve por sorteo y no se inventa un ganador.
  }
  const ganados = votos.map((_, i) => orden?.filter((q) => q.i === i).length ?? 0);
  // Columnas hasta un divisor más que la candidatura con más escaños: a la derecha nadie gana.
  const columnas = Math.min(escanos, Math.max(...ganados) + 1);
  const posicion = (i: number, divisor: number) =>
    orden ? orden.findIndex((q) => q.i === i && q.divisor === divisor) : -1;

  return (
    <div className="el-sim caja-plana">
      <div className="el-sim-escanos">
        <span id="el-sim-escanos-titulo">Escaños a repartir</span>
        <div className="el-sim-paso">
          <Button
            variant="icon"
            type="button"
            aria-label="Un escaño menos"
            disabled={escanos <= 1}
            onClick={() => setEscanos((n) => n - 1)}
          >
            <Icon name="menos" size={16} />
          </Button>
          <output className="t-dato" aria-labelledby="el-sim-escanos-titulo" aria-live="polite">
            {escanos}
          </output>
          <Button
            variant="icon"
            type="button"
            aria-label="Un escaño más"
            disabled={escanos >= MAX_ESCANOS}
            onClick={() => setEscanos((n) => n + 1)}
          >
            <Icon name="mas" size={16} />
          </Button>
        </div>
        <span className="el-sim-nota">
          {provincia
            ? escanos === provincia.seats
              ? `Los de ${provincia.name}`
              : `${provincia.name} elige ${provincia.seats}`
            : 'Elige una provincia para usar sus escaños'}
        </span>
      </div>

      <ul className="el-sim-filas">
        {candidaturas.map((letra, i) => {
          const v = votos[i] ?? 0;
          const fuera = escanos > 1 && v < minimo;
          const parte = porcentaje.format(total ? v / total : 0);
          return (
            <li key={letra} className="el-sim-fila" data-fuera={fuera || undefined}>
              <label className="el-sim-letra" htmlFor={`el-sim-${letra}`}>
                <span className="sr-only">Votos de la candidatura </span>
                {letra}
              </label>
              <input
                id={`el-sim-${letra}`}
                type="range"
                min={0}
                max={MAX_VOTOS}
                step={500}
                value={v}
                aria-valuetext={`${numero.format(v)} votos, ${parte}`}
                style={{ '--pct': `${(v / MAX_VOTOS) * 100}%` } as CSSProperties}
                onChange={(e) => {
                  const nuevo = Number(e.target.value);
                  setVotos((actual) => actual.map((x, j) => (j === i ? nuevo : x)));
                }}
              />
              <span className="el-sim-votos">
                <span className="t-dato">{numero.format(v)}</span>
                <span>{fuera ? `${parte} · no llega al 3 %` : parte}</span>
              </span>
              <span className="el-sim-ganados">
                <strong className="t-dato">{ganados[i]}</strong>
                <span>{ganados[i] === 1 ? 'escaño' : 'escaños'}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="el-sim-resultado" aria-live="polite">
        {!orden ? (
          <p className="el-sim-aviso caja-aviso">
            {total === 0
              ? 'Mueve los votos de alguna candidatura para repartir los escaños.'
              : 'Empate exacto en el último escaño: la ley lo decide por sorteo.'}
          </p>
        ) : (
          <>
            <p className="el-sim-subtitulo">Orden en que se asignan los escaños</p>
            <ol className="el-sim-orden">
              {orden.map((q, n) => (
                <li key={`${q.i}-${q.divisor}`}>
                  <span className="sr-only">Escaño {n + 1}: candidatura </span>
                  {candidaturas[q.i]}
                </li>
              ))}
            </ol>
            <p className="el-sim-subtitulo">Votos divididos entre 1, 2, 3…</p>
            <div className="table-scroll">
              <table className="el-sim-tabla">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Candidatura</span>
                    </th>
                    {Array.from({ length: columnas }, (_, d) => (
                      <th key={d} scope="col">
                        ÷{d + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidaturas.map((letra, i) => {
                    const v = votos[i] ?? 0;
                    const fuera = escanos > 1 && v < minimo;
                    return (
                      <tr key={letra} data-fuera={fuera || undefined}>
                        <th scope="row">{letra}</th>
                        {Array.from({ length: columnas }, (_, d) => {
                          const n = posicion(i, d + 1);
                          return (
                            <td key={d} data-gana={n >= 0 || undefined}>
                              {fuera ? '—' : numero.format(Math.round(v / (d + 1)))}
                              {n >= 0 && <span className="sr-only">, escaño {n + 1}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
