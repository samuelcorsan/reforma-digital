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
  pressure,
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
import {
  Dot,
  Fold,
  interviewsHref,
  Jump,
  Notice,
  reportHref,
  TimelineAndTranscript,
  videoHref,
} from './interviews';
import { answerStyles } from './mark-icon';
import { Portrait } from './portrait';
import { Bars, Cell, Explore, Grid, Label, Legend, ReportSection } from './report';
import { ShareButton } from './share-button';

// El análisis de comunicación de una entrevista: el informe, con sus gráficas. Todo sale de
// lib/elecciones/communication.ts; aquí solo se pinta.

const grey = 'var(--muted-foreground)';

// El texto del informe: negrita, cursiva, enlaces y minutos del vídeo (73:05), que llevan a él.
// Un ancla del texto (`#datos`) lleva a la subpágina del análisis que tiene esa sección.
function anchorHref(id: string, hash: string) {
  const section = hash.slice(1);
  const fixed: Partial<Record<string, CommView>> = {
    claves: 'resumen',
    ronda: 'comparativa',
    limites: 'metodologia',
    anexo: 'metodologia',
  };
  const view =
    fixed[section] ??
    (Object.keys(commSections) as CommView[]).find((v) =>
      commSections[v]?.some((s) => s === section),
    );
  return view ? `${commHref(id, view)}${hash}` : hash;
}

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
        <a key={match.index} href={anchorHref(id, url)} className="underline underline-offset-4">
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
          href={videoHref(id, Number(minutes) * 60 + Number(seconds))}
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
              {replyNames[reply]}
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
  if (section === 'habla') {
    const { invitado: guest, jordi: host } = c.habla;
    return (
      <Grid>
        <Cell span={5}>
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
          <Legend
            small
            items={[
              { label: name, color },
              { label: who, color: grey },
            ]}
          />
        </Cell>
      </Grid>
    );
  }
  if (section === 'preguntas') {
    return (
      <Grid>
        <Cell>
          <QuestionSquares analysis={c} />
          <p className="m-0 text-sm text-muted-foreground">
            La trama indica si la respuesta corresponde a la pregunta, no si su contenido es cierto.
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
        <Cell>
          <Bars
            rows={topics.map((t) => ({
              label: t.topic,
              value: t.minutes,
              display: `${decimal(t.minutes)} min`,
            }))}
          />
          <p className="m-0 text-sm text-muted-foreground">
            De los {c.temas.length} tramos de la entrevista, {opened} los introduce {name} y{' '}
            {c.temas.length - opened}, {who}.
          </p>
        </Cell>
      </Grid>
    );
  }
  if (section === 'datos') {
    return (
      <AI label="Comprobación con IA y buscador web · 13 de noviembre de 2026">
        <p>
          Esta comprobación es independiente de{' '}
          <Link href={reportHref(a.id, 'verificaciones')} className="underline underline-offset-4">
            las verificaciones de la entrevista revisada
          </Link>
          : usa otro método y otra escala, e incluye más afirmaciones, también las de {who}. Por eso
          ambas pueden calificar de forma distinta la misma frase. No constituye una nota, y muchas
          filas se basan solo en el extracto del buscador.
        </p>
      </AI>
    );
  }
  return null;
}

// El título de cada sección y su nombre en el índice. El índice agrupa: una entrada sin nombre va
// bajo la anterior que lo tiene, para que quepa entero sin cortarse.
const sectionNames = {
  habla: ['Tiempo de palabra', 'Tiempo de palabra'],
  preguntas: ['Preguntas y grado de respuesta', 'Preguntas'],
  sintonia: ['Relación con el entrevistador', null],
  temas: ['Temas tratados', 'Temas y promesas'],
  merito: ['Atribución de logros y fracasos', null],
  promesas: ['Promesas verificables', null],
  trabas: ['Trabas en el habla', 'Trabas y voz'],
  silencios: ['Pausas', null],
  voz: ['Voz', null],
  cara: ['Movimientos faciales', 'Movimientos faciales'],
  datos: ['Comprobación de datos', 'Datos'],
  momentos: ['Momentos clave', 'Momentos'],
  espectador: ['Interpretaciones de la entrevista según el espectador', null],
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
      <Cell span={4} label="Preguntas duras">
        <Bars narrow max={100} rows={row((x) => (x.p.hard / x.p.questions) * 100, pct)} />
      </Cell>
      <Cell span={4} label="Preguntas duras con respuesta a lo preguntado">
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
      <Cell label="Voz tras una pregunta dura frente al resto">
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
          Cada casilla recoge la media tras una pregunta dura y la del resto de la entrevista, con
          la misma definición para todos los candidatos. Por ello puede diferir en unas décimas del
          cálculo de cada informe.
        </p>
      </Cell>
    </Grid>
  );
}

