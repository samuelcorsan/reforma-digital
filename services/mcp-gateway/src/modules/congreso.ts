import { z } from 'zod';
import { text, optionalText, date, whole, type ModuleDefinition } from './common.js';

const filters = {
  q: optionalText('Palabras del título u órgano'),
  legislatura: optionalText('Legislatura en números romanos (por defecto XV)'),
  desde: date.optional().describe('Fecha mínima AAAA-MM-DD'),
  hasta: date.optional().describe('Fecha máxima AAAA-MM-DD'),
  pagina: whole('Página (por defecto 1)', 10000),
  limite: whole('Resultados por página (por defecto 24)', 100)
};

export const congreso: ModuleDefinition = {
  name: 'congreso',
  description: 'Votaciones, preguntas parlamentarias y sesiones del Congreso español',
  tools: [
    {
      name: 'indice_congreso',
      description: 'Índice, publicación, datasets y atribución del Congreso.',
      inputSchema: {}
    },
    {
      name: 'buscar_votaciones',
      description: 'Listar y buscar votaciones parlamentarias con recuentos.',
      inputSchema: { ...filters }
    },
    {
      name: 'ver_votacion',
      description: 'Ver una votación y el voto individual de cada diputado.',
      inputSchema: {
        id: text('Identificador de votación'),
        legislatura: optionalText('Legislatura, por defecto XV')
      }
    },
    {
      name: 'buscar_preguntas',
      description: 'Buscar preguntas parlamentarias, autoría y estado.',
      inputSchema: { ...filters, estado: optionalText('Estado de tramitación') }
    },
    {
      name: 'buscar_sesiones',
      description: 'Buscar Diarios de Sesiones de Pleno y comisiones.',
      inputSchema: { ...filters }
    },
    {
      name: 'ver_sesion',
      description: 'Ver Diario de Sesiones completo con todas sus intervenciones.',
      inputSchema: {
        id: text('ID de Diario, por ejemplo DSCD-15-PL-123'),
        legislatura: optionalText('Legislatura, por defecto XV')
      }
    },
    {
      name: 'ver_conjunto',
      description: 'Recuperar dataset JSON por su ruta publicada.',
      inputSchema: {
        ruta: z.string().trim().min(5).max(240).regex(/^[\w.\-/]+\.json$/)
          .refine(x => !x.split('/').includes('..'), 'No se permiten segmentos ..')
          .describe('Ruta del conjunto como leyes.json')
      }
    }
  ]
};
