/**
 * Sophia 2027 — Canonical Creative Economy Domain Model
 *
 * Core entities and relationships for the Creative Economy OS.
 * These types define the domain vocabulary used across all layers.
 *
 * @module seed/types/creative-domain
 */

// =============================================================================
// IDENTITY
// =============================================================================

export interface Creator {
  id: string;
  userId: string; // links to auth user
  displayName: string;
  bio?: string;
  timezone: string;
  locale: 'vi' | 'en';
  onboardingComplete: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  autonomyLevel: AutonomyLevel;
  monthlyBudgetCents: number;
  currency: string;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  fontPrimary?: string;
  logoAssetId?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// CREATIVE IDENTITY
// =============================================================================

export type Tone = 'formal' | 'casual' | 'sharp' | 'warm' | 'playful' | 'authoritative' | 'empathetic';

export interface CreativeIdentity {
  id: string;
  workspaceId: string;
  brandId?: string;

  // Voice
  voiceDescription: string;
  tone: Tone;
  formality: number; // 0-1 scale
  energy: number; // 0-1 scale

  // Positioning
  beliefs: string[];
  positioning: string;
  targetAudience: string;

  // Constraints
  forbiddenPatterns: string[];
  requiredDisclosures: string[];

  // Preferences
  preferredFormats: ContentFormat[];
  referenceWorks: string[]; // IDs or URLs of approved examples

