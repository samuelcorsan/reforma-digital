export const categories = {
  parlamento: { name: 'Parlamento' },
  transporte: { name: 'Transporte' },
  normativa: { name: 'Normativa' },
  estadistica: { name: 'Estadística' },
  'administracion-local': { name: 'Administración local' },
  consumo: { name: 'Consumo' },
  ayudas: { name: 'Ayudas públicas' },
  vivienda: { name: 'Vivienda' },
  contratacion: { name: 'Contratación pública' },
} satisfies Record<string, { name: string }>;
export type Category = keyof typeof categories;

export const ambitos = {
  estatal: { name: 'Estatal' },
  autonomico: { name: 'Autonómico' },
  local: { name: 'Local' },
} satisfies Record<string, { name: string }>;
/** Lo que cubren los datos: toda España, o una comunidad o un municipio, con su nombre. */
export type Ambito = { tipo: 'estatal' } | { tipo: 'autonomico' | 'local'; territorio: string };
