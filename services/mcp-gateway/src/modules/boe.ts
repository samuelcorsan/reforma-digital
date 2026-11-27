import { z } from 'zod';
import { text, optionalText, date, whole, type ModuleDefinition } from './common.js';

export const boe: ModuleDefinition = {
  name: 'boe',
  description: 'Sumarios oficiales y legislación consolidada del BOE',
  tools: [
    {
      name: 'sumario_boe',
      description: 'Sumario de disposiciones publicadas en una fecha del BOE.',
      inputSchema: {
        fecha: date.describe('Fecha de publicación AAAA-MM-DD'),
        seccion: z.enum(['1', '2A', '2B', '3', '4', '5A', '5B', '5C', 'T']).optional()
          .describe('Sección del BOE (incluye T, Tribunal Constitucional)'),
        q: optionalText('Palabras del título')
      }
    },
    {
      name: 'buscar_legislacion',
      description: 'Buscar normativa consolidada con su estado de vigencia.',
      inputSchema: {
        q: text('Palabras del título de la norma'),
        pagina: whole('Página desde 1 (por defecto 1)', 10000),
        limite: whole('Resultados por página (por defecto 10)', 100)
      }
    },
    {
      name: 'indice_norma',
      description: 'Índice de una norma consolidada, con identificadores de artículos.',
      inputSchema: { id: text('ID de la norma, por ejemplo BOE-A-2023-12203') }
    },
    {
      name: 'ver_bloque',
      description: 'Texto vigente de un artículo o bloque de norma consolidada.',
      inputSchema: {
        id: text('ID de la norma consolidada'),
        bloque: text('ID del bloque, como a3 o pr')
      }
    }
  ]
};
