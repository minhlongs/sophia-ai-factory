/**
 * @module seed/index-domain-exports
 *
 * Domain type and voice preset re-exports for the seed barrel.
 */

// ─── types (shared TypeScript types) ─────────────────────────────────────────
// User excluded — canonical source is seed/db/client.ts (via ./db barrel).
// Tier is canonical here — voices/presets.ts also exports Tier, excluded from ./voices below.
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
export {
  VOICE_PRESETS,
  getVoicePreset,
  listPresetsByLanguage,
  canAccessPreset,
  listPresetsForTier,
} from './voices';
