import { z } from 'zod';

const integer = (defaultValue: number, max: number) =>
  z.coerce.number().int().min(0).max(max).default(defaultValue);

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  UPSTREAM_BASE_URL: z.string().url().default('https://reforma-digital.es/mcp'),
  UPSTREAM_TIMEOUT_MS: integer(20_000, 120_000).refine(x => x >= 1000),
  UPSTREAM_MAX_BYTES: integer(4_194_304, 16_777_216).refine(x => x >= 4096),
  UPSTREAM_RETRIES: integer(1, 3),
  MAX_SESSIONS: integer(100, 10_000).refine(x => x >= 1),
  MAX_INFLIGHT_TOOLS: integer(25, 1000).refine(x => x >= 1),
  SSE_HEARTBEAT_MS: integer(15_000, 120_000),
  GATEWAY_TOKEN: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  ALLOWED_HOSTS: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false')
});

export const config = schema.parse(process.env);
export const allowedOrigins = new Set(
  (config.ALLOWED_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean)
);
export const allowedHosts = new Set(
  (config.ALLOWED_HOSTS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
);
