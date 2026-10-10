import type { betterAuth } from 'better-auth';

export type AuthInstance = ReturnType<typeof betterAuth>;

export const CANONICAL_TRUSTED_ORIGINS: readonly string[] = [
  'https://sophia.agencyos.network',
  'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
  'https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8787',
] as const;
