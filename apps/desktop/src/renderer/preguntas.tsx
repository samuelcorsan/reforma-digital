import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { Input } from '@reforma-digital/design/ui/input';
import { Textarea } from '@reforma-digital/design/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@reforma-digital/design/ui/radio-group';
import { Checkbox } from '@reforma-digital/design/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import { cn } from '@reforma-digital/design/lib/utils';
import type { Ayuda, ItemConversacion } from '../shared/api';
import { useEstado } from './estado';
import { Icono, Marca, type NombreIcono } from './icono';

type ItemPregunta = Extract<ItemConversacion, { tipo: 'pregunta' }>;
export const TIPO_INPUT: Partial<Record<string, string>> = {
  fecha: 'date',
  email: 'email',
  telefono: 'tel',
  numero: 'number',
};

/**
 * Cabecera con el icono, lo que pide el asistente y, debajo en gris, qué es exactamente;
 * `accesorio` va a su derecha. Una pregunta pendiente recibe el foco al aparecer, salvo que la
 * persona tenga algo escrito.
 */
function Tarjeta({
  icono,
  sinFondo = false,
  titulo,
  descripcion,
  accesorio,
  children,
}: {
  icono: ReactNode;
  /** La marca de Reforma Digital va sola, sin el cuadro de color. */
  sinFondo?: boolean;
  titulo: string;
  descripcion: string;
  accesorio?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();
  useEffect(() => {
    const activo = document.activeElement;
    if (
      !(activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement) ||
      !activo.value
    )
      ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`${idTitulo} ${idDescripcion}`}
      className="my-6 rounded-[20px] bg-background outline-none [animation:chat-enter_360ms_var(--ease-brand)_both] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 p-5">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl text-brand',
            !sinFondo && 'bg-brand/[0.08]',
          )}
        >
          {icono}
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h3 id={idTitulo} className="m-0 text-[17px] leading-snug font-medium text-balance">
            {titulo}
          </h3>
          <p id={idDescripcion} className="m-0 mt-0.5 text-sm text-muted-foreground">
            {descripcion}
          </p>
        </div>
        {accesorio}
      </div>
      {children}
    </section>
  );
}

/**
 * Envía la respuesta. La tarjeta vuelve a estar disponible si no llega al proceso principal o si
 * sigue pendiente (Touch ID cancelado).
 */
function useResponder(tramite: string, item: ItemPregunta) {
  const [enviando, setEnviando] = useState(false);
  const responder = (r: Record<string, string> | boolean | null) => {
    setEnviando(true);
    window.rd.responder(tramite, item.id, r).then(
      (hecho) => setEnviando(!hecho),
      () => setEnviando(false),
    );
  };
  return { enviando, responder };
}

/** Sustituye los marcadores por la pista enmascarada de Mis datos: «DNI {{documento_numero}}» → «DNI •••• 78Z». */
function useConMarcadores() {
  const { app } = useEstado();
  const vista = new Map((app?.perfil ?? []).map((d) => [d.clave, d.vista]));
  return (t: string) =>
    t.replace(/\{\{([a-z0-9_.]+)(?::[a-z/]+)?\}\}/gi, (_m, clave: string) => {
      const v = vista.get(clave);
      return v ? `«${v}»` : `«${app?.campos.find((c) => c.clave === clave)?.etiqueta ?? clave}»`;
    });
}

type Campo = Extract<
  ItemPregunta['pregunta'],
  { tipo: 'formulario' }
>['formulario']['campos'][number];

/** Las respuestas de un campo de varias opciones van juntas, separadas así. */
const SEPARADOR = '; ';
const marcadas = (v = '') => v.split(SEPARADOR).filter(Boolean);
/**
 * Un campo con solo_si se pregunta solo si el otro campo se ve y tiene esa respuesta (A → B → C:
 * si A oculta B, C también se va, aunque B conserve lo que se respondió).
 */
