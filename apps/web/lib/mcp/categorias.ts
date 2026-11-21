export const categories = {
  parlamento: { name: 'Parlamento' },
  transporte: { name: 'Transporte' },
} satisfies Record<string, { name: string }>;
export type Category = keyof typeof categories;
