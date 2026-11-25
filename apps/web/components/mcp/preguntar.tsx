'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@reforma-digital/design/ui/input-group';
import { Icon } from '../brand/icon';

/** Lo que responde `/api/mcp/preguntar`, con la pregunta: `servidor` es `null` si ninguno sirve. */
export type Respuesta = { pregunta: string; servidor: string | null; seguro: boolean };

/** El prompt de «Créalo con tu agente» cuando ningún servidor responde a la pregunta. */
export const crear = (pregunta: string, repo: string) =>
  `Quiero que mi asistente pueda responder «${pregunta}» con datos públicos de España. Busca la fuente oficial y abierta que los publique y crea un servidor MCP de solo lectura que la consulte, siguiendo cómo están hechos los de Reforma Digital: ${repo}/tree/main/packages/mcp. Si quieres compartirlo, proponlo como pull request en ese repositorio.`;

/** Lo que se espera tras la última tecla antes de buscar. */
const ESPERA_MS = 450;
/** Lo mínimo que se ve «Comprobando…»: el modelo tarda unos 300 ms y el efecto no se llegaría a ver. */
const MINIMO_MS = 1000;

/**
 * El buscador de la biblioteca: se escribe qué se quiere saber y un modelo de decisión dice qué
 * servidor lo responde. La respuesta filtra la lista; vaciarlo la deja entera.
 */
export function Preguntar({
  respuesta,
  onRespuesta,
}: {
  respuesta: Respuesta | undefined;
  onRespuesta: (respuesta: Respuesta | undefined) => void;
}) {
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>();
  const campo = useRef<HTMLInputElement>(null);
  const texto = pregunta.trim();

  // Busca sola cuando se deja de escribir; lo que se escribe después cancela la búsqueda en curso.
  useEffect(() => {
    if (texto.length < 3) {
      setCargando(false);
      setError(undefined);
      onRespuesta(undefined);
      return;
    }
    const control = new AbortController();
    async function buscar() {
      setCargando(true);
      // La respuesta anterior no vale para la pregunta nueva: ni mientras se comprueba ni si falla.
      onRespuesta(undefined);
      setError(undefined);
      let fallo = 'No he podido comprobarlo ahora. Prueba otra vez.';
      try {
        const minimo = new Promise((ok) => setTimeout(ok, MINIMO_MS));
        const response = await fetch('/api/mcp/preguntar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pregunta: texto }),
          signal: control.signal,
        });
        // El 429 lo da el firewall de Vercel, con su propia página: no trae nuestro JSON.
        if (response.status === 429) {
          fallo = 'Has hecho muchas preguntas seguidas. Espera un rato y vuelve a probar.';
        } else {
          const body = (await response.json()) as Omit<Respuesta, 'pregunta'> | { error: string };
          await minimo;
          if (control.signal.aborted) return;
          if (!('error' in body)) return onRespuesta({ pregunta: texto, ...body });
          fallo = body.error;
        }
      } catch {
        // Cancelada por otra búsqueda: no hay nada que decir. Sin red o sin JSON: el mensaje genérico.
        if (control.signal.aborted) return;
      } finally {
        if (!control.signal.aborted) setCargando(false);
      }
      setError(fallo);
    }
    const espera = setTimeout(() => void buscar(), ESPERA_MS);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, onRespuesta]);

  const nota =
    error ?? (respuesta?.servidor && !respuesta.seguro && 'Puede que lo responda este servidor.');

  return (
    // Enter no hace falta: la búsqueda ya va sola.
    <form onSubmit={(e) => e.preventDefault()} className="mt-12">
      <label htmlFor="pregunta-mcp" className="sr-only">
        ¿Qué quieres saber? Te decimos qué servidor lo responde
      </label>
      <InputGroup
        className={cn('h-11 rounded-full bg-background pr-1.5 pl-1.5', cargando && 'comprobando')}
      >
        <InputGroupAddon>
          <Icon name="chispa" size={16} />
        </InputGroupAddon>
        <InputGroupInput
          ref={campo}
          id="pregunta-mcp"
          type="search"
          enterKeyHint="search"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Escribe qué quieres saber y te decimos qué servidor lo responde"
          maxLength={300}
          autoComplete="off"
          aria-describedby={nota ? 'pregunta-mcp-nota' : undefined}
          className="text-15 [&::-webkit-search-cancel-button]:hidden"
        />
        <InputGroupAddon align="inline-end">
          {cargando ? (
            <span className="pr-2 text-sm text-muted-foreground">Comprobando…</span>
          ) : (
            pregunta && (
              <InputGroupButton
                size="icon-xs"
                aria-label="Borrar la pregunta"
                onClick={() => {
                  setPregunta('');
                  // El botón desaparece al vaciar: el foco vuelve al campo, no al principio de la página.
                  campo.current?.focus();
                }}
                className="rounded-full"
              >
                <Icon name="nunca" size={14} />
              </InputGroupButton>
            )
          )}
        </InputGroupAddon>
      </InputGroup>
      <p
        id="pregunta-mcp-nota"
        aria-live="polite"
        className="mt-2 min-h-5 px-4 text-sm text-muted-foreground"
      >
        {nota}
      </p>
    </form>
  );
}
