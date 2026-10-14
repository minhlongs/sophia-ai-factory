/**
 * Core type definitions for Sophia AI Video Factory
 * Re-exports domain-specific submodules to maintain backward compatibility.
 */

// Core Tier, User, and Feature flags
export * from './tier-core';

// Purchases, scripts, videos, and campaigns
export * from './purchase-types';

// Core Primitives
export type { Json } from './json';
export type { Database } from './database';

// Domain Types
export * from './user';
export * from './affiliate';
export * from './video';
export * from './billing';
export * from './raas';
export * from './infra';

// Cross-layer types (moved from forest/land to seed for layer compliance)
export type { AiService, UsageEventInput, UsageEventDB } from './ai-service';
export type { ChannelProvider, PublishStatus, ChannelStatus, PublishMeta, MetricsJson, Publisher } from './channel-provider';
export type { QuotaLimit, QuotaCheckResult, CreditRule, ExportOptions } from './quota-types';
export type { CachedQuota, QuotaCheckContext, QuotaConfig } from './quota-types';
export type {
  PublishingChannel,
  PublishingJob,
  PublishingResult,
} from './publishing-persistence';
export type { VideoGenerateRequestedEvent } from './video-events';
export { D1Events } from './d1-events';
export * from './landing-page-types';
export * from './creative-domain';
export * from './creative-economy';
export * from './creator-marketplace';
export type { PayoutRail } from './creator-marketplace';
export * from './telegram-sales';
export * from './growth';
export * from './affiliate-expansion-types';
export * from './dubbing';
export * from './apac-syndication';
export * from './unit-economics-types';
export * from './enterprise-deal';
export type {
  QueueLane,
  JobStatus,
  GpuProvider,
  CircuitBreakerState,
  VideoRenderRow,
  VideoRenderJob,
  EnqueueJobInput,
  SchedulerConfig,
  LeaseJobResult,
  QueueMetrics,
  DlqAlertPayload,
} from './video-render-queue';
export {
  ALL_QUEUE_LANES,
  isQueueLane,
  ALL_JOB_STATUSES,
  isJobStatus,
  ALL_GPU_PROVIDERS,
  isGpuProvider,
  ALL_CIRCUIT_BREAKER_STATES,
  isCircuitBreakerState,
  PRIORITY_SCORES,
  getPriorityScoreForTier,
  getLaneForTier,
  DEFAULT_SCHEDULER_CONFIG,
  parseJobPayload,
  mapRowToJob,
} from './video-render-queue';

export * from './agy-multitenancy';
export type {
  EscalationAction,
  EscalationPolicy,
  AgentSpec,
  ComputeLimits,
  PermissionRules,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
  AuditLedgerRecord,
  FleetGovernanceYaml,
} from './agent-governance';
export type { AutonomyLevel as AgyAutonomyLevel } from './agent-governance';
export * from './agency-portal';
export * from './autonomous-engine';
