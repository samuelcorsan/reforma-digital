import { useId, useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@reforma-digital/design/ui/input-group';
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@reforma-digital/design/ui/sheet';
import type { Fuente } from '../shared/api';
import { host } from './formato';
import { Icono } from './icono';

type PropsFuentes = {
  fuentes: Fuente[];
  abrir: (url: string) => void;
};

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

// Dentro del portal: los filtros se reinician al cerrar y volver a abrir el panel.
function ContenidoFuentes({ fuentes, abrir }: PropsFuentes) {
  const id = useId();
  const buscador = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<'todas' | Fuente['origen']>('todas');
  const busqueda = normalizar(consulta);
  const coinciden = fuentes.filter((f) =>
    normalizar(`${f.titulo} ${host(f.url)}`).includes(busqueda),
  );
  const leidas = fuentes.filter((f) => f.origen === 'pagina').length;
  const filtros = [
    { valor: 'todas', etiqueta: 'Todas', cantidad: fuentes.length },
    { valor: 'pagina', etiqueta: 'Leídas', cantidad: leidas },
    { valor: 'busqueda', etiqueta: 'Encontradas', cantidad: fuentes.length - leidas },
  ] as const;
  const grupos = [
    {
      origen: 'pagina',
      titulo: 'Páginas leídas',
      fuentes: coinciden.filter((f) => f.origen === 'pagina'),
    },
    {
      origen: 'busqueda',
      titulo: 'Resultados encontrados',
      fuentes: coinciden.filter((f) => f.origen === 'busqueda'),
    },
  ].filter((g) => g.fuentes.length && (filtro === 'todas' || filtro === g.origen));
  const visibles = grupos.reduce((n, g) => n + g.fuentes.length, 0);
  return (
    <>
      <SheetHeader className="shrink-0 px-6 pt-6 pb-5 pr-20">
        <SheetTitle className="flex items-center gap-2 text-[17px]">
          <Icono nombre="libro" size={18} />
          Fuentes
        </SheetTitle>
        <SheetDescription>
          Esta búsqueda · {fuentes.length} {fuentes.length === 1 ? 'fuente' : 'fuentes'}
        </SheetDescription>
      </SheetHeader>
      <SheetClose
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="absolute top-4 right-4 min-h-11 min-w-11"
            aria-label="Cerrar fuentes"
          />
        }
      >
        <Icono nombre="cerrar" />
      </SheetClose>
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 pb-5">
        <InputGroup className="h-11">
          <InputGroupInput
            ref={buscador}
            type="search"
            className="h-11 [&::-webkit-search-cancel-button]:hidden"
            aria-label="Buscar fuentes por título o web"
            placeholder="Buscar por título o web"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
          />
          <InputGroupAddon>
            <Icono nombre="buscar" />
          </InputGroupAddon>
          {consulta && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                className="min-h-11 min-w-11"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setConsulta('');
                  buscador.current?.focus();
                }}
              >
                <Icono nombre="cerrar" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div role="group" aria-label="Filtrar fuentes" className="flex gap-2">
          {filtros.map((f) => (
            <Button
              key={f.valor}
              variant={filtro === f.valor ? 'secondary' : 'outline'}
              className="min-h-11 min-w-0 flex-1 aria-pressed:bg-muted"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
            >
              {f.etiqueta} <span className="tabular-nums">{f.cantidad}</span>
            </Button>
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        {visibles} fuentes visibles
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {grupos.map((g) => (
          <section key={g.origen} aria-labelledby={`${id}-${g.origen}`} className="mb-6 last:mb-0">
            <h3
              id={`${id}-${g.origen}`}
              className="m-0 mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {g.titulo} · {g.fuentes.length}
            </h3>
            <ul className="m-0 list-none divide-y divide-border p-0">
              {g.fuentes.map((f) => (
                <li key={f.id}>
                  <SheetClose
                    render={<button type="button" title={f.titulo} onClick={() => abrir(f.url)} />}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                      g.origen === 'pagina' && 'bg-muted/60',
                    )}
                  >
                    <Favicon url={f.url} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="line-clamp-2 text-[15px] leading-snug wrap-anywhere">
                        {f.titulo || host(f.url)}
                      </span>
                      <span className="text-sm text-muted-foreground wrap-anywhere">
                        {host(f.url)}
                      </span>
                      {!f.oficial && (
                        <span className="flex items-center gap-1 text-sm text-[var(--warning-foreground)]">
                          <Icono nombre="info" size={14} />
                          Sin verificar
                        </span>
                      )}
                    </span>
                    {g.origen === 'pagina' && (
                      <span className="shrink-0 text-sm">Abrir página</span>
                    )}
                    <Icono nombre="siguiente" className="shrink-0 text-muted-foreground" />
                  </SheetClose>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!visibles && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="m-0 text-muted-foreground">No hay fuentes que coincidan.</p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setConsulta('');
                setFiltro('todas');
                buscador.current?.focus();
              }}
            >
              Ver todas las fuentes
            </Button>
          </div>
        )}
      </div>
      <p className="m-0 shrink-0 border-t border-border px-6 py-4 text-sm text-muted-foreground">
        Las fuentes se abren en el navegador de la app.
      </p>
    </>
  );
}

export function PanelFuentes(props: PropsFuentes) {
  return (
    <SheetContent
      showCloseButton={false}
      className="w-full gap-0 border-border data-[side=right]:sm:max-w-[520px] motion-reduce:transition-none"
    >
      <ContenidoFuentes {...props} />
    </SheetContent>
  );
}

/**
 * El icono de la web, del servicio de favicons de Google a través del servidor de Reforma Digital
 * (`/icono` en el proceso principal). Solo se envía el origen, sin ruta, y al mostrarse; si no
 * carga, se dibuja un globo.
 */
export function Favicon({ url, className }: { url: string; className?: string }) {
  const [falla, setFalla] = useState(false);
  const base = cn('size-5 shrink-0 rounded-full bg-background', className);
  if (falla)
    return (
      <span className={cn(base, 'grid place-items-center bg-muted text-muted-foreground')}>
        <Icono nombre="web" size={12} />
      </span>
    );
  return (
    <img
      src={`/icono?origen=${encodeURIComponent(URL.parse(url)?.origin ?? '')}`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      onError={() => setFalla(true)}
      className={base}
    />
  );
}
