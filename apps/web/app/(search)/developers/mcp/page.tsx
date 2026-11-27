import type { Metadata } from 'next';
import { Header } from '../../../../components/brand/header';
import { Footer } from '../../../../components/brand/footer';
import { JsonLd } from '../../../../components/json-ld';
import {
  Biblioteca,
  orders,
  type Order,
  type Summary,
} from '../../../../components/mcp/biblioteca';
import { InstinctButton, OnboardButton } from '../../../../components/mcp/onboard';
import { servers } from '../../../../lib/mcp/catalog';
import { agentPrompt, instinctPrompt } from '../../../../lib/mcp/rutas';
import { links } from '../../../../lib/site';
import { breadcrumbs, pageMetadata, webPage } from '../../../../lib/seo';

const title = 'Biblioteca MCP';
const description =
  'Servidores MCP de Reforma Digital para conectar Claude, ChatGPT, Cursor o VS Code con datos públicos de España: el Congreso, Renfe y más. Sin claves y de solo lectura.';

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: '/developers/mcp',
  og: 'mcp',
});

const graph = [
  webPage({ name: title, description, path: '/developers/mcp' }),
  breadcrumbs(title, '/developers/mcp'),
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

export default async function Page({ searchParams }: Props) {
  const all = await servers();
  const params = await searchParams;
  const orden = one(params.orden);

  const summaries: Summary[] = all.map((server) => ({
    id: server.id,
    name: server.name,
    summary: server.summary,
    logo: server.logo,
    ambito: server.ambito,
    tools: server.tools.length,
  }));

  return (
    <>
      <JsonLd graph={graph} />
      <Header current="/developers" />
      <Biblioteca
        servers={summaries}
        initial={Object.hasOwn(orders, orden) ? (orden as Order) : 'destacados'}
        repo={links.repo}
      >
        <h1 className="mx-auto max-w-[16ch] text-balance font-heading text-fluid-40-72 leading-1.05">
          Datos públicos para tu asistente
        </h1>
        <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-balance text-muted-foreground">
          Servidores MCP para que tu asistente consulte por su cuenta datos públicos de España.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <OnboardButton prompt={agentPrompt('/developers/mcp')} />
          <InstinctButton prompt={instinctPrompt()} />
        </div>
      </Biblioteca>
      <Footer />
    </>
  );
}
