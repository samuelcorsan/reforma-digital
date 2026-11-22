import type { IconName } from '../../components/brand/icon';

export const electionsBase = '/elecciones';
export const electionsHref = (path = '') => `${electionsBase}${path ? `/${path}` : ''}`;

// Apartados de la sección, con un vocabulario institucional y descriptivo. `short` es el nombre en la
// barra lateral y `cta`, el enlace de su tarjeta en la portada.
export const electionPages = {
  '350': {
    short: 'Reparto de escaños',
    title: 'Reparto de los 350 escaños',
    text: 'Escaños que elige cada provincia, composición del Congreso y evolución del reparto desde 1977.',
    cta: 'Consultar el reparto',
  },
  caducan: {
    short: 'Iniciativas que caducan',
    title: 'Iniciativas que caducan con la disolución',
    text: 'Proyectos y proposiciones de ley que quedan sin tramitar y decretos-leyes pendientes ante la Diputación Permanente.',
    cta: 'Consultar las iniciativas',
  },
  legislatura: {
    short: 'Balance de la legislatura',
    title: 'Balance de la XV legislatura',
    text: 'Actividad de la XV legislatura desde la sesión constitutiva hasta la disolución: votaciones, leyes, decretos-leyes y preguntas.',
    cta: 'Consultar el balance',
  },
  repite: {
    short: 'Diputados candidatos',
    title: 'Diputados que se presentan de nuevo',
    text: 'Diputados de la XV legislatura incluidos en las candidaturas, con su puesto y su circunscripción.',
    cta: 'Consultar las candidaturas',
  },
  escano: {
    short: 'Votos por escaño',
    title: 'Votos por escaño y simulador',
    text: "Votos necesarios para obtener un diputado en cada provincia, último escaño asignado y simulador del sistema D'Hondt.",
    cta: 'Abrir el simulador',
  },
  historico: {
    short: 'Resultados desde 1977',
    title: 'Resultados de las elecciones generales desde 1977',
    text: 'Resultados de las dieciséis elecciones generales en las 52 circunscripciones: composición del Congreso, fuerza más votada y evolución por provincia.',
    cta: 'Consultar los resultados',
  },
  metricas: {
    short: 'Indicadores',
    title: 'Indicadores del sistema electoral',
    text: 'Participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo en cada elección general.',
    cta: 'Consultar los indicadores',
  },
  mapa: {
    short: 'Resultados por municipio',
    title: 'Resultados por municipio',
    text: 'Resultados de 2019 y 2023 en los 8.131 municipios y variación entre ambas elecciones.',
    cta: 'Consultar los municipios',
  },
  voto: {
    short: 'Voto por territorio',
    title: 'Voto según el territorio',
    text: 'Comportamiento electoral por municipio según siete variables: tamaño, despoblación, edad, renta, territorio, cambio entre elecciones y peso del voto.',
    cta: 'Consultar el análisis',
  },
  encuestas: {
    short: 'Encuestas',
    title: 'Encuestas electorales',
    text: 'Encuestas publicadas desde 2023 y media diaria de estimación de voto.',
    cta: 'Consultar las encuestas',
  },
  proyeccion: {
    short: 'Proyección de escaños',
    title: 'Proyección de escaños',
    text: 'Escaños estimados a partir de la media de encuestas, por provincia, y probabilidad de cada mayoría.',
    cta: 'Consultar la proyección',
  },
  mercados: {
    short: 'Mercados de predicción',
    title: 'Mercados de predicción',
    text: 'Probabilidades de Polymarket sobre el ganador, la Presidencia del Gobierno y la fecha de salida de Pedro Sánchez, actualizadas a diario.',
    cta: 'Consultar los mercados',
  },
  acierto: {
    short: 'Precisión de las encuestas',
    title: 'Precisión de las encuestas',
    text: 'Error de las encuestas frente al resultado en las cinco últimas elecciones generales, por encuestadora, magnitud y sentido.',
    cta: 'Consultar la clasificación',
  },
  // Viven en su propia ruta (/elecciones/entrevistas/...), con candidatos y entrevistas debajo.
  entrevistas: {
    short: 'Entrevistas',
    title: 'Entrevistas a los candidatos',
    text: 'Análisis de las entrevistas a los cuatro candidatos: verificación de sus afirmaciones, propuestas y grado de respuesta a las preguntas.',
    cta: 'Consultar las entrevistas',
  },
  'entrevistas/comparar': {
    short: 'Comparativa',
    title: 'Comparativa de entrevistas',
    text: 'Indicadores de las entrevistas de una misma ronda con la misma escala: valoración, respuestas, propuestas, verificaciones y tono.',
    cta: 'Comparar las entrevistas',
  },
  'entrevistas/verificaciones': {
    short: 'Verificaciones',
    title: 'Verificaciones',
    text: 'Afirmaciones comprobables de las entrevistas con su calificación y sus fuentes oficiales, filtrables por calificación y por candidato.',
    cta: 'Consultar las verificaciones',
  },
  'entrevistas/metodologia': {
    short: 'Metodología',
    title: 'Metodología',
    text: 'Valoración sobre 10, criterios y ponderación, calificaciones y proceso de verificación y revisión con IA.',
    cta: 'Consultar la metodología',
  },
} as const;
export type ElectionPage = keyof typeof electionPages;

// Los grupos de la barra lateral.
export const electionGroups: { name: string; icon: IconName; pages: ElectionPage[] }[] = [
  { name: 'Legislatura', icon: 'libro', pages: ['caducan', 'legislatura', 'repite'] },
  { name: 'Escaños', icon: 'escano', pages: ['350', 'escano'] },
  { name: 'Historial electoral', icon: 'historia', pages: ['historico', 'metricas'] },
  { name: 'Resultados territoriales', icon: 'mapa', pages: ['mapa', 'voto'] },
  { name: 'Encuestas', icon: 'grafica', pages: ['encuestas', 'proyeccion', 'mercados', 'acierto'] },
  {
    name: 'Entrevistas',
    icon: 'microfono',
    pages: [
      'entrevistas',
      'entrevistas/verificaciones',
      'entrevistas/comparar',
      'entrevistas/metodologia',
    ],
  },
];
export const electionOrder = electionGroups.flatMap((group) => group.pages);
export const isElectionPage = (id: string): id is ElectionPage => id in electionPages;
