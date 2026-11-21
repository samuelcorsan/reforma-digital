'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Button } from '@reforma-digital/design/ui/button';

import { Icon } from './brand/icon';
import { links } from '../lib/site';

/**
 * Por ahora es una plantilla: mete el problema en un mensaje con el contexto del repositorio.
 * Cuando haya IA, se sustituye por la llamada al modelo y la interfaz no cambia.
 */
function componerPrompt(problema: string) {
  return `Quiero ayudar a resolver un problema en Reforma Digital (${links.repo}).

## El problema
${problema}

## Cómo trabajar
1. Clona el repositorio y lee AGENTS.md, CONTRIBUTING.md y, si hay interfaz, DESIGN.md antes de tocar nada.
2. Averigua dónde ocurre: las adaptaciones de cada sede van en sites/<portal>, lo compartido en packages/ y la composición en apps/.
3. Antes de escribir código, explícame la causa y propónme un plan corto. Pregúntame solo lo que cambie el enfoque.
4. Implementa lo mínimo que lo resuelva, reutilizando los componentes y tokens que ya existen.
5. Verifica con pnpm check y, si cambia el comportamiento en el navegador, con pnpm test:e2e.
6. Abre una PR con el título «type(scope): resultado concreto» y la descripción en español, siguiendo la plantilla. No incluyas datos personales.`;
}

type Estado = 'escribiendo' | 'copiado' | 'error';

// Ejemplos de lo que cubre el proyecto (la extensión en sus cuatro sedes, El Congreso y los MCP), uno
// por tipo de comentario: algo que falla, algo que no se entiende, una pantalla sin adaptar y una idea.
const ejemplos = [
  'En la cita de Extranjería de Barcelona, el buscador no encuentra la toma de huellas…',
  'Querría que la extensión también me guiara en la pantalla de datos personales de Extranjería…',
  'En la cita del DNI no sé qué es el número de soporte ni dónde lo encuentro…',
  'En el catálogo de Hacienda busco «renta» y no me sale la cita que necesito…',
  'Querría que El Congreso me avisara cuando se vote una ley sobre vivienda…',
  'Querría un servidor MCP de la AEMET para preguntarle a mi agente por los avisos de mi zona…',
];