// Cómo se ha medido cada cosa. Lo hace un programa o una IA, y se dice cuál.
const method = [
  [
    'Transcripción',
    'Transcripción automática (Whisper) con el instante de cada palabra. Solo cuentan las palabras cuya voz se pudo atribuir con seguridad a cada persona.',
  ],
  [
    'Preguntas y respuestas',
    'Una IA analizó la transcripción completa con un criterio escrito, común a todas las entrevistas. En caso de duda entre dos clases de respuesta, se asigna la más favorable al invitado.',
  ],
  [
    'Trabas y pausas',
    'Repeticiones, frases interrumpidas y silencios de más de 0,4 segundos entre palabras de la misma persona. Son recuentos mínimos, porque la transcripción elimina parte de los titubeos.',
  ],
  [
    'Voz',
    'Tono, volumen y velocidad de cada frase, medidos con Praat y comparados con la media de la propia persona.',
  ],
  [
    'Movimientos faciales',
    'Un programa (py-feat) estima unidades de acción FACS cinco veces por segundo, respecto a la cara de base de cada uno. No se usa ningún modelo de emociones.',
  ],
  [
    'Redacción del informe',
    'Redacción con IA a partir de esas medidas. Cada cita entre comillas se contrastó automáticamente con la transcripción.',
  ],
] as const;

// El anexo: qué lleva el paquete de datos de una entrevista y qué se queda fuera.
const packed = [
  [
    'Transcripción y hablantes',
    'Cada palabra con su instante, los turnos y la verificación de las voces.',
  ],
  ['Habla y voz', 'Trabas y pausas, una por una, y tono, volumen y velocidad de cada frase.'],
  [
    'Movimientos faciales',
    'Unidades de acción y postura fotograma a fotograma, gestos y movimiento.',
  ],
  [
    'Preguntas y respuestas',
    'Dureza y tipo de respuesta de cada pregunta, temas, afirmaciones, promesas, atribución de logros y fracasos, y relación con el entrevistador.',
  ],
  [
    'Comprobación de datos',
    'Veredicto, explicación y fuentes de cada afirmación, e indicación de si la fuente se llegó a consultar.',
  ],
  ['Informes y gráficas', 'Este informe, el informe técnico y las gráficas de cada medida.'],
] as const;
const unpacked = [
  [
    'El vídeo, el audio y los fotogramas',
    'Pertenecen al programa. Cada dato incluye su minuto para consultar el original.',
  ],
  ['Comentarios de YouTube', 'Contienen nombres de usuario. Solo se incluyen los recuentos.'],
  ['Huellas de identidad', 'Las usadas para atribuir cada cara y cada voz a su persona.'],
] as const;

// Las subpáginas del análisis: el resumen (conclusiones) es la de entrada.
export const commViews = {
  resumen: 'Resumen del análisis',
  linea: 'Línea de tiempo y transcripción',
  preguntas: 'Preguntas y relación con el entrevistador',
  temas: 'Temas y atribución de logros',
  voz: 'Voz, pausas y gestos',
  publico: 'Datos y audiencia',
  comparativa: 'Comparativa entre candidatos',
  metodologia: 'Limitaciones y datos',
} as const;
export type CommView = keyof typeof commViews;
// Qué secciones del análisis van en cada subpágina.
const commSections: Partial<Record<CommView, readonly (typeof sectionIds)[number][]>> = {
  preguntas: ['habla', 'preguntas', 'sintonia'],
  linea: ['momentos'],
  temas: ['temas', 'merito'],
  voz: ['trabas', 'silencios', 'voz', 'cara'],
  publico: ['datos', 'espectador'],
};
const commBlurb: Record<CommView, string> = {
  resumen: '',
  linea: 'Vídeo, momentos clave, temas y marcas minuto a minuto, con la transcripción',
  preguntas: 'Tiempo de palabra, preguntas duras y cómo responde a cada una',
  temas: 'De qué se habla y a quién atribuye logros y fracasos',
  voz: 'Trabas, pausas, voz y movimientos faciales',
  publico: 'Comprobación de datos y lo que comenta el público',
  comparativa: 'Las mismas medidas para todos los candidatos de la ronda',
  metodologia: 'Qué no puede decir este análisis, cómo se ha hecho y los datos completos',
};
export const commHref = (id: string, view: CommView = 'resumen') =>
  interviewsHref(`${id}/${communicationPath}${view === 'resumen' ? '' : `/${view}`}`);
