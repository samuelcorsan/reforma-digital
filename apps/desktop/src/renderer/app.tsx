import { useEffect, useRef, useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { cn } from '@reforma-digital/design/lib/utils';
import { Logotipo } from '@reforma-digital/design/ui/logotipo';
import { Ajustes } from './ajustes';
import { Bienvenida } from './bienvenida';
import { MisDatos } from './datos';
import { useEstado } from './estado';
import { hace } from './formato';
import { Icono, Marca } from './icono';
import { Inicio } from './inicio';
import { Tramite } from './tramite';
import type { ResumenTramite } from '../shared/api';

export type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'tramite'; id: string }
  | { tipo: 'datos' }
  | { tipo: 'ajustes'; privacidad?: boolean };

/** Una fila de la barra lateral: compacta, con el fondo un poco más oscuro al pasar o al estar activa. */
const fila = (activo: boolean) =>
  cn(
    'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] transition-colors',
    activo ? 'bg-foreground/[0.07] font-medium' : 'hover:bg-foreground/[0.04]',
  );

/** Lo que dice un trámite a la derecha de su fila: que espera, que ha terminado o cuándo cambió. */
function Estado({ t, nuevo }: { t: ResumenTramite; nuevo: boolean }) {
  if (t.ejecucion === 'trabajando')
    return (
      <span title="Trabajando" className="grid size-4 place-items-center">
        <span className="size-1.5 rounded-full bg-foreground/50 motion-safe:animate-pulse" />
        <span className="sr-only">Trabajando</span>
      </span>
    );
  if (t.aviso === 'oferta')
    return (
      <span
        title="El asistente puede hacerlo por ti"
        className="grid size-4 place-items-center rounded-full bg-brand-yellow text-[11px] leading-none font-semibold text-foreground"
      >
        <span aria-hidden="true">!</span>
        <span className="sr-only">El asistente puede hacerlo por ti</span>
      </span>
    );
  if (t.ejecucion === 'esperando')
    return (
      <span
        title="El asistente espera tu respuesta"
        className="grid size-4 place-items-center rounded-full bg-brand text-[11px] leading-none font-semibold text-white"
      >
        <span aria-hidden="true">!</span>
        <span className="sr-only">El asistente espera tu respuesta</span>
      </span>
    );
  if (t.aviso === 'terminado' && nuevo)
    return (
      <span
        title="Ha terminado"
        className="grid size-4 place-items-center rounded-full bg-blue-500 text-white"
      >
        <Icono nombre="check" size={10} />
        <span className="sr-only">Ha terminado</span>
      </span>
    );
  return <span className="text-sm text-muted-foreground">{hace(t.actualizado)}</span>;
}

/** Lo que ha visto la persona de cada trámite: el azul de «ha terminado» sale hasta que lo abre. */
function useVistos(tramites: ResumenTramite[], activo: ResumenTramite | undefined) {
  const [vistos, setVistos] = useState<Record<string, string>>(() => {
    const guardados = localStorage.getItem('vistos');
    return guardados
      ? (JSON.parse(guardados) as Record<string, string>)
      : Object.fromEntries(tramites.map((t) => [t.id, t.actualizado]));
  });
  useEffect(() => {
    if (!activo || vistos[activo.id] === activo.actualizado) return;
    const nuevos = { ...vistos, [activo.id]: activo.actualizado };
    localStorage.setItem('vistos', JSON.stringify(nuevos));
    setVistos(nuevos);
  }, [activo, vistos]);
  return vistos;
}

