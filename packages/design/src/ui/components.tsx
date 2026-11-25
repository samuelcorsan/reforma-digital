import { RadioGroupItem } from '../../ui/radio-group';
import { cn } from '../../lib/utils';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useId, type ReactNode } from 'react';

/**
 * Componentes React del sistema de diseño (DESIGN.md §3). Solo usan tokens y
 * clases del preset (bg-*): ningún adaptador debe definir estilos propios.
 */

/** Etiqueta obligatoria en toda mejora: deja claro quién hace qué. */
export function CommunityBadge({ host }: { host: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Badge variant="outline">
        <ShieldIcon />
        Interfaz comunitaria · sitio oficial
      </Badge>
      <span className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))]'}>
        Estás en <strong className="font-semibold text-ink [overflow-wrap:anywhere]">{host}</strong>
        , la web oficial del trámite. Los datos y envíos los gestiona esa web.
      </span>
    </div>
  );
}

export interface Step {
  id: string;
  label: string;
}

export function ProgressSteps({
  steps,
  current,
  outOfScopeFrom,
}: {
  steps: Step[];
  current: string;
  outOfScopeFrom?: string;
}) {
  const currentIndex = steps.findIndex((s) => s.id === current);
  const outIndex = outOfScopeFrom ? steps.findIndex((s) => s.id === outOfScopeFrom) : -1;
  return (
    <nav aria-label="Progreso del trámite" className="mt-5">
      <p
        className={
          'text-xs [line-height:1.4] font-semibold [letter-spacing:0.06em] uppercase [color:rgb(var(--bg-ink-subtle))] mb-2'
        }
      >
        Paso {currentIndex + 1} de {steps.length}
        <span className="normal-case tracking-normal text-ink sm:hidden">
          {' '}
          · {steps[currentIndex]?.label}
        </span>
      </p>
      {/* Móvil: barra segmentada compacta. */}
      <div aria-hidden="true" className="flex gap-1 sm:hidden">
        {steps.map((step, i) => (
          <span
            key={step.id}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= currentIndex ? 'bg-brand-600' : 'bg-line',
            )}
          />
        ))}
      </div>
      {/* Desde 640 px: lista de pasos. En móvil queda solo para lectores de pantalla. */}
      <ol className="sr-only sm:not-sr-only sm:grid sm:grid-cols-5 sm:gap-2">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <li
              key={step.id}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex flex-col items-start gap-2 [padding:10px_12px] [border-radius:var(--bg-radius-control)] [font-size:13px] [line-height:1.4] [color:rgb(var(--bg-ink-muted))]',
                state === 'current' &&
                  '[background-color:rgb(var(--bg-brand-100))] [color:rgb(var(--bg-ink))] font-semibold [&_[data-part=bg-step-num]]:[background-color:rgb(var(--bg-brand-600))] [&_[data-part=bg-step-num]]:[color:rgb(var(--bg-ink-inverse))]',
                state === 'done' &&
                  '[&_[data-part=bg-step-num]]:[background-color:rgb(var(--bg-success-bg))] [&_[data-part=bg-step-num]]:[color:rgb(var(--bg-success-fg))]',
                state === 'todo' && '[color:rgb(var(--bg-ink-subtle))]',
              )}
            >
              <span
                aria-hidden="true"
                data-part="bg-step-num"
                className={
                  'flex items-center justify-center w-6 h-6 shrink-0 [border-radius:999px] text-xs font-bold [background-color:rgb(var(--bg-surface-muted))] [color:rgb(var(--bg-ink-subtle))]'
                }
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span>
                <span className="sr-only">
                  {state === 'done'
                    ? 'Completado: '
                    : state === 'current'
                      ? 'Paso actual: '
                      : 'Pendiente: '}
                </span>
                {step.label}
                {outIndex >= 0 && i >= outIndex && (
                  <span className="block text-[12px] font-normal text-ink-subtle">
                    solo en la web oficial
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Panel principal de una pantalla. La etiqueta comunitaria (CommunityBadge) la pinta el runtime en
 * la barra superior de cada página mejorada, así que el panel no la repite.
 */
export function Panel({
  title,
  children,
  progress,
  lead,
}: {
  title: string;
  children: ReactNode;
  progress?: ReactNode;
  lead?: ReactNode;
}) {
  const titleId = useId();
  return (
    <Card render={<section />} aria-labelledby={titleId} className="my-4 p-4 sm:p-6">
      {/* h2 en el HTML (la web oficial ya tiene su h1); tamaño visual de h1. */}
      <h2
        id={titleId}
        className={
          '[font-size:28px] [line-height:1.2] font-medium [color:rgb(var(--bg-ink))] [letter-spacing:-0.035em] [@media(max-width:_639px)]:text-2xl'
        }
      >
        {title}
      </h2>
      {lead && (
        <div
          className={
            '[font-size:17px] [line-height:1.6] [color:rgb(var(--bg-ink-muted))] mt-2 max-w-[70ch]'
          }
        >
          {lead}
        </div>
      )}
      {progress}
      <div className="mt-6 space-y-6">{children}</div>
    </Card>
  );
}

export function PrimaryAction({
  children,
  onClick,
  disabled,
  hint,
  large = true,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hint?: ReactNode;
  large?: boolean;
}) {
  const hintId = useId();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        size={large ? 'lg' : 'default'}
      >
        {children}
        <span aria-hidden="true">→</span>
      </Button>
      {hint && (
        <p id={hintId} className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))]'}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function SecondaryAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="button" onClick={onClick} variant="outline">
      {children}
    </Button>
  );
}