function seVe(c: Campo, campos: Campo[], valores: Record<string, string>, vistos = 0): boolean {
  if (!c.solo_si) return true;
  const de = campos.find((o) => o.clave === c.solo_si!.campo);
  // Con un ciclo (A depende de B y B de A), ninguno se ve.
  if (!de || vistos > campos.length) return false;
  return (
    seVe(de, campos, valores, vistos + 1) &&
    marcadas(valores[c.solo_si.campo]).includes(c.solo_si.valor)
  );
}
/** Con más opciones que estas, un desplegable en lugar de botones. */
const MAX_BOTONES = 8;

function Entrada({
  c,
  id,
  valor,
  fijar,
}: {
  c: Campo;
  id: string;
  valor: string;
  fijar: (v: string) => void;
}) {
  const ayuda = c.privado
    ? 'Se guarda cifrado en tu ordenador. El asistente no verá el valor.'
    : c.ayuda;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-[15px] font-medium">
        {c.privado && <Icono nombre="candado" size={16} className="text-muted-foreground" />}
        {c.etiqueta}
        {c.obligatorio === false && (
          <span className="font-normal text-muted-foreground">(opcional)</span>
        )}
      </label>
      {c.tipo === 'varias' && c.opciones?.length ? (
        <div id={id} role="group" aria-label={c.etiqueta} className="grid gap-2 sm:grid-cols-2">
          {c.opciones.map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 text-[15px] has-data-checked:border-foreground has-data-checked:font-medium"
            >
              <Checkbox
                checked={marcadas(valor).includes(o)}
                onCheckedChange={(si) =>
                  fijar(
                    (si ? [...marcadas(valor), o] : marcadas(valor).filter((x) => x !== o)).join(
                      SEPARADOR,
                    ),
                  )
                }
              />
              {o}
            </label>
          ))}
        </div>
      ) : c.tipo === 'opcion' && (c.opciones?.length ?? 0) > MAX_BOTONES ? (
        <Select
          value={valor || null}
          items={c.opciones!.map((o) => ({ value: o, label: o }))}
          onValueChange={(v) => fijar(String(v ?? ''))}
        >
          <SelectTrigger id={id} aria-label={c.etiqueta} className="h-11 w-full text-base">
            <SelectValue placeholder="Elige una opción" />
          </SelectTrigger>
          <SelectContent>
            {c.opciones!.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : c.tipo === 'si_no' || (c.tipo === 'opcion' && c.opciones?.length) ? (
        <RadioGroup
          id={id}
          aria-label={c.etiqueta}
          value={valor}
          onValueChange={(v) => fijar(String(v))}
          className="grid gap-2 sm:grid-cols-2"
        >
          {(c.tipo === 'si_no' ? ['Sí', 'No'] : (c.opciones ?? [])).map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 text-[15px] has-data-checked:border-foreground has-data-checked:font-medium"
            >
              <RadioGroupItem value={o} />
              {o}
            </label>
          ))}
        </RadioGroup>
      ) : c.tipo === 'texto_largo' ? (
        <Textarea id={id} maxLength={2000} value={valor} onChange={(e) => fijar(e.target.value)} />
      ) : (
        <Input
          id={id}
          className="h-11 text-base"
          type={TIPO_INPUT[c.tipo] ?? 'text'}
          autoComplete="off"
          maxLength={2000}
          value={valor}
          onChange={(e) => fijar(e.target.value)}
        />
      )}
      {ayuda && <p className="mt-1.5 mb-0 text-sm text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** Una respuesta como se lee: las fechas, «31/12/1990». */
const legible = (c: Campo, v = '') =>
  (c.tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? v.split('-').reverse().join('/')
    : v.trim()) || '—';

/** Los pasos que marca el asistente o, si no los marca todos, de tres en tres. */
function enPasos(campos: Campo[]) {
  const pasos: { nombre: string; campos: Campo[] }[] = [];
  for (const c of campos) {
    const p = pasos.find((x) => x.nombre === c.paso);
    if (p) p.campos.push(c);
    else if (c.paso) pasos.push({ nombre: c.paso, campos: [c] });
  }
  if (pasos.length > 1 && campos.every((c) => c.paso)) return pasos;
  return Array.from({ length: Math.ceil(campos.length / 3) }, (_, n) => {
    const grupo = campos.slice(n * 3, n * 3 + 3);
    return { nombre: grupo[0]!.etiqueta, campos: grupo };
  });
}

/**
 * Si el formulario ofrece hacer el trámite, llega plegado bajo la explicación del asistente, con
 * el botón de la acción («Pedir la cita»): al pulsarlo se despliega con los datos que hacen falta.
 * Con más de cuatro datos va por pasos y termina con un resumen para revisarlos.
 */
function Formulario({ tramite, item }: { tramite: string; item: ItemPregunta }) {
  const base = useId();
  const f = item.pregunta.tipo === 'formulario' ? item.pregunta.formulario : null;
  const [valores, setValores] = useState<Record<string, string>>({});
  const [abierto, setAbierto] = useState(!f?.accion);
  const [paso, setPaso] = useState(0);
  const [atras, setAtras] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const { enviando, responder } = useResponder(tramite, item);
  const plegable = Boolean(f?.accion);
  useEffect(() => {
    if (abierto && plegable)
      formulario.current
        ?.querySelector<HTMLElement>(
          'input:not([aria-hidden]), textarea, [role="radio"], button[type="submit"]',
        )
        ?.focus();
  }, [abierto, plegable, paso]);
  if (!f) return null;
  const pendiente = (c: Campo) => c.obligatorio !== false && !valores[c.clave]?.trim();
  // Los campos que dependen de otra respuesta entran y salen según lo que se va respondiendo.
  const enJuego = f.campos.filter((c) => seVe(c, f.campos, valores));
  const faltan = enJuego.filter(pendiente);
  const fijar = (clave: string, v: string) => setValores((x) => ({ ...x, [clave]: v }));
  // Que quede claro quién lo hace: «Pedir la cita» → «Pedir la cita por mí».
  const accion = f.accion && (/por m[ií]/i.test(f.accion) ? f.accion : `${f.accion} por mí`);
  const pasos = f.accion && f.campos.length > 4 ? enPasos(enJuego) : null;
  const revisar = pasos !== null && paso >= pasos.length;
  const visibles = pasos ? (pasos[paso]?.campos ?? []) : enJuego;
  const faltanAqui = revisar ? faltan : visibles.filter(pendiente);
  const ir = (n: number) => {
    setAtras(n < paso);
    setPaso(n);
  };
  const campos = visibles.map((c) => (
    <Entrada
      key={c.clave}
      c={c}
      id={`${base}-${c.clave}`}
      valor={valores[c.clave] ?? ''}
      fijar={(v) => fijar(c.clave, v)}
    />
  ));
  const acciones = (
    <div className={cn('flex flex-wrap items-center gap-3', pasos ? 'mt-6' : 'mt-5')}>
      {paso > 0 ? (
        <Button type="button" variant="ghost" size="lg" onClick={() => ir(paso - 1)}>
          Atrás
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={enviando}
          onClick={() => responder(null)}
        >
          Ahora no
        </Button>
      )}
      {faltanAqui.length > 0 && (
        <span className="text-sm text-muted-foreground">
          Faltan {faltanAqui.length} por completar.
        </span>
      )}
      <Button
        type="submit"
        variant="sunset"
        size="lg"
        className="ml-auto"
        disabled={enviando || faltanAqui.length > 0}
      >
        {pasos && !revisar ? 'Continuar' : (accion ?? 'Enviar respuestas')}
      </Button>
    </div>
  );
  const cuerpo = (
    <div className="px-5 pb-5">
      {f.explicacion && (
        <p className="mt-0 mb-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {f.explicacion}
        </p>
      )}
      <form
        ref={formulario}
        onSubmit={(e) => {
          e.preventDefault();
          if (faltanAqui.length) return;
          if (pasos && !revisar) ir(paso + 1);
          else responder(Object.fromEntries(enJuego.map((c) => [c.clave, valores[c.clave] ?? ''])));
        }}
      >
        {pasos ? (
          <div className="rounded-[22px] bg-muted p-1.5">
            <ol className="m-0 flex list-none gap-3 px-4 pt-2 pb-3 text-[15px]">
              {[...pasos.map((p) => p.nombre), 'Revisar'].map((nombre, n) => (
                <li
                  key={n}
                  aria-current={n === paso ? 'step' : undefined}
                  className={cn(
                    'min-w-0 flex-1 truncate text-center transition-colors',
                    n === paso ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="tabular-nums">{n + 1}.</span> {nombre}
                </li>
              ))}
            </ol>
            <div className="rounded-[18px] bg-background p-6">
              <div
                key={paso}
                className={cn(
                  'space-y-4',
                  atras
                    ? '[animation:chat-slide-back_280ms_var(--ease-brand)_both]'
                    : '[animation:chat-slide-forward_280ms_var(--ease-brand)_both]',
                )}
              >
                <h4 className="mb-5 text-[17px] leading-snug font-medium">
                  {revisar ? 'Revisa los datos' : pasos[paso]!.nombre}
                </h4>
                {revisar ? (
                  <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-6 gap-y-2.5 text-[15px]">
                    {enJuego.map((c) => (
                      <div key={c.clave} className="contents">
                        <dt className="text-muted-foreground">{c.etiqueta}</dt>
                        <dd className="m-0 break-words">{legible(c, valores[c.clave])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  campos
                )}
              </div>
              {acciones}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">{campos}</div>
            {acciones}
          </>
        )}
      </form>
    </div>
  );
  if (!f.accion)
    return (
      <Tarjeta
        icono={<Marca size={28} />}
        sinFondo
        titulo="El asistente necesita unos datos"
        descripcion={f.titulo}
      >
        {cuerpo}
      </Tarjeta>
    );
  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <Tarjeta
        icono={<Marca size={28} />}
        sinFondo
        titulo="El asistente puede hacerlo por ti"
        descripcion={f.titulo}
        accesorio={
          <div className="ml-auto flex gap-2">
            {!abierto && (
              <Button variant="ghost" size="lg" disabled={enviando} onClick={() => responder(null)}>
                Ahora no
              </Button>
            )}
            {/* El mismo botón despliega y pliega, para que no pierda el foco. */}
            <CollapsibleTrigger
              aria-label={abierto ? 'Plegar' : undefined}
              render={
                <Button variant={abierto ? 'ghost' : 'sunset'} size={abierto ? 'icon-lg' : 'lg'} />
              }
            >
              {abierto ? <Icono nombre="siguiente" className="-rotate-90" /> : accion}
            </CollapsibleTrigger>
          </div>
        }
      >
        <CollapsibleContent
          // Al terminar de desplegarse, deja a la vista el formulario entero si cabe.
          onTransitionEnd={(e) => {
            if (abierto && e.target === e.currentTarget && e.propertyName === 'height')
              e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }}
          className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-300 ease-(--ease-brand) data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none"
        >
          {cuerpo}
        </CollapsibleContent>
      </Tarjeta>
    </Collapsible>
  );
}

function Confirmacion({ tramite, item }: { tramite: string; item: ItemPregunta }) {
  const { app } = useEstado();
  const conMarcadores = useConMarcadores();
  const { enviando, responder } = useResponder(tramite, item);
  if (item.pregunta.tipo !== 'confirmacion') return null;
  const c = item.pregunta.confirmacion;
  const huella = app?.touchId && app.ajustes.touchIdEnConfirmaciones;
  return (
    <Tarjeta icono={<Icono nombre="huella" />} titulo="Necesito tu permiso" descripcion={c.accion}>
      <div className="px-5 pb-5">
        {c.previas?.length ? (
          <p className="mt-0 mb-3 flex gap-2 rounded-xl bg-[var(--warning)] px-3 py-2.5 text-sm text-[var(--warning-foreground)]">
            <Icono nombre="aviso" />
            <span>
              En este trámite ya se hizo: {c.previas.join('; ')}. Comprueba que no lo estás
              repitiendo.
            </span>
          </p>
        ) : null}
        {c.detalles.length > 0 && (
          <ul className="mt-0 mb-4 space-y-1.5 pl-5 text-[15px] leading-relaxed">
            {c.detalles.map((d) => (
              <li key={d}>{conMarcadores(d)}</li>
            ))}
          </ul>
        )}
        {c.sitio && <p className="mt-0 mb-4 text-sm text-muted-foreground">En {c.sitio}</p>}
        <div className="flex flex-wrap gap-3">
          <Button variant="sunset" size="lg" disabled={enviando} onClick={() => responder(true)}>
            {huella && <Icono nombre="huella" />}
            Aprobar
          </Button>
          <Button variant="outline" size="lg" disabled={enviando} onClick={() => responder(false)}>
            No
          </Button>
        </div>
      </div>
    </Tarjeta>
  );
}

/** Antes de dar los datos de la persona a una web que no es oficial. */
function Confianza({ tramite, item }: { tramite: string; item: ItemPregunta }) {
  const { enviando, responder } = useResponder(tramite, item);
  if (item.pregunta.tipo !== 'confianza') return null;
  const web = item.pregunta.web;
  return (
    <Tarjeta
      icono={<Icono nombre="web" />}
      titulo="¿Confías en esta web?"
      descripcion={`${web} no está en la lista de webs oficiales`}
    >
      <div className="px-5 pb-5">
        <p className="mt-0 mb-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          El asistente quiere escribir tus datos personales en{' '}
          <strong className="font-medium text-foreground">{web}</strong>. Hazlo solo si es la web
          donde quieres hacer el trámite. Si confías en ella, no se te volverá a preguntar; puedes
          quitarla en Ajustes.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="sunset" size="lg" disabled={enviando} onClick={() => responder(true)}>
            Confiar en {web}
          </Button>
          <Button variant="outline" size="lg" disabled={enviando} onClick={() => responder(false)}>
            No
          </Button>
        </div>
      </div>
    </Tarjeta>
  );
}

const MOTIVOS: Record<Ayuda['motivo'], { icono: NombreIcono; titulo: string }> = {
  iniciar_sesion: { icono: 'candado', titulo: 'Inicia sesión tú' },
  captcha: { icono: 'mano', titulo: 'Resuelve la comprobación' },
  certificado: { icono: 'huella', titulo: 'Elige tu certificado' },
  firma: { icono: 'huella', titulo: 'Firma tú con AutoFirma' },
  pago: { icono: 'mano', titulo: 'El pago lo haces tú' },
  adjuntar: { icono: 'documento', titulo: 'Adjunta el archivo' },
  otro: { icono: 'mano', titulo: 'Te toca a ti' },
};

function Ayuda({
  tramite,
  item,
  verNavegador,
}: {
  tramite: string;
  item: ItemPregunta;
  verNavegador: () => void;
}) {
  const { enviando, responder } = useResponder(tramite, item);
  if (item.pregunta.tipo !== 'ayuda') return null;
  const a = item.pregunta.ayuda;
  const m = MOTIVOS[a.motivo];
  return (
    <Tarjeta icono={<Icono nombre={m.icono} />} titulo={m.titulo} descripcion={a.instrucciones}>
      <div className="px-5 pb-5">
        <p className="mt-0 mb-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Hazlo en el navegador de la derecha, en la web oficial. El asistente espera y no ve lo que
          escribes en las contraseñas.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="sunset" size="lg" disabled={enviando} onClick={() => responder(true)}>
            Ya está
          </Button>
          <Button variant="outline" size="lg" onClick={verNavegador}>
            Ver el navegador
          </Button>
          <Button variant="ghost" size="lg" disabled={enviando} onClick={() => responder(false)}>
            No he podido
          </Button>
        </div>
      </div>
    </Tarjeta>
  );
}

/** El primer número de un texto como «91 123 45 67 / 91 765 43 21» o «901 50 20 50, opción 3». */
const primerNumero = (t: string) =>
  (/\+?\d[\d\s.-]{1,}\d/.exec(t)?.[0] ?? '').replace(/[^\d+]/g, '');

/** La llamada que no se puede evitar: a quién, qué conseguir y qué preguntar, y lo que le dicen. */
function Llamada({ tramite, item }: { tramite: string; item: ItemPregunta }) {
  const { enviando, responder } = useResponder(tramite, item);
  const [notas, setNotas] = useState('');
  const idNotas = useId();
  if (item.pregunta.tipo !== 'llamada') return null;
  const l = item.pregunta.llamada;
  const lista = (titulo: string, items: string[], numerada: boolean) => {
    const Lista = numerada ? 'ol' : 'ul';
    return (
      <div>
        <h4 className="m-0 mb-1.5 text-[15px] font-medium">{titulo}</h4>
        <Lista className={cn('m-0 space-y-1 pl-5', numerada ? 'list-decimal' : 'list-disc')}>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </Lista>
      </div>
    );
  };
  return (
    <Tarjeta
      icono={<Icono nombre="telefono" />}
      titulo={`Llama a ${l.organismo}`}
      descripcion={l.objetivo}
    >
      <div className="space-y-5 px-5 pb-5 text-[15px] leading-relaxed">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-heading text-[28px] leading-tight tabular-nums select-all">
            {l.telefono}
          </span>
          <Button
            variant="outline"
            size="lg"
            onClick={() => void window.rd.abrirEnlace(`tel:${primerNumero(l.telefono)}`)}
          >
            <Icono nombre="telefono" size={16} />
            Llamar
          </Button>
          {l.horario && <span className="w-full text-muted-foreground">Horario: {l.horario}</span>}
        </div>
        {lista('Qué preguntar', l.preguntas, true)}
        {l.tener_a_mano?.length ? lista('Ten a mano', l.tener_a_mano, false) : null}
        <div>
          <label htmlFor={idNotas} className="mb-1.5 block font-medium">
            Qué te han dicho
          </label>
          <Textarea
            id={idNotas}
            maxLength={2000}
            value={notas}
            placeholder="Fechas, documentos, números de referencia…"
            onChange={(e) => setNotas(e.target.value)}
          />
          <p className="mt-1.5 mb-0 text-sm text-muted-foreground">
            El asistente lo lee para seguir con el trámite. Los datos personales que escribas le
            llegan ocultos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="sunset"
            size="lg"
            disabled={enviando}
            onClick={() => responder({ notas })}
          >
            Ya he llamado
          </Button>
          <Button variant="ghost" size="lg" disabled={enviando} onClick={() => responder(false)}>
            No he podido llamar
          </Button>
        </div>
      </div>
    </Tarjeta>
  );
}

export function Pregunta({
  tramite,
  item,
  verNavegador,
}: {
  tramite: string;
  item: ItemPregunta;
  verNavegador: () => void;
}) {
  if (item.estado !== 'pendiente') {
    const titulo =
      item.pregunta.tipo === 'formulario'
        ? item.pregunta.formulario.titulo
        : item.pregunta.tipo === 'confirmacion'
          ? item.pregunta.confirmacion.accion
          : item.pregunta.tipo === 'llamada'
            ? `Llamar a ${item.pregunta.llamada.organismo}`
            : item.pregunta.tipo === 'confianza'
              ? `Dar tus datos a ${item.pregunta.web}`
              : item.pregunta.ayuda.instrucciones;
    return (
      <p className="my-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Icono
          nombre={
            item.resultado === 'No aprobado' || item.estado === 'cancelada' ? 'cerrar' : 'check'
          }
          size={16}
        />
        <span>
          {titulo} · <span className="font-medium text-foreground">{item.resultado}</span>
        </span>
      </p>
    );
  }
  if (item.pregunta.tipo === 'formulario') return <Formulario tramite={tramite} item={item} />;
  if (item.pregunta.tipo === 'confirmacion') return <Confirmacion tramite={tramite} item={item} />;
  if (item.pregunta.tipo === 'llamada') return <Llamada tramite={tramite} item={item} />;
  if (item.pregunta.tipo === 'confianza') return <Confianza tramite={tramite} item={item} />;
  return <Ayuda tramite={tramite} item={item} verNavegador={verNavegador} />;
}
