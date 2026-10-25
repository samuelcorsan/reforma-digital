'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@reforma-digital/design/ui/tabs';
import type { Candidate, Mark } from '../../lib/elecciones/interviews';
import { MarkIcon } from './mark-icon';
import { Portrait } from './portrait';
import { Cell, Grid, Label } from './report';

export type Person = {
  candidate: Candidate;
  score: string | null;
  provisional: boolean;
  interviewId: string | null;
};
export type Figure = {
  group: string;
  name: string;
  // El tope de la escala, igual para todos.
  max: number;
  kind?: Mark['kind'];
  color?: string;
  values: Partial<Record<string, { value: number; display: string }>>;
};
// La huella: cada eje, de 0 a 1 sobre su tope fijo.
export type Footprint = {
  axes: { name: string; text: string }[];
  values: Partial<Record<string, number[]>>;
};
type Answer = 'directa' | 'parcial' | 'evasiva' | 'cambio';
export type Common = {
  id: string;
  topic: string;
  question: string;
  answers: Partial<Record<string, { text: string; answer: Answer; href: string }>>;
};

const answerKinds: Answer[] = ['directa', 'parcial', 'evasiva', 'cambio'];
const answerNames: Record<Answer, string> = {
  directa: 'Directa',
  parcial: 'Parcial',
  evasiva: 'Evasiva',
  cambio: 'Cambio de tema',
};
const answerStyles: Record<Answer, string> = {
  directa: 'bg-foreground',
  parcial: 'bg-muted-foreground/60',
  evasiva: 'bg-muted-foreground/25',
  cambio:
    'bg-[repeating-linear-gradient(45deg,var(--border)_0_3px,transparent_3px_6px)] ring-1 ring-border',
};
const surname = (c: Candidate) => c.name.split(' ').at(-1) ?? c.name;

function Heading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <h2 className="m-0 font-heading text-[32px] leading-tight font-normal lg:text-[40px]">
        {title}
      </h2>
      {children && <p className="m-0 max-w-[62ch] text-muted-foreground">{children}</p>}
    </div>
  );
}

