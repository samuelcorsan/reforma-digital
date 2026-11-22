import { z } from 'zod';
import { text, whole, type ModuleDefinition } from './common.js';

export const eustat: ModuleDefinition = {
  name: 'eustat',
  description: 'Estadísticas oficiales de Euskadi y territorios históricos',
  tools: [
    {
      name: 'buscar_tabla',
      description: 'Buscar tablas estadísticas de Eustat por palabras del título.',
      inputSchema: { q: text('Tema y variables de la tabla') }
    },
    {
      name: 'ver_tabla',
      description: 'Ver variables y valores de una tabla Eustat para elegir filtros.',
      inputSchema: { tabla: text('ID de tabla, por ejemplo PX_INEIPC_fe_pc02cm.px') }
    },
    {
      name: 'datos_tabla',
      description: 'Consultar valores recientes de Eustat filtrando por variables.',
      inputSchema: {
        tabla: text('ID de tabla de Eustat'),
        filtros: z.record(z.string().min(1).max(100), z.string().max(200)).optional()
          .describe('Mapa variable → texto que deben contener los valores'),
        ultimos: whole('Número de últimos periodos (por defecto 1)', 120)
      }
    }
  ]
};
