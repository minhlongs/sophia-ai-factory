/**
 * @module seed
 *
 * Seed layer — foundational primitives for Sophia AI Factory.
 *
 * Barrel re-exports from subdomains. Import from `@/seed/*`.
 * Consumers: tree/ → forest/ → land/
 *
 * Conflict notes:
 * - seed/auth exports User (better-auth-session); seed/db/index.ts handles its own
 *   User type in db/client.ts. seed/index.ts uses seed/db barrel (./db) which
 *   excludes the db/auth sub-module to avoid User duplication.
 * - seed/auth/enriched-jwt.ts re-exports EnrichedJwtClaims from enriched-jwt-types.ts,
 *   so enriched-jwt-types is excluded from the auth barrel to prevent TS2308.
 * - seed/types exports Tier; seed/db/types also exports Tier. seed/db/index.ts
 *   re-exports from db/types, so we use the db barrel (./db) which includes
 *   db/types. seed/types is still exported via index-domain-exports for direct use.
 */

// ─── ai (AI service primitives, LLM adapters) ────────────────────────────────
export * from './ai';

// ─── auth (Better Auth client, session helpers) ──────────────────────────────
export type {
  FeatureLimit,
  EnrichedJwtPayload,
  EnrichedJwtClaims,
  LicenseContext,
  OpenClawScope,
  OpenClawAuthResult,
  OpenClawAuthError,
  NonceCache,
} from './auth';
export {
  getDefaultEntitlements,
  getLicenseContext,
  createEnrichedJwt,
  verifyEnrichedJwt,
  decodeEnrichedJwt,
  extractQuotaFromJwt,
  isJwtExpired,
  refreshJwtIfExpired,
  AuthSystemError,
  getSession,
  isAuthError,
  getCurrentUserOrOpenClaw,
  checkJwtNonce,
  markJwtNonceAsUsed,
  preRegisterNonce,
  cleanupExpiredNonces,
} from './auth';

// ─── cache (KV cache helpers) ─────────────────────────────────────────────────
export * from './cache';

// ─── config (environment, pricing, feature flags) ────────────────────────────
export * from './config';

// ─── db (D1/Kysely client, schema definitions, migrations) ──────────────────
export * from './db';

// ─── email (email service primitives) ────────────────────────────────────────
export * from './email';

// ─── health (health-check utilities) ─────────────────────────────────────────
export * from './health';

// ─── hooks (React hooks primitives) ─────────────────────────────────────────
export * from './hooks';

// ─── observability (logging, metrics) ────────────────────────────────────────
export * from './observability';

// ─── openapi (OpenAPI schema helpers) ────────────────────────────────────────
export * from './openapi';

// ─── security (encryption, JWT, webhook verification) ────────────────────────
export * from './security';

// ─── domain types, utils, validators, voices ─────────────────────────────────
export * from './index-domain-exports';
