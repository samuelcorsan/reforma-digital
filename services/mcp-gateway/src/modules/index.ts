import type { ModuleDefinition } from './common.js';
import { renfe } from './renfe.js';
import { carburantes } from './carburantes.js';
import { ine } from './ine.js';
import { boe } from './boe.js';
import { alsa } from './alsa.js';
import { congreso } from './congreso.js';
import { eustat } from './eustat.js';

export const modules: readonly ModuleDefinition[] = [
  renfe, carburantes, ine, boe, alsa, congreso, eustat
];
