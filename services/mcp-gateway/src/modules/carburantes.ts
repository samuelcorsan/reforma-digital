import { z } from 'zod';
import { text, whole, type ModuleDefinition } from './common.js';

export const carburantes: ModuleDefinition = {
  name: 'carburantes',
  description: 'Precios públicos de carburantes en gasolineras españolas',
  tools: [
    {
      name: 'buscar_municipio',
      description: 'Buscar municipio y obtener su identificador para la consulta de gasolineras.',
      inputSchema: { nombre: text('Nombre total o parcial de municipio') }
    },
    {
      name: 'gasolineras_baratas',
      description: 'Gasolineras más baratas de un municipio o provincia por carburante.',
      inputSchema: {
        municipio: text('ID de municipio obtenido con buscar_municipio').optional(),
        provincia: z.string().regex(/^\d{2}$/).optional().describe('Código de provincia (dos cifras)'),
        carburante: z.enum([
          'gasolina95', 'gasolina95_e10', 'gasolina98', 'diesel',
          'diesel_premium', 'glp', 'gnc', 'adblue'
        ]),
        limite: whole('Máximo de gasolineras (por defecto 10)', 100)
      },
      validate: args => {
        if (!args.municipio && !args.provincia) {
          throw new Error('Indica municipio o provincia.');
        }
      }
    }
  ]
};
