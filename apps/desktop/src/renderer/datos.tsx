import { useEffect, useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Input } from '@reforma-digital/design/ui/input';
import type { CampoPerfil } from '../shared/api';
import { useEstado } from './estado';
import { Icono } from './icono';
import { TIPO_INPUT } from './preguntas';

export function Cabecera({ titulo, entradilla }: { titulo: string; entradilla: string }) {
  return (
    <>
      <div className="arrastrar h-[52px] shrink-0" />
      <h1 className="m-0 font-heading text-[36px] leading-[1.1] font-normal">{titulo}</h1>
      <p className="mt-3 mb-8 max-w-[62ch] text-base leading-relaxed text-[var(--text-secondary)]">
        {entradilla}
      </p>
    </>
  );
}

const GRUPOS: CampoPerfil['grupo'][] = ['Identidad', 'Documento', 'Contacto', 'Domicilio', 'Otros'];

export function MisDatos({
  verPrivacidad,
  sinGuardar,
}: {
  verPrivacidad: () => void;
  /** Se marca mientras haya cambios sin guardar, para avisar antes de cambiar de pantalla. */
  sinGuardar: { current: boolean };
}) {
  const { app } = useEstado();
  const [edicion, setEdicion] = useState<Record<string, string> | null>(null);
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    sinGuardar.current = Boolean(
      edicion && app?.campos.some((c) => (edicion[c.clave] ?? '') !== (original[c.clave] ?? '')),
    );
    return () => {
      sinGuardar.current = false;
    };
  }, [edicion, original, app, sinGuardar]);
  if (!app) return null;
  const hayDatos = app.perfil.some((d) => d.guardado);
  const vista = new Map(app.perfil.map((d) => [d.clave, d]));
  const editar = async () => {
    const valores = await window.rd.revelarPerfil();
    // Sin Touch ID, no mostrarlos es lo que la persona ha elegido en el cuadro: no hay error.
    if (!valores)
      return setAviso(app.touchId ? 'No se ha podido comprobar tu identidad con Touch ID.' : '');
    setAviso('');
    setOriginal(valores);
    setEdicion(valores);
  };
  const guardar = async () => {
    if (!edicion) return;
    const e = await window.rd.guardarPerfil(
      Object.fromEntries(app.campos.map((c) => [c.clave, edicion[c.clave] ?? ''])),
    );
    setErrores(e);
    if (!Object.keys(e).length) setEdicion(null);
  };
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-10 pb-16">
        <Cabecera
          titulo="Mis datos"
          entradilla="El asistente los usa para rellenar los formularios oficiales sin preguntarte cada vez. Se guardan cifrados en este ordenador, con una clave protegida por el sistema."
        />
        <div className="mb-6 flex items-center gap-4 rounded-[24px] bg-background p-5">
          <Icono nombre="candado" className="shrink-0 text-muted-foreground" />
          <p className="m-0 flex-1 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            La IA no lee tus datos: solo hace lo que le pides.
          </p>
          <Button variant="outline" size="lg" onClick={verPrivacidad}>
            Ver cómo se protegen
          </Button>
        </div>
        <div className="mb-6 flex items-center gap-3">
          {!edicion && (
            <Button variant="outline" size="lg" onClick={() => void editar()}>
              {app.touchId && <Icono nombre="huella" />}
              Ver y editar
            </Button>
          )}
          {aviso && <p className="m-0 text-sm text-destructive">{aviso}</p>}
          {hayDatos && (
            <Button
              variant="destructive"
              size="lg"
              className="ml-auto"
              onClick={() => {
                if (confirm('¿Borrar todos tus datos guardados? Los trámites se conservan.'))
                  void window.rd.borrarDatos('perfil');
              }}
            >
              <Icono nombre="papelera" />
              Borrar mis datos
            </Button>
          )}
        </div>
        {GRUPOS.map((grupo) => (
          <section key={grupo} className="mb-3 rounded-[24px] bg-background p-6">
            <h2 className="mt-0 mb-4 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
              {grupo}
            </h2>
            <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-5">
              {app.campos
                .filter((c) => c.grupo === grupo)
                .map((c) => {
                  const d = vista.get(c.clave);
                  const id = `dato-${c.clave}`;
                  return (
                    <div key={c.clave}>
                      <dt className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        {c.privacidad === 'identificador' && <Icono nombre="candado" size={14} />}
                        {edicion ? <label htmlFor={id}>{c.etiqueta}</label> : c.etiqueta}
                        {edicion && c.ayuda && (
                          <span className="group/ayuda relative ml-auto">
                            <button
                              type="button"
                              aria-label={`Ayuda: ${c.etiqueta}`}
                              aria-describedby={`${id}-ayuda`}
                              className="grid size-6 place-items-center rounded-full hover:text-foreground focus-visible:text-foreground"
                            >
                              <Icono nombre="info" size={16} />
                            </button>
                            <span
                              id={`${id}-ayuda`}
                              role="tooltip"
                              className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 hidden w-64 rounded-lg bg-foreground p-3 text-sm leading-snug font-normal text-background group-focus-within/ayuda:block group-hover/ayuda:block"
                            >
                              {c.ayuda}
                            </span>
                          </span>
                        )}
                      </dt>
                      <dd className="m-0">
                        {edicion ? (
                          c.opciones ? (
                            <select
                              id={id}
                              value={edicion[c.clave] ?? ''}
                              onChange={(e) =>
                                setEdicion({ ...edicion, [c.clave]: e.target.value })
                              }
                              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
                            >
                              <option value="">Sin indicar</option>
                              {c.opciones.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              id={id}
                              className="h-11 text-base"
                              type={TIPO_INPUT[c.tipo] ?? 'text'}
                              autoComplete="off"
                              value={edicion[c.clave] ?? ''}
                              aria-invalid={Boolean(errores[c.clave])}
                              onChange={(e) =>
                                setEdicion({ ...edicion, [c.clave]: e.target.value })
                              }
                            />
                          )
                        ) : (
                          <span
                            className={
                              d?.guardado ? 'text-base' : 'text-base text-muted-foreground'
                            }
                          >
                            {d?.guardado ? d.vista : 'Sin guardar'}
                          </span>
                        )}
                        {errores[c.clave] && (
                          <p className="mt-1 mb-0 text-sm text-destructive">{errores[c.clave]}</p>
                        )}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </section>
        ))}
      </div>
      {edicion && (
        <div className="sticky bottom-0 border-t border-border bg-muted/95 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-[820px] items-center gap-3 px-10">
            <Button variant="sunset" size="lg" onClick={() => void guardar()}>
              Guardar cambios
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setEdicion(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
