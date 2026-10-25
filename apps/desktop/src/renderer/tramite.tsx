import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Sheet, SheetTrigger } from '@reforma-digital/design/ui/sheet';
import { Notice, Response, Shimmer } from '@reforma-digital/design/chat';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { cn } from '@reforma-digital/design/lib/utils';
import type { Fuente, ItemConversacion, TramiteVista } from '../shared/api';
import { cargarTramite, useEstado } from './estado';
import { duracion, host } from './formato';
import { Favicon, PanelFuentes } from './fuentes';
import { Icono } from './icono';
import { Compositor } from './inicio';
import { Pregunta } from './preguntas';
const DE_NAVEGADOR = new Set([
  'abrir',
  'pulsar',
  'escribir',
  'elegir',
  'marcar',
  'tecla',
  'volver',
  'responder_dialogo',
  'pedir_ayuda',
]);

type ItemActividad = Extract<ItemConversacion, { tipo: 'actividad' }>;
type VerFuentes = (fuentes: Fuente[]) => void;

/** `clave`: el elemento al que sigue, para que el «Pensando» previo y sus acciones sean el mismo. */
type Bloque =
  | { tipo: 'item'; item: ItemConversacion }
  | { tipo: 'actividad'; clave: string; items: ItemActividad[] };

// Estas acciones ya se ven como su tarjeta: no cuentan entre las acciones del asistente.
const CON_TARJETA = new Set(['preguntar', 'confirmar', 'pedir_ayuda', 'llamar']);

/** Las acciones seguidas del asistente se muestran juntas, como una lista de pasos desplegable. */
function agrupar(items: ItemConversacion[]): Bloque[] {
  const bloques: Bloque[] = [];
  let previo = 'inicio';
  for (const item of items) {
    const ultimo = bloques.at(-1);
    if (item.tipo === 'actividad' && CON_TARJETA.has(item.herramienta)) continue;
    if (item.tipo === 'actividad' && ultimo?.tipo === 'actividad') ultimo.items.push(item);
    else if (item.tipo === 'actividad')
      bloques.push({ tipo: 'actividad', clave: previo, items: [item] });
    else {
      bloques.push({ tipo: 'item', item });
      previo = item.id;
    }
  }
  return bloques;
}

/** Varias acciones seguidas de la misma herramienta son un paso: «Escribiendo en 3 campos». */
const VARIAS: Record<string, (n: number) => string> = {
  leer_pagina: (n) => `Leyendo ${n} páginas`,
  escribir: (n) => `Escribiendo en ${n} campos`,
  elegir: (n) => `Eligiendo ${n} opciones`,
  marcar: (n) => `Marcando ${n} casillas`,
};

function pasos(items: ItemActividad[]) {
  const grupos: ItemActividad[][] = [];
  for (const i of items) {
    const g = grupos.at(-1);
    if (g && g[0]!.herramienta === i.herramienta) g.push(i);
    else grupos.push([i]);
  }
  return grupos;
}

/** Vuelve a pintar cada segundo mientras `activo`. */
function useSegundero(activo: boolean) {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [activo]);
}

/** De quién es la web; en la ficha va solo el título, porque el icono ya dice de quién es. */
const deQuien = (f: Fuente) => f.organismo?.split(' · ')[0] ?? host(f.url);

const entra = '[animation:chat-stage-change_280ms_var(--ease-brand)_both]';

