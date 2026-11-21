export const categories = {
  parlamento: { name: 'Parlamento' },
  transporte: { name: 'Transporte' },
  normativa: { name: 'Normativa' },
  estadistica: { name: 'Estadística' },
  consumo: { name: 'Consumo' },
} satisfies Record<string, { name: string }>;
export type Category = keyof typeof categories;