  // Metadata
  version: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: string; // userId
}

export interface ContentFormat {
  type: 'video_short' | 'video_long' | 'image' | 'audio' | 'article' | 'carousel';
  platform: 'youtube' | 'tiktok' | 'x' | 'instagram' | 'facebook' | 'whatsapp' | 'blog';
  maxDurationSeconds?: number;
  aspectRatio?: string;
  constraints: string[];
}

// =============================================================================
// MEMORY
// =============================================================================

export type MemoryCategory =
  | 'identity'
  | 'creative'
  | 'audience'
  | 'performance'
  | 'business'
  | 'operational'
  | 'provenance';

export type MemoryConfidence = 'high' | 'medium' | 'low';

export interface CreativeMemory {
  id: string;
  workspaceId: string;
  category: MemoryCategory;
  key: string;
  value: unknown;
  confidence: MemoryConfidence;
  source: string; // 'performance' | 'human_edit' | 'agent_inference' | 'import'
  evidence: string; // JSON array of supporting events/ids
  scope: 'global' | 'campaign' | 'project' | 'channel';
  scopeId?: string;
  version: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

// =============================================================================
// GOALS & SIGNALS
// =============================================================================

export type GoalType = 'audience_growth' | 'lead_generation' | 'revenue' | 'engagement' | 'brand_awareness' | 'retention';

export interface CreativeGoal {
  id: string;
  workspaceId: string;
  missionId?: string;
  type: GoalType;
  description: string;
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  timeframeStart: number;
  timeframeEnd: number;
  priority: number; // 1-5
  status: 'draft' | 'active' | 'achieved' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export type SignalType = 'trend' | 'competitor' | 'audience' | 'search' | 'content' | 'market';

export interface MarketSignal {
  id: string;
  workspaceId: string;
  type: SignalType;
  source: string; // provider name
  title: string;
  summary: string;
  data: Record<string, unknown>;
  confidence: number; // 0-1
  relevanceScore: number; // 0-1
  expiresAt?: number;
  consumed: boolean;
  createdAt: number;
}

// =============================================================================
// CONCEPTS & CONTENT
// =============================================================================

export type ContentStatus = 'draft' | 'planned' | 'in_production' | 'review' | 'approved' | 'published' | 'archived';
export type ContentKind = 'video_short' | 'video_long' | 'image' | 'audio' | 'article' | 'carousel' | 'mixed';

export interface CreativeConcept {
  id: string;
  workspaceId: string;
  missionId?: string;
  title: string;
  hook: string;
  format: ContentKind;
  targetChannel: string[];
  audience: string;
  estimatedDuration?: number;
  tags: string[];
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Story {
  id: string;
  workspaceId: string;
  conceptId?: string;
  title: string;
  synopsis: string;
  characters: string[]; // IP character IDs
  themes: string[];
  arc: string; // narrative arc description
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface IP {
  id: string;
  workspaceId: string;
  type: 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand';
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  parentId?: string;
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ContentProject {
  id: string;
  workspaceId: string;
  missionId?: string;
  conceptId?: string;
  storyId?: string;
  creatorId: string;
  brandId?: string;
  title: string;
  description: string;
  format: ContentKind;
  status: ContentStatus;
  budgetCents: number;
  actualCostCents: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ContentAsset {
  id: string;
  projectId: string;
  workspaceId: string;
  type: 'script' | 'storyboard' | 'audio' | 'video' | 'image' | 'subtitle' | 'thumbnail';
  storageKey?: string; // R2 key if applicable
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status: ContentStatus;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface DerivativeAsset {
  id: string;
  workspaceId: string;
  sourceAssetId: string;
  parentAssetId: string;
  type: 'clip' | 'thumbnail' | 'quote_card' | 'audio_extract' | 'text_extract' | 'remix' | 'translation' | 'summary';
  storageKey?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

// =============================================================================
// DISTRIBUTION
// =============================================================================

export interface DistributionPlan {
  id: string;
  projectId: string;
  workspaceId: string;
  channels: ChannelConfig[];
  scheduleAt?: number;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface ChannelConfig {
  channel: string; // 'youtube' | 'tiktok' | 'x' | ...
  assetId: string;
  title?: string;
  description?: string;
  tags?: string[];
  publishAt?: number;
  settings: Record<string, unknown>;
}

export interface DistributionAsset {
  id: string;
  workspaceId: string;
  planId: string;
  assetId: string;
  channel: string;
  platformPostId?: string;
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  scheduledAt: number;
  postedAt?: number;
  analytics: Record<string, unknown>;
  error?: string;
  createdAt: number;
}

// =============================================================================
// PERFORMANCE
// =============================================================================

export interface PerformanceEvent {
  id: string;
  workspaceId: string;
  assetId: string;
  projectId: string;
  entityType: string; // 'asset' | 'mission' | 'campaign'
  entityId: string;
  channel: string;
  eventType: string; // 'impression' | 'view' | 'click' | 'like' | 'share' | 'save' | 'follow' | 'conversion' | 'revenue'
  count: number;
  valueCents?: number;
  recordedAt: number;
  rawData?: Record<string, unknown>;
}

export interface PerformanceSnapshot {
  id: string;
  workspaceId: string;
  assetId: string;
  channel: string;
  snapshotDate: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchTimeSeconds: number;
  retention3s: number;
  retention30s: number;
  followerDelta: number;
  leadDelta: number;
  revenueCents: number;
  costCents: number;
  creativeRoi: number;
}

// =============================================================================
// ECONOMY
// =============================================================================

export type RevenueEventType = 'sale' | 'affiliate' | 'ad' | 'subscription' | 'lead' | 'licensing';

export interface RevenueEvent {
  id: string;
  workspaceId: string;
  assetId?: string;
  projectId?: string;
  channel: string;
  type: RevenueEventType;
  amountCents: number;
  currency: string;
  metadata: Record<string, unknown>;
  occurredAt: number;
  recordedAt: number;
}

// =============================================================================
// AGENT RUNTIME
// =============================================================================

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export interface AgentPermission {
  tool: string;
  scopes: string[];
  requiresApproval: boolean;
  maxCostCents?: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  permissions: AgentPermission[];
  defaultAutonomy: AutonomyLevel;
  maxRetries: number;
  timeoutMs: number;
  modelPolicy?: ModelPolicy;
}

export interface AgentContext {
  workspaceId: string;
  missionId?: string;
  projectId?: string;
  creativeIdentity?: CreativeIdentity;
  memory: CreativeMemory[];
  autonomyLevel: AutonomyLevel;
  budgetRemainingCents: number;
  correlationId: string;
  /** Action ids the human has explicitly approved for this run. */
  approvedActionIds?: string[];
}

export interface AgentDecision {
  type: string;
  reasoning: string;
  confidence: number;
  alternatives?: Array<{ description: string; score: number }>;
  requiresHumanApproval: boolean;
}

export interface AgentAction {
  type: string;
  tool: string;
  parameters: Record<string, unknown>;
  estimatedCostCents?: number;
  approvalRequired: boolean;
}

export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: { code: string; message: string };
  artifacts: string[]; // asset IDs created
  costCents: number;
  durationMs: number;
  provenanceRecordId?: string;
}

export interface AgentApproval {
  id: string;
  agentRunId: string;
  action: AgentAction;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string;
  reviewComment?: string;
  reviewedAt?: number;
}

export interface AgentRun {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  parentRunId?: string;
  input: Record<string, unknown>;
  decision?: AgentDecision;
  actions: AgentAction[];
  result?: AgentResult;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval';
  autonomyLevel: AutonomyLevel;
  startedAt?: number;
  finishedAt?: number;
  error?: { code: string; message: string };
}

// =============================================================================
// MISSION
// =============================================================================

export type CreativeMissionStatus =
  | 'draft'
  | 'planned'
  | 'approval_required'
  | 'running'
  | 'paused'
  | 'review'
  | 'completed'
  | 'learning'
  | 'iterating';

export interface Mission {
  id: string;
  workspaceId: string;
  creatorId: string;
  brandId?: string;
  title: string;
  objective: string;
  audience: string;
  geography: string;
  timeframeStart: number;
  timeframeEnd: number;
  budgetCents: number;
  spentCents: number;
  autonomyLevel: AutonomyLevel;
  channels: string[];
  monetizationGoals: string[];
  constraints: Record<string, unknown>;
  successMetrics: Record<string, number>;
  status: CreativeMissionStatus;
  currentPhase: string;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// PROVENANCE
// =============================================================================

export type ProvenanceAction =
  | 'created'
  | 'generated'
  | 'edited'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'derived'
  | 'archived';

export interface ProvenanceRecord {
  id: string;
  workspaceId: string;
  assetId: string;
  agentRunId?: string;
  action: ProvenanceAction;
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  model?: string;
  modelVersion?: string;
  prompt?: string;
  sourceAssetId?: string;
  humanEdits?: string;
  approvalId?: string;
  derivativeOf?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

// =============================================================================
// EXPERIMENT
// =============================================================================

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'cancelled';

export interface Experiment {
  id: string;
  workspaceId: string;
  projectId: string;
  hypothesis: string;
  metric: string;
  variants: ExperimentVariant[];
  audience: string;
  channel: string;
  status: ExperimentStatus;
  startedAt?: number;
  endedAt?: number;
  winnerVariantId?: string;
  confidence?: number;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string; // 'A' | 'B'
  description: string;
  assetId?: string;
  trafficPercent: number;
}

// =============================================================================
// PROVIDER ABSTRACTION
// =============================================================================

export type ModelCapability = 'text' | 'vision' | 'image' | 'video' | 'audio' | 'tts' | 'stt' | 'embedding' | 'reasoning' | 'code';
export type CostPolicy = 'cheap' | 'balanced' | 'quality' | 'premium';

export interface ModelPolicy {
  capability: ModelCapability;
  costPolicy: CostPolicy;
  maxCostCents?: number;
  maxLatencyMs?: number;
  fallbackProvider?: string;
  requiredQuality: number; // 0-1
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai_compatible' | 'openrouter' | 'byok_api_key' | 'local';
  apiKeyRef?: string; // encrypted key reference, never plaintext
  capabilities: ModelCapability[];
  models: ModelInfo[];
  isActive: boolean;
}

export interface ModelInfo {
  id: string;
  providerId: string;
  name: string;
  capability: ModelCapability;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  maxContextTokens: number;
  supportsImages: boolean;
  avgLatencyMs: number;
}

export interface ModelRequest {
  capability: ModelCapability;
  prompt: string;
  images?: string[];
  parameters: Record<string, unknown>;
  policy: ModelPolicy;
}

export interface ModelResponse {
  modelId: string;
  providerId: string;
  output: string | object;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  metadata: Record<string, unknown>;
}

// =============================================================================
// SIGNAL PROVIDERS
// =============================================================================

export interface MarketSignal {
  id: string;
  workspaceId: string;
  type: SignalType;
  source: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  confidence: number;
  relevanceScore: number;
  expiresAt?: number;
  consumed: boolean;
  createdAt: number;
}

// =============================================================================
// UTILITY
// =============================================================================

export function isAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === 'number' && [0, 1, 2, 3, 4].includes(value);
}

export function clampAutonomyLevel(level: number): AutonomyLevel {
  const clamped = Math.max(0, Math.min(4, Math.round(level)));
  return clamped as AutonomyLevel;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}