import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@reforma-digital/design/ui/button-link';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import { cn } from '@reforma-digital/design/lib/utils';
import { Header } from '../../../../../components/brand/header';
import { Footer } from '../../../../../components/brand/footer';
import { Icon } from '../../../../../components/brand/icon';
import { CodeBlock, type Sample } from '../../../../../components/code-block';
import { JsonLd } from '../../../../../components/json-ld';
import { ServerLogo } from '../../../../../components/mcp/logo';
import { Texto } from '../../../../../components/developers/texto';
import { InstinctButton, OnboardButton } from '../../../../../components/mcp/onboard';
import { serverIds, servers, type McpServer, type Tool } from '../../../../../lib/mcp/catalog';
import { agentPrompt, endpoint, fichaPath, instinctPrompt } from '../../../../../lib/mcp/rutas';
import { pageMetadata, webPage } from '../../../../../lib/seo';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return serverIds.map((id) => ({ id }));
}

async function find(params: Props['params']) {
  const { id } = await params;
  const server = (await servers()).find((s) => s.id === id);
  if (!server) notFound();
  return server;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = await find(params);
  return pageMetadata({
    title: `${server.name} · Biblioteca MCP`,
    description: `Servidor MCP: ${server.summary} Conéctalo a Claude, ChatGPT, Cursor o VS Code.`,
    path: fichaPath(server.id),
    og: 'mcp',
  });
}

const mono = 'font-mono text-em-90';

const focus =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="mt-12 border-t border-border pt-10"
    >
      <h2 id={`${id}-titulo`} className="mb-5 font-heading text-3xl leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToolItem({ tool }: { tool: Tool }) {
  return (
    <Collapsible className="rounded-2xl border border-border">
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left hover:bg-muted/60',
          focus,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{tool.title}</span>
          <code className="block truncate font-mono text-xs text-muted-foreground">
            {tool.name}
          </code>
        </span>
        {tool.params.length > 0 && (
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {tool.params.length} {tool.params.length === 1 ? 'parámetro' : 'parámetros'}
          </span>
        )}
        <span className="transition-transform duration-150 group-data-panel-open:rotate-90 motion-reduce:transition-none">
          <Icon name="derecha" size={16} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pb-5">
        <p className="text-muted-foreground">
          <Texto text={tool.description} />
        </p>
        {tool.params.length > 0 ? (
          // Una fila por parámetro: nombre y tipo a la izquierda, qué es y su valor por defecto a la
          // derecha. Sin cabecera de tabla ni líneas negras: separa una línea fina.
          <dl className="mt-4 divide-y divide-border rounded-xl bg-muted/60">
            {tool.params.map((param) => (
              <div
                key={param.name}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <code className="font-mono text-sm">{param.name}</code>
                  <span className="text-xs text-muted-foreground">
                    {param.type}
                    {param.required && ', obligatorio'}
                  </span>
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {param.description && <Texto text={param.description} />}
                  {param.default && (
                    <span className="mt-0.5 block text-xs">
                      Por defecto <code className={mono}>{param.default}</code>
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No necesita parámetros.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Connect({ server }: { server: McpServer }) {
  const url = endpoint(server.id);
  const name = server.id;
  const cursor = `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${encodeURIComponent(
    Buffer.from(JSON.stringify({ url })).toString('base64'),
  )}`;
  const vscode = `vscode:mcp/install?${encodeURIComponent(
    JSON.stringify({ name, type: 'http', url }),
  )}`;
  const samples: Sample[] = [
    { label: 'Claude Code', lang: 'bash', code: `claude mcp add --transport http ${name} ${url}` },
    { label: 'Codex', lang: 'bash', code: `codex mcp add ${name} --url ${url}` },
    {
      label: 'Cursor',
      lang: 'json',
      code: JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2),
    },
    {
      label: 'VS Code',
      lang: 'json',
      code: JSON.stringify({ servers: { [name]: { type: 'http', url } } }, null, 2),
    },
  ];
  const via = 'mb-4 font-medium';

  // Dos vías separadas: la frase de «Conecta tu agente» apunta a la guía en Markdown, y quien la
  // pegaba como conector en Claude.ai acababa con la URL de la guía en vez de la del servidor.
  return (
    <section aria-labelledby="conectar-titulo" className="mt-12">
      <h2 id="conectar-titulo" className="sr-only">
        Conectar
      </h2>
      <h3 className={via}>Claude Code, Codex, Cursor, VS Code o Instinct</h3>
      <div className="flex flex-wrap gap-2">
        <OnboardButton
          prompt={agentPrompt(
            fichaPath(server.id),
            `el servidor MCP «${server.name}» de Reforma Digital`,
          )}
        />
        <InstinctButton prompt={instinctPrompt()} />
        <ButtonLink href={cursor} variant="outline" size="xl">
          Añadir a Cursor
        </ButtonLink>
        <ButtonLink href={vscode} variant="outline" size="xl">
          Añadir a VS Code
        </ButtonLink>
      </div>
      <CodeBlock samples={samples} />

      <h3 className={cn(via, 'mt-10')}>Claude.ai o ChatGPT (web)</h3>
      <p className="max-w-[65ch] text-muted-foreground">
        Añádelo como conector personalizado, sin autenticación, con esta URL: en Claude.ai, desde
        Ajustes → Conectores; en ChatGPT, con el modo desarrollador activado. La frase de «Conecta
        tu agente» no sirve aquí.
      </p>
      <CodeBlock samples={[{ label: 'URL del conector', lang: 'text', code: url }]} />
    </section>
  );
}

export default async function Page({ params }: Props) {
  const server = await find(params);
  const path = fichaPath(server.id);

  return (
    <>
      <JsonLd graph={[webPage({ name: server.name, description: server.summary, path })]} />
      <Header current="/developers" />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-(--container-content) px-(--page-gutter) pt-12 pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-16"
      >
        <div className="min-w-0">
          <nav aria-label="Migas de pan" className="mb-10 text-sm">
            <Link href="/developers/mcp" className="text-muted-foreground hover:text-foreground">
              Biblioteca MCP
            </Link>
            <span aria-hidden="true" className="mx-2 text-muted-foreground">
              /
            </span>
            <span aria-current="page">{server.name}</span>
          </nav>
          <div className="flex items-center gap-4">
            <ServerLogo logo={server.logo} size="lg" />
            <h1 className="min-w-0 font-heading text-fluid-30-44 leading-1.1">{server.name}</h1>
          </div>
          <p className="mt-5 max-w-[65ch] text-lg leading-relaxed text-muted-foreground">
            {server.summary}
          </p>
        </div>

        {/* En escritorio se queda fija a la derecha mientras baja el resto. */}
        <div className="mt-10 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-start">
          <Image
            src={server.escena}
            alt=""
            // Tal cual se exportó (3x): el optimizador la recomprime y emborrona el texto.
            unoptimized
            className="mx-auto h-auto w-full max-w-[520px]"
          />
        </div>

        <div className="min-w-0 lg:col-start-1">
          <Connect server={server} />

          <Section id="herramientas" title="Herramientas">
            <div className="grid gap-3">
              {server.tools.map((tool) => (
                <ToolItem key={tool.name} tool={tool} />
              ))}
            </div>
          </Section>

          {server.examples.length > 0 && (
            <Section id="ejemplos" title="Prueba a preguntar">
              <ul className="grid gap-3">
                {server.examples.map((example) => (
                  <li key={example} className="rounded-2xl bg-muted px-5 py-4">
                    «{example}»
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
