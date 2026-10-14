import type { PipelineStage } from '@/seed/types/unit-economics-types';

export const DEFAULT_LATENCY_THRESHOLD_MS = 6_000; // 6 seconds SLA ceiling

export interface FallbackExecutionParams<T> {
  stage: PipelineStage;
  primaryProvider: string;
  execute: (provider: string) => Promise<T>;
  fallbackChain?: string[];
  tenantKeyRef?: string;
  latencyThresholdMs?: number;
}