function Barra({ vista, ir }: { vista: Vista; ir: (v: Vista) => void }) {
  const { app } = useEstado();
  const tramites = app?.tramites ?? [];
  const activo = tramites.find((t) => vista.tipo === 'tramite' && vista.id === t.id);
  const vistos = useVistos(tramites, activo);
  const filaTramite = (t: ResumenTramite) => (
    <li key={t.id} className="group relative">
      <button
        type="button"
        aria-current={t === activo ? 'page' : undefined}
        className={cn(fila(t === activo), 'pr-2')}
        onClick={() => ir({ tipo: 'tramite', id: t.id })}
      >
        <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
        <span className="flex shrink-0 items-center transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
          <Estado t={t} nuevo={t !== activo && vistos[t.id] !== t.actualizado} />
        </span>
      </button>
      <button
        type="button"
        aria-label={t.fijado ? 'Dejar de fijar' : 'Fijar'}
        title={t.fijado ? 'Dejar de fijar' : 'Fijar'}
        onClick={() => void window.rd.ajustarTramite(t.id, { fijado: !t.fijado })}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <Icono nombre="fijar" size={16} className={t.fijado ? 'rotate-45' : ''} />
      </button>
    </li>
  );
  const fijados = tramites.filter((t) => t.fijado);
  const resto = tramites.filter((t) => !t.fijado);
  return (
    <nav
      aria-label="Trámites"
      className="flex w-[260px] shrink-0 flex-col border-r border-border bg-foreground/[0.025]"
    >
      <div className="arrastrar h-[52px] shrink-0" />
      <div className="space-y-0.5 px-2.5">
        <button
          type="button"
          className={fila(vista.tipo === 'inicio')}
          onClick={() => ir({ tipo: 'inicio' })}
        >
          <Icono nombre="mas" />
          Nuevo trámite
          <kbd className="ml-auto font-sans text-sm font-normal text-muted-foreground">
            {app?.plataforma === 'darwin' ? '⌘N' : 'Ctrl+N'}
          </kbd>
        </button>
        <button
          type="button"
          className={fila(vista.tipo === 'datos')}
          onClick={() => ir({ tipo: 'datos' })}
        >
          <Icono nombre="persona" />
          Mis datos
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {fijados.length > 0 && (
          <>
            <h2 className="mx-2.5 mt-6 mb-1 text-sm font-normal text-muted-foreground">Fijados</h2>
            <ul className="m-0 space-y-0.5 p-0">{fijados.map(filaTramite)}</ul>
          </>
        )}
        <h2 className="mx-2.5 mt-6 mb-1 text-sm font-normal text-muted-foreground">Trámites</h2>
        <ul className="m-0 space-y-0.5 p-0">
          {resto.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">
              {tramites.length ? 'Todos están fijados.' : 'Aún no hay ninguno.'}
            </li>
          )}
          {resto.map(filaTramite)}
        </ul>
      </div>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-t border-border px-4">
        <span role="img" aria-label="Reforma Digital" className="flex items-end gap-[4.5px]">
          <Marca size={18} />
          <Logotipo size={18} lineas={1} />
        </span>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Ajustes"
          aria-current={vista.tipo === 'ajustes' ? 'page' : undefined}
          className={cn(
            'ml-auto hover:bg-foreground/[0.06]',
            vista.tipo === 'ajustes' && 'bg-foreground/[0.07]',
          )}
          onClick={() => ir({ tipo: 'ajustes' })}
        >
          <Icono nombre="ajustes" />
        </Button>
      </div>
    </nav>
  );
}

export function App() {
  const { app } = useEstado();
  const [vista, irA] = useState<Vista>({ tipo: 'inicio' });
  const sinGuardar = useRef(false);
  const ir = (v: Vista) => {
    if (sinGuardar.current && !confirm('Tienes cambios sin guardar. ¿Salir sin guardarlos?'))
      return;
    irA(v);
  };
  const [bienvenida, setBienvenida] = useState(() => !localStorage.getItem('bienvenida'));
  useEffect(
    () =>
      window.rd.on((e) => {
        if (e.tipo === 'menu') ir({ tipo: e.vista });
      }),
    [],
  );
  if (!app) return null;
  if (bienvenida)
    return (
      <Bienvenida
        alTerminar={() => {
          localStorage.setItem('bienvenida', '1');
          setBienvenida(false);
        }}
      />
    );
  return (
    <div className="flex h-full bg-muted">
      <Barra vista={vista} ir={ir} />
      <main className="flex min-w-0 flex-1 flex-col">
        {vista.tipo === 'inicio' && <Inicio abrir={(id) => ir({ tipo: 'tramite', id })} />}
        {vista.tipo === 'tramite' && (
          <Tramite key={vista.id} id={vista.id} alBorrar={() => ir({ tipo: 'inicio' })} />
        )}
        {vista.tipo === 'datos' && (
          <MisDatos
            verPrivacidad={() => ir({ tipo: 'ajustes', privacidad: true })}
            sinGuardar={sinGuardar}
          />
        )}
        {vista.tipo === 'ajustes' && <Ajustes privacidad={vista.privacidad ?? false} />}
      </main>
    </div>
  );
}