/** Fila de acciones: principal a la izquierda, secundarias después. */
export function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-t border-line pt-5">{children}</div>
  );
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} variant="link" className="justify-start text-left">
      {children}
    </Button>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        '[color:rgb(var(--bg-brand-600))] [text-decoration-line:underline] [text-decoration-thickness:1px] [text-underline-offset:3px] [text-decoration-color:rgb(var(--bg-brand-600)_/_0.4)] font-medium cursor-pointer [&:hover]:[color:rgb(var(--bg-brand-700))] [&:hover]:[text-decoration-color:currentColor] [&:hover]:[text-decoration-thickness:2px] [&:focus-visible]:[outline:3px_solid_rgb(var(--bg-brand-600))] [&:focus-visible]:[outline-offset:2px] [&:focus-visible]:[border-radius:2px]'
      }
    >
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

export type CalloutTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

// Nombres completos (no plantillas) para que Tailwind los detecte al compilar.
const CALLOUT_TONES: Record<CalloutTone, string> = {
  info: 'bg-callout bg-callout-info',
  warning: 'bg-callout bg-callout-warning',
  danger: 'bg-callout bg-callout-danger',
  success: 'bg-callout bg-callout-success',
  neutral: 'bg-callout bg-callout-neutral',
};

export function Callout({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div role={role} className={CALLOUT_TONES[tone]}>
      {title && <p className={'font-semibold mb-1'}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3
      id={id}
      className={'[font-size:20px] [line-height:1.3] [font-weight:650] [color:rgb(var(--bg-ink))]'}
    >
      {children}
    </h3>
  );
}

/** Buscador con etiqueta visible (DESIGN.md §3 · Campo). */
export function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={
          'block [font-size:15px] [line-height:1.4] font-semibold [color:rgb(var(--bg-ink))] [margin-bottom:6px]'
        }
      >
        {label}
      </label>
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

/** Opción seleccionable dentro de RadioGroup (DESIGN.md §3). */
export function Choice({ value, children }: { value: string; children: ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <RadioGroupItem value={value} className={'mt-0.5'} />
      <span>{children}</span>
    </label>
  );
}

/** Separa el panel del contenido oficial que sigue debajo (DESIGN.md §3 · Bloque oficial). */
export function OfficialDivider({ children }: { children?: ReactNode }) {
  return (
    <div
      className={
        '[font-family:var(--bg-font)] text-base [line-height:1.6] [color:rgb(var(--bg-ink))] mb-2 flex items-center gap-3'
      }
    >
      <span
        className={
          'text-xs [line-height:1.4] font-semibold [letter-spacing:0.06em] uppercase [color:rgb(var(--bg-ink-subtle))] whitespace-nowrap'
        }
      >
        Información oficial de esta página
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {children}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
