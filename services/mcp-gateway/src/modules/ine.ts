import { text, optionalText, whole, type ModuleDefinition } from './common.js';
import { z } from 'zod';

export const ine: ModuleDefinition = {
  name: 'ine',
  description: 'Estadísticas oficiales del Instituto Nacional de Estadística',
  tools: [
    {
      name: 'buscar_operacion',
      description: 'Buscar operaciones estadísticas por código o nombre (IPC, EPA, padrón).',
      inputSchema: { q: text('Texto a buscar en las operaciones estadísticas') }
    },
    {
      name: 'buscar_tabla',
      description: 'Buscar tablas de una operación estadística del INE.',
      inputSchema: {
        operacion: text('Código de operación, como IPC o EPA'),
        q: optionalText('Filtrar por palabras del nombre de tabla')
      }
    },
    {
      name: 'datos_tabla',
      description: 'Consultar últimos valores de series de una tabla del INE.',
      inputSchema: {
        tabla: z.number().int().positive().describe('ID numérico de la tabla'),
        q: optionalText('Filtrar por nombre de serie'),
        ultimos: whole('Número de últimos periodos (por defecto 1)', 120)
      }
    },
    {
      name: 'datos_serie',
      description: 'Consultar últimos valores de una serie del INE, con avisos de vigencia.',
      inputSchema: {
        codigo: text('Código de serie como IPC290751'),
        ultimos: whole('Número de últimos periodos (por defecto 1)', 120)
      }
    }
  ]
};
