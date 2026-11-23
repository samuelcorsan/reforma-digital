export const categories = {
  parlamento: { name: 'Parlamento' },
  transporte: { name: 'Transporte' },
  normativa: { name: 'Normativa' },
  estadistica: { name: 'Estadística' },
  'administracion-local': { name: 'Administración local' },
  consumo: { name: 'Consumo' },
  vivienda: { name: 'Vivienda' },
  contratacion: { name: 'Contratación pública' },
} satisfies Record<string, { name: string }>;
export type Category = keyof typeof categories;
