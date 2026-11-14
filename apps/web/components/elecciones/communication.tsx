import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { Card } from '@reforma-digital/design/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reforma-digital/design/ui/table';
import {
  allCommunication,
  communicationPath,
  hardnessIds,
  hardnessNames,
  isHard,
  pressure,
  rapportIds,
  rapportNames,
  replyIds,
  replyNames,
  sectionIds,
  topicMinutes,
  type Block,
  type Communication,
  type Question,
} from '../../lib/elecciones/communication';
import { decimal, formatDate, minute, thousands } from '../../lib/elecciones/format';
import {
  getCandidate,
  getInterview,
  interviewName,
  interviewerOf,
  outlet,
  publishedDay,
  videoUrl,
  type Interview,
} from '../../lib/elecciones/interviews';
import { Icon } from '../brand/icon';
import { AI } from '../congreso/common';
import { Dot, Fold, interviewsHref, Jump, Notice } from './interviews';
import { answerStyles, MarkIcon } from './mark-icon';
import { PageIndex } from './page-index';
import { PhotoCredits, Portrait } from './portrait';
import { Bars, Cell, Explore, Grid, Label, Legend, ReportSection } from './report';
import { ShareButton } from './share-button';

// El análisis de comunicación de una entrevista: el informe, con sus gráficas. Todo sale de
// lib/elecciones/communication.ts; aquí solo se pinta.

const grey = 'var(--muted-foreground)';
// El vídeo en ese segundo: abre la entrevista revisada con el reproductor ahí.
const jumpHref = (id: string, second: number) =>
  `${interviewsHref(id)}?t=${Math.floor(second)}#minuto`;

// El texto del informe: negrita, cursiva, enlaces y minutos del vídeo (73:05), que llevan a él.
const inline = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)|\b(\d{1,3}):(\d{2})\b/g;
function Rich({ text, id }: { text: string; id: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(inline)) {
    const [whole, bold, italic, label, url, minutes, seconds] = match;
    nodes.push(text.slice(last, match.index));
    last = match.index + whole.length;
    if (bold) {
      nodes.push(
        <b key={match.index} className="font-medium">
          <Rich text={bold} id={id} />
        </b>,
      );
    } else if (italic) {
      nodes.push(
        <i key={match.index}>
          <Rich text={italic} id={id} />
        </i>,
      );
    } else if (label && url?.startsWith('#')) {
      nodes.push(
        <a key={match.index} href={url} className="underline underline-offset-4">
          {label}
        </a>,
      );
    } else if (label && url) {
      nodes.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {label}
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>,
      );
    } else {
      nodes.push(
        <a
          key={match.index}
          href={jumpHref(id, Number(minutes) * 60 + Number(seconds))}
          aria-label={`Ver en el vídeo, minuto ${whole}`}
          className="font-mono text-[0.92em] tabular-nums underline decoration-dotted underline-offset-4"
        >
          {whole}
        </a>,
      );
    }
  }
  nodes.push(text.slice(last));
  return <>{nodes}</>;
}

// «**Quién corta a quién.** Tres de cada cuatro…»: la entrada en negrita titula y el resto es el
// texto. Una entrada más larga que `max` es una frase destacada, no un título.
function split(text: string, max = 70) {
  const match = /^\*\*(.+?)\*\*[.:]?(?:\s+(.+))?$/s.exec(text);
  const lead = match?.[1]?.replace(/[.:]$/, '');
  return lead && lead.length <= max ? { lead, body: match?.[2] ?? '' } : { lead: null, body: text };
}

// Una columna de cifras se alinea a la derecha.
const numeric = (rows: string[][], column: number) =>
  column > 0 && rows.every((row) => /^[−+-]?\d|^—$/.test(row[column] ?? ''));
// Un recuento: «7» o «2 (Óscar Puente)».
const count = (cell: string) => (/^\d+(?: \(.+\))?$/.test(cell) ? parseInt(cell, 10) : null);
// Una tabla solo de recuentos se tiñe: más tinta, más casos.
// ponytail: se reconoce por su forma (cuatro columnas o más, todo enteros), que hoy solo tiene la
// de mérito y culpa. Si otra tabla así no debe teñirse, que el conversor marque cuál es.
const counts = (rows: string[][]) =>
  (rows[0]?.length ?? 0) > 3 && rows.every((row) => row.slice(1).every((c) => count(c) !== null));
const wide = (block?: Block) => block?.tipo === 'tabla' && block.cabecera.length > 3;

