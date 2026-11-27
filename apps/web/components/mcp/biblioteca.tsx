'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { fichaPath } from '../../lib/mcp/rutas';
import type { McpServer } from '../../lib/mcp/catalog';
import { ServerLogo } from './logo';
import { OnboardButton } from './onboard';
import { crear, Preguntar, type Respuesta } from './preguntar';

export type Summary = {
  id: string;
  name: string;
  summary: string;
  logo: McpServer['logo'];
  tools: number;
};

export const orders = {
  destacados: 'Destacados',
  az: 'A–Z',
  herramientas: 'Más herramientas',
} as const;
export type Order = keyof typeof orders;

const focus =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground';

function Row({ server, position }: { server: Summary; position: number }) {
  return (
    <li className="border-b border-border">
      <Link
        href={fichaPath(server.id)}
        className={cn(
          'grid grid-cols-[24px_36px_minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-3.5 no-underline transition-colors duration-150 hover:bg-muted/60 motion-reduce:transition-none sm:grid-cols-[40px_36px_minmax(0,1fr)_auto] sm:gap-x-4',
          focus,
        )}
      >
        <span className="font-mono text-sm text-muted-foreground tabular-nums">{position}</span>
        <ServerLogo logo={server.logo} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{server.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{server.summary}</span>
        </span>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {server.tools}
          <span className="sr-only"> herramientas</span>
        </span>
      </Link>
    </li>
  );
}

// Sin filtro de categorías mientras haya pocos servidores: el buscador por pregunta, que deja el
// servidor que la responde, la lista y su orden.
export function Biblioteca({
  servers,
  initial,
  repo,
  children,
}: {
  servers: Summary[];
  initial: Order;
  /** El repositorio, para el prompt de «Créalo con tu agente». */
  repo: string;
  /** Titular y entradilla, encima de la lista. */
  children: ReactNode;
}) {
  const [order, setOrder] = useState<Order>(initial);
  const [respuesta, setRespuesta] = useState<Respuesta>();

  // El orden vive en la URL para poder compartirlo, sin volver a pedir la página.
  const sort = (next: Order) => {
    setOrder(next);
    const search = next === 'destacados' ? '' : `?orden=${next}`;
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  };

  const shown = respuesta ? servers.filter((s) => s.id === respuesta.servidor) : [...servers];
  if (order === 'az') shown.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (order === 'herramientas') shown.sort((a, b) => b.tools - a.tools);

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-[960px] px-(--page-gutter) pt-16 pb-24">
      <div className="text-center">{children}</div>

      <Preguntar respuesta={respuesta} onRespuesta={setRespuesta} />

      <div className="mt-2 flex items-end justify-between gap-4 border-b border-border">
        <div role="group" aria-label="Ordenar" className="flex gap-5">
          {(Object.keys(orders) as Order[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={order === key}
              onClick={() => sort(key)}
              className={cn(
                'relative -mb-px border-b-2 border-transparent py-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground aria-pressed:border-foreground aria-pressed:text-foreground motion-reduce:transition-none',
                focus,
              )}
            >
              {orders[key]}
            </button>
          ))}
        </div>
        <p
          aria-live="polite"
          className="py-2.5 text-sm whitespace-nowrap text-muted-foreground max-sm:sr-only"
        >
          {shown.length} {shown.length === 1 ? 'servidor' : 'servidores'}
        </p>
      </div>

      <ol>
        {shown.map((server, i) => (
          <Row key={server.id} server={server} position={i + 1} />
        ))}
      </ol>

      {respuesta && !shown.length && (
        <div className="py-14 text-center">
          <p className="font-medium">
            {respuesta.seguro ? 'Ningún servidor' : 'Parece que ningún servidor'} responde a eso
            todavía
          </p>
          <p className="mt-1 text-sm text-balance text-muted-foreground">
            Tu agente puede crear el que falta y proponerlo a la biblioteca.
          </p>
          <OnboardButton
            key={respuesta.pregunta}
            prompt={crear(respuesta.pregunta, repo)}
            label="Créalo con tu agente"
            title="Copia un prompt para que tu agente cree el servidor MCP que falta"
            className="mt-6"
          />
        </div>
      )}
    </main>
  );
}
