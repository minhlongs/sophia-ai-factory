/**
 * @file memory-goals.ts
 * @description Memory entities, confidence tiers, creative goals, and market signals.
 * @layer seed
 */

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
