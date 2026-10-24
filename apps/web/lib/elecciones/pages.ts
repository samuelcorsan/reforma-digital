export const electionsBase = '/elecciones';
export const electionsHref = (path = '') => `${electionsBase}${path ? `/${path}` : ''}`;

// Apartados de la sección, con el texto de Escaño Abierto. `short` es el nombre en la navegación y
// `cta`, la frase junto a la flecha de su tarjeta en la portada.
export const electionPages = {
  '350': {
    short: 'Los 350',
    title: 'Los 350',
    text: 'Cada escaño sale de una provincia. Del mapa al hemiciclo, y cómo ha cambiado el reparto desde 1977.',
    cta: 'Cómo ha cambiado desde 1977',
  },
  caducan: {
    short: 'Lo que caduca',
    title: 'Lo que caduca',
    text: 'Las leyes que la disolución deja a medio camino y los decretos-leyes que heredará la Diputación Permanente.',
    cta: 'Ver todas las leyes',
  },
  legislatura: {
    short: 'En cifras',
    title: 'La legislatura en cifras',
    text: 'La XV legislatura, de la sesión constitutiva a la disolución: votaciones, leyes, decretos y preguntas.',
    cta: 'Ver las cifras',
  },
  repite: {
    short: '¿Repite?',
    title: '¿Repite?',
    text: 'Quién de los 350 vuelve a ir en las listas, en qué puesto y por qué provincia.',
    cta: 'Ver quién repite',
  },
  escano: {
    short: 'Precio del escaño',
    title: 'El precio de un escaño',
    text: "Cuántos votos cuesta un diputado en cada provincia, el último escaño de cada una y un simulador D'Hondt.",
    cta: "Probar el simulador D'Hondt",
  },
  historico: {
    short: 'Desde 1977',
    title: 'Elecciones desde 1977',
    text: 'Las dieciséis generales y sus 52 provincias: el hemiciclo de cada una, quién ganó dónde y cómo ha cambiado cada circunscripción.',
    cta: 'Ver las 16 elecciones',
  },
  metricas: {
    short: 'Métricas',
    title: 'Métricas',
    text: 'Participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo, elección a elección.',
    cta: 'Ver las métricas',
  },
  mapa: {
    short: 'Por municipios',
    title: 'Municipio a municipio',
    text: 'El voto de 2019 y 2023 en los 8.131 municipios y cuánto cambió entre las dos.',
    cta: 'Ver los municipios',
  },
  voto: {
    short: 'Geografía del voto',
    title: 'La geografía del voto',
    text: 'Ciudad y campo, la España vacía, la edad, el dinero, las Españas, el giro y el peso del voto: cómo vota cada España, municipio a municipio.',
    cta: 'Ver los siete ejes',
  },
  encuestas: {
    short: 'Encuestas',
    title: 'Las encuestas',
    text: 'Todas las encuestas desde 2023 y su media día a día: cómo ha cambiado la intención de voto camino del 29N.',
    cta: 'Ver todas las encuestas',
  },
  proyeccion: {
    short: 'Proyección',
    title: 'La proyección',
    text: 'Los escaños que salen de la media de las encuestas, provincia a provincia, y lo probable que es cada mayoría.',
    cta: 'Ver la proyección',
  },
  mercados: {
    short: 'Mercados',
    title: 'Los mercados',
    text: 'Lo que apuestan en Polymarket: quién gana, quién preside y cuándo se va Sánchez, día a día.',
    cta: 'Ver las apuestas',
  },
  acierto: {
    short: '¿Aciertan?',
    title: 'Cuánto acertaron',
    text: 'Las encuestas de las cinco últimas generales frente al resultado: quién falló, cuánto y hacia dónde.',
    cta: 'Ver el ranking',
  },
} as const;
export type ElectionPage = keyof typeof electionPages;

export const electionGroups: {
  name: string;
  title: string;
  text: string;
  pages: ElectionPage[];
}[] = [
  {
    name: 'La legislatura',
    title: 'La legislatura que se acaba',
    text: 'Lo que deja hecho y sin hacer la XV legislatura, y quién vuelve a presentarse.',
    pages: ['caducan', 'legislatura', 'repite'],
  },
  {
    name: 'Los escaños',
    title: 'Cómo se reparten los 350',
    text: "Cada provincia elige sus diputados por separado, con la ley D'Hondt: por eso unos votos pesan más que otros.",
    pages: ['350', 'escano'],
  },
  {
    name: 'La historia',
    title: 'Cuarenta y nueve años de elecciones',
    text: 'Las dieciséis generales desde 1977, una a una, provincia a provincia y en cifras.',
    pages: ['historico', 'metricas'],
  },
  {
    name: 'El mapa',
    title: 'El mapa del voto',
    text: 'Quién gana dónde, municipio a municipio, y cómo vota cada España.',
    pages: ['mapa', 'voto'],
  },
  {
    name: 'Las encuestas',
    title: 'Lo que dicen las encuestas',
    text: 'Las encuestas y su media hasta el 23 de noviembre: desde el 24, la ley prohíbe publicarlas.',
    pages: ['encuestas', 'proyeccion', 'mercados', 'acierto'],
  },
];
export const electionOrder = electionGroups.flatMap((group) => group.pages);
export const isElectionPage = (id: string): id is ElectionPage => id in electionPages;
