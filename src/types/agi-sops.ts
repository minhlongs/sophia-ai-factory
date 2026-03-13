/**
 * AGI SOPs TypeScript Types
 * Types for interacting with AGI SOPs Python backend
 */

export interface SOP {
  name: string;
  version: string;
  description: string;
  steps: SOPStep[];
  quality_gates: QualityGate[];
  metadata?: Record<string, unknown>;
}

export interface SOPStep {
  id: string;
  command: string;
  timeout?: number;
  validation?: string;
  rollback?: string;
  description?: string;
  status?: StepStatus;
  output?: string;
  error?: string;
  duration_ms?: number;
}

export interface QualityGate {
  name: string;
  check: string;
  description?: string;
  passed?: boolean;
  message?: string;
}

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';

export interface ExecutionResult {
  success: boolean;
  status: ExecutionStatus;
  sop_name: string;
  steps_completed: number;
  steps_failed: number;
  steps_skipped: number;
  duration_ms?: number;
  error?: string;
  outputs: Record<string, { success: boolean; output: string }>;
  rollback_performed?: boolean;
}

export interface SOPListResponse {
  sops: Array<{
    name: string;
    version: string;
    description: string;
    steps_count: number;
  }>;
}

export interface SearchResponse {
  results: Array<{
    name: string;
    content: string;
    distance: number;
  }>;
}

export interface PlanRequest {
  goal: string;
  context?: string;
}

export interface PlanResponse {
  plan: string;
  steps: Array<{
    id: string;
    description: string;
    command?: string;
  }>;
}
