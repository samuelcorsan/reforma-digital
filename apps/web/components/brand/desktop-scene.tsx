// La app de escritorio dibujada con HTML (DESIGN.md §9), para /escritorio y los proyectos de la portada.
import { cn } from '@reforma-digital/design/lib/utils';

import { FitWidth } from './fit-width';
import { Icon } from './icon';
import { LogoMark } from './logo';

const tramites = [
  { titulo: 'Renovar el DNI', estado: 'oferta', activo: true },
  { titulo: 'Empadronarme', estado: 'trabaja' },
  { titulo: 'Descargar mi vida laboral', estado: 'listo' },
  { titulo: 'Bono social de la luz', estado: '5 min' },
  { titulo: 'Cambiar el domicilio fiscal', estado: '12 d' },
];

/**
 * La ventana de la app tal como es, a 1000 px de ancho y `height` de alto. Donde no cabe se encoge
 * entera, como una captura, sin reordenarse. Decorativa: el texto de cada página ya la explica.
 */
export function DesktopScene({ height }: { height: number }) {
  return (
    <FitWidth width={1000} height={height}>
      <div className="grid h-full grid-cols-[220px_1fr] overflow-hidden rounded-t-2xl bg-muted text-left text-sm shadow-(--shadow-overlay)">
        <aside className="flex flex-col bg-foreground/[0.025] px-2.5">
          <div className="flex h-[52px] shrink-0 items-center gap-2 px-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="flex h-9 items-center gap-2 rounded-lg px-2.5 font-medium">
            <Icon name="mas" size={14} /> Nuevo trámite
          </span>
          <span className="flex h-9 items-center gap-2 rounded-lg px-2.5">
            <Icon name="usuario" size={16} /> Mis datos
          </span>
          <p className="mt-5 mb-1 px-2.5 text-xs text-muted-foreground">Trámites</p>
          {tramites.map((t) => (
            <span
              key={t.titulo}
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg px-2.5',
                t.activo && 'bg-foreground/[0.07]',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
              <Estado estado={t.estado} />
            </span>
          ))}
          <span className="mt-auto flex h-12 items-center gap-2 px-2.5 text-muted-foreground">
            <span className="text-brand">
              <LogoMark size={16} />
            </span>
            <span className="ml-auto">Ajustes</span>
          </span>
        </aside>

        <div className="relative flex min-w-0 flex-col">
          <div className="h-[52px] shrink-0" />
          <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-4 overflow-hidden px-6">
            <p className="m-0 rounded-2xl bg-background px-4 py-3 text-[15px]">
              Quiero renovar mi DNI en Sevilla. Me caduca el mes que viene.
            </p>
            <div className="grid gap-2">
              <span className="text-muted-foreground">Ha trabajado 8 s</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">
                  <Icon name="buscar" size={14} />
                </span>
                {['citapreviadnie.es', 'policia.es', 'boe.es'].map((web) => (
                  <span
                    key={web}
                    className="rounded-full bg-background px-2.5 py-1 font-mono text-xs text-(--text-secondary)"
                  >
                    {web}
                  </span>
                ))}
              </span>
            </div>
            <div className="grid gap-2 text-[15px] leading-6">
              <p className="m-0">Para renovarlo en Sevilla:</p>
              <ol className="m-0 grid list-decimal gap-1 pl-5">
                <li>Pide cita en una oficina de expedición.</li>
                <li>Lleva tu DNI actual y una foto reciente.</li>
                <li>Paga la tasa en la misma oficina.</li>
              </ol>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-background p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/[0.08] text-brand">
                <Icon name="calendario" size={18} />
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-[17px] leading-6">
                  El asistente puede hacerlo por ti
                </span>
                <span className="block truncate text-muted-foreground">
                  Busca huecos en citapreviadnie.es
                </span>
              </span>
              <span className="ml-auto flex items-center gap-3">
                <span className="text-muted-foreground">Ahora no</span>
                <span className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                  Pedir la cita por mí
                </span>
              </span>
            </div>
          </div>
          <div className="mx-auto mb-5 w-[calc(100%-48px)] max-w-[600px] rounded-[28px] bg-background px-5 pt-4 pb-2.5">
            <span className="block h-6 text-muted-foreground">Responde al asistente…</span>
            <span className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Equilibrado</span>
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <span className="-rotate-90">
                  <Icon name="derecha" size={14} />
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </FitWidth>
  );
}

/** Los avisos de la barra lateral (DESIGN.md §9) o cuánto hace del último cambio. */
function Estado({ estado }: { estado: string }) {
  if (estado === 'oferta')
    return (
      <span className="grid size-4 place-items-center rounded-full bg-brand-yellow text-[11px] font-bold text-foreground">
        !
      </span>
    );
  if (estado === 'trabaja')
    return (
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none" />
    );
  if (estado === 'listo')
    return (
      <span className="grid size-4 place-items-center rounded-full bg-(--link) text-background">
        <Icon name="hecho" size={10} />
      </span>
    );
  return <span className="text-xs text-muted-foreground tabular-nums">{estado}</span>;
}
