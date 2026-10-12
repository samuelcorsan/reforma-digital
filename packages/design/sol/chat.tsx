'use client';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Streamdown, type Components, type ExtraProps } from 'streamdown';

/**
 * Sol chat building blocks (GUIA.md · Chat). Presentational only: the app decides which verified
 * block each one renders and passes the icons in (Icon lives in apps/web). Styles in chat.css.
 */

const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/* ─── Markdown ─────────────────────────────────────────────────────────────── */

const prose: Components = {
  p: ({ children }) => <p>{children}</p>,
  h1: ({ children }) => <h1 className="chat-md-heading">{children}</h1>,
  h2: ({ children }) => <h2 className="chat-md-heading">{children}</h2>,
  h3: ({ children }) => <h3 className="chat-md-heading">{children}</h3>,
  h4: ({ children }) => <h4 className="chat-md-heading">{children}</h4>,
  h5: ({ children }) => <h5 className="chat-md-heading">{children}</h5>,
  h6: ({ children }) => <h6 className="chat-md-heading">{children}</h6>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  hr: () => <hr />,
  table: ({ children }) => (
    <div className="chat-md-table">
      <table>{children}</table>
    </div>
  ),
  inlineCode: ({ children }) => <code>{children}</code>,
  // Quoted content is read here and opened on the official site: no links, images or checkboxes.
  a: ({ children }) => <span>{children}</span>,
  img: () => null,
  input: () => null,
};

type CitationTag = ComponentProps<'span'> & ExtraProps & { index?: string };

/**
 * Markdown for answers and official excerpts, rendered with Streamdown. While tokens arrive it
 * repairs unterminated syntax and reveals each word; finished content renders in static mode.
 */
export const Response = memo(function Response({
  children,
  streaming = false,
  skipHtml = false,
  renderCitation,
  className,
}: {
  children: string;
  streaming?: boolean;
  /** HTML from official sites is never rendered. */
  skipHtml?: boolean;
  /** Renders the `<rd-cite index="n">` tags added by withCitations, never by the model. */
  renderCitation?: (index: number, label: ReactNode) => ReactNode;
  className?: string;
}) {
  return (
    <Streamdown
      className={join('chat-md', className)}
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      animated={{ animation: 'reveal', duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      skipHtml={skipHtml}
      controls={false}
      {...(renderCitation
        ? {
            allowedTags: { 'rd-cite': ['index'] },
            literalTagContent: ['rd-cite'],
            components: {
              ...prose,
              'rd-cite': ({ index, children: label }: CitationTag) =>
                renderCitation(Number(index), label),
            },
          }
        : { components: prose })}
    >
      {children}
    </Streamdown>
  );
});

const escapeTag = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Appends citations after the verified text so they flow with its last line. */
export function withCitations(text: string, labels: readonly string[]): string {
  return labels.reduce(
    (out, label, index) => `${out} <rd-cite index="${index}">${escapeTag(label)}</rd-cite>`,
    text,
  );
}

/* ─── Conversation ─────────────────────────────────────────────────────────── */

/** The question is the heading of its turn; `details` holds the lines under it. */
export function Question({
  level,
  children,
  attachment,
  details,
}: {
  level: 1 | 2;
  children: ReactNode;
  attachment?: ReactNode;
  details?: ReactNode;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <header className="chat-question">
      {attachment && <p className="chat-attached-message">{attachment}</p>}
      <Heading className="chat-question-title">{children}</Heading>
      {details && <div className="chat-question-details">{details}</div>}
    </header>
  );
}

/** One short status line under the question, e.g. «Respuesta verificada con 2 fuentes oficiales». */
export function QuestionDetail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="chat-question-detail chat-enter">
      {icon}
      {children}
    </p>
  );
}

/** Activity indicator: the shimmer says work is pending; the stage crossfades when it changes. */
export function Thinking({ label, stage }: { label: string; stage?: string }) {
  return (
    <div className="chat-thinking" role="status">
      <span className="chat-shimmer">{label}</span>
      {stage && (
        <span key={stage} className="chat-stage">
          {stage}
        </span>
      )}
    </div>
  );
}

