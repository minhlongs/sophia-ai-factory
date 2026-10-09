/**
 * Production-Safe Mission Preflight Checklist: Domain Types.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/types
 */

import type { AICapability } from '@/seed/ai/capability-model';
import type { ByokProvider } from '@/tree/byok/user-api-key-store';

export interface PreflightGateCheck {
  passed: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MissionPreflightChecklist {
  auth: PreflightGateCheck;
  ownership: PreflightGateCheck;
  entitlement: PreflightGateCheck;
  credential: PreflightGateCheck;
  capability: PreflightGateCheck;
  storage: PreflightGateCheck;
  queue: PreflightGateCheck;
}

export interface MissionPreflightResult {
  passed: boolean;
  failureCode?: string;
  failureReason?: string;
  gates: MissionPreflightChecklist;
}

export interface MissionPreflightOptions {
  /** User ID. If omitted, will be fetched via getCurrentUser(). */
  userId?: string;
  /** Workspace ID to check membership for. */
  workspaceId: string;
  /** Required capability for this mission. Default: 'AI_IMAGE' */
  capability?: AICapability;
  /** Composite required capabilities for multi-track missions. */
  requiredCapabilities?: readonly AICapability[] | AICapability[];
  /** Specific required BYOK provider, if any. */
  requiredProvider?: ByokProvider;
  /** Estimated cost of single mission in cents (spike guard). */
  estimatedCostCents?: number;
  /** Optional overrides for testing/dependency injection */
  overrides?: {
    storageReady?: boolean;
    queueReady?: boolean;
    mcuBalance?: number;
    tier?: string;
    membershipVerified?: boolean;
  };
}

export interface AuthGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
  resolvedUserId?: string;
}

export interface PreflightGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
}

export interface CredentialGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
  configuredProviders: ByokProvider[];
}
