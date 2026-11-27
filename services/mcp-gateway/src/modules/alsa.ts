import { z } from 'zod';
import { text, time, whole, counter, type ModuleDefinition } from './common.js';

const busDate = z.string().trim().min(2).max(40).describe('AAAA-MM-DD, DD/MM/AAAA, today, tomorrow o día semanal');

export const alsa: ModuleDefinition = {
  name: 'alsa',
  description: 'Paradas, horarios y precios de autobuses ALSA',
  tools: [
    {
      name: 'find_stops',
      description: 'Buscar paradas y localidades por nombre o identificador ALSA.',
      inputSchema: {
        query: text('Nombre de parada/ciudad o identificador'),
        limit: whole('Máximo de paradas (por defecto 10)', 100)
      }
    },
    {
      name: 'search_buses',
      description: 'Buscar autobuses, plazas, tarifas, bonos e ida/vuelta en ALSA.',
      inputSchema: {
        origin: text('Parada o localidad de origen'),
        destination: text('Parada o localidad de destino'),
        date: busDate.optional().describe('Fecha de ida, por defecto today'),
        return_date: busDate.optional().describe('Fecha de regreso'),
        open_return: z.boolean().optional().describe('Vuelta abierta (por defecto false)'),
        adults: counter('Adultos 26-59 (por defecto 1)', 30),
        young: counter('Jóvenes 12-25', 30),
        seniors: counter('Mayores de 60', 30),
        children: counter('Niños 4-11', 30),
        babies: counter('Bebés 0-3', 30),
        after: time.optional().describe('Solo salidas desde HH:MM'),
        before: time.optional().describe('Solo salidas antes de HH:MM'),
        arrive_by: time.optional().describe('Solo llegadas antes de HH:MM'),
        service: text('Servicio Comfort, Supra, Premium...').optional(),
        available_only: z.boolean().optional().describe('Solo viajes disponibles'),
        direct_only: z.boolean().optional().describe('Solo viajes directos'),
        include_packages: z.boolean().optional().describe('Incluir tarifas flexibles y paquetes'),
        limit: whole('Máximo de salidas por sentido (por defecto 20)', 100)
      },
      validate: args => {
        if (args.open_return === true && args.return_date !== undefined) {
          throw new Error('open_return y return_date no pueden utilizarse conjuntamente.');
        }
        const passengers = ['adults', 'young', 'seniors', 'children', 'babies']
          .reduce((sum, key) => sum + (typeof args[key] === 'number' ? args[key] as number : (key === 'adults' ? 1 : 0)), 0);
        if (passengers < 1) throw new Error('Se necesita al menos un viajero.');
      }
    }
  ]
};