const noticeBoxes = { info: 'caja-plana', warning: 'caja-aviso', error: 'caja-error' } as const;

export function Notice({
  tone,
  icon,
  title,
  children,
  actions,
  role,
}: {
  tone: keyof typeof noticeBoxes;
  icon: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={join('chat-notice chat-enter', noticeBoxes[tone])} role={role}>
      {icon}
      <div>
        {title && <strong className="chat-notice-title">{title}</strong>}
        {children}
        {actions && <div className="chat-notice-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* ─── Answer blocks ────────────────────────────────────────────────────────── */

export function Answer({ children }: { children: ReactNode }) {
  return <div className="chat-answer">{children}</div>;
}

export function StepList({ start, children }: { start: number; children: ReactNode }) {
  return (
    <ol className="chat-steps" start={start}>
      {children}
    </ol>
  );
}

export function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="chat-step chat-enter">
      <span className="chat-step-number">
        {number}
        <span className="sr-only">.</span>
      </span>
      <div>{children}</div>
    </li>
  );
}

export function Fact({ children }: { children: ReactNode }) {
  return <div className="chat-fact chat-enter">{children}</div>;
}

export function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="chat-details">{children}</div>;
}

/** Documentation, cost or deadline card. `highlight` is the single sun-coloured card of a view. */
export function DetailCard({
  label,
  figure,
  highlight = false,
  children,
}: {
  label: ReactNode;
  figure?: string | undefined;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={join('chat-detail chat-enter', highlight ? 'caja-sol' : 'caja-gris')}>
      <h3 className="chat-detail-label">{label}</h3>
      {figure && <p className="chat-detail-figure">{figure}</p>}
      <div className={figure ? 'chat-detail-note' : 'chat-detail-text'}>{children}</div>
    </section>
  );
}

/** Where the procedure is done, with the action that opens the official page. */
export function WhereCard({
  label,
  title,
  description,
  action,
}: {
  label: string;
  title: string;
  description?: ReactNode;
  action: ReactNode;
}) {
  return (
    <section className="chat-where caja-plana chat-enter">
      <div>
        <p className="chat-where-label">{label}</p>
        <h3 className="chat-where-title">{title}</h3>
        {description && <p className="chat-where-description">{description}</p>}
      </div>
      {action}
    </section>
  );
}

/** Inline citation: the organisation's name; opens the cited fragment. */
export function SourceChip({
  children,
  icon,
  title,
  onOpen,
}: {
  children: ReactNode;
  icon: ReactNode;
  title?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="chat-source-chip" title={title} onClick={onOpen}>
      {children}
      {icon}
    </button>
  );
}

