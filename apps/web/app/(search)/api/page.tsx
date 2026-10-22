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
import { Header } from '../../../components/brand/header';
import { Footer } from '../../../components/brand/footer';
import { CodeBlock, type Sample } from '../../../components/code-block';
import { JsonLd } from '../../../components/json-ld';
import { breadcrumbs, pageMetadata, webPage } from '../../../lib/seo';
import { siteUrl } from '../../../lib/site';

const title = 'API de Reforma Digital';
const description =
  'La API de Reforma Digital sirve de forma abierta los datos del Congreso de los Diputados: votaciones, preguntas, Diarios de Sesiones y datasets en JSON, sin autenticación y con licencia CC BY 4.0.';

export const metadata: Metadata = pageMetadata({ title, description, path: '/api', og: 'api' });

const graph = [webPage({ name: title, description, path: '/api' }), breadcrumbs('API', '/api')];

const base = new URL('/api/congreso', siteUrl).href;

function request(path: string): Sample[] {
  const url = `${base}${path}`;
  return [
    { label: 'curl', lang: 'bash', code: `curl "${url}"` },
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

type Param = [name: string, type: string, text: string, value?: string];
const listParams: Param[] = [
  ['pagina', 'entero', 'Número de página, empezando por 1.', '1'],
  ['limite', 'entero', 'Resultados por página, entre 1 y 100.', '24'],
  ['legislatura', 'texto', 'Legislatura en números romanos.', 'XV'],
  ['desde', 'fecha', 'Fecha mínima en formato AAAA-MM-DD.'],
  ['hasta', 'fecha', 'Fecha máxima en formato AAAA-MM-DD.'],
];
const search: Param = ['q', 'texto', 'Filtra por el título, hasta 200 caracteres.'];
const legislature: Param[] = [['legislatura', 'texto', 'Legislatura en números romanos.', 'XV']];

// Forma de cada respuesta según las consultas de app/api/congreso; los valores son ilustrativos.
const endpoints: {
  id: string;
  path: string;
  title: string;
  text: ReactNode;
  params?: Param[];
  request: Sample[];
  response?: Sample[];
}[] = [
  {
    id: 'indice',
    path: '',
    title: 'Obtener el índice',
    text: 'Devuelve la versión de la API, la última publicación de datos, los datasets disponibles con su hash SHA-256 y la atribución que debe acompañar a cualquier uso de los datos.',
    request: request(''),
    response: response(`{
  "version": 1,
  "atribucion": { "origen": "Escaño Abierto", "licencia": "CC BY 4.0", … },
  "publicacion": { "id": "…", "created_at": "…", "counts": { … } },
  "conjuntos": [{ "path": "leyes.json", "sha256": "…", "updated_at": "…" }],
  "endpoints": ["datasets/<ruta.json>", "votaciones", …]
}`),
  },
  {
    id: 'votaciones',
    path: '/votaciones',
    title: 'Listar votaciones',
    text: 'Devuelve las votaciones del Pleno ordenadas de la más reciente a la más antigua, con el recuento de votos de cada sentido.',
    params: [...listParams, search],
    request: request('/votaciones?q=vivienda&limite=5'),
    response: response(`{
  "pagina": 1, "limite": 5, "total": 42,
  "resultados": [{
    "id": "…", "legislature": "XV", "date": "2025-03-12",
    "title": "…", "kind": "…", "initiative": "…",
    "yes_count": 172, "no_count": 170, "abstention_count": 1,
    "absent_count": 7, "topics": […]
  }]
}`),
  },
  {
    id: 'votacion',
    path: '/votaciones/<id>',
    title: 'Obtener una votación',
    text: (
      <>
        Devuelve una votación y el voto individual de cada diputado. El campo <code>voto</code> toma
        los valores <code>S</code> (sí), <code>N</code> (no), <code>A</code> (abstención) y{' '}
        <code>X</code> (no vota).
      </>
    ),
    params: legislature,
    request: request('/votaciones/<id>'),
    response: response(`{
  "votacion": { "id": "…", "title": "…", "yes_count": 172, … },
  "votos": [{ "diputado": "…", "grupo": "…", "voto": "S" }]
}`),
  },
  {
    id: 'preguntas',
    path: '/preguntas',
    title: 'Listar preguntas',
    text: 'Devuelve las preguntas parlamentarias con su número de expediente, sus autores y su estado de tramitación.',
    params: [
      ...listParams,
      search,
      ['estado', 'texto', 'Filtra por el estado exacto de la pregunta.'],
    ],
    request: request('/preguntas?q=sanidad'),
    response: response(`{
  "pagina": 1, "limite": 24, "total": 318,
  "resultados": [{
    "exp": "…", "presentada": "2025-02-03", "titulo": "…",
    "estado": "…", "autores": [["…", "…"]]
  }]
}`),
  },
  {
    id: 'sesiones',
    path: '/sesiones',
    title: 'Listar sesiones',
    text: 'Devuelve los Diarios de Sesiones del Pleno y de las comisiones, con el número de intervenciones de cada uno.',
    params: [...listParams, ['q', 'texto', 'Filtra por el nombre del órgano.']],
    request: request('/sesiones?q=pleno&desde=2025-01-01'),
    response: response(`{
  "pagina": 1, "limite": 24, "total": 96,
  "resultados": [{
    "id": "DSCD-15-PL-1", "date": "2023-08-17",
    "organo": "Pleno", "intervenciones": 84
  }]
}`),
  },
  {
    id: 'sesion',
    path: '/sesiones/<id>',
    title: 'Obtener una sesión',
    text: (
      <>
        Devuelve una sesión con todas sus intervenciones. El identificador tiene la forma{' '}
        <code>DSCD-15-PL-1</code>, donde <code>PL</code> identifica el Pleno y <code>CO</code> las
        comisiones.
      </>
    ),
    params: legislature,
    request: request('/sesiones/DSCD-15-PL-1'),
    response: response(`{
  "id": "DSCD-15-PL-1", "fecha": "2023-08-17", "ds": "https://…",
  "intervenciones": [{ "orador": "…", "grupo": "…", "texto": "…", "item": "…" }]
}`),
  },
  {
    id: 'datasets',
    path: '/datasets/<ruta.json>',
    title: 'Obtener un dataset',
    text: (
      <>
        Devuelve uno de los archivos originales que alimentan la web, como <code>leyes.json</code>,{' '}
        <code>temas.json</code> o <code>elecciones/historico.json</code>. La lista completa de rutas
        está en el campo <code>conjuntos</code> del índice. Las respuestas incluyen{' '}
        <code>ETag</code>.
      </>
    ),
    request: request('/datasets/leyes.json'),
  },
  {
    id: 'descarga',
    path: '/descarga',
    title: 'Descargar el histórico completo',
    text: 'Devuelve el histórico completo en un único archivo .tar.gz. Es la forma recomendada de obtener todos los datos en lugar de recorrer los listados.',
    request: [{ label: 'curl', lang: 'bash', code: `curl -o congreso.tar.gz "${base}/descarga"` }],
  },
];

const errors = [
  ['400', 'Un parámetro, una ruta o un identificador no tiene un formato válido.'],
  ['404', 'El endpoint o el recurso solicitado no existe.'],
  [
    '451',
    'Las encuestas y la descarga completa no están disponibles durante el periodo de veda electoral.',
  ],
  ['502', 'El archivo de la descarga completa no está disponible en este momento.'],
  ['503', 'Los datos no están disponibles temporalmente. Reintenta más tarde.'],
];

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

const mono = 'font-mono text-[0.9em]';

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
            <TableCell className="whitespace-normal">{text}</TableCell>
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
  return (
    <>
      <JsonLd graph={graph} />
      <Header current="/api" />
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
            <h1 className="mb-6 font-heading text-[clamp(36px,4.5vw,60px)] leading-[1.1]">
              {title}
            </h1>
            <p className="mb-8 max-w-[65ch] text-lg leading-relaxed text-muted-foreground">
              La API de Reforma Digital sirve de forma abierta los datos del Congreso de los
              Diputados: las votaciones del Pleno con el voto de cada diputado, las preguntas
              parlamentarias, los Diarios de Sesiones y los datasets que alimentan la web. Es una
              API REST de solo lectura que responde en JSON.
            </p>
            <CodeBlock samples={[{ label: 'URL base', lang: 'text', code: base }]} />
          </section>

          <Doc id="autenticacion" title="Autenticación">
            <p className="text-muted-foreground">
              La API no requiere autenticación ni claves de acceso. Todas las peticiones son{' '}
              <code className={mono}>GET</code> y las respuestas incluyen{' '}
              <code className={mono}>Access-Control-Allow-Origin: *</code>, así que puede consumirse
              desde un servidor o directamente desde el navegador.
            </p>
            <CodeBlock samples={request('/votaciones?q=vivienda&limite=5')} />
          </Doc>

          <Doc id="paginacion" title="Paginación">
            <p className="text-muted-foreground">
              Los endpoints de listado se paginan con los parámetros{' '}
              <code className={mono}>pagina</code> y <code className={mono}>limite</code>. Cada
              respuesta indica la página devuelta y el número total de resultados.
            </p>
            <CodeBlock
              samples={response(`{
  "pagina": 1,
  "limite": 24,
  "total": 318,
  "resultados": [ … ]
}`)}
            />
            <p className="text-muted-foreground">
              Para recorrer un listado completo, incrementa <code className={mono}>pagina</code>{' '}
              hasta haber leído <code className={mono}>total</code> resultados.
            </p>
          </Doc>

          {endpoints.map((endpoint) => (
            <Doc key={endpoint.id} id={endpoint.id} title={endpoint.title}>
              <p className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3">
                <Badge className="font-mono">GET</Badge>
                <code className="font-mono text-sm break-all">/api/congreso{endpoint.path}</code>
              </p>
              <p className="text-muted-foreground">{endpoint.text}</p>
              {endpoint.params && (
                <>
                  <h3 className={subheading}>Parámetros de consulta</h3>
                  <Params params={endpoint.params} />
                </>
              )}
              <h3 className={subheading}>Petición</h3>
              <CodeBlock samples={endpoint.request} />
              {endpoint.response && (
                <>
                  <h3 className={subheading}>Respuesta</h3>
                  <CodeBlock samples={endpoint.response} />
                </>
              )}
            </Doc>
          ))}

          <Doc id="errores" title="Errores">
            <p className="text-muted-foreground">
              La API usa los códigos de estado HTTP habituales. Las respuestas de error incluyen un
              cuerpo <code className={mono}>{'{ "error": "…" }'}</code> que describe el motivo.
            </p>
            <Table className="my-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map(([code, text]) => (
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
              Los datasets devuelven una cabecera <code className={mono}>ETag</code> con su hash.
              Envíala en <code className={mono}>If-None-Match</code> para recibir un{' '}
              <code className={mono}>304 Not Modified</code> sin cuerpo cuando el archivo no haya
              cambiado. Guarda las respuestas en caché y, si necesitas todos los datos, usa la
              descarga completa.
            </p>
            <CodeBlock
              samples={[
                {
                  label: 'curl',
                  lang: 'bash',
                  code: `curl -H 'If-None-Match: "<sha256>"' "${base}/datasets/leyes.json"`,
                },
              ]}
            />
          </Doc>

          <Doc id="licencia" title="Licencia y atribución">
            <p className="text-muted-foreground">
              Los datos se distribuyen con licencia{' '}
              <strong className="text-foreground">CC BY 4.0</strong>, salvo las encuestas, que se
              distribuyen con <strong className="text-foreground">CC BY-SA 4.0</strong>. Cualquier
              uso debe citar la fuente que indica el campo <code className={mono}>atribucion</code>{' '}
              del índice. Los resúmenes y la clasificación por temas se generan con IA y pueden
              contener errores: los documentos oficiales del Congreso son la referencia.
            </p>
          </Doc>
        </main>
      </div>
      <Footer />
    </>
  );
}
