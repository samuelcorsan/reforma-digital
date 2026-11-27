import { createCn } from 'cn/config';

const named = (pattern: RegExp) => (value: string) => pattern.test(value);

// `cn` clasifica cada clase por su nombre. Sin esto toma `text-28` por un color y `font-650` por una
// familia, y descarta la otra clase al combinarlas; el resto de tokens de theme.css quedaría sin fusionar.
export const cn = createCn({
  extend: {
    theme: {
      text: [named(/^(\d+|em-\d+|fluid-[\d-]+(-suave)?)$/)],
      'font-weight': ['650'],
      radius: [named(/^\d+$/), 'inherit'],
      spacing: [named(/^(\d+vh|em-\d+|fluid-[\d-]+)$/)],
      tracking: ['titular', 'eyebrow', 'etiqueta'],
    },
  },
});
