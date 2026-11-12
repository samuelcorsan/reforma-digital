'use client';

import { useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';

// Dos candidatos ficticios con perfiles opuestos, como en El VAR Electoral. Nunca van junto al
// nombre, la foto o el color de un candidato real.
const fictitious = [
  {
    name: 'Candidato A',
    profile: 'Riguroso con los datos, pero esquiva preguntas',
    scores: {
      veracidad: 8.6,
      alGrano: 4.9,
      concrecion: 6.2,
      sustancia: 7,
      juegoLimpio: 6.4,
      claridad: 6.8,
    },
  },
  {
    name: 'Candidato B',
    profile: 'Directo y claro, pero menos preciso con las cifras',
    scores: {
      veracidad: 5.9,
      alGrano: 8.1,
      concrecion: 6.6,
      sustancia: 6.1,
      juegoLimpio: 7.2,
      claridad: 8.4,
    },
  },
];
// Por debajo de esta diferencia, es un empate (el margen habitual de una valoración).
const tie = 0.3;

type Criterion = { id: keyof (typeof fictitious)[number]['scores']; name: string; weight: number };

// Cambia lo que pesa cada criterio y mira cómo cambian las valoraciones y quién queda por delante.
export function ScoreSimulator({ criteria }: { criteria: Criterion[] }) {
  const initial = Object.fromEntries(criteria.map((c) => [c.id, c.weight]));
  const [weights, setWeights] = useState(initial);
  const total = criteria.reduce((t, c) => t + (weights[c.id] ?? 0), 0) || 1;
  const scores = fictitious.map(
    (f) => criteria.reduce((t, c) => t + f.scores[c.id] * (weights[c.id] ?? 0), 0) / total,
  );
  const [a = 0, b = 0] = scores;
  const ahead = Math.abs(a - b) < tie ? null : a > b ? 0 : 1;
  const changed = criteria.some((c) => weights[c.id] !== c.weight);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <ul className="m-0 grid list-none gap-4 p-0">
          {criteria.map((c) => (
            <li key={c.id} className="grid gap-1.5">
              <span className="flex items-baseline justify-between gap-4">
                <label htmlFor={`peso-${c.id}`} className="font-medium">
                  {c.name}
                </label>
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  {Math.round(((weights[c.id] ?? 0) / total) * 100)} %
                </span>
              </span>
              <input
                id={`peso-${c.id}`}
                type="range"
                min={0}
                max={50}
                value={weights[c.id] ?? 0}
                onChange={(event) => setWeights({ ...weights, [c.id]: Number(event.target.value) })}
                className="h-6 w-full accent-foreground"
              />
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={!changed}
          onClick={() => setWeights(initial)}
        >
          Volver a los pesos de la metodología
        </Button>
      </div>
      <div className="grid content-start gap-3">
        {fictitious.map((f, i) => (
          <div
            key={f.name}
            className={cn(
              'grid gap-1 rounded-xl p-5 ring-1 transition-colors motion-reduce:transition-none',
              ahead === i ? 'bg-muted ring-foreground' : 'ring-border',
            )}
          >
            <span className="flex items-baseline justify-between gap-4">
              <b className="font-medium">{f.name}</b>
              <span className="font-heading text-4xl leading-none tabular-nums">
                {(scores[i] ?? 0).toFixed(1).replace('.', ',')}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{f.profile}</span>
          </div>
        ))}
        <p aria-live="polite" className="m-0 text-muted-foreground">
          {ahead == null
            ? 'Empate: la diferencia es menor que el margen.'
            : `Con estos pesos, por delante: ${fictitious[ahead]?.name}.`}
        </p>
      </div>
    </div>
  );
}
