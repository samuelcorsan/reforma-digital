import { z } from 'zod';
import { text, optionalText, time, travelDate, whole, type ModuleDefinition } from './common.js';

export const renfe: ModuleDefinition = {
  name: 'renfe',
  description: 'Estaciones, trenes, precios y retrasos RENFE',
  tools: [
    {
      name: 'find_stations',
      description: 'Buscar estaciones RENFE por nombre o código, con sugerencias.',
      inputSchema: {
        query: text('Nombre de estación/ciudad o código RENFE'),
        limit: whole('Máximo de estaciones (por defecto 10)', 100)
      }
    },
    {
      name: 'search_trains',
      description: 'Trenes, horarios y tarifas entre estaciones; incluye retrasos de hoy.',
      inputSchema: {
        origin: text('Estación o ciudad de origen'),
        destination: text('Estación o ciudad de destino'),
        date: travelDate.optional().describe('AAAA-MM-DD, today o tomorrow (por defecto today)'),
        after: time.optional().describe('Solo salidas desde HH:MM'),
        arrive_by: time.optional().describe('Solo llegadas antes de HH:MM'),
        include_fares: z.boolean().optional().describe('Incluir tarifas (por defecto true)'),
        limit: whole('Máximo de trenes (por defecto 10)', 100)
      }
    },
    {
      name: 'train_status',
      description: 'Estado, retraso y siguiente estación de un tren RENFE en directo.',
      inputSchema: { train: text('Número de tren, por ejemplo 03081') }
    },
    {
      name: 'list_delays',
      description: 'Trenes RENFE que presentan retrasos actualmente.',
      inputSchema: { train: optionalText('Filtrar por número de tren') }
    }
  ]
};
