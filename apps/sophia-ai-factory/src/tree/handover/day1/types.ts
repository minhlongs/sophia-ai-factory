/**
 * Types and options for Day-1 Operational Verification Engine.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/types
 */

import type {
  CheckpointResult,
  CheckpointStatus,
} from '@/seed/handover/handover-types';

export type { CheckpointResult, CheckpointStatus };

export interface Day1ProbeOptions {
  baseUrl?: string;
  timeoutMs?: number;
  skipNetworkCalls?: boolean;
}