/** Un paso: un punto en la línea (la búsqueda, una lupa con las webs que encontró). */
function Paso({
  items,
  fuentes,
  abrir,
  verFuentes,
  conLinea,
}: {
  items: ItemActividad[];
  fuentes: Fuente[];
  abrir: (url: string) => void;
  verFuentes: VerFuentes;
  conLinea: boolean;
}) {
  const herramienta = items[0]!.herramienta;
  const activo = items.some((i) => i.estado === 'inicio');
  const errores = items.filter((i) => i.estado === 'error').length;
  const busqueda = herramienta === 'buscar';
  const encontradas = busqueda
    ? fuentes.filter((f) => items.some((i) => i.fuentes?.includes(f.id)))
    : [];
  const varias = items.length > 1 ? VARIAS[herramienta] : undefined;
  const texto = busqueda
    ? activo
      ? 'Buscando'
      : 'Ha buscado'
    : varias
      ? varias(items.length)
      : items.at(-1)!.resumen;
  return (
    <li className={cn('relative grid grid-cols-[18px_1fr] gap-x-3 pb-2.5', entra)}>
      {conLinea && (
        <span
          aria-hidden
          className="absolute top-[22px] -bottom-1 left-[8.5px] w-px bg-foreground/10"
        />
      )}
      <span className="flex h-6 items-center justify-center text-muted-foreground">
        {busqueda ? (
          <Icono nombre="buscar" size={16} />
        ) : (
          <span
            className={cn(
              'size-1.5 rounded-full',
              activo ? 'bg-foreground' : errores ? 'bg-brand' : 'bg-foreground/25',
            )}
          />
        )}
      </span>
      <div className="min-w-0 leading-6">
        {activo ? (
          <Shimmer>{texto}</Shimmer>
        ) : (
          <span className="text-muted-foreground">{texto}</span>
        )}
        {!activo && errores > 0 && <span className="text-muted-foreground"> · sin éxito</span>}
        {encontradas.length > 0 && (
          <div className="mt-2 mb-1 flex flex-wrap items-center gap-2">
            {encontradas.slice(0, 4).map((f) => (
              <button
                key={f.id}
                type="button"
                title={`${deQuien(f)} – ${f.titulo}`}
                onClick={() => abrir(f.url)}
                className={cn(
                  'inline-flex h-8 max-w-[15rem] items-center gap-2 rounded-lg bg-foreground/[0.05] px-2.5 text-sm text-foreground hover:bg-foreground/[0.08]',
                  entra,
                )}
              >
                <Favicon url={f.url} className="size-4 rounded-[4px]" />
                <span className="truncate">{f.titulo || deQuien(f)}</span>
              </button>
            ))}
            {encontradas.length > 4 && (
              <SheetTrigger
                render={<Button variant="outline" className="min-h-11 cursor-pointer" />}
                onClick={() => verFuentes(encontradas)}
              >
                Ver las {encontradas.length} fuentes
                <Icono nombre="siguiente" />
              </SheetTrigger>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Lo que hace el asistente entre sus respuestas: «Pensando» con el tiempo que lleva y, debajo, sus
 * pasos en una línea. Al terminar queda como «Ha trabajado 8 s», desplegable.
 */
function Actividad({
  items,
  enCurso,
  fuentes,
  abrir,
  verFuentes,
}: {
  items: ItemActividad[];
  enCurso: boolean;
  fuentes: Fuente[];
  abrir: (url: string) => void;
  verFuentes: VerFuentes;
}) {
  const [abierta, setAbierta] = useState(enCurso);
  useSegundero(enCurso && items.length > 0);
  // Al terminar se pliega: queda solo «Ha trabajado 8 s».
  useEffect(() => {
    if (!enCurso) setAbierta(false);
  }, [enCurso]);
  if (!items.length)
    return (
      <div role="status" className="my-4 py-1 text-[15px]">
        <Shimmer>Pensando</Shimmer>
      </div>
    );
  const desde = Date.parse(items[0]!.desde ?? '');
  const hasta = enCurso
    ? Date.now()
    : Math.max(...items.map((i) => Date.parse(i.hasta ?? '') || 0));
  const tiempo = desde && hasta >= desde ? duracion(hasta - desde) : '';
  const grupos = pasos(items);
  return (
    <Collapsible open={abierta} onOpenChange={setAbierta} className="my-4">
      <CollapsibleTrigger className="flex items-center gap-1.5 rounded-lg py-1 text-[15px] text-muted-foreground hover:text-foreground">
        <Icono
          nombre="abajo"
          size={16}
          className={cn('transition-transform duration-200', !abierta && '-rotate-90')}
        />
        {enCurso ? (
          <>
            <Shimmer>Pensando</Shimmer>
            <span className="ml-1 text-foreground/35 tabular-nums">{tiempo}</span>
          </>
        ) : (
          `Ha trabajado ${tiempo}`.trim()
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-300 ease-(--ease-brand) data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        <ol className="m-0 mt-2 list-none p-0 text-[15px]">
          {grupos.map((g, n) => (
            <Paso
              key={g[0]!.id}
              items={g}
              fuentes={fuentes}
              abrir={abrir}
              verFuentes={verFuentes}
              conLinea={!enCurso || n < grupos.length - 1}
            />
          ))}
          {!enCurso && (
            <li className={cn('grid grid-cols-[18px_1fr] gap-x-3', entra)}>
              <span className="flex h-6 items-center justify-center">
                <span className="grid size-4 place-items-center rounded-full bg-foreground text-background">
                  <Icono nombre="check" size={10} />
                </span>
              </span>
              <span className="leading-6">Listo</span>
            </li>
          )}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Conversacion({
  vista,
  verNavegador,
  abrirFuente,
  verFuentes,
  alVolver,
}: {
  vista: TramiteVista;
  verNavegador: () => void;
  abrirFuente: (url: string) => void;
  verFuentes: VerFuentes;
  /** Tras volver a antes de un mensaje, su texto vuelve al compositor. */
  alVolver: (texto: string) => void;
}) {
  const fin = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const trabajando = vista.ejecucion === 'trabajando';
  const primero = vista.conversacion.find((i) => i.tipo === 'usuario');
  // Ya aceptó que el asistente haga el trámite: lo que pida después no vuelve a ser una oferta.
  const enCurso = vista.conversacion.some(
    (i) =>
      i.tipo === 'pregunta' &&
      i.pregunta.tipo === 'formulario' &&
      Boolean(i.pregunta.formulario.accion) &&
      i.resultado === 'Respondido',
  );
  const bloques = agrupar(vista.conversacion);
  const ultimo = vista.conversacion.at(-1);
  // Mientras piensa sin haber hecho nada todavía: el mismo bloque que mostrará sus acciones.
  if (
    trabajando &&
    ultimo?.tipo !== 'actividad' &&
    !(ultimo?.tipo === 'pregunta' && ultimo.estado === 'pendiente')
  )
    bloques.push({ tipo: 'actividad', clave: ultimo?.id ?? 'inicio', items: [] });
  const total = vista.conversacion.reduce(
    (n, i) => n + (i.tipo === 'asistente' ? i.texto.length : 1),
    0,
  );
  // Baja con la respuesta salvo que la persona esté leyendo más arriba.
  useEffect(() => {
    const c = caja.current;
    if (c && c.scrollHeight - c.scrollTop - c.clientHeight < 240)
      fin.current?.scrollIntoView({ block: 'end' });
  }, [total]);
  return (
    <div ref={caja} className="min-h-0 flex-1 overflow-y-auto">
      <div
        role="log"
        aria-label="Conversación"
        aria-busy={trabajando}
        className="mx-auto w-full max-w-[720px] px-8 pt-4 pb-6 [&_.chat-notice]:rounded-[20px] [&_.chat-notice]:px-5"
      >
        {bloques.map((b, n) => {
          if (b.tipo === 'actividad')
            return (
              <Actividad
                key={`actividad-${b.clave}`}
                items={b.items}
                enCurso={trabajando && n === bloques.length - 1}
                fuentes={vista.fuentes}
                abrir={abrirFuente}
                verFuentes={verFuentes}
              />
            );
          const i = b.item;
          // Volver a antes de un mensaje: no en el primero, que dejaría el trámite vacío.
          const volver =
            i.tipo === 'usuario' &&
            i !== primero &&
            i.mensajes !== undefined &&
            vista.ejecucion === 'inactivo';
          if (i.tipo === 'usuario')
            return (
              <div key={i.id} className="group my-6">
                <p className="m-0 rounded-[20px] bg-background px-5 py-3.5 text-base leading-relaxed whitespace-pre-wrap">
                  {i.texto}
                </p>
                {(i.redirigido || i.protegidos > 0 || volver) && (
                  <div className="mt-1.5 ml-1 flex min-h-7 items-center gap-4 text-sm text-muted-foreground">
                    {i.redirigido && (
                      <span className="flex items-center gap-1.5">
                        <Icono nombre="redirigir" size={16} />
                        Interrumpiste al asistente con este mensaje
                      </span>
                    )}
                    {i.protegidos > 0 && (
                      <span
                        className="flex items-center gap-1.5"
                        title="Se enviaron al asistente como marcadores: no ha visto los valores."
                      >
                        <Icono nombre="candado" size={16} />
                        {i.protegidos === 1
                          ? '1 dato protegido'
                          : `${i.protegidos} datos protegidos`}
                      </span>
                    )}
                    {volver && (
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-foreground/[0.06] hover:text-foreground"
                        onClick={() => {
                          if (
                            confirm(
                              '¿Volver a antes de este mensaje? Se borran él y todo lo que vino después. Las webs que abrió el asistente no se deshacen.',
                            )
                          )
                            void window.rd.volver(vista.id, i.id).then(() => alVolver(i.texto));
                        }}
                      >
                        <Icono nombre="deshacer" size={16} />
                        Volver a antes de este mensaje
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          if (i.tipo === 'asistente')
            return (
              <div key={i.id} className="my-4 text-base leading-[1.65]">
                <Response
                  streaming={trabajando && i === ultimo}
                  className="[&_li]:marker:text-muted-foreground [&_ol]:list-decimal [&_ul]:list-disc"
                >
                  {i.texto}
                </Response>
              </div>
            );
          if (i.tipo === 'pregunta')
            return (
              <Pregunta
                key={i.id}
                tramite={vista.id}
                item={i}
                enCurso={enCurso}
                verNavegador={verNavegador}
              />
            );
          if (i.tipo !== 'aviso') return null;
          return (
            <div key={i.id} className="my-4">
              <Notice
                tone={i.tono === 'error' ? 'error' : 'info'}
                icon={<Icono nombre={i.tono === 'error' ? 'aviso' : 'info'} />}
                role={i.tono === 'error' ? 'alert' : 'status'}
                actions={
                  i.continuar && i === ultimo && !trabajando ? (
                    <Button
                      variant="sunset"
                      size="lg"
                      onClick={() => void window.rd.enviar(vista.id, 'Continúa.')}
                    >
                      Continuar
                    </Button>
                  ) : i.archivo ? (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => void window.rd.mostrarArchivo(i.archivo!)}
                    >
                      Mostrar en la carpeta
                    </Button>
                  ) : undefined
                }
              >
                <p>{i.texto}</p>
              </Notice>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
    </div>
  );
}

/**
 * Lo que la persona ha escrito mientras el asistente trabaja: sale cuando termine, o ya con
 * «Interrumpir», que lo mete en lo que está haciendo.
 */
function Cola({ vista }: { vista: TramiteVista }) {
  if (!vista.cola.length) return null;
  return (
    <ul
      aria-label="Para cuando termine"
      className="m-0 mx-4 -mb-4 list-none rounded-t-[22px] border border-b-0 border-border bg-background/60 p-0 px-3 pt-1.5 pb-5"
    >
      {vista.cola.map((m) => (
        <li key={m.id} className="flex items-center gap-3 py-1 pl-1 text-[15px]">
          <Icono nombre="reloj" size={16} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{m.texto}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            title="Mandarlo ya: el asistente lo tiene en cuenta en su siguiente paso"
            onClick={() => void window.rd.redirigir(vista.id, m.id)}
          >
            <Icono nombre="redirigir" size={16} />
            Interrumpir
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Quitar de la cola"
            onClick={() => void window.rd.quitarDeCola(vista.id, m.id)}
          >
            <Icono nombre="papelera" size={16} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function PanelNavegador({ vista, oculto }: { vista: TramiteVista; oculto: boolean }) {
  const hueco = useRef<HTMLDivElement>(null);
  const nav = vista.navegador;
  const hayVista = Boolean(nav?.url);
  useLayoutEffect(() => {
    const el = hueco.current;
    if (!el || !hayVista || oculto) return;
    const colocar = () => {
      const r = el.getBoundingClientRect();
      void window.rd.colocarNavegador(vista.id, {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
      });
    };
    colocar();
    const ro = new ResizeObserver(colocar);
    ro.observe(el);
    // El hueco también se mueve sin cambiar de tamaño al redimensionar o ampliar la ventana.
    window.addEventListener('resize', colocar);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', colocar);
      void window.rd.colocarNavegador(vista.id, null);
    };
  }, [vista.id, hayVista, oculto]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Atrás"
          disabled={!nav?.puedeVolver}
          onClick={() => void window.rd.navegar(vista.id, 'atras')}
        >
          <Icono nombre="atras" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Recargar"
          disabled={!hayVista}
          onClick={() => void window.rd.navegar(vista.id, 'recargar')}
        >
          <Icono nombre="recargar" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
          <Icono nombre="web" size={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{nav?.url ? host(nav.url) : 'Sin página'}</span>
        </div>
      </div>
      {hayVista ? (
        <div ref={hueco} className="min-h-0 flex-1 bg-background" />
      ) : (
        <div className="flex flex-1 items-center justify-center p-10 text-center text-[15px] leading-relaxed text-muted-foreground">
          <p className="max-w-[40ch]">
            El navegador se abre cuando el asistente visita una web. Verás aquí todo lo que hace y
            podrás tomar el control cuando quieras.
          </p>
        </div>
      )}
    </div>
  );
}

export function Tramite({ id, alBorrar }: { id: string; alBorrar: () => void }) {
  const { tramites } = useEstado();
  const vista = tramites[id];
  const [verNavegador, setVerNavegador] = useState(false);
  const [fuentesVisibles, setFuentesVisibles] = useState(false);
  const [seleccionFuentes, setSeleccionFuentes] = useState<Fuente[]>([]);
  const [borrador, setBorrador] = useState<{ texto: string }>();
  useEffect(() => {
    if (!vista) void cargarTramite(id);
  }, [id, vista]);
  // Mientras el asistente usa el navegador (o te pide que lo uses), se ve lo que pasa.
  const ultimo = vista?.conversacion.at(-1);
  const clave = ultimo ? `${ultimo.id}:${ultimo.tipo === 'actividad' ? ultimo.estado : ''}` : '';
  const pideNavegador = Boolean(
    ultimo &&
    ((ultimo.tipo === 'actividad' &&
      DE_NAVEGADOR.has(ultimo.herramienta) &&
      ultimo.estado === 'inicio') ||
      (ultimo.tipo === 'pregunta' &&
        ultimo.estado === 'pendiente' &&
        ultimo.pregunta.tipo === 'ayuda')),
  );
  useEffect(() => {
    if (pideNavegador) setVerNavegador(true);
  }, [clave, pideNavegador]);
  if (!vista) return null;
  const abrirFuente = (url: string) => {
    setVerNavegador(true);
    void window.rd.abrirEnTramite(vista.id, url);
  };
  const trabajando = vista.ejecucion === 'trabajando';
  // Mientras espera una respuesta tampoco acepta mensajes nuevos, pero se puede detener.
  const ocupado = vista.ejecucion !== 'inactivo';
  return (
    <Sheet
      // La vista nativa queda sobre el DOM: se oculta hasta que termina de cerrarse el panel.
      onOpenChange={(abierta) => {
        if (abierta) setFuentesVisibles(true);
      }}
      onOpenChangeComplete={(abierta) => {
        if (!abierta) setFuentesVisibles(false);
      }}
    >
      <div className="flex h-full min-h-0">
        <section
          className={cn('flex min-w-0 flex-col', verNavegador ? 'w-[400px] shrink-0' : 'flex-1')}
          aria-label="Conversación"
        >
          <header
            className={cn(
              'arrastrar flex h-[52px] shrink-0 items-center gap-2 px-6',
              !verNavegador && 'hueco-botones',
            )}
          >
            <h1 className="m-0 truncate text-[15px] font-medium">{vista.titulo}</h1>
            {!verNavegador && (
              <Button
                variant="ghost"
                size="lg"
                className="ml-auto hover:bg-foreground/[0.06]"
                onClick={() => setVerNavegador(true)}
              >
                <Icono nombre="web" />
                Navegador
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              className={cn('hover:bg-foreground/[0.06]', verNavegador && 'ml-auto')}
              aria-label="Borrar este trámite"
              onClick={() => {
                if (
                  confirm(
                    '¿Borrar este trámite? Se borran la conversación y la sesión del navegador. Los documentos descargados se quedan en tu carpeta de Descargas.',
                  )
                )
                  void window.rd.borrarTramite(vista.id).then(alBorrar);
              }}
            >
              <Icono nombre="papelera" />
            </Button>
          </header>
          <Conversacion
            vista={vista}
            verNavegador={() => setVerNavegador(true)}
            abrirFuente={abrirFuente}
            verFuentes={setSeleccionFuentes}
            alVolver={(texto) => setBorrador({ texto })}
          />
          {/* La conversación se funde con el lienzo justo encima del compositor. */}
          <div className="relative mx-auto w-full max-w-[720px] px-8 pt-2 pb-6 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-linear-to-b before:from-transparent before:to-muted">
            <Cola vista={vista} />
            <Compositor
              placeholder={
                trabajando
                  ? 'Añade otra petición para cuando termine'
                  : vista.aviso === 'oferta'
                    ? 'Responde a la tarjeta o escribe otra cosa'
                    : ocupado
                      ? 'Responde a la tarjeta o añade otra petición'
                      : 'Escribe al asistente'
              }
              borrador={borrador}
              ocupado={ocupado}
              alEnviar={(t) => window.rd.enviar(vista.id, t)}
              alDetener={() => void window.rd.detener(vista.id)}
              razonamiento={vista.razonamiento}
              alRazonar={(razonamiento) =>
                void window.rd.ajustarTramite(vista.id, { razonamiento })
              }
            />
          </div>
        </section>
        {verNavegador && (
          <aside
            aria-label="Navegador del trámite"
            className="flex min-w-0 flex-1 flex-col border-l border-border bg-background"
          >
            <div className="arrastrar hueco-botones flex h-[52px] shrink-0 items-center gap-2 px-4">
              <span className="text-[15px] font-medium">Navegador</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label="Ocultar el navegador"
                onClick={() => setVerNavegador(false)}
              >
                <Icono nombre="cerrar" />
              </Button>
            </div>
            <PanelNavegador vista={vista} oculto={fuentesVisibles} />
          </aside>
        )}
      </div>
      <PanelFuentes fuentes={seleccionFuentes} abrir={abrirFuente} />
    </Sheet>
  );
}
