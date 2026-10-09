/**
 * @file ai-provider.ts
 * @description Provider abstractions, policies, models, and requests/responses for creative AI.
 * @layer seed
 */

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'image'
  | 'video'
  | 'audio'
  | 'tts'
  | 'stt'
  | 'embedding'
  | 'reasoning'
  | 'code';

export type CostPolicy = 'cheap' | 'balanced' | 'quality' | 'premium';

export interface ModelPolicy {
  capability: ModelCapability;
  costPolicy: CostPolicy;
  maxCostCents?: number;
  maxLatencyMs?: number;
  fallbackProvider?: string;
  requiredQuality: number; // 0-1
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

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai_compatible' | 'openrouter' | 'byok_api_key' | 'local';
  apiKeyRef?: string; // encrypted key reference, never plaintext
  capabilities: ModelCapability[];
  models: ModelInfo[];
  isActive: boolean;
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

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