// Las subpáginas que tiene este análisis.
export function commAvailable(c: Communication): CommView[] {
  return (Object.keys(commViews) as CommView[]).filter((view) => {
    // El vídeo y la transcripción están siempre, tenga o no momentos clave.
    if (view === 'linea') return true;
    const ids = commSections[view];
    if (ids) return ids.some((id) => c.secciones[id]?.length);
    if (view === 'comparativa') return allCommunication().length > 1;
    return true;
  });
}

// Las partes del análisis (sin su resumen, que es el propio enlace), para la barra lateral.
export const commNavItems = (a: Interview, c: Communication) =>
  commAvailable(c)
    .filter((view) => view !== 'resumen')
    .map((view) => ({ href: commHref(a.id, view), label: commViews[view] }));

export function CommunicationReport({
  interview: a,
  analysis: c,
  view = 'resumen',
}: {
  interview: Interview;
  analysis: Communication;
  view?: CommView;
}) {
  const candidate = getCandidate(a.candidato);
  const name = interviewName(a);
  const who = interviewerOf(a) ?? 'el entrevistador';
  const color = candidate?.color ?? 'var(--foreground)';
  const day = publishedDay(a);
  const video = videoUrl(a);
  // La entrada la resumen el titular y las conclusiones; sus avisos, sí, van a la vista.
  const [, ...warnings] = c.entrada;
  const sections = sectionIds.filter(
    (id) => c.secciones[id]?.length && commSections[view]?.includes(id),
  );
  const views = commAvailable(c);
  const i = views.indexOf(view);
  return (
    <>
      {view === 'resumen' ? (
        <>
          <Link
            href={interviewsHref(a.id)}
            className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <Icon name="izquierda" size={14} /> Entrevista a {name}
          </Link>
          {/* Cabecera ligera, como la del informe: quién, dónde y qué se puede hacer. */}
          <header className="mb-4 grid items-center gap-x-8 gap-y-5 md:grid-cols-[9rem_minmax(0,1fr)]">
            {candidate && (
              <Portrait
                candidate={candidate}
                sizes="(min-width: 768px) 240px, 40vw"
                hoverColor
                className="max-md:w-32"
              />
            )}
            <div className="grid content-start justify-items-start gap-3">
              <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                {candidate && <Dot color={candidate.color} />}
                {[
                  candidate?.party,
                  outlet(a),
                  day && formatDate(day, { day: 'numeric', month: 'long' }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h1 className="m-0 font-heading text-4xl leading-[1.05] font-normal lg:text-[56px]">
                Análisis de comunicación
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {video && (
                  <a
                    href={video}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-slot="button"
                    data-variant="outline"
                    className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
                  >
                    Ver el vídeo original
                    <span aria-hidden="true"> ↗</span>
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                )}
                {c.datos.length > 0 && (
                  <Link
                    href={`${commHref(a.id, 'metodologia')}#anexo`}
                    data-slot="button"
                    data-variant="outline"
                    className={cn(buttonVariants({ variant: 'outline', size: 'xl' }))}
                  >
                    <Icon name="descargar" size={18} /> Descargar los datos
                  </Link>
                )}
                <ShareButton title={`${name}: análisis de comunicación`} />
              </div>
            </div>
          </header>
          {warnings.map((text) => (
            <Notice key={text}>
              <Rich text={text} id={a.id} />
            </Notice>
          ))}
        </>
      ) : (
        <header className="mb-4 grid justify-items-start gap-2">
          <Link
            href={commHref(a.id)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <Icon name="izquierda" size={14} /> Análisis de comunicación · {name}
          </Link>
          <h1 className="m-0 font-heading text-4xl leading-[1.08] font-normal lg:text-[52px]">
            {commViews[view]}
          </h1>
        </header>
      )}

      {view === 'resumen' && c.claves.length > 0 && (
        <ReportSection id="claves" title="Conclusiones principales">
          <ol className="m-0 grid list-none grid-cols-12 gap-4 p-0">
            {c.claves.map((text) => {
              const key = split(text, Infinity);
              return (
                <Card
                  key={text}
                  render={<li />}
                  className="col-span-12 gap-3 p-6 text-base md:col-span-6 lg:col-span-4 lg:last:nth-[3n+1]:col-span-12 max-sm:p-5"
                >
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

      {sections.map((id) => (
        <ReportSection key={id} id={id} title={sectionNames[id][0]}>
          <Visual section={id} analysis={c} interview={a} name={name} who={who} color={color} />
          <Prose blocks={c.secciones[id] ?? []} id={a.id} />
        </ReportSection>
      ))}

      {view === 'linea' && <TimelineAndTranscript interview={a} />}

      {view === 'publico' && c.publico && (
        <Grid>
          <Cell label="Audiencia en YouTube">
            <dl className="m-0 flex flex-wrap gap-x-10 gap-y-5">
              {(
                [
                  ['Visualizaciones', thousands(c.publico.vistas)],
                  ['Me gusta', thousands(c.publico.meGusta)],
                  ['Comentarios analizados', thousands(c.publico.comentarios)],
                  ['Comentarios con minuto citado', thousands(c.publico.conMinuto)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid gap-1">
                  <dt>
                    <Label>{label}</Label>
                  </dt>
                  <dd className="m-0 font-heading text-3xl leading-none tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {c.publico.citados.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-sm">
                <li className="text-muted-foreground">Minutos más citados:</li>
                {c.publico.citados.map((x) => (
                  <li key={x.segundo} className="flex items-center gap-1.5">
                    <Jump interview={a} second={x.segundo} />
                    <span className="text-muted-foreground tabular-nums">× {x.veces}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 text-sm text-muted-foreground">
              Datos consultados el{' '}
              {formatDate(c.publico.lectura.slice(0, 10), { day: 'numeric', month: 'long' })} a las{' '}
              {c.publico.lectura.slice(11)}, pocas horas después del estreno. Los comentarios con
              minuto son pocos: son un indicio, no una medida.
            </p>
          </Cell>
        </Grid>
      )}

      {view === 'comparativa' && (
        <section id="ronda" className="my-16 scroll-mt-40">
          <p className="m-0 mb-6 max-w-[65ch] text-muted-foreground">
            Entrevistas con el mismo entrevistador, el mismo formato y el mismo día. Los recuentos
            describen cada entrevista y no establecen quién estuvo mejor.
          </p>
          <SideBySide current={c} />
        </section>
      )}

      {view === 'metodologia' && (
        <ReportSection id="limites" title="Limitaciones del análisis">
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
            <Cell span={5} label="Metodología">
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
                      Referencias académicas ({c.referencias.length})
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
      )}

      {view === 'metodologia' && c.datos.length > 0 && (
        <ReportSection id="anexo" title="Anexo: datos">
          <Grid>
            <Cell span={7}>
              <p className="m-0 max-w-[60ch]">
                Datos completos de las mediciones, sin procesar, en CSV y JSON. Cada paquete incluye
                un archivo LEEME que describe su contenido.
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
            <Cell span={5} label="Datos no incluidos">
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

      {view === 'resumen' ? (
        <section aria-labelledby="detalle" className="my-16">
          <h2
            id="detalle"
            data-section-title
            className="m-0 mb-6 scroll-mt-40 font-heading text-[32px] leading-tight font-normal lg:text-[36px]"
          >
            Ver en detalle
          </h2>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {views
              .filter((v) => v !== 'resumen')
              .map((v) => (
                <li key={v}>
                  <Link
                    href={commHref(a.id, v)}
                    className="group flex h-full min-h-28 flex-col gap-2 rounded-[20px] p-5 no-underline ring-1 ring-border transition-colors hover:bg-muted/60 motion-reduce:transition-none"
                  >
                    <span className="flex items-center justify-between gap-3 text-lg font-medium">
                      {commViews[v]}
                      <span className="flex transition-transform duration-300 ease-(--ease-brand) motion-safe:group-hover:translate-x-1">
                        <Icon name="derecha" size={16} />
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">{commBlurb[v]}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : (
        <nav
          aria-label="Partes del análisis de comunicación"
          className="mt-16 grid grid-cols-2 gap-4"
        >
          {[views[i - 1], views[i + 1]].map((v, k) =>
            v ? (
              <Link
                key={v}
                href={commHref(a.id, v)}
                className={cn(
                  'grid gap-1 rounded-xl p-5 no-underline ring-1 ring-border transition-colors hover:bg-muted motion-reduce:transition-none',
                  k === 1 && 'col-start-2 text-right',
                )}
              >
                <span className="text-sm text-muted-foreground">
                  {k === 1 ? 'Siguiente' : 'Anterior'}
                </span>
                <b className="text-lg font-medium">
                  {v === 'resumen' ? 'Resumen del análisis' : commViews[v]}
                </b>
              </Link>
            ) : null,
          )}
        </nav>
      )}
    </>
  );
}
