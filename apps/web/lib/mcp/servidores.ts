import { createAlsaMcp } from '@reforma-digital/alsa';
import {
  createBoeMcp,
  createCarburantesMcp,
  createCatastroMcp,
  createContratacionMcp,
  createEustatMcp,
  createIneMcp,
  createMunicipiosMcp,
  createRedElectricaMcp,
  createSubvencionesMcp,
  createTraficoMcp,
  createIdescatMcp,
  createBormeMcp,
} from '@reforma-digital/mcp';
import { createRenfeMcp } from '@reforma-digital/renfe';
import { congresoMcp } from '../congreso/mcp';
import { contarUso } from './uso';

const mcps: Record<string, { fetch: (request: Request) => Promise<Response> }> = {
  congreso: congresoMcp(),
  renfe: createRenfeMcp(),
  boe: createBoeMcp(),
  ine: createIneMcp(),
  eustat: createEustatMcp(),
  catastro: createCatastroMcp(),
  municipios: createMunicipiosMcp(),
  carburantes: createCarburantesMcp(),
  'red-electrica': createRedElectricaMcp(),
  alsa: createAlsaMcp(),
  contratacion: createContratacionMcp(),
  subvenciones: createSubvencionesMcp(),
  trafico: createTraficoMcp(),
  idescat: createIdescatMcp(),
  borme: createBormeMcp(),
};

/**
 * El handler de cada servidor MCP por su id, el de `/mcp/<id>`. Todos pasan por `contarUso`, así
 * que un servidor nuevo se cuenta solo con añadirlo aquí.
 */
export const handlers = new Map(
  Object.entries(mcps).map(([id, mcp]) => [id, contarUso(id, (request) => mcp.fetch(request))]),
);
