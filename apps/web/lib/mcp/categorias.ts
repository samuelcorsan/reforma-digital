export const categories = {
  parlamento: { name: 'Parlamento' },
  transporte: { name: 'Transporte' },
  normativa: { name: 'Normativa' },
  estadistica: { name: 'Estadística' },
  consumo: { name: 'Consumo' },
  ayudas: { name: 'Ayudas públicas' },
  vivienda: { name: 'Vivienda' },
  contratacion: { name: 'Contratación pública' },
} satisfies Record<string, { name: string }>;
export type Category = keyof typeof categories;
