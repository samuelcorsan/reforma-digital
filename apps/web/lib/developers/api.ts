// La documentación de la API del Congreso, como datos: la página /developers/api y su versión en
// Markdown (/developers/api.md) salen de aquí. Los textos marcan el código con `comillas invertidas`
// y el énfasis con **asteriscos**, como en Markdown.
import { siteUrl } from '../site';

export const title = 'API de Reforma Digital';
export const description =
  'La API de Reforma Digital sirve de forma abierta los datos del Congreso de los Diputados: votaciones, preguntas, Diarios de Sesiones y datasets en JSON, sin autenticación y con licencia CC BY 4.0.';

export const apiBase = new URL('/api/congreso', siteUrl).href;

export const intro =
  'La API de Reforma Digital sirve de forma abierta los datos del Congreso de los Diputados: las votaciones del Pleno con el voto de cada diputado, las preguntas parlamentarias, los Diarios de Sesiones y los datasets que alimentan la web. Es una API REST de solo lectura que responde en JSON.';

export const auth =
  'La API no requiere autenticación ni claves de acceso. Todas las peticiones son `GET` y las respuestas incluyen `Access-Control-Allow-Origin: *`, así que puede consumirse desde un servidor o directamente desde el navegador.';

export const pagination = {
  text: 'Los endpoints de listado se paginan con los parámetros `pagina` y `limite`. Cada respuesta indica la página devuelta y el número total de resultados.',
  example: `{
  "pagina": 1,
  "limite": 24,
  "total": 318,
  "resultados": [ … ]
}`,
  after:
    'Para recorrer un listado completo, incrementa `pagina` hasta haber leído `total` resultados.',
};

/** [nombre, tipo, descripción, valor por defecto] */
export type Param = [name: string, type: string, text: string, value?: string];
const listParams: Param[] = [
  ['pagina', 'entero', 'Número de página, empezando por 1.', '1'],
  ['limite', 'entero', 'Resultados por página, entre 1 y 100.', '24'],
  ['legislatura', 'texto', 'Legislatura en números romanos.', 'XV'],
  ['desde', 'fecha', 'Fecha mínima en formato AAAA-MM-DD.'],
  ['hasta', 'fecha', 'Fecha máxima en formato AAAA-MM-DD.'],
];
const search: Param = ['q', 'texto', 'Filtra por el título, hasta 200 caracteres.'];
const legislature: Param[] = [['legislatura', 'texto', 'Legislatura en números romanos.', 'XV']];

export type Endpoint = {
  id: string;
  path: string;
  title: string;
  /** Nombre y una línea para el menú «Desarrolladores» de la cabecera. */
  menu?: { label: string; text: string };
  text: string;
  params?: Param[];
  /** Ruta y consulta de ejemplo, tras la URL base. */
  example: string;
  /** Se descarga a un archivo en vez de leerse como JSON. */
  download?: string;
  response?: string;
};

