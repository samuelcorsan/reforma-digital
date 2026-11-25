import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Badge } from '@reforma-digital/design/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reforma-digital/design/ui/table';
import { Header } from '../../../../components/brand/header';
import { Footer } from '../../../../components/brand/footer';
import { CodeBlock, type Sample } from '../../../../components/code-block';
import { JsonLd } from '../../../../components/json-ld';
import { breadcrumbs, pageMetadata, webPage } from '../../../../lib/seo';
import {
  apiBase,
  auth,
  cache,
  curl,
  description,
  endpoints,
  errors,
  intro,
  license,
  pagination,
  title,
  type Endpoint,
  type Param,
} from '../../../../lib/developers/api';
import { Texto } from '../../../../components/developers/texto';

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: '/developers/api',
  og: 'api',
});

const graph = [
  webPage({ name: title, description, path: '/developers/api' }),
  breadcrumbs('API', '/developers/api'),
];

function request(endpoint: Endpoint): Sample[] {
  const url = `${apiBase}${endpoint.example}`;
  if (endpoint.download) return [{ label: 'curl', lang: 'bash', code: curl(endpoint) }];
  return [
    { label: 'curl', lang: 'bash', code: curl(endpoint) },
    {
      label: 'JavaScript',
      lang: 'javascript',
      code: `const res = await fetch('${url}');\nconst datos = await res.json();`,
    },
    {
      label: 'Python',
      lang: 'python',
      code: `import requests\n\ndatos = requests.get('${url}').json()`,
    },
  ];
}

const response = (code: string): Sample[] => [{ label: 'Respuesta 200', lang: 'json', code }];

const nav = [
  [
    'Empezar',
    [
      ['introduccion', 'Introducción'],
      ['autenticacion', 'Autenticación'],
      ['paginacion', 'Paginación'],
    ],
  ],
  ['Endpoints', endpoints.map(({ id, title }) => [id, title])],
  [
    'Referencia',
    [
      ['errores', 'Errores'],
      ['cache', 'Caché'],
      ['licencia', 'Licencia y atribución'],
    ],
  ],
] as const;

const mono = 'font-mono text-em-90';

function Params({ params }: { params: Param[] }) {
  return (
    <Table className="my-4">
      <TableHeader>
        <TableRow>
          <TableHead>Parámetro</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Por defecto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.map(([name, type, text, value]) => (
          <TableRow key={name}>
            <TableCell>
              <code className={mono}>{name}</code>{' '}
              <span className="text-xs text-muted-foreground">{type}</span>
            </TableCell>
            <TableCell className="whitespace-normal">
              <Texto text={text} />
            </TableCell>
            <TableCell>{value ? <code className={mono}>{value}</code> : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const subheading = 'mt-8 mb-3 text-sm font-semibold';

function Doc({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-12">
      <h2 className="mb-4 font-heading text-3xl leading-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function Api() {
  const votaciones = endpoints.find(({ id }) => id === 'votaciones');
  return (
    <>
      <JsonLd graph={graph} />
      <Header current="/developers" />
      <div className="mx-auto max-w-(--container-content) px-(--page-gutter) min-[1100px]:grid min-[1100px]:grid-cols-[232px_minmax(0,1fr)] min-[1100px]:gap-x-12">
        <nav
          aria-label="Documentación de la API"
          className="sticky top-6 hidden self-start py-16 min-[1100px]:block"
        >
          {nav.map(([group, links]) => (
            <div key={group} className="mb-6">
              <p className="mb-2 px-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <ul className="grid gap-0.5">
                {links.map(([id, text]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="block rounded-lg px-3 py-1.5 text-sm no-underline hover:bg-muted"
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 max-w-[820px] pt-16 pb-20">
          <section id="introduccion" className="scroll-mt-24 pb-12">
            <h1 className="mb-6 font-heading text-fluid-36-60 leading-1.1">{title}</h1>
            <p className="mb-8 max-w-[65ch] text-lg leading-relaxed text-muted-foreground">
              {intro}
            </p>
            <CodeBlock samples={[{ label: 'URL base', lang: 'text', code: apiBase }]} />
          </section>

          <Doc id="autenticacion" title="Autenticación">
            <p className="text-muted-foreground">
              <Texto text={auth} />
            </p>
            {votaciones && <CodeBlock samples={request(votaciones)} />}
          </Doc>

          <Doc id="paginacion" title="Paginación">
            <p className="text-muted-foreground">
              <Texto text={pagination.text} />
            </p>
            <CodeBlock samples={response(pagination.example)} />
            <p className="text-muted-foreground">
              <Texto text={pagination.after} />
            </p>
          </Doc>

          {endpoints.map((endpoint) => (
            <Doc key={endpoint.id} id={endpoint.id} title={endpoint.title}>
              <p className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3">
                <Badge className="font-mono">GET</Badge>
                <code className="font-mono text-sm break-all">/api/congreso{endpoint.path}</code>
              </p>
              <p className="text-muted-foreground">
                <Texto text={endpoint.text} />
              </p>
              {endpoint.params && (
                <>
                  <h3 className={subheading}>Parámetros de consulta</h3>
                  <Params params={endpoint.params} />
                </>
              )}
              <h3 className={subheading}>Petición</h3>
              <CodeBlock samples={request(endpoint)} />
              {endpoint.response && (
                <>
                  <h3 className={subheading}>Respuesta</h3>
                  <CodeBlock samples={response(endpoint.response)} />
                </>
              )}
            </Doc>
          ))}

          <Doc id="errores" title="Errores">
            <p className="text-muted-foreground">
              <Texto text={errors.text} />
            </p>
            <Table className="my-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.codes.map(([code, text]) => (
                  <TableRow key={code}>
                    <TableCell>
                      <code className={mono}>{code}</code>
                    </TableCell>
                    <TableCell className="whitespace-normal">{text}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Doc>

          <Doc id="cache" title="Caché">
            <p className="text-muted-foreground">
              <Texto text={cache.text} />
            </p>
            <CodeBlock samples={[{ label: 'curl', lang: 'bash', code: cache.example }]} />
          </Doc>

          <Doc id="licencia" title="Licencia y atribución">
            <p className="text-muted-foreground">
              <Texto text={license} />
            </p>
          </Doc>
        </main>
      </div>
      <Footer />
    </>
  );
}