export function PromptComposer() {
  const [problema, setProblema] = useState('');
  const [estado, setEstado] = useState<Estado>('escribiendo');
  // El ejemplo que se ve y el que se está yendo, que sale a la vez que entra el nuevo.
  const [ejemplo, setEjemplo] = useState({ actual: 0, anterior: -1 });
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const vacio = !problema.trim();

  // Los ejemplos rotan mientras el campo está vacío; con movimiento reducido se queda el primero.
  useEffect(() => {
    if (problema || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const intervalo = setInterval(
      () =>
        setEjemplo(({ actual }) => ({ actual: (actual + 1) % ejemplos.length, anterior: actual })),
      3400,
    );
    return () => clearInterval(intervalo);
  }, [problema]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vacio) return;
    clearTimeout(temporizador.current);
    // Se copia sin esperar a nada: Safari solo deja escribir en el portapapeles durante el gesto.
    try {
      await navigator.clipboard.writeText(componerPrompt(problema.trim()));
      setEstado('copiado');
      temporizador.current = setTimeout(() => setEstado('escribiendo'), 4000);
    } catch {
      setEstado('error');
    }
  }

  return (
    <div className="grid justify-items-center gap-5">
      {/* Como el de Cursor: una pieza con borde fino, el texto arriba y, abajo a la derecha, el botón
        redondo de enviar. Al copiar, el atardecer cubre la pieza con el aviso. */}
      <form
        onSubmit={(event) => void enviar(event)}
        data-copiado={estado === 'copiado' || undefined}
        className="relative w-full overflow-hidden rounded-[20px] border border-border bg-background text-left transition-colors hover:border-foreground/25 has-focus-visible:border-foreground/50 data-copiado:border-transparent data-copiado:[background:var(--brand-gradient)]"
      >
        {estado === 'copiado' && (
          // Lo anuncia el aviso oculto de abajo. Deja pasar el clic al texto y se quita al escribir.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-4 px-6 text-background [background:var(--brand-gradient)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.98] motion-safe:duration-300"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-background text-brand motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:delay-100 motion-safe:duration-300 motion-safe:fill-mode-both">
              <Icon name="hecho" size={24} />
            </span>
            <span className="grid gap-0.5 text-left">
              <span className="font-heading text-[clamp(20px,2.4vw,26px)] leading-tight">
                ¡Copiado en tu portapapeles!
              </span>
              <span className="text-base text-background/85">
                Pégalo en tu agente para empezar.
              </span>
            </span>
          </div>
        )}
        <label htmlFor="pc-problema" className="sr-only">
          Explica qué problema has tenido o qué querrías que hubiera
        </label>
        {!problema && (
          // Hace de placeholder, que el nativo no se puede animar: como en QuiverAI, palabra a
          // palabra, el ejemplo viejo sube y se desenfoca mientras el nuevo entra desde abajo.
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-4">
            {ejemplos.map((texto, i) =>
              i === ejemplo.actual ? (
                <Ejemplo key={`entra-${i}`} texto={texto} />
              ) : i === ejemplo.anterior ? (
                <Ejemplo key={`sale-${i}`} texto={texto} sale />
              ) : null,
            )}
          </div>
        )}
        <textarea
          id="pc-problema"
          value={problema}
          onChange={(event) => {
            setProblema(event.target.value);
            setEstado('escribiendo');
          }}
          onKeyDown={(event) => {
            // Intro envía y Mayús + Intro salta de línea; durante la composición de acentos, no.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={2000}
          rows={2}
          className="relative block field-sizing-content max-h-72 min-h-[calc(2lh+20px)] w-full max-sm:min-h-[calc(3lh+20px)] resize-none bg-transparent px-4 pt-4 pb-1 text-base leading-normal outline-none"
        />
        <div className="flex items-center justify-between gap-3 pt-1 pr-3 pb-3 pl-4">
          <p aria-live="polite" className="m-0 min-w-0 text-sm">
            {estado === 'copiado' && (
              <span className="sr-only">¡Copiado en tu portapapeles! Pégalo en tu agente.</span>
            )}
            {estado === 'error' && (
              <span className="inline-flex items-center gap-2 text-(--text-secondary)">
                <Icon name="aviso" size={16} />
                Tu navegador no ha dejado copiar. Revisa el permiso del portapapeles.
              </span>
            )}
          </p>
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            disabled={vacio}
            aria-label="Copiar el mensaje para tu agente"
          >
            <Icon name="enviar" size={16} />
          </Button>
        </div>
      </form>
      {/* Mientras se ve el aviso de copiado, el enlace se oculta (sin mover nada) para no competir. */}
      <a
        href={`${links.repo}/issues/new`}
        className={cn(
          'flex min-h-11 w-fit items-center gap-2 underline underline-offset-[0.25em]',
          estado === 'copiado' && 'invisible',
        )}
      >
        Abrir una issue <Icon name="externo" size={16} />
      </a>
    </div>
  );
}

// Los tiempos de QuiverAI: entra en 720 ms desde 8 px más abajo y sale en 480 ms subiendo 6 px,
// las dos con 5 px de desenfoque, y las palabras se escalonan a lo largo de 320 ms.
const entra =
  'motion-safe:animate-in fade-in-0 blur-in-[5px] slide-in-from-bottom-2 duration-720 fill-mode-both';
const sale =
  'motion-safe:animate-out fade-out-0 blur-out-[5px] slide-out-to-top-[6px] duration-480 fill-mode-both';

function Ejemplo({ texto, sale: saliendo }: { texto: string; sale?: boolean }) {
  const palabras = texto.split(' ');
  const paso = 320 / Math.max(palabras.length - 1, 1);
  return (
    // El que sale se superpone al que entra.
    <p
      className={cn(
        'm-0 text-base leading-normal text-muted-foreground',
        saliendo && 'absolute inset-0',
      )}
    >
      {palabras.map((palabra, i) => (
        <span
          key={i}
          className={cn(
            'inline-block whitespace-pre ease-[cubic-bezier(.22,1,.36,1)]',
            saliendo ? sale : entra,
          )}
          style={{ animationDelay: `${Math.round(i * paso)}ms` }}
        >
          {i < palabras.length - 1 ? `${palabra} ` : palabra}
        </span>
      ))}
    </p>
  );
}
