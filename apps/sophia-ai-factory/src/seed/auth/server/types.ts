import type { betterAuth } from 'better-auth';
import {
  PRODUCTION_TECHNICAL_ORIGIN,
  PILOT_TECHNICAL_ORIGIN,
} from '@/seed/domain';

export type AuthInstance = ReturnType<typeof betterAuth>;

export const CANONICAL_TRUSTED_ORIGINS: readonly string[] = [
  PRODUCTION_TECHNICAL_ORIGIN,
  PILOT_TECHNICAL_ORIGIN,
  'https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev',
] as const;

export const LOCAL_DEV_TRUSTED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8787',
] as const;
