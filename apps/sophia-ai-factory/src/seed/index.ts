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
 *   db/types. seed/types is still exported below for direct use.
 */

// ─── ai (AI service primitives, LLM adapters) ────────────────────────────────
export * from './ai';

// ─── auth (Better Auth client, session helpers) ──────────────────────────────
// getD1Raw excluded from auth barrel (conflicts with seed/db/client)
// enriched-jwt-types excluded (EnrichedJwtClaims re-exported via enriched-jwt)
// better-auth-session excluded (getCurrentUser/getCurrentUserFromHeaders return User,
// conflicts with seed/db/client). Selective re-exports for non-conflicting symbols.
// isJwtExpired re-exported from auth/enriched-jwt; security/jwt-validator-jwks also
// exports isJwtExpired — security/index.ts uses explicit re-exports excluding it.
// OpenClawAuthResult from get-current-user-or-openclaw.ts — no User clash.
// NonceCache is a type (interface), so it must use 'export type'.
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
// Use the db barrel which handles internal conflicts (auth excluded for User,
// enriched-jwt-types excluded for EnrichedJwtClaims).
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

// ─── types (shared TypeScript types) ─────────────────────────────────────────
// User excluded — canonical source is seed/db/client.ts (via ./db barrel).
// Tier is canonical here — voices/presets.ts also exports Tier, excluded from ./voices below.
// All other types re-exported selectively.
export type {
  Tier,
TierLowercase,
FeatureFlag,
TierConfig,
AffiliateProgram,
AccessCheck,
ScriptStatus,
ScriptRecord,
VideoRecord,
PurchaseKind,
OneTimeSkuId,
PurchaseStatus,
UserPurchase,
OneTimeSku,
CampaignStatus,
Campaign,
// ── Sophia 2027 Creative Economy Domain Types ────────────────────────────
Creator,
Workspace,
Brand,
CreativeIdentity,
CreativeGoal,
ContentProject,
ContentAsset,
DerivativeAsset,
DistributionPlan,
PerformanceEvent,
PerformanceSnapshot,
RevenueEvent,
RevenueEventType,
Experiment,
ExperimentStatus,
ExperimentVariant,
ProvenanceRecord,
ProvenanceAction,
AgentDefinition,
AgentRun,
AgentContext,
AgentDecision,
AgentAction,
AgentResult,
AgentApproval,
AgentPermission,
CreativeMemory,
MemoryCategory,
MemoryConfidence,
MarketSignal,
SignalType,
IP,
Story,
ContentStatus,
ContentKind,
Tone,
ContentFormat,
AutonomyLevel,
CostPolicy,
ModelPolicy,
ModelCapability,
ModelRequest,
ModelResponse,
AIProvider,
ModelInfo,
ChannelConfig,
} from './types';

// ─── utils (shared utility functions) ────────────────────────────────────────
export * from './utils';

// ─── validators (Zod schemas) ─────────────────────────────────────────────────
export * from './validators';

// ─── voices (voice service types) ────────────────────────────────────────────
  export type { Gender, VoiceLanguage } from './voices';
  export { VOICE_PRESETS, getVoicePreset, listPresetsByLanguage, canAccessPreset, listPresetsForTier } from './voices';
