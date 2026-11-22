import { z, type ZodRawShape } from 'zod';

export const text = (description: string) => z.string().trim().min(1).max(300).describe(description);
export const optionalText = (description: string) => text(description).optional();
export const whole = (description: string, max = 100) =>
  z.number().int().min(1).max(max).optional().describe(description);
export const counter = (description: string, max = 30) =>
  z.number().int().min(0).max(max).optional().describe(description);
export const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).describe('Hora local HH:MM');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
  'Fecha inválida; usa AAAA-MM-DD'
);
export const travelDate = z.union([date, z.enum(['today', 'tomorrow'])]);

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  /** Optional validation across several fields, after the Zod field validation. */
  validate?: (arguments_: Record<string, unknown>) => void;
}

export type ModuleName = 'renfe' | 'carburantes' | 'ine' | 'boe' | 'alsa' | 'congreso' | 'eustat';

export type ModuleDefinition = {
  name: ModuleName;
  description: string;
  tools: readonly ToolDefinition[];
};