export function CompareBoard({
  people,
  figures,
  footprint,
  commons,
}: {
  people: Person[];
  figures: Figure[];
  footprint: Footprint;
  commons: Common[];
}) {
  const present = people.filter((p) => p.interviewId);
  const [focus, setFocus] = useState<string | null>(null);
  const [mode, setMode] = useState<'todos' | 'duelo'>('todos');
  const [pair, setPair] = useState<[string, string]>([
    present[0]?.candidate.slug ?? '',
    present[1]?.candidate.slug ?? '',
  ]);
  const [group, setGroup] = useState('Todo');
  const [topic, setTopic] = useState('Todos');
  const [open, setOpen] = useState<string | null>(null);

  const shown = mode === 'duelo' ? present.filter((p) => pair.includes(p.candidate.slug)) : present;
  const dim = (slug: string) => !!focus && focus !== slug;
  const groups = [...new Set(figures.map((f) => f.group))];
  const topics = [...new Set(commons.map((q) => q.topic))];

  // La huella como polígonos: cada eje, de 0 al tope.
  const size = 360;
  const radius = 132;
  const point = (axis: number, r: number) => {
    const angle = (Math.PI * 2 * axis) / footprint.axes.length - Math.PI / 2;
    return [size / 2 + Math.cos(angle) * radius * r, size / 2 + Math.sin(angle) * radius * r];
  };
  const polygon = (values: number[]) =>
    values.map((v, i) => point(i, Math.max(0.02, Math.min(1, v))).join(',')).join(' ');

  // El selector de cada lado del 1 contra 1: no deja elegir al que ya está en el otro.
  const picker = (side: 0 | 1) => (
    <Tabs
      value={pair[side]}
      onValueChange={(value) =>
        setPair(side === 0 ? [String(value), pair[1]] : [pair[0], String(value)])
      }
    >
      <TabsList aria-label={side === 0 ? 'Primero' : 'Segundo'}>
        {present.map(({ candidate: c }) => (
          <TabsTrigger
            key={c.slug}
            value={c.slug}
            className="px-3"
            disabled={pair[side === 0 ? 1 : 0] === c.slug}
          >
            {surname(c)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-20">
      {/* Los cuatro, siempre a mano: pulsar en uno lo destaca en todos los gráficos. */}
      <div className="sticky top-22 z-20 grid grid-cols-[minmax(0,1fr)] gap-2">
        <p className="m-0 text-sm text-muted-foreground">
          Pulsa en uno para destacarlo en todos los gráficos.
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-background/90 p-1.5 ring-1 ring-foreground/10 backdrop-blur sm:grid-cols-4">
          {people.map(({ candidate: c, score, provisional, interviewId }) => (
            <button
              key={c.slug}
              type="button"
              disabled={!interviewId}
              aria-pressed={focus === c.slug}
              onClick={() => setFocus(focus === c.slug ? null : c.slug)}
              className="flex min-h-12 items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 aria-pressed:bg-muted aria-pressed:ring-1 aria-pressed:ring-foreground/20 motion-reduce:transition-none"
            >
              <Portrait candidate={c} kind="avatar" sizes="80px" className="size-9 shrink-0" />
              <span className="grid min-w-0 leading-tight">
                <b className="truncate text-sm font-medium">{surname(c)}</b>
                <span className="text-xs text-muted-foreground">
                  {score ? `${score} sobre 10${provisional ? ' · prov.' : ''}` : 'Pendiente'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <Heading label="La huella" title="Cuatro formas de hacer una entrevista">
          Cada eje va de cero al mismo tope para los cuatro. Más grande no es mejor ni peor: es más
          de esa cosa.
        </Heading>
        <Grid>
          <Cell span={6} className="items-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label="La huella de cada candidato sobre los mismos ejes"
              className="mx-auto w-full max-w-[420px] overflow-visible"
            >
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <polygon
                  key={r}
                  points={footprint.axes.map((_, i) => point(i, r).join(',')).join(' ')}
                  fill="none"
                  stroke="var(--border)"
                />
              ))}
              {footprint.axes.map((axis, i) => {
                const [x, y] = point(i, 1);
                const [lx, ly] = point(i, 1.16);
                return (
                  <g key={axis.name}>
                    <line x1={size / 2} y1={size / 2} x2={x} y2={y} stroke="var(--border)" />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {axis.name}
                    </text>
                  </g>
                );
              })}
              {[...shown]
                .sort(
                  (x, y) => Number(x.candidate.slug === focus) - Number(y.candidate.slug === focus),
                )
                .map(({ candidate: c }) => {
                  const values = footprint.values[c.slug];
                  return (
                    values && (
                      <polygon
                        key={c.slug}
                        points={polygon(values)}
                        fill={c.color}
                        fillOpacity={dim(c.slug) ? 0.03 : 0.14}
                        stroke={c.color}
                        strokeOpacity={dim(c.slug) ? 0.25 : 1}
                        strokeWidth={focus === c.slug ? 2.5 : 1.5}
                        strokeLinejoin="round"
                      />
                    )
                  );
                })}
            </svg>
          </Cell>
          <Cell span={6} label="Cómo se lee">
            <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {footprint.axes.map((axis) => (
                <div key={axis.name}>
                  <dt className="font-medium">{axis.name}</dt>
                  <dd className="m-0 text-sm text-muted-foreground">{axis.text}</dd>
                </div>
              ))}
            </dl>
            <ul className="m-0 mt-auto flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-sm">
              {shown.map(({ candidate: c }) => (
                <li key={c.slug} className="flex items-center gap-2">
                  <i
                    aria-hidden="true"
                    className="block size-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </li>
              ))}
            </ul>
          </Cell>
        </Grid>
      </section>

      {commons.length > 0 && (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-8">
          <Heading label="Preguntas comunes" title="La misma pregunta: quién respondió a qué">
            Pulsa en una pregunta para ver cómo se formuló y lo que respondió cada uno.
          </Heading>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Tabs value={topic} onValueChange={(value) => setTopic(String(value))}>
                <TabsList aria-label="Tema">
                  {['Todos', ...topics].map((t) => (
                    <TabsTrigger key={t} value={t} className="px-3">
                      {t}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted-foreground">
              {answerKinds.map((a) => (
                <li key={a} className="flex items-center gap-1.5">
                  <i
                    aria-hidden="true"
                    className={cn('block size-3 rounded-[3px]', answerStyles[a])}
                  />
                  {answerNames[a]}
                </li>
              ))}
            </ul>
          </div>
          <Grid>
            <Cell className="gap-0 p-0 lg:p-0 max-sm:p-0">
              <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,3.5rem)] items-end gap-2 border-b border-border px-6 pt-5 pb-3 max-sm:grid-cols-[minmax(0,1fr)_repeat(4,2.5rem)] max-sm:px-4">
                <Label>Pregunta</Label>
                {people.map(({ candidate: c }) => (
                  <span
                    key={c.slug}
                    className="grid justify-items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Portrait candidate={c} kind="avatar" sizes="64px" className="size-7" />
                    <span className="max-sm:sr-only">{surname(c)}</span>
                  </span>
                ))}
              </div>
              <ul className="m-0 grid list-none p-0">
                {commons
                  .filter((q) => topic === 'Todos' || q.topic === topic)
                  .map((q) => (
                    <li key={q.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        aria-expanded={open === q.id}
                        onClick={() => setOpen(open === q.id ? null : q.id)}
                        className="grid w-full grid-cols-[minmax(0,1fr)_repeat(4,3.5rem)] items-center gap-2 px-6 py-4 text-left hover:bg-muted/60 max-sm:grid-cols-[minmax(0,1fr)_repeat(4,2.5rem)] max-sm:px-4"
                      >
                        <span className="grid gap-1">
                          <Label>{q.topic}</Label>
                          <span className="text-lg leading-snug">{q.question}</span>
                        </span>
                        {people.map(({ candidate: c }) => {
                          const a = q.answers[c.slug];
                          return (
                            <span key={c.slug} className="grid justify-items-center">
                              <i
                                title={a ? answerNames[a.answer] : 'No se le preguntó'}
                                className={cn(
                                  'block size-7 rounded-md',
                                  a
                                    ? answerStyles[a.answer]
                                    : 'border border-dashed border-muted-foreground/40',
                                  dim(c.slug) && 'opacity-30',
                                )}
                              />
                              <span className="sr-only">
                                {c.name}: {a ? answerNames[a.answer] : 'no se le preguntó'}
                              </span>
                            </span>
                          );
                        })}
                      </button>
                      {open === q.id && (
                        <ul className="m-0 grid list-none gap-4 bg-muted/50 px-6 py-5 max-sm:px-4">
                          {people.map(({ candidate: c }) => {
                            const a = q.answers[c.slug];
                            return (
                              <li key={c.slug} className="grid gap-1">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                  <Portrait
                                    candidate={c}
                                    kind="avatar"
                                    sizes="48px"
                                    className="size-6"
                                  />
                                  {c.name}
                                  <span className="font-normal text-muted-foreground">
                                    · {a ? answerNames[a.answer] : 'No se le preguntó'}
                                  </span>
                                </span>
                                {a && (
                                  <span className="text-muted-foreground">
                                    «{a.text}»{' '}
                                    <Link
                                      href={a.href}
                                      className="text-foreground underline underline-offset-4"
                                    >
                                      Ver la entrevista
                                    </Link>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
              </ul>
            </Cell>
          </Grid>
        </section>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Heading label="En cifras" title="Mismas reglas, misma escala">
            Cada barra tiene un tope fijo, el mismo para todos. No hay ganador: cada cifra se lee
            por separado.
          </Heading>
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value === 'duelo' ? 'duelo' : 'todos')}
          >
            <TabsList aria-label="Comparar">
              <TabsTrigger value="todos" className="px-3">
                Los cuatro
              </TabsTrigger>
              <TabsTrigger value="duelo" className="px-3" disabled={present.length < 2}>
                1 contra 1
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {mode === 'duelo' && (
          <div className="flex flex-wrap items-center gap-3">
            {picker(0)}
            <span className="text-sm text-muted-foreground">contra</span>
            {picker(1)}
          </div>
        )}
        <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tabs value={group} onValueChange={(value) => setGroup(String(value))}>
            <TabsList aria-label="Qué cifras">
              {['Todo', ...groups].map((g) => (
                <TabsTrigger key={g} value={g} className="px-3">
                  {g}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {groups
          .filter((g) => group === 'Todo' || g === group)
          .map((g) => (
            <div key={g} className="grid grid-cols-[minmax(0,1fr)] gap-4">
              {group === 'Todo' && (
                <h3 className="m-0 font-heading text-2xl leading-tight font-normal">{g}</h3>
              )}
              <Grid>
                {figures
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <Cell
                      key={f.name}
                      span={6}
                      label={
                        f.kind ? (
                          <span className="inline-flex items-center gap-2">
                            <MarkIcon kind={f.kind} color={f.color} className="size-6" />
                            {f.name}
                          </span>
                        ) : (
                          f.name
                        )
                      }
                    >
                      <ul className="m-0 grid list-none gap-3 p-0">
                        {shown.map(({ candidate: c }) => {
                          const v = f.values[c.slug];
                          if (!v) return null;
                          return (
                            <li
                              key={c.slug}
                              className={cn(
                                'grid grid-cols-[1.75rem_minmax(0,1fr)_5.5rem] items-center gap-3 transition-opacity motion-reduce:transition-none',
                                dim(c.slug) && 'opacity-30',
                              )}
                            >
                              <Portrait
                                candidate={c}
                                kind="avatar"
                                sizes="56px"
                                className="size-7"
                              />
                              <span className="relative h-3 rounded-full bg-muted" title={c.name}>
                                <i
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{
                                    width: `${Math.min(1, v.value / f.max) * 100}%`,
                                    background: c.color,
                                  }}
                                />
                              </span>
                              <span className="text-right font-mono text-sm tabular-nums">
                                {v.display}
                                <span className="sr-only"> · {c.name}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </Cell>
                  ))}
              </Grid>
            </div>
          ))}
      </section>
    </div>
  );
}
