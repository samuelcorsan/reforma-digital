import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reforma-digital/design/ui/select';
import type { Razonamiento } from '../shared/api';
import { useEstado } from './estado';
import { Icono } from './icono';

/** Cada sugerencia pone en el compositor una petición con [huecos] que rellena la persona. */
const SUGERENCIAS = [
  {
    titulo: 'Renovar el DNI',
    texto: 'Quiero renovar mi DNI en [municipio]. Me caduca el [fecha].',
  },
  {
    titulo: 'Empadronarme',
    texto:
      'Quiero empadronarme en [municipio]. Vivo allí desde [fecha], [de alquiler / en propiedad / con familiares].',
  },
  {
    titulo: 'Descargar mi vida laboral',
    texto:
      'Quiero descargar mi informe de vida laboral. Tengo [Cl@ve / certificado digital / ninguno].',
  },
  {
    titulo: 'Pedir el paro',
    texto:
      'Quiero pedir el paro. Mi contrato terminó el [fecha] y he trabajado [tiempo] en los últimos 6 años.',
  },
];

const RAZONAMIENTO = [
  { value: 'low', label: 'Rápido' },
  { value: 'medium', label: 'Equilibrado' },
  { value: 'high', label: 'Cuidadoso' },
] satisfies { value: Razonamiento; label: string }[];

/** Cuánto piensa el asistente antes de actuar, en este trámite. */
function Razonar({
  valor,
  alCambiar,
}: {
  valor: Razonamiento;
  alCambiar: (v: Razonamiento) => void;
}) {
  return (
    <Select
      value={valor}
      items={RAZONAMIENTO}
      onValueChange={(v) => {
        if (v === 'low' || v === 'medium' || v === 'high') alCambiar(v);
      }}
    >
      {/* Dentro del compositor no hay un segundo borde (DESIGN.md §8.5). */}
      <SelectTrigger
        aria-label="Cuánto piensa antes de actuar"
        className="h-8 border-transparent text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="p-1">
        {RAZONAMIENTO.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** El campo para escribir, el mismo en el inicio y en cada trámite. */
export function Compositor({
  placeholder,
  ocupado,
  alEnviar,
  alDetener,
  razonamiento,
  alRazonar,
  borrador,
  autoFocus = false,
}: {
  placeholder: string;
  ocupado: boolean;
  alEnviar: (texto: string) => Promise<void> | void;
  alDetener?: () => void;
  razonamiento: Razonamiento;
  alRazonar: (v: Razonamiento) => void;
  /** Un texto que poner en el campo, p. ej. el de un mensaje al volver a antes de él. */
  borrador?: { texto: string } | undefined;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!borrador) return;
    setTexto(borrador.texto);
    // Deja seleccionado el primer [hueco] para escribir encima.
    requestAnimationFrame(() => {
      const hueco = /\[[^\]]*\]/.exec(borrador.texto);
      ref.current?.focus();
      if (hueco) ref.current?.setSelectionRange(hueco.index, hueco.index + hueco[0].length);
    });
  }, [borrador]);
  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      await alEnviar(t);
      setTexto('');
    } finally {
      setEnviando(false);
      ref.current?.focus();
    }
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar();
    }
  };
  return (
    <div className="rounded-[28px] bg-background focus-within:ring-1 focus-within:ring-foreground/20">
      <label className="sr-only" htmlFor="compositor">
        Mensaje para el asistente
      </label>
      <textarea
        id="compositor"
        ref={ref}
        autoFocus={autoFocus}
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={tecla}
        placeholder={placeholder}
        maxLength={4000}
        className="field-sizing-content block max-h-60 min-h-[60px] w-full resize-none bg-transparent px-5 pt-4 text-base leading-6 outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-1 px-2.5 pt-1 pb-2.5">
        <Razonar valor={razonamiento} alCambiar={alRazonar} />
        {/* Mientras trabaja, con texto se manda a la cola y sin texto se puede detener. */}
        {ocupado && alDetener && !texto.trim() ? (
          <Button
            variant="sunset"
            size="icon-lg"
            className="ml-auto rounded-full"
            aria-label="Detener al asistente"
            onClick={alDetener}
          >
            <Icono nombre="detener" />
          </Button>
        ) : (
          <Button
            variant="sunset"
            size="icon-lg"
            className="ml-auto rounded-full"
            aria-label="Enviar"
            disabled={!texto.trim() || enviando}
            onClick={() => void enviar()}
          >
            <Icono nombre="enviar" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function Inicio({ abrir }: { abrir: (id: string) => void }) {
  const { app } = useEstado();
  const [razonamiento, setRazonamiento] = useState<Razonamiento>('medium');
  const [borrador, setBorrador] = useState<{ texto: string }>();
  // El municipio de Mis datos, si está guardado, ya va puesto.
  const municipio = app?.perfil.find((d) => d.clave === 'municipio' && d.guardado)?.vista;
  // Un doble clic en un recordatorio no debe crear dos trámites.
  const creando = useRef(false);
  const crear = async (texto: string) => {
    if (creando.current) return;
    creando.current = true;
    try {
      abrir(await window.rd.crearTramite(texto, razonamiento));
    } finally {
      creando.current = false;
    }
  };
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* El atardecer de Sol, solo como luz de fondo bajo el contenido. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(60%_100%_at_50%_100%,color-mix(in_oklab,var(--brand-yellow)_16%,transparent),transparent)]"
      />
      <div className="arrastrar h-[52px] shrink-0" />
      <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-8">
        <div className="my-auto w-full max-w-[680px] py-10">
          <h1 className="m-0 mb-8 text-center font-heading text-[40px] leading-[1.1] font-normal">
            ¿Qué trámite quieres hacer?
          </h1>
          {app?.recordatorios.length ? (
            <div className="mb-3 flex flex-wrap gap-2 px-2">
              {app.recordatorios.map((r) => (
                <button
                  key={r.texto}
                  type="button"
                  onClick={() => void crear(r.sugerencia)}
                  className="flex min-h-9 items-center gap-2 rounded-full bg-[var(--warning)] px-3.5 text-left text-sm text-[var(--warning-foreground)] transition-[scale] active:scale-[0.96]"
                >
                  <Icono nombre="aviso" size={16} />
                  <span>
                    <strong className="font-medium">{r.texto}</strong> Te ayudo a renovarlo.
                  </span>
                  <Icono nombre="siguiente" size={14} />
                </button>
              ))}
            </div>
          ) : null}
          <Compositor
            autoFocus
            placeholder="Por ejemplo: quiero pedir cita para renovar el DNI en Sevilla"
            ocupado={false}
            alEnviar={crear}
            razonamiento={razonamiento}
            alRazonar={setRazonamiento}
            borrador={borrador}
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGERENCIAS.map((s) => (
              <Button
                key={s.titulo}
                variant="outline"
                size="lg"
                className="rounded-full px-3.5 text-[15px] font-normal"
                onClick={() =>
                  setBorrador({
                    texto: municipio ? s.texto.replace('[municipio]', municipio) : s.texto,
                  })
                }
              >
                {s.titulo}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