function DataTable({ block, id }: { block: Extract<Block, { tipo: 'tabla' }>; id: string }) {
  const tinted = counts(block.filas);
  const top = Math.max(1, ...block.filas.flatMap((row) => row.slice(1).map((c) => count(c) ?? 0)));
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {block.cabecera.map((head, j) => (
            <TableHead
              key={j}
              className={cn(
                'h-auto py-2 align-bottom text-sm font-normal whitespace-normal text-muted-foreground first:pl-0 last:pr-0',
                tinted && j > 0 ? 'text-center' : numeric(block.filas, j) && 'text-right',
              )}
            >
              <Rich text={head} id={id} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {block.filas.map((row, j) => (
          <TableRow key={j} className={cn('hover:bg-transparent', tinted && 'border-0')}>
            {row.map((cell, k) => {
              const n = tinted && k > 0 ? (count(cell) ?? 0) : null;
              return n === null ? (
                <TableCell
                  key={k}
                  className={cn(
                    'py-2.5 align-top leading-snug whitespace-normal first:pl-0 last:pr-0',
                    numeric(block.filas, k) &&
                      'text-right font-mono tabular-nums sm:whitespace-nowrap max-sm:text-sm',
                    tinted && 'align-middle',
                  )}
                >
                  <Rich text={cell} id={id} />
                </TableCell>
              ) : (
                <TableCell key={k} className="p-1">
                  <span
                    className={cn(
                      'grid min-h-11 place-items-center rounded-lg px-2 text-center font-mono text-sm tabular-nums',
                      n / top > 0.5 && 'text-background',
                      !n && 'text-muted-foreground',
                    )}
                    style={{
                      background: `color-mix(in oklab, var(--foreground) ${Math.round((n / top) * 88)}%, var(--muted))`,
                    }}
                  >
                    {cell}
                  </span>
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Blocks({ blocks, id }: { blocks: Block[]; id: string }) {
  return blocks.map((block, i) => {
    if (block.tipo === 'tabla') return <DataTable key={i} block={block} id={id} />;
    if (block.tipo === 'lista') {
      const List = block.ordenada ? 'ol' : 'ul';
      return (
        <List
          key={i}
          className={cn('m-0 grid gap-3', block.ordenada ? 'list-decimal pl-6' : 'list-none p-0')}
        >
          {block.items.map((item, j) => (
            <li
              key={j}
              className={cn(
                'break-inside-avoid leading-relaxed',
                !block.ordenada && 'border-b border-border pb-3 last:border-0 last:pb-0',
              )}
            >
              <Rich text={item} id={id} />
            </li>
          ))}
        </List>
      );
    }
    return (
      <p key={i} className="m-0 leading-relaxed">
        <Rich text={block.texto} id={id} />
      </p>
    );
  });
}

// El texto de una sección, en tarjetas que se leen de arriba abajo en dos columnas. Cada párrafo
// con entrada en negrita abre la suya, igual que cada punto de una lista de puntos titulados. Una
// tarjeta sola en su tramo, o con una tabla ancha, ocupa las dos columnas.
type TextCard = { lead: string | null; blocks: Block[]; full: boolean };
type Piece = { heading: string } | TextCard;
function pieces(blocks: Block[]) {
  const list: Piece[] = [];
  // La tarjeta abierta: la última, si no la ha cerrado un subtítulo o una lista de puntos titulados.
  let card: TextCard | undefined;
  for (const block of blocks) {
    if (block.tipo === 'subtitulo') {
      list.push({ heading: block.texto });
      card = undefined;
      continue;
    }
    const points = block.tipo === 'lista' ? block.items.map(split) : [];
    if (points.length > 1 && points.every((point) => point.lead)) {
      for (const [i, point] of points.entries()) {
        list.push({
          lead: block.tipo === 'lista' && block.ordenada ? `${i + 1}. ${point.lead}` : point.lead,
          blocks: [{ tipo: 'parrafo', texto: point.body }],
          full: false,
        });
      }
      card = undefined;
      continue;
    }
    const { lead, body } = block.tipo === 'parrafo' ? split(block.texto) : { lead: null, body: '' };
    const secondTable = block.tipo === 'tabla' && card?.blocks.some((b) => b.tipo === 'tabla');
    if (!card || lead || secondTable) {
      card = { lead, blocks: [], full: false };
      list.push(card);
    }
    if (!lead) card.blocks.push(block);
    else if (body) card.blocks.push({ tipo: 'parrafo', texto: body });
    if (wide(block)) card.full = true;
  }
  for (const [i, piece] of list.entries()) {
    const alone = (other?: Piece) => !other || 'heading' in other;
    if ('blocks' in piece && alone(list[i - 1]) && alone(list[i + 1])) piece.full = true;
  }
  return list;
}

// Dentro de una tarjeta a todo el ancho, el texto va en dos columnas y las tablas anchas, enteras.
function CardBody({ card, id }: { card: TextCard; id: string }) {
  if (!card.full) return <Blocks blocks={card.blocks} id={id} />;
  const groups: Block[][] = [];
  for (const block of card.blocks) {
    const last = groups.at(-1);
    if (!last || wide(block) || wide(last[0])) groups.push([block]);
    else last.push(block);
  }
  return groups.map((group, i) =>
    wide(group[0]) ? (
      <Blocks key={i} blocks={group} id={id} />
    ) : (
      <div
        key={i}
        className="gap-10 md:columns-2 [&>*]:mb-4 [&>*]:last:mb-0 [&>*:not(p)]:break-inside-avoid"
      >
        <Blocks blocks={group} id={id} />
      </div>
    ),
  );
}

function Prose({ blocks, id }: { blocks: Block[]; id: string }) {
  return (
    <div className="mt-4 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {pieces(blocks).map((piece, i) =>
        'heading' in piece ? (
          <h3
            key={i}
            className="m-0 pt-6 font-heading text-[28px] leading-tight font-normal [column-span:all]"
          >
            {piece.heading}
          </h3>
        ) : (
          <Cell key={i} className={cn('gap-4', piece.full && '[column-span:all]')}>
            {piece.lead && (
              <h3 className="m-0 font-heading text-2xl leading-tight font-normal">
                <Rich text={piece.lead} id={id} />
              </h3>
            )}
            <CardBody card={piece} id={id} />
          </Cell>
        ),
      )}
    </div>
  );
}

// Cómo responde a cada pregunta, con la trama de las preguntas de la entrevista revisada: de tinta
// llena (responde) a trama (cambia de tema). El hueco es de quien no le deja contestar.
const replyStyles = {
  responde: answerStyles.directa,
  en_parte: answerStyles.parcial,
  otra_pregunta: answerStyles.evasiva,
  ataca_pregunta: answerStyles.evasiva,
  cambia_tema: answerStyles.cambio,
  sin_respuesta: 'ring-1 ring-inset ring-muted-foreground/60',
} as const satisfies Record<Question['respuesta'], string>;
const dodges = (q: Question) =>
  q.respuesta === 'otra_pregunta' ||
  q.respuesta === 'ataca_pregunta' ||
  q.respuesta === 'cambia_tema';

// Una fila de la línea de la entrevista: su nombre y su franja, del primer segundo al último.
const laneGrid = 'grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-4';
function Lane({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(laneGrid, 'border-t border-border py-3')}>
      <p className="m-0 text-sm leading-tight">{name}</p>
      <div className={cn('relative', className)}>{children}</div>
    </div>
  );
}

// La entrevista de un vistazo: en el mismo eje, de qué se habla, cuándo aprieta el entrevistador,
// cuándo no se contesta a lo preguntado, la voz, las trabas, las pausas y los momentos clave. Es un
// dibujo: cada dato está, con su minuto, en las secciones de debajo.
function Timeline({
  analysis: c,
  interview: a,
  name,
  who,
  color,
}: {
  analysis: Communication;
  interview: Interview;
  name: string;
  who: string;
  color: string;
}) {
  const span = c.fin - c.inicio;
  const share = (second: number) => (Math.min(Math.max(second, c.inicio), c.fin) - c.inicio) / span;
  const at = (second: number) => `${share(second) * 100}%`;
  const tick = 'absolute bottom-0 w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground';
  // Los temas, en el orden en que salen por primera vez.
  const topics = [...new Set(c.temas.map((t) => t.tema))];
  // La voz: una curva por los minutos con frases suyas, sobre su propia media.
  const voice = c.voz.flatMap((z, i) =>
    z === null ? [] : [[share(i * 60 + 30) * 1000, z] as const],
  );
  const y = (z: number) => 22 - Math.max(-2, Math.min(2, z)) * 10;
  const curve = voice.map(([x, z]) => `${x.toFixed(1)},${y(z).toFixed(1)}`).join(' L');
  const stops = Array.from({ length: Math.floor(c.fin / 900) + 1 }, (_, i) => i * 900).filter(
    (second) => second >= c.inicio,
  );
  // La leyenda: de cada fila, una muestra de cada marca y qué es.
  const sample = 'absolute bottom-0 left-1/2 w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground';
  const legend: [string, [ReactNode, string][]][] = [
    [
      'Temas',
      [
        [
          <i key="0" className="absolute inset-x-0 inset-y-1 rounded-[2px] bg-foreground/70" />,
          `Lo saca ${who}`,
        ],
        [
          <i
            key="0"
            className="absolute inset-x-0 inset-y-1 rounded-[2px]"
            style={{ background: color }}
          />,
          `Lo saca ${name}`,
        ],
      ],
    ],
    [
      'Preguntas',
      [
        [
          <i key="0" className={cn(sample, 'h-full')} />,
          'Dura: incómoda, repregunta o insistencia',
        ],
        [<i key="0" className={cn(sample, 'h-[45%] opacity-45')} />, 'Neutra o cómoda'],
      ],
    ],
    [
      'No contesta',
      [
        [
          <i key="0" className={cn(sample, 'h-full')} style={{ background: color }} />,
          'Contesta a otra cosa, ataca la pregunta o cambia de tema',
        ],
      ],
    ],
    [
      'Voz',
      [
        [
          <svg key="0" viewBox="0 0 16 16" className="absolute inset-0 size-full">
            <path d="M0,9 L4,5 L8,11 L12,3 L16,8" fill="none" stroke={color} strokeWidth={1.5} />
          </svg>,
          'Tono, volumen y tensión: más arriba, más intensa que su propia media',
        ],
      ],
    ],
    ['Trabas', [[<i key="0" className={cn(sample, 'h-full')} />, 'Repite una palabra o se corta']]],
    [
      'Pausas',
      [
        [
          <i key="0" className={cn(sample, 'h-full')} />,
          'Antes de una cifra, un compromiso o un rival',
        ],
        [
          <i key="0" className={cn(sample, 'h-[60%] opacity-35')} />,
          'Otra pausa. Más alta, más larga',
        ],
      ],
    ],
    [
      'Momentos clave',
      [
        [<MarkIcon key="0" kind="momento" color={color} className="size-5" />, `De ${name}`],
        [<MarkIcon key="0" kind="momento" className="size-5" />, `De ${who}`],
      ],
    ],
    ...(c.publico?.citados.length
      ? [
          [
            'Lo que cita el público',
            [
              [
                <i key="0" className="absolute inset-1 rounded-full bg-foreground/70" />,
                'Minuto citado en comentarios. Más grande, más veces',
              ],
            ],
          ] satisfies (typeof legend)[number],
        ]
      : []),
  ];
  return (
    <>
      <div className="overflow-x-auto">
        <div
          role="img"
          aria-label={`La entrevista de un vistazo, del minuto ${minute(c.inicio)} al ${minute(c.fin)}: temas, preguntas, respuestas que no contestan a lo preguntado, voz, trabas, pausas y momentos clave de ${name}. Los datos están en las secciones de esta página.`}
          className="min-w-[820px]"
        >
          {/* Los temas, uno por fila: se ve cuándo se habla de cada uno y quién lo saca. */}
          <div className="grid gap-1 pb-3">
            <p className="m-0 mb-1 text-sm leading-tight">Temas</p>
            {topics.map((topic) => (
              <div key={topic} className={laneGrid}>
                <p className="m-0 text-xs leading-tight text-muted-foreground">{topic}</p>
                <div className="relative h-3.5">
                  <i className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  {c.temas
                    .filter((t) => t.tema === topic)
                    .map((t) => (
                      <i
                        key={t.inicio}
                        title={`${minute(t.inicio)}–${minute(t.fin)} · ${t.tema} · lo saca ${t.quien === 'invitado' ? name : who}`}
                        className={cn(
                          'absolute inset-y-0 min-w-[3px] rounded-[2px]',
                          t.quien === 'jordi' && 'bg-foreground/70',
                        )}
                        style={{
                          left: at(t.inicio),
                          width: `${((t.fin - t.inicio) / span) * 100}%`,
                          background: t.quien === 'invitado' ? color : undefined,
                        }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
          <Lane name="Preguntas" className="h-8">
            {c.preguntas.map((q, i) => (
              <i
                key={i}
                title={`${minute(q.segundo)} · ${hardnessNames[q.dureza]} · ${q.texto}`}
                className={cn(tick, !isHard(q) && 'opacity-45')}
                style={{ left: at(q.segundo), height: isHard(q) ? '100%' : '45%' }}
              />
            ))}
          </Lane>
          <Lane name="No contesta" className="h-5">
            {c.preguntas.filter(dodges).map((q, i) => (
              <i
                key={i}
                title={`${minute(q.segundo)} · ${replyNames[q.respuesta]} · ${q.texto}`}
                className={tick}
                style={{ left: at(q.segundo), height: '100%', background: color }}
              />
            ))}
          </Lane>
          <Lane name="Voz" className="h-11">
            <svg viewBox="0 0 1000 44" preserveAspectRatio="none" className="block size-full">
              <path
                d={`M${voice[0]?.[0].toFixed(1) ?? 0},22 L${curve} L${voice.at(-1)?.[0].toFixed(1) ?? 1000},22 Z`}
                fill={color}
                opacity={0.22}
              />
              <path
                d={`M${curve}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={0}
                x2={1000}
                y1={22}
                y2={22}
                stroke="var(--border)"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </Lane>
          <Lane name="Trabas" className="h-4">
            {c.trabas.map((t, i) => (
              <i
                key={i}
                title={`${minute(t.segundo)} · ${t.tipo} · «${t.contexto}»`}
                className={tick}
                style={{ left: at(t.segundo), height: '100%' }}
              />
            ))}
          </Lane>
          <Lane name="Pausas" className="h-6">
            {c.pausas.map((p, i) => (
              <i
                key={i}
                title={`${minute(p.segundo)} · ${decimal(p.duracion)} s${p.carga ? ' · antes de una frase con carga' : ''}`}
                className={cn(tick, !p.carga && 'opacity-35')}
                style={{ left: at(p.segundo), height: `${Math.min(1, p.duracion / 2.5) * 100}%` }}
              />
            ))}
          </Lane>
          <Lane name="Momentos clave" className="h-7">
            {c.momentos.map((m) => (
              <a
                key={`${m.quien}-${m.segundo}`}
                href={jumpHref(a.id, m.segundo)}
                title={`${minute(m.segundo)} · ${m.titulo}`}
                // El dibujo es una imagen para el lector de pantalla: con teclado, estos mismos
                // minutos están enlazados en «Momentos clave».
                tabIndex={-1}
                className="absolute top-0 -translate-x-1/2"
                style={{ left: at(m.segundo) }}
              >
                <MarkIcon kind="momento" color={m.quien === 'invitado' ? color : undefined} />
              </a>
            ))}
          </Lane>
          {c.publico && c.publico.citados.length > 0 && (
            <Lane name="Lo que cita el público" className="h-6">
              {c.publico.citados.map((x) => (
                <i
                  key={x.segundo}
                  title={`Minuto ${minute(x.segundo)} · citado en ${x.veces} comentarios`}
                  className="absolute bottom-0 -translate-x-1/2 rounded-full bg-foreground/70"
                  style={{
                    left: at(x.segundo + 30),
                    width: `${6 + x.veces * 2}px`,
                    height: `${6 + x.veces * 2}px`,
                  }}
                />
              ))}
            </Lane>
          )}
          <div className={cn(laneGrid, 'border-t border-border pt-2')}>
            <span />
            <div className="relative h-5 font-mono text-xs text-muted-foreground tabular-nums">
              {stops.map((second) => (
                <span
                  key={second}
                  className="absolute -translate-x-1/2 first:translate-x-0"
                  style={{ left: at(second) }}
                >
                  {minute(second)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 border-t border-border pt-6">
        <ul className="m-0 grid list-none gap-x-8 gap-y-6 p-0 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {legend.map(([lane, marks]) => (
            <li key={lane} className="grid content-start gap-2">
              <Label>{lane}</Label>
              {marks.map(([mark, text]) => (
                <span key={text} className="flex items-start gap-2.5 leading-snug">
                  <span aria-hidden="true" className="relative block size-5 shrink-0">
                    {mark}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm text-muted-foreground">
          Todas las filas comparten el eje del vídeo. Pasa el ratón por una marca para ver su minuto
          y de qué es.
        </p>
      </div>
    </>
  );
}

// Dos barras por medida, la del invitado y la del entrevistador. Si las medidas son la misma cosa
// (`shared`), todas comparten escala; si no, cada una tiene la suya.
function Paired({
  rows,
  color,
  shared,
}: {
  rows: { label: ReactNode; guest: number; host: number; digits?: number; unit?: string }[];
  color: string;
  shared?: boolean;
}) {
  const all = Math.max(...rows.flatMap((row) => [row.guest, row.host]), Number.EPSILON);
  return (
    <dl className="m-0 grid gap-5">
      {rows.map(({ label, guest, host, digits = 0, unit }, i) => {
        const top = shared ? all : Math.max(guest, host, Number.EPSILON);
        return (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 max-sm:grid-cols-1"
          >
            <dt className="leading-snug">
              {label}
              {unit && <span className="block text-sm text-muted-foreground">{unit}</span>}
            </dt>
            <dd className="m-0 grid gap-1.5">
              {(
                [
                  [guest, color],
                  [host, grey],
                ] as const
              ).map(([value, background], j) => (
                <span key={j} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3">
                  <span className="h-2.5 rounded-full bg-muted">
                    <i
                      className="block h-full rounded-full"
                      style={{ width: `${(value / top) * 100}%`, background }}
                    />
                  </span>
                  <span className="text-right font-mono text-sm tabular-nums">
                    {decimal(value, digits)}
                  </span>
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// Cada pregunta, un cuadrado: por filas, cuánto aprieta; por trama, cómo se responde.
function QuestionSquares({ analysis: c }: { analysis: Communication }) {
  return (
    <>
      <dl className="m-0 grid gap-4">
        {hardnessIds.map((id) => {
          const list = c.preguntas.filter((q) => q.dureza === id);
          if (!list.length) return null;
          return (
            <div
              key={id}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 max-sm:grid-cols-1"
            >
              <dt>
                {hardnessNames[id]}{' '}
                <span className="font-mono text-muted-foreground tabular-nums">{list.length}</span>
              </dt>
              <dd className="m-0 flex flex-wrap content-start gap-1">
                {list.map((q, i) => (
                  <i
                    key={i}
                    aria-hidden="true"
                    title={`${minute(q.segundo)} · ${replyNames[q.respuesta]} · ${q.texto}`}
                    className={cn('block size-3.5 rounded-[3px]', replyStyles[q.respuesta])}
                  />
                ))}
                <span className="sr-only">
                  {replyIds
                    .map(
                      (reply) => [reply, list.filter((q) => q.respuesta === reply).length] as const,
                    )
                    .filter(([, n]) => n > 0)
                    .map(([reply, n]) => `${replyNames[reply]}: ${n}`)
                    .join('; ')}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-muted-foreground">
        {replyIds.map((reply) => {
          const n = c.preguntas.filter((q) => q.respuesta === reply).length;
          return n ? (
            <li key={reply} className="flex items-center gap-1.5">
              <i
                aria-hidden="true"
                className={cn('block size-3 rounded-[3px]', replyStyles[reply])}
              />
              {replyNames[reply]} ({n})
            </li>
          ) : null;
        })}
      </ul>
    </>
  );
}

// Dónde va cada gráfica: encima del texto de su sección.
function Visual({
  section,
  analysis: c,
  interview: a,
  name,
  who,
  color,
}: {
  section: (typeof sectionIds)[number];
  analysis: Communication;
  interview: Interview;
  name: string;
  who: string;
  color: string;
}) {
  const people = (
    <Legend
      small
      items={[
        { label: name, color },
        { label: who, color: grey },
      ]}
    />
  );
  if (section === 'habla') {
    const { invitado: guest, jordi: host } = c.habla;
    return (
      <Grid>
        <Cell span={5} label="Quién tiene la palabra">
          <p className="m-0 grid gap-2">
            <b className="font-heading text-[56px] leading-none font-normal tabular-nums">
              {decimal(guest.parte)} %
            </b>
            <span className="text-muted-foreground">
              de las palabras son de {name}: {thousands(guest.palabras)} frente a{' '}
              {thousands(host.palabras)} de {who}.
            </span>
          </p>
          <span aria-hidden="true" className="flex h-4 overflow-hidden rounded-full">
            <i className="block h-full" style={{ width: `${guest.parte}%`, background: color }} />
            <i className="block h-full flex-1" style={{ background: grey }} />
          </span>
          {people}
        </Cell>
        <Cell span={7} label="Los dos, con la misma medida">
          <Paired
            color={color}
            rows={[
              { label: 'Minutos de habla', guest: guest.minutos, host: host.minutos, digits: 1 },
              {
                label: 'Velocidad',
                unit: 'palabras por minuto',
                guest: guest.palabrasPorMinuto,
                host: host.palabrasPorMinuto,
              },
              {
                label: 'Trabas',
                unit: 'por cada 100 palabras',
                guest: guest.trabasPor100,
                host: host.trabasPor100,
                digits: 2,
              },
              {
                label: 'Pausas',
                unit: 'por cada 1.000 palabras',
                guest: guest.pausasPor1000,
                host: host.pausasPor1000,
                digits: 1,
              },
            ]}
          />
        </Cell>
      </Grid>
    );
  }
  if (section === 'preguntas') {
    return (
      <Grid>
        <Cell label={`Las ${c.preguntas.length} preguntas, una a una`}>
          <QuestionSquares analysis={c} />
          <p className="m-0 text-sm text-muted-foreground">
            Cada cuadrado es una intervención de {who} que pide respuesta, en el orden en que se
            hizo. La trama dice si se contesta a lo preguntado, no si lo que se dice es cierto.
          </p>
        </Cell>
      </Grid>
    );
  }
  if (section === 'temas') {
    const topics = topicMinutes(c);
    const opened = c.temas.filter((t) => t.quien === 'invitado').length;
    return (
      <Grid>
        <Cell label="Minutos por tema">
          <Bars
            rows={topics.map((t) => ({
              label: t.topic,
              value: t.minutes,
              display: `${decimal(t.minutes)} min`,
            }))}
          />
          <p className="m-0 text-sm text-muted-foreground">
            De los {c.temas.length} tramos de la entrevista, {opened} los abre {name} y{' '}
            {c.temas.length - opened}, {who}.
          </p>
        </Cell>
      </Grid>
    );
  }
  if (section === 'sintonia') {
    const rows = rapportIds
      .map((tipo) => {
        const list = c.sintonia.filter((x) => x.tipo === tipo);
        return {
          tipo,
          guest: list.filter((x) => x.quien === 'invitado').length,
          total: list.length,
        };
      })
      .filter((row) => row.total > 0);
    return (
      <Grid>
        <Cell label="Quién inicia cada momento de relación">
          <Paired
            shared
            color={color}
            rows={rows.map((row) => ({
              label: rapportNames[row.tipo],
              guest: row.guest,
              host: row.total - row.guest,
            }))}
          />
          {people}
        </Cell>
      </Grid>
    );
  }
  if (section === 'cara') {
    return (
      <Grid>
        <Cell span={8} label="Movimientos de la cara, por cada 10 minutos en pantalla">
          <Paired
            shared
            color={color}
            rows={c.cara.map((g) => ({
              label: (
                <>
                  <span className="font-mono">{g.au}</span>
                  <span className="block text-sm text-muted-foreground">{g.nombre}</span>
                </>
              ),
              guest: g.invitado,
              host: g.jordi,
              digits: 1,
            }))}
          />
          {people}
        </Cell>
        <Cell span={4} label="Cómo leerlo">
          <p className="m-0">
            Son unidades de acción del sistema FACS: nombran movimientos de músculos, no emociones.
            Cada persona se compara con su propia cara.
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            La cámara enseña la cara de {name} en el {decimal(c.habla.invitado.pantalla, 0)} % de
            los fotogramas y la de {who} en el {decimal(c.habla.jordi.pantalla, 0)} %: lo decide la
            realización. Un movimiento se puede medir; lo que significa, no.
          </p>
        </Cell>
      </Grid>
    );
  }
  if (section === 'datos') {
    return (
      <AI label="Comprobado con IA y buscador web · 13 de noviembre de 2026">
        <p>
          Esta comprobación es distinta de{' '}
          <Link
            href={`${interviewsHref(a.id)}#verificaciones`}
            className="underline underline-offset-4"
          >
            las verificaciones de la entrevista revisada
          </Link>
          : otro método, otra escala, más afirmaciones y también las de {who}. Por eso las dos no
          siempre califican igual la misma frase. No es una nota, y muchas filas se apoyan solo en
          el extracto del buscador.
        </p>
      </AI>
    );
  }
  return null;
}

// El título de cada sección y su nombre en el índice. El índice agrupa: una entrada sin nombre va
// bajo la anterior que lo tiene, para que quepa entero sin cortarse.
const sectionNames = {
  habla: ['Lo que dicen los datos', 'Quién habla'],
  preguntas: ['Las preguntas y cómo se responden', 'Preguntas'],
  sintonia: ['Sintonía con el entrevistador', null],
  temas: ['De qué se habla', 'Temas y promesas'],
  merito: ['Mérito y culpa', null],
  promesas: ['Promesas verificables', null],
  trabas: ['Trabas contadas una a una', 'Trabas y voz'],
  silencios: ['Silencios', null],
  voz: ['Voz', null],
  cara: ['Cara', 'Cara'],
  datos: ['Comprobación de datos', 'Datos'],
  momentos: ['Momentos clave', 'Momentos'],
  espectador: ['Por qué cada espectador vio una entrevista distinta', null],
} as const satisfies Record<(typeof sectionIds)[number], readonly [string, string | null]>;

// Cómo de grande es una diferencia (d de Cohen): por debajo de 0,2 no se aprecia.
const effect = (d: number) =>
  Math.abs(d) < 0.2
    ? 'inapreciable'
    : Math.abs(d) < 0.5
      ? 'pequeña'
      : Math.abs(d) < 0.8
        ? 'media'
        : 'grande';

// Las entrevistas de la ronda, con la misma medida. Solo cifras: no dicen quién estuvo mejor.
function SideBySide({ current }: { current: Communication }) {
  const all = allCommunication().flatMap((c) => {
    const interview = getInterview(c.id);
    const candidate = interview && getCandidate(interview.candidato);
    return interview && candidate ? [{ c, candidate, p: pressure(c) }] : [];
  });
  const row = (value: (x: (typeof all)[number]) => number, display: (n: number) => string) =>
    all.map((x) => ({
      // El apellido: «Feijóo», no «PP».
      label: x.candidate.name.split(' ').at(-1) ?? x.candidate.short,
      value: value(x),
      display: display(value(x)),
      color: x.candidate.color,
      href: x.c.id === current.id ? undefined : interviewsHref(`${x.c.id}/${communicationPath}`),
    }));
  const pct = (n: number) => `${Math.round(n)} %`;
  return (
    <Grid>
      <Cell span={4} label="De las palabras, son suyas">
        <Bars narrow max={100} rows={row((x) => x.c.habla.invitado.parte, pct)} />
      </Cell>
      <Cell span={4} label="Preguntas duras">
        <Bars narrow max={100} rows={row((x) => (x.p.hard / x.p.questions) * 100, pct)} />
      </Cell>
      <Cell span={4} label="De las duras, contesta a lo preguntado">
        <Bars narrow max={100} rows={row((x) => (x.p.answered / x.p.hard) * 100, pct)} />
      </Cell>
      <Cell span={4} label="Trabas por cada 100 palabras">
        <Bars
          narrow
          rows={row(
            (x) => x.c.habla.invitado.trabasPor100,
            (n) => decimal(n, 2),
          )}
        />
      </Cell>
      <Cell span={4} label="Pausas por cada 1.000 palabras">
        <Bars
          narrow
          rows={row(
            (x) => x.c.habla.invitado.pausasPor1000,
            (n) => decimal(n),
          )}
        />
      </Cell>
      <Cell span={4} label="Promesas comprobables">
        <Bars narrow rows={row((x) => x.c.promesas.verificables, String)} />
      </Cell>
      <Cell label="La voz tras una pregunta dura, frente al resto">
        <Table className="text-base">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto py-2 pl-0 text-sm font-normal text-muted-foreground">
                Candidato
              </TableHead>
              {current.presion.medidas.map((m) => (
                <TableHead
                  key={m.nombre}
                  className="h-auto py-2 text-sm font-normal whitespace-normal text-muted-foreground"
                >
                  {m.nombre} ({m.unidad})
                </TableHead>
              ))}
              <TableHead className="h-auto py-2 pr-0 text-sm font-normal whitespace-normal text-muted-foreground">
                Trabas por 100 palabras
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map(({ c, candidate }) => (
              <TableRow key={c.id} className="hover:bg-transparent">
                <TableHead scope="row" className="h-auto py-2.5 pl-0 font-normal">
                  <span className="flex items-center gap-2">
                    <Dot color={candidate.color} />
                    {candidate.name}
                  </span>
                </TableHead>
                {c.presion.medidas.map((m) => (
                  <TableCell key={m.nombre} className="py-2.5 whitespace-normal">
                    <span className="font-mono tabular-nums">
                      {decimal(m.duras, m.unidad === 'palabras/min' ? 0 : 1)} /{' '}
                      {decimal(m.resto, m.unidad === 'palabras/min' ? 0 : 1)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Diferencia {effect(m.d)} (d = {decimal(m.d, 2)})
                    </span>
                  </TableCell>
                ))}
                <TableCell className="py-2.5 pr-0 font-mono tabular-nums">
                  {decimal(c.presion.trabasPor100.duras, 2)} /{' '}
                  {decimal(c.presion.trabasPor100.resto, 2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="m-0 text-sm text-muted-foreground">
          En cada casilla, la media tras una pregunta dura y la del resto de la entrevista, con la
          misma definición para todos; por eso puede variar unas décimas respecto al cálculo de cada
          informe. Ninguna de estas medidas sirve para saber si alguien dice la verdad.
        </p>
      </Cell>
    </Grid>
  );
}

// Cómo se ha medido cada cosa. Lo hace un programa o una IA, y se dice cuál.
const method = [
  [
    'Lo que se dice',
    'Transcripción automática (Whisper) con el instante de cada palabra. Solo cuentan las palabras cuya voz se pudo atribuir con seguridad a cada persona.',
  ],
  [
    'Preguntas y respuestas',
    'Una IA leyó la transcripción entera con un criterio escrito, el mismo para todos. Ante la duda entre dos clases de respuesta, se elige la más favorable al invitado.',
  ],
  [
    'Trabas y pausas',
    'Repeticiones, frases que se cortan y huecos de más de 0,4 segundos entre palabras de la misma persona. Son recuentos mínimos: la transcripción limpia parte de los titubeos.',
  ],
  [
    'Voz',
    'Tono, volumen y velocidad de cada frase, medidos con Praat y comparados con la media de la propia persona.',
  ],
  [
    'Cara',
    'Un programa (py-feat) estima unidades de acción FACS cinco veces por segundo, respecto a la cara de base de cada uno. No se usa ningún modelo de emociones.',
  ],
  [
    'El texto',
    'Redactado con IA a partir de esas medidas. Cada cita entre comillas se comprobó por programa contra la transcripción.',
  ],
] as const;

// El anexo: qué lleva el paquete de datos de una entrevista y qué se queda fuera.
const packed = [
  [
    'Transcripción y hablantes',
    'Cada palabra con su instante, los turnos y la verificación de las voces.',
  ],
  [
    'Habla y voz',
    'Las trabas y las pausas, una a una, y de cada frase su tono, su volumen y su velocidad.',
  ],
  ['Cara', 'Unidades de acción y postura fotograma a fotograma, gestos y movimiento.'],
  [
    'Preguntas y respuestas',
    'Cada pregunta con su dureza y su respuesta, los temas, las afirmaciones, las promesas, el mérito y la culpa y la sintonía.',
  ],
  [
    'Comprobación de datos',
    'Cada afirmación con su veredicto, su explicación, sus fuentes y si la fuente se llegó a abrir.',
  ],
  ['Informes y gráficas', 'Este informe, el informe técnico y las gráficas de cada medida.'],
] as const;
const unpacked = [
  [
    'El vídeo, el audio y los fotogramas',
    'Son del programa. Cada dato lleva su minuto para ir al original.',
  ],
  ['Los comentarios de YouTube', 'Llevan nombres de usuarios. Solo van los recuentos.'],
  ['Las huellas de identidad', 'Las que sirvieron para asignar cada cara y cada voz a su persona.'],
  [
    'Los clasificadores de emoción',
    'El análisis no los usa: la cara y la voz se describen como movimiento y sonido.',
  ],
] as const;

export function CommunicationReport({
  interview: a,
  analysis: c,
}: {
  interview: Interview;
  analysis: Communication;
}) {
  const candidate = getCandidate(a.candidato);
  const name = interviewName(a);
  const who = interviewerOf(a) ?? 'el entrevistador';
  const color = candidate?.color ?? 'var(--foreground)';
  const day = publishedDay(a);
  const video = videoUrl(a);
  const p = pressure(c);
  const [lead, ...warnings] = c.entrada;
  const sections = sectionIds.filter((id) => c.secciones[id]?.length);
  const others = allCommunication().length > 1;
  return (
    <>
      <Link
        href={interviewsHref(a.id)}
        className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <Icon name="izquierda" size={14} /> La entrevista a {name}, revisada
      </Link>
      <Card
        render={<header />}
        className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-8 p-6 text-base md:grid-cols-[minmax(0,200px)_minmax(0,1fr)] lg:p-8 max-sm:p-5"
      >
        {candidate && (
          <Portrait
            candidate={candidate}
            sizes="(min-width: 768px) 280px, 60vw"
            className="max-md:mx-auto max-md:w-40"
          />
        )}
        <div className="grid content-start justify-items-start gap-6">
          <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {candidate && <Dot color={candidate.color} />}
            <b className="font-medium text-foreground">Análisis de comunicación</b>
            <span>
              {[outlet(a), day && formatDate(day, { day: 'numeric', month: 'long' })]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
          <h1 className="m-0 font-heading text-3xl leading-[1.1] font-normal text-balance lg:text-[44px]">
            {c.titular}
          </h1>
          {lead && (
            <p className="m-0 max-w-[70ch] text-lg leading-relaxed text-muted-foreground">
              <Rich text={lead} id={a.id} />
            </p>
          )}
          <dl className="m-0 flex flex-wrap gap-x-8 gap-y-5 border-t border-border pt-6 max-sm:gap-x-6">
            {(
              [
                ['Preguntas', String(p.questions)],
                ['Duras', `${Math.round((p.hard / p.questions) * 100)} %`],
                ['Contesta a las duras', String(p.answered), `de ${p.hard}`],
                ['Palabras suyas', `${decimal(c.habla.invitado.parte)} %`],
                [
                  'Promesas comprobables',
                  String(c.promesas.verificables),
                  `de ${c.promesas.total}`,
                ],
              ] as const
            ).map(([label, value, aside]) => (
              <div key={label} className="grid content-start gap-1">
                <dt className="whitespace-nowrap">
                  <Label>{label}</Label>
                </dt>
                <dd className="m-0 font-heading text-3xl leading-none whitespace-nowrap tabular-nums lg:text-4xl">
                  {value}
                  {aside && <span className="ml-1.5 text-base text-muted-foreground">{aside}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Link
              href={interviewsHref(a.id)}
              data-slot="button"
              data-variant="sunset"
              className={cn(buttonVariants({ variant: 'sunset', size: 'xl' }))}
            >
              Ver la entrevista revisada <Icon name="derecha" size={16} />
            </Link>
            {video && (
              <a
                href={video}
                target="_blank"
                rel="noopener noreferrer"
                data-slot="button"
                data-variant="outline"
                className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
              >
                Ver el original
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            )}
            {c.datos.length > 0 && (
              <a
                href="#anexo"
                data-slot="button"
                data-variant="outline"
                className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
              >
                <Icon name="descargar" size={18} /> Descargar los datos
              </a>
            )}
            <ShareButton title={`${name}: análisis de comunicación`} />
          </div>
        </div>
      </Card>
      {warnings.map((text) => (
        <Notice key={text}>
          <Rich text={text} id={a.id} />
        </Notice>
      ))}

      <PageIndex
        items={[
          [c.claves.length > 0 && 'claves', 'Claves'],
          ['vistazo', 'De un vistazo'],
          ...sections.flatMap((id): [string, string][] => {
            const short = sectionNames[id][1];
            return short ? [[id, short]] : [];
          }),
          [others && 'ronda', 'Los tres'],
          ['limites', 'Límites'],
        ]}
      />

      {c.claves.length > 0 && (
        <ReportSection id="claves" title="Para llevarte a casa">
          {c.frase && (
            <p className="m-0 mb-6 max-w-[60ch] font-heading text-2xl leading-snug">{c.frase}</p>
          )}
          <ol className="m-0 grid list-none grid-cols-12 gap-4 p-0">
            {c.claves.map((text, i) => {
              const key = split(text, Infinity);
              return (
                <Card
                  key={text}
                  render={<li />}
                  className="col-span-12 gap-3 p-6 text-base md:col-span-6 lg:col-span-4 lg:last:nth-[3n+1]:col-span-12 max-sm:p-5"
                >
                  <Label>{String(i + 1).padStart(2, '0')}</Label>
                  {key.lead && (
                    <h3 className="m-0 font-heading text-2xl leading-tight font-normal">
                      <Rich text={key.lead} id={a.id} />
                    </h3>
                  )}
                  <p className="m-0 leading-relaxed text-muted-foreground">
                    <Rich text={key.body} id={a.id} />
                  </p>
                </Card>
              );
            })}
          </ol>
        </ReportSection>
      )}

      <ReportSection id="vistazo" title="La entrevista, de un vistazo">
        <Grid>
          <Cell>
            <Timeline analysis={c} interview={a} name={name} who={who} color={color} />
          </Cell>
        </Grid>
      </ReportSection>

      {sections.map((id) => (
        <ReportSection key={id} id={id} title={sectionNames[id][0]}>
          <Visual section={id} analysis={c} interview={a} name={name} who={who} color={color} />
          <Prose blocks={c.secciones[id] ?? []} id={a.id} />
          {id === 'momentos' && c.publico && (
            <Grid>
              <Cell label="El público, en YouTube">
                <dl className="m-0 flex flex-wrap gap-x-10 gap-y-5">
                  {(
                    [
                      ['Vistas', thousands(c.publico.vistas)],
                      ['Me gusta', thousands(c.publico.meGusta)],
                      ['Comentarios leídos', thousands(c.publico.comentarios)],
                      ['Citan algún minuto', thousands(c.publico.conMinuto)],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="grid gap-1">
                      <dt>
                        <Label>{label}</Label>
                      </dt>
                      <dd className="m-0 font-heading text-3xl leading-none tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {c.publico.citados.length > 0 && (
                  <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm">
                    <li className="text-muted-foreground">Los minutos más citados:</li>
                    {c.publico.citados.map((x) => (
                      <li key={x.segundo} className="flex items-center gap-1.5">
                        <Jump interview={a} second={x.segundo} />
                        <span className="text-muted-foreground tabular-nums">× {x.veces}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="m-0 text-sm text-muted-foreground">
                  Lectura del{' '}
                  {formatDate(c.publico.lectura.slice(0, 10), { day: 'numeric', month: 'long' })} a
                  las {c.publico.lectura.slice(11)}, pocas horas después del estreno. Son pocos
                  comentarios con minuto: sirven de pista, no de medida.
                </p>
              </Cell>
            </Grid>
          )}
        </ReportSection>
      ))}

      {others && (
        <ReportSection id="ronda" title="Los candidatos, con la misma medida">
          <p className="m-0 mb-6 max-w-[65ch] text-muted-foreground">
            Mismo entrevistador, mismo formato y mismo día. Son recuentos con las mismas reglas para
            todos: describen cómo fue cada entrevista, no quién estuvo mejor.
          </p>
          <SideBySide current={c} />
        </ReportSection>
      )}

      <ReportSection id="limites" title="Lo que este análisis no puede decir">
        <Grid>
          <Cell span={7}>
            <dl className="m-0 grid gap-4">
              {c.limites.map((text) => {
                const limit = split(text);
                return (
                  <div
                    key={text}
                    className="grid gap-1 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    {limit.lead && <dt className="font-medium">{limit.lead}</dt>}
                    <dd className="m-0 leading-relaxed text-muted-foreground">
                      <Rich text={limit.body} id={a.id} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Cell>
          <Cell span={5} label="Cómo se ha hecho">
            <dl className="m-0 grid gap-3">
              {method.map(([title, text]) => (
                <div key={title}>
                  <dt className="font-medium">{title}</dt>
                  <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
            {c.referencias.length > 0 && (
              <Fold
                summary={
                  <span className="text-sm font-medium">
                    Las {c.referencias.length} referencias académicas citadas
                  </span>
                }
              >
                <ul className="m-0 grid list-none gap-2 p-0 text-sm text-muted-foreground">
                  {c.referencias.map((text) => (
                    <li key={text}>
                      <Rich text={text} id={a.id} />
                    </li>
                  ))}
                </ul>
              </Fold>
            )}
          </Cell>
        </Grid>
      </ReportSection>

      {c.datos.length > 0 && (
        <ReportSection id="anexo" title="Anexo: los datos">
          <Grid>
            <Cell span={7} label="Para descargar">
              <p className="m-0 max-w-[60ch]">
                Todo lo medido, tal como salió, en CSV y JSON. Cada paquete lleva un LEEME que
                explica sus archivos.
              </p>
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {c.datos.map((d) => (
                  <li key={d.archivo}>
                    <a
                      href={`/datos/comunicacion/${d.archivo}`}
                      download
                      className="flex h-full min-h-16 items-center gap-4 rounded-2xl px-4 py-3 no-underline ring-1 ring-border transition-colors hover:bg-muted motion-reduce:transition-none"
                    >
                      <Icon name="descargar" size={18} />
                      <span className="grid gap-0.5">
                        <b className="leading-snug font-medium">{d.nombre}</b>
                        <span className="font-mono text-sm text-muted-foreground tabular-nums">
                          ZIP · {decimal(d.bytes / 1e6)} MB · {d.archivos} archivos
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <dl className="m-0 grid gap-x-8 gap-y-4 border-t border-border pt-6 sm:grid-cols-2">
                {packed.map(([title, text]) => (
                  <div key={title}>
                    <dt className="font-medium">{title}</dt>
                    <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
            </Cell>
            <Cell span={5} label="Lo que no va en el paquete">
              <dl className="m-0 grid gap-4">
                {unpacked.map(([title, text]) => (
                  <div key={title}>
                    <dt className="font-medium">{title}</dt>
                    <dd className="m-0 text-sm text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
            </Cell>
          </Grid>
        </ReportSection>
      )}

      <div className="grid gap-6">
        <Explore
          links={[
            { href: interviewsHref(a.id), text: 'La entrevista revisada' },
            { href: interviewsHref(), text: 'Todas las entrevistas' },
            { href: interviewsHref('metodologia'), text: 'Cómo se revisan' },
          ]}
        />
        {candidate && <PhotoCredits people={[candidate]} />}
      </div>
    </>
  );
}
