import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Input } from '@reforma-digital/design/ui/input';
import { RadioGroup, RadioGroupItem } from '@reforma-digital/design/ui/radio-group';
import { Checkbox } from '@reforma-digital/design/ui/checkbox';
import { cn } from '@reforma-digital/design/lib/utils';
import { Cabecera } from './datos';
import { useEstado } from './estado';
import { dolares } from './formato';
import { Icono } from './icono';

const opcion =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 has-data-checked:border-foreground';

/** Otro proveedor compatible con OpenAI: se prueba antes de guardarlo y sus claves no vuelven a la interfaz. */
function FormularioProveedor({ alGuardar }: { alGuardar: () => void }) {
  const { app } = useEstado();
  const actual = app?.ajustes.proveedorPropio;
  const [url, setUrl] = useState(actual?.url ?? '');
  const [modelo, setModelo] = useState(actual?.modelo ?? '');
  const [clave, setClave] = useState('');
  const [claveExa, setClaveExa] = useState('');
  const [modelos, setModelos] = useState<string[]>([]);
  const [estado, setEstado] = useState<{ probando: boolean; error?: string }>({ probando: false });
  const id = useId();
  if (!app) return null;
  // La clave guardada solo sirve para el servidor al que se dio.
  const hayClave =
    app.clavesPropias.proveedor && URL.parse(url)?.origin === URL.parse(actual?.url ?? '')?.origin;
  const buscarModelos = () => {
    if (url.trim())
      void window.rd.modelosDelProveedor({ url, ...(clave ? { clave } : {}) }).then(setModelos);
  };
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setEstado({ probando: true });
    const r = await window.rd.guardarProveedorPropio({
      url,
      modelo,
      ...(clave ? { clave } : {}),
      ...(claveExa ? { claveExa } : {}),
    });
    if (!r.ok) return setEstado({ probando: false, error: r.error });
    setEstado({ probando: false });
    setClave('');
    setClaveExa('');
    alGuardar();
  };
  const etiqueta = 'mb-1.5 block text-sm font-medium';
  const ayuda = 'mt-1.5 mb-0 text-sm leading-relaxed text-muted-foreground';
  return (
    <form onSubmit={(e) => void guardar(e)} className="mt-4 space-y-4 rounded-2xl bg-muted p-4">
      <div>
        <label htmlFor={`${id}-url`} className={etiqueta}>
          Dirección de la API
        </label>
        <Input
          id={`${id}-url`}
          required
          className="h-11 bg-background text-base"
          placeholder="https://api.openai.com/v1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={buscarModelos}
        />
        <p className={ayuda}>
          Para un modelo en tu ordenador, por ejemplo http://localhost:11434/v1 (Ollama).
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-clave`} className={etiqueta}>
          Clave
        </label>
        <Input
          id={`${id}-clave`}
          type="password"
          autoComplete="off"
          className="h-11 bg-background text-base"
          placeholder={
            hayClave ? 'Guardada. Escribe otra para cambiarla' : 'Si el servidor la pide'
          }
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onBlur={buscarModelos}
        />
      </div>
      <div>
        <label htmlFor={`${id}-modelo`} className={etiqueta}>
          Modelo
        </label>
        <Input
          id={`${id}-modelo`}
          required
          list={`${id}-modelos`}
          autoComplete="off"
          className="h-11 bg-background text-base"
          placeholder="gpt-6-luna"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
        />
        <datalist id={`${id}-modelos`}>
          {modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor={`${id}-exa`} className={etiqueta}>
          Clave de Exa <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <Input
          id={`${id}-exa`}
          type="password"
          autoComplete="off"
          className="h-11 bg-background text-base"
          placeholder={app.clavesPropias.exa ? 'Guardada. Escribe otra para cambiarla' : ''}
          value={claveExa}
          onChange={(e) => setClaveExa(e.target.value)}
        />
        <p className={ayuda}>
          Para buscar en la web. Sin ella, el asistente busca con el buscador de Reforma Digital.
        </p>
      </div>
      <p className={ayuda}>
        Las condiciones de ese proveedor deciden si guarda tus peticiones o entrena con ellas. Tus
        datos personales siguen sin llegarle: van como marcadores.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={estado.probando}>
          {estado.probando ? 'Probando…' : 'Probar y usar'}
        </Button>
        {estado.error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {estado.error}
          </p>
        )}
      </div>
    </form>
  );
}

/** Por defecto, el proveedor de la app; la persona puede elegir otro o un modelo en su ordenador. */
function Proveedor() {
  const { app } = useEstado();
  const [editando, setEditando] = useState(false);
  if (!app) return null;
  const a = app.ajustes;
  const propio = a.proveedor === 'propio' || editando;
  return (
    <fieldset className="m-0 mb-6 border-0 p-0">
      <legend className="mb-3 text-[15px] font-medium">Proveedor de IA</legend>
      <RadioGroup
        value={propio ? 'propio' : 'app'}
        onValueChange={(v) => {
          if (v === 'app') {
            setEditando(false);
            void window.rd.guardarAjustes({ proveedor: 'app' });
          } else if (a.proveedorPropio) void window.rd.guardarAjustes({ proveedor: 'propio' });
          else setEditando(true);
        }}
        className="grid gap-2"
      >
        <label className={opcion}>
          <RadioGroupItem value="app" className="mt-0.5" />
          <span>
            <span className="block text-[15px] font-medium">El de Reforma Digital</span>
            <span className="block text-sm text-muted-foreground">
              Recomendado, sin configurar nada: modelos abiertos alojados en la Unión Europea que no
              guardan tus peticiones, a través de un servidor de Reforma Digital que tampoco las
              guarda.
            </span>
          </span>
        </label>
        <label className={opcion}>
          <RadioGroupItem value="propio" className="mt-0.5" />
          <span>
            <span className="block text-[15px] font-medium">
              Otro proveedor o un modelo en tu ordenador
            </span>
            <span className="block text-sm text-muted-foreground">
              Cualquier servidor compatible con la API de OpenAI: OpenAI, Ollama, LM Studio…
            </span>
          </span>
        </label>
      </RadioGroup>
      {propio && <FormularioProveedor alGuardar={() => setEditando(false)} />}
    </fieldset>
  );
}

/** Un ajuste de sí o no, con su explicación debajo. */
function Opcion({
  activo,
  alCambiar,
  titulo,
  children,
  proximamente = false,
}: {
  activo: boolean;
  alCambiar?: (v: boolean) => void;
  titulo: string;
  children: ReactNode;
  proximamente?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-3', proximamente && 'opacity-60')}>
      <Checkbox
        checked={activo}
        disabled={proximamente}
        onCheckedChange={(v) => alCambiar?.(v === true)}
        className="mt-0.5"
      />
      <span>
        <span className="flex items-center gap-2 text-[15px] font-medium">
          {titulo}
          {proximamente && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              Próximamente
            </span>
          )}
        </span>
        <span className="block text-sm leading-relaxed text-muted-foreground">{children}</span>
      </span>
    </label>
  );
}

/** `privacidad`: llega desde Mis datos y baja hasta esa sección. */
export function Ajustes({ privacidad }: { privacidad: boolean }) {
  const { app } = useEstado();
  const seccion = useRef<HTMLElement>(null);
  useEffect(() => {
    if (privacidad) seccion.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [privacidad]);
  if (!app) return null;
  const contexto = app.campos
    .filter((c) => c.privacidad === 'contexto')
    .map((c) => c.etiqueta.toLowerCase());
  const a = app.ajustes;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-10 pb-16">
        <Cabecera titulo="Ajustes" entradilla="Cómo trabaja el asistente y qué guarda la app." />
        <section className="mb-3 flex flex-col gap-6 rounded-[24px] bg-background p-6">
          {app.plataforma === 'darwin' && (
            <Opcion
              activo={a.touchIdEnConfirmaciones}
              alCambiar={(v) => void window.rd.guardarAjustes({ touchIdEnConfirmaciones: v })}
              titulo="Pedir Touch ID para aprobar envíos, reservas, pagos y firmas"
            >
              {app.touchId
                ? 'Touch ID está disponible en este Mac.'
                : 'Este Mac no tiene Touch ID: bastará con tu aprobación.'}
            </Opcion>
          )}
          <Opcion
            activo={a.cerrarSesiones}
            alCambiar={(v) => void window.rd.guardarAjustes({ cerrarSesiones: v })}
            titulo="Cerrar las sesiones de las webs al cerrar la app"
          >
            Si lo activas, al volver a abrir la app tendrás que iniciar sesión otra vez en las webs
            de tus trámites. Si no, siguen abiertas, guardadas en este ordenador.
          </Opcion>
          <Opcion activo={false} titulo="Interfaces comunitarias" proximamente>
            Interfaces más claras de Reforma Digital para algunas webs oficiales, como la cita del
            DNI o la Agencia Tributaria, sin quitar sus controles.
          </Opcion>
        </section>
        <section className="mb-3 rounded-[24px] bg-background p-6">
          <Proveedor />
          {app.desarrollo && (
            <p className="mt-4 mb-0 text-sm text-muted-foreground">
              Gasto en IA de todos tus trámites:{' '}
              {dolares(app.tramites.reduce((n, t) => n + t.costeUsd, 0))}
            </p>
          )}
        </section>
        <section className="mb-3 rounded-[24px] bg-background p-6">
          <h2 className="mt-0 mb-1 text-[15px] font-medium">
            Webs no oficiales que pueden recibir tus datos
          </h2>
          <p className="mt-0 mb-3 text-sm leading-relaxed text-muted-foreground">
            En las webs oficiales la app escribe tus datos sin preguntar. En cualquier otra, antes
            te pregunta si confías en ella. Estas son las que has aceptado.
          </p>
          {app.websConfiadas.length ? (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {app.websConfiadas.map((web) => (
                <li key={web} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-[15px]">{web}</span>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => void window.rd.dejarDeConfiar(web)}
                  >
                    Dejar de confiar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[15px] text-[var(--text-secondary)]">Ninguna todavía.</p>
          )}
        </section>
        <section
          ref={seccion}
          id="privacidad"
          className="mb-3 scroll-mt-6 rounded-[24px] bg-background p-6"
        >
          <h2 className="mt-0 mb-3 text-[15px] font-medium">Privacidad</h2>
          <ul className="m-0 list-disc space-y-2 pl-5 text-[15px] marker:text-muted-foreground leading-relaxed text-[var(--text-secondary)]">
            <li>
              La IA solo ejecuta lo que le pides: busca, explica y rellena las webs. No lee tus
              datos ni los guarda.
            </li>
            <li>
              Tus datos, conversaciones y trámites se guardan cifrados en este ordenador, con una
              clave protegida por el sistema. No salen de él: al servidor de Reforma Digital solo le
              llegan las peticiones al asistente, con marcadores en lugar de tus datos, y no las
              guarda.
            </li>
            <li>
              En lugar de tu nombre, tu DNI, tus fechas, tu dirección, tu teléfono, tu correo o tu
              IBAN, a la IA le llegan marcadores ({'{{nombre}}'}, {'{{documento_numero}}'}). Sabe
              que hay un dato, no cuál es.
            </li>
            <li>
              Para investigar sí ve datos de contexto: {contexto.join(', ')}, tu edad y cuánto le
              queda a tu documento.
            </li>
            <li>
              Antes de enviar nada a la IA, un modelo de privacidad que se ejecuta en tu ordenador,
              sin conexión, busca nombres, DNI, direcciones, teléfonos y correos en lo que escribes
              y en las webs, también de otras personas, y los cambia por marcadores. Si ese modelo
              falla, no se envía nada.
            </li>
            <li>
              La app pone el dato real solo al escribirlo en la web del trámite: en una web oficial
              o en otra si confías en ella.
            </li>
            <li>Nada se envía, reserva, paga ni firma sin tu aprobación.</li>
            <li>Contraseñas, CAPTCHA, certificados, firmas y pagos los haces tú.</li>
            <li>
              Es código abierto: puedes leer cómo funciona todo esto en{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() =>
                  void window.rd.abrirEnlace('https://github.com/samuelcorsan/reforma-digital')
                }
              >
                github.com/samuelcorsan/reforma-digital
              </button>
              .
            </li>
          </ul>
        </section>
        <section className="pt-5">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              if (
                confirm(
                  '¿Borrar todo? Se borran tus datos, los trámites, las sesiones del navegador y los ajustes. No se puede deshacer.',
                )
              )
                void window.rd.borrarDatos('todo');
            }}
          >
            <Icono nombre="papelera" />
            Borrar todo y empezar de cero
          </Button>
          <p className="mt-6 mb-0 text-sm text-muted-foreground">
            Reforma Digital {app.version} · Código abierto con licencia MIT · Proyecto
            independiente, sin vinculación con la Administración.
          </p>
        </section>
      </div>
    </div>
  );
}