/** Organisation monogram. Drawn locally, so no request reveals which sources were consulted. */
function Monogram({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'ES';
  return (
    <span className="chat-monogram" aria-hidden="true">
      {initials}
    </span>
  );
}

export function SourcesButton({
  organization,
  count,
  onOpen,
}: {
  organization: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="chat-sources-button" onClick={onOpen}>
      <Monogram name={organization} />
      Fuentes · {count}
    </button>
  );
}

/* ─── Controls ─────────────────────────────────────────────────────────────── */

export function Suggestions({ children }: { children: ReactNode }) {
  return <div className="chat-followups">{children}</div>;
}

/** Example or follow-up question. `index` staggers its entrance after the previous one. */
export function Suggestion({
  children,
  icon,
  index = 0,
  onSelect,
}: {
  children: string;
  icon: ReactNode;
  index?: number;
  onSelect: (question: string) => void;
}) {
  return (
    <button
      type="button"
      className="chat-suggestion"
      style={{ '--index': index } as CSSProperties}
      onClick={() => onSelect(children)}
    >
      {children}
      {icon}
    </button>
  );
}

/**
 * Two glyphs in the same spot: the inactive one shrinks and blurs out as the other arrives, so
 * send/stop and copy/copied switch without the control jumping.
 */
export function IconSwap({ active, a, b }: { active: 'a' | 'b'; a: ReactNode; b: ReactNode }) {
  return (
    <span className="icon-swap" data-active={active}>
      <span className="icon-swap-a">{a}</span>
      <span className="icon-swap-b">{b}</span>
    </span>
  );
}

/** Jump to the latest message. Stays mounted so showing and hiding can interrupt each other. */
export function JumpButton({
  visible,
  onClick,
  children,
}: {
  visible: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="chat-jump"
      data-visible={visible}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={onClick}
      aria-label="Ir al último mensaje"
    >
      {children}
    </button>
  );
}

/* ─── Sources sheet ────────────────────────────────────────────────────────── */

/**
 * Native modal dialog: a side sheet on wide screens and a bottom sheet on phones. Moving between the
 * list and a fragment slides in the direction of travel; the first view arrives with the sheet.
 */
export function SourceSheet({
  open,
  view,
  title,
  back,
  close,
  onClose,
  children,
}: {
  open: boolean;
  /** Changing it remounts the content with a slide; `detail` slides forward. */
  view: string;
  title: string;
  back?: ReactNode;
  close: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<{
    open: boolean;
    view: string;
    direction?: 'forward' | 'back' | undefined;
  }>({ open, view });
  if (shown.open !== open || shown.view !== view)
    setShown({
      open,
      view,
      direction: open && shown.open ? (view === 'list' ? 'back' : 'forward') : undefined,
    });
  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    if (!open && el?.open) el.close();
  }, [open]);
  // Bottom sheet only: dragging the top bar down closes it; content keeps its own scroll.
  const drag = useRef<{ id: number; y: number; t: number; dy: number; moved: boolean } | null>(
    null,
  );
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || !matchMedia('(max-width: 760px)').matches) return;
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      t: event.timeStamp,
      dy: 0,
      moved: false,
    };
    // Touch is captured implicitly; a mouse needs it to keep the drag once it leaves the bar.
    // Buttons capture on the first move instead, so a plain press still reaches them.
    if (event.target instanceof Element && !event.target.closest('button'))
      event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = dialog.current;
    if (!d || !el || event.pointerId !== d.id) return;
    d.dy = event.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(d.dy) < 4) return;
      // Captured, the release lands on the bar, so a drag never also presses back or close.
      d.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      el.style.transition = 'none';
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Down follows the finger; up meets growing resistance instead of a hard stop.
    el.style.transform = `translateY(${d.dy > 0 ? d.dy : -3 * Math.sqrt(-d.dy)}px)`;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = dialog.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (!el || !d.moved) return;
    // A quick flick is enough; a slow drag has to cover a quarter of the sheet.
    if (d.dy > el.offsetHeight / 4 || d.dy / (event.timeStamp - d.t) > 0.11) el.close();
    // Cleared after close() so the transition runs from the finger to the closed or open state.
    el.style.transform = '';
    el.style.transition = '';
  };
  return (
    <dialog
      ref={dialog}
      className="chat-sheet"
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="chat-sheet-inner">
        <div
          className="chat-sheet-bar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span className="chat-sheet-handle" aria-hidden="true" />
          {back}
          {close}
        </div>
        <div key={view} className="chat-sheet-view" data-direction={shown.direction}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

export function SourceDetail({
  eyebrow,
  organization,
  title,
  excerpt,
  meta,
  action,
  children,
}: {
  eyebrow: string;
  organization: string;
  title: string;
  excerpt: ReactNode;
  meta: { label: string; value: string }[];
  action: ReactNode;
  /** Other sources of the same answer. */
  children?: ReactNode;
}) {
  return (
    <article className="chat-source">
      <p className="chat-source-eyebrow">{eyebrow}</p>
      <p className="chat-source-organization">
        <Monogram name={organization} />
        {organization}
      </p>
      <h2 className="chat-source-title">{title}</h2>
      <blockquote className="chat-source-excerpt">{excerpt}</blockquote>
      <dl className="chat-source-meta">
        {meta.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {action}
      {children}
    </article>
  );
}

export function SourceList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="chat-source-list">
      <h3>{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

export function SourceCard({
  title,
  meta,
  icon,
  onOpen,
}: {
  title: string;
  meta: string;
  icon: ReactNode;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" className="chat-source-card" onClick={onOpen}>
        <span>
          <strong>{title}</strong>
          <small>{meta}</small>
        </span>
        {icon}
      </button>
    </li>
  );
}
