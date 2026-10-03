import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: [
    '@reforma-digital/core',
    '@reforma-digital/government',
    '@reforma-digital/db',
    '@reforma-digital/retrieval',
    '@reforma-digital/ai',
    '@reforma-digital/evals',
  ],
  serverExternalPackages: ['postgres', '@langfuse/otel', '@opentelemetry/sdk-node'],
  poweredByHeader: false,
};
export default config;