// Forma de cada respuesta según las consultas de app/api/congreso; los valores son ilustrativos.
export const endpoints: Endpoint[] = [
  {
    id: 'indice',
    path: '',
    title: 'Obtener el índice',
    text: 'Devuelve la versión de la API, la última publicación de datos, los datasets disponibles con su hash SHA-256 y la atribución que debe acompañar a cualquier uso de los datos.',
    example: '',
    response: `{
  "version": 1,
  "atribucion": { "origen": "Escaño Abierto", "licencia": "CC BY 4.0", … },
  "publicacion": { "id": "…", "created_at": "…", "counts": { … } },
  "conjuntos": [{ "path": "leyes.json", "sha256": "…", "updated_at": "…" }],
  "endpoints": ["datasets/<ruta.json>", "votaciones", …]
}`,
  },
  {
    id: 'votaciones',
    path: '/votaciones',
    title: 'Listar votaciones',
    menu: { label: 'Votaciones', text: 'Votaciones del Pleno con el voto de cada diputado.' },
    text: 'Devuelve las votaciones del Pleno ordenadas de la más reciente a la más antigua, con el recuento de votos de cada sentido.',
    params: [...listParams, search],
    example: '/votaciones?q=vivienda&limite=5',
    response: `{
  "pagina": 1, "limite": 5, "total": 42,
  "resultados": [{
    "id": "…", "legislature": "XV", "date": "2025-03-12",
    "title": "…", "kind": "…", "initiative": "…",
    "yes_count": 172, "no_count": 170, "abstention_count": 1,
    "absent_count": 7, "topics": […]
  }]
}`,
  },
  {
    id: 'votacion',
    path: '/votaciones/<id>',
    title: 'Obtener una votación',
    text: 'Devuelve una votación y el voto individual de cada diputado. El campo `voto` toma los valores `S` (sí), `N` (no), `A` (abstención) y `X` (no vota).',
    params: legislature,
    example: '/votaciones/<id>',
    response: `{
  "votacion": { "id": "…", "title": "…", "yes_count": 172, … },
  "votos": [{ "diputado": "…", "grupo": "…", "voto": "S" }]
}`,
  },
  {
    id: 'preguntas',
    path: '/preguntas',
    title: 'Listar preguntas',
    menu: { label: 'Preguntas', text: 'Preguntas parlamentarias, sus autores y su estado.' },
    text: 'Devuelve las preguntas parlamentarias con su número de expediente, sus autores y su estado de tramitación.',
    params: [
      ...listParams,
      search,
      ['estado', 'texto', 'Filtra por el estado exacto de la pregunta.'],
    ],
    example: '/preguntas?q=sanidad',
    response: `{
  "pagina": 1, "limite": 24, "total": 318,
  "resultados": [{
    "exp": "…", "presentada": "2025-02-03", "titulo": "…",
    "estado": "…", "autores": [["…", "…"]]
  }]
}`,
  },
  {
    id: 'sesiones',
    path: '/sesiones',
    title: 'Listar sesiones',
    menu: { label: 'Sesiones', text: 'Diarios de Sesiones del Pleno y las comisiones.' },
    text: 'Devuelve los Diarios de Sesiones del Pleno y de las comisiones, con el número de intervenciones de cada uno.',
    params: [...listParams, ['q', 'texto', 'Filtra por el nombre del órgano.']],
    example: '/sesiones?q=pleno&desde=2025-01-01',
    response: `{
  "pagina": 1, "limite": 24, "total": 96,
  "resultados": [{
    "id": "DSCD-15-PL-1", "date": "2023-08-17",
    "organo": "Pleno", "intervenciones": 84
  }]
}`,
  },
  {
    id: 'sesion',
    path: '/sesiones/<id>',
    title: 'Obtener una sesión',
    text: 'Devuelve una sesión con todas sus intervenciones. El identificador tiene la forma `DSCD-15-PL-1`, donde `PL` identifica el Pleno y `CO` las comisiones.',
    params: legislature,
    example: '/sesiones/DSCD-15-PL-1',
    response: `{
  "id": "DSCD-15-PL-1", "fecha": "2023-08-17", "ds": "https://…",
  "intervenciones": [{ "orador": "…", "grupo": "…", "texto": "…", "item": "…" }]
}`,
  },
  {
    id: 'datasets',
    path: '/datasets/<ruta.json>',
    title: 'Obtener un dataset',
    menu: { label: 'Datasets', text: 'Los archivos originales que alimentan la web.' },
    text: 'Devuelve uno de los archivos originales que alimentan la web, como `leyes.json`, `temas.json` o `elecciones/historico.json`. La lista completa de rutas está en el campo `conjuntos` del índice. Las respuestas incluyen `ETag`.',
    example: '/datasets/leyes.json',
  },
  {
    id: 'descarga',
    path: '/descarga',
    title: 'Descargar el histórico completo',
    text: 'Devuelve el histórico completo en un único archivo .tar.gz. Es la forma recomendada de obtener todos los datos en lugar de recorrer los listados.',
    example: '/descarga',
    download: 'congreso.tar.gz',
  },
];

export const errors = {
  text: 'La API usa los códigos de estado HTTP habituales. Las respuestas de error incluyen un cuerpo `{ "error": "…" }` que describe el motivo.',
  codes: [
    ['400', 'Un parámetro, una ruta o un identificador no tiene un formato válido.'],
    ['404', 'El endpoint o el recurso solicitado no existe.'],
    [
      '451',
      'Las encuestas y la descarga completa no están disponibles durante el periodo de veda electoral.',
    ],
    ['502', 'El archivo de la descarga completa no está disponible en este momento.'],
    ['503', 'Los datos no están disponibles temporalmente. Reintenta más tarde.'],
  ],
};

export const cache = {
  text: 'Los datasets devuelven una cabecera `ETag` con su hash. Envíala en `If-None-Match` para recibir un `304 Not Modified` sin cuerpo cuando el archivo no haya cambiado. Guarda las respuestas en caché y, si necesitas todos los datos, usa la descarga completa.',
  example: `curl -H 'If-None-Match: "<sha256>"' "${apiBase}/datasets/leyes.json"`,
};

export const license =
  'Los datos se distribuyen con licencia **CC BY 4.0**, salvo las encuestas, que se distribuyen con **CC BY-SA 4.0**. Cualquier uso debe citar la fuente que indica el campo `atribucion` del índice. Los resúmenes y la clasificación por temas se generan con IA y pueden contener errores: los documentos oficiales del Congreso son la referencia.';

/** La orden curl de un endpoint, la misma en la página y en el Markdown. */
export const curl = (endpoint: Endpoint) =>
  endpoint.download
    ? `curl -o ${endpoint.download} "${apiBase}${endpoint.example}"`
    : `curl "${apiBase}${endpoint.example}"`;
