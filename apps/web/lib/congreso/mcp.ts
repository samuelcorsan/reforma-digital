import { createCongresoMcp } from '@reforma-digital/mcp';
import { GET as congreso } from '../../app/api/congreso/[[...path]]/route';

// Cada herramienta llama a la ruta de la API en el mismo proceso: no sale a internet ni pasa
// otra vez por el cortafuegos, y la API sigue siendo la única que valida y aplica la veda.
export const congresoMcp = () =>
  createCongresoMcp((path, query) =>
    congreso(new Request(`http://localhost/api/congreso?${query}`), {
      params: Promise.resolve({ path }),
    }),
  );
