// `face`: el punto medio de los ojos y el tamaño de la cara en cada foto (fracciones de su alto,
// medidas con Vision en El VAR Electoral), para que las cuatro caras salgan igual de grandes.
// `adjust` corrige a ojo la medida automática. `pollId` es su partido en las encuestas de la
// sección (Frente Amplio se lee como sucesor de Sumar). Las fotos son de Wikimedia Commons, recortadas del
// fondo y en blanco y negro.
export const candidates = [
  // De menos a más escaños en las generales de 2023, como el resto de la sección.
  {
    slug: 'ada-colau',
    pollId: 'SUMAR',
    name: 'Ada Colau',
    party: 'Frente Amplio',
    short: 'FA',
    color: '#F0522D',
    face: { x: 0.3978, y: 0.3206, size: 0.2269 },
    adjust: 1,
    author: 'Robo71',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Ada-Colau-Encuentro-2024.jpg',
  },
  {
    slug: 'santiago-abascal',
    pollId: 'VOX',
    name: 'Santiago Abascal',
    party: 'Vox',
    short: 'Vox',
    color: '#5BA83A',
    face: { x: 0.5356, y: 0.2839, size: 0.3125 },
    adjust: 1,
    author: 'Gage Skidmore',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Santiago_Abascal_(54349274173)_(cropped).jpg',
  },
  {
    slug: 'pedro-sanchez',
    pollId: 'PSOE',
    name: 'Pedro Sánchez',
    party: 'PSOE',
    short: 'PSOE',
    color: '#D8342B',
    face: { x: 0.5252, y: 0.3156, size: 0.3086 },
    adjust: 1.08,
    author: 'Pool Moncloa / Carlos Spottorno',
    license: 'Atribución',
    source: 'https://commons.wikimedia.org/wiki/File:Pedro_S%C3%A1nchez_in_2026.jpg',
  },
  {
    slug: 'alberto-nunez-feijoo',
    pollId: 'PP',
    name: 'Alberto Núñez Feijóo',
    party: 'Partido Popular',
    short: 'PP',
    color: '#2C7BC4',
    face: { x: 0.5086, y: 0.2541, size: 0.2122 },
    adjust: 1,
    author: 'Partido Popular',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg',
  },
] as const;
export type Candidate = (typeof candidates)[number];
