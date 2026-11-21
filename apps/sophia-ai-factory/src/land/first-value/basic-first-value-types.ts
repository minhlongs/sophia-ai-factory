/**
 * Types and dependency-injection contracts for BasicFirstValueService.
 *
 * @module land/first-value/basic-first-value-types
 */

import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { FirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import type {
  HonestValidationReceipt,
  ProviderAuthStatus,
} from '@/tree/byok/honest-validation-receipt';
import type { KeyCapability } from '@/tree/byok/validation-receipt-types';
import type {
  FirstValuePrivateExport,
  FirstValueScriptArtifact,
  FirstValueSessionContext,
  ScriptProvenance,
} from '@/tree/first-value/first-value-contract';
import type { FirstValueFunnelCollector } from '@/tree/first-value/funnel-metrics';

export type FirstValueErrorCode =
  | 'UNAUTHENTICATED'
  | 'WRONG_ORGANIZATION'
  | 'INVALID_BYOK_FORMAT'
  | 'MISSING_BYOK'
  | 'BYOK_STORAGE_FAILED'
  | 'TAMPERED_RECEIPT'
  | 'PAID_INFERENCE_NOT_AUTHORIZED'
  | 'PROVIDER_AUTH_NOT_VERIFIED'
  | 'PROVIDER_TIMEOUT'
  | 'INVALID_SCRIPT_SCHEMA'
  | 'MCU_INSUFFICIENT'
  | 'ARTIFACT_NOT_FOUND'
  | 'EXPLICIT_USER_ACTION_REQUIRED'
  | 'SCRIPT_NOT_ACCEPTED';

export type FirstValueResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: FirstValueErrorCode; readonly error: string };

export interface ProviderAuthProbeOutcome {
  readonly status: ProviderAuthStatus;
  readonly probedCapabilities?: readonly KeyCapability[];
}

export interface BasicFirstValueDeps {
  readonly signingSecret: string;
  readonly verifyOrgMembership: (orgId: string, userId: string) => Promise<boolean>;
  readonly storeEncryptedKey: (userId: string, orgId: string, provider: string, key: string) => Promise<void>;
  readonly probeProviderAuth?: (
    provider: string,
    key: string,
  ) => Promise<ProviderAuthProbeOutcome>;
  readonly generateWithProvider?: (args: {
    userId: string;
    orgId: string;
    provider: string;
    model: string;
    topic: string;
    audience: string;
    durationSec: number;
  }) => Promise<unknown>;
  readonly chargeMcu: (args: {
    userId: string;
    orgId: string;
    missionId: string;
    amount: number;
  }) => Promise<boolean>;
  readonly notifyOptional?: (args: {
    userId: string;
    orgId: string;
    artifactId: string;
  }) => Promise<void>;
  readonly collector?: FirstValueFunnelCollector;
  readonly nowMs?: () => number;
}

export interface ConfigureByokInput {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly orgId: string;
  readonly provider: string;
  readonly rawKey: string;
  readonly verifyWithProvider?: boolean;
}

export interface PreviewCostInput {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly orgId: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly receipt: HonestValidationReceipt;
  readonly customRateCard?: Readonly<Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }>>;
}

export interface GenerateForReviewInput {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly orgId: string;
  readonly idempotencyKey: string;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly model: string;
  readonly receipt: HonestValidationReceipt;
  readonly mode: ScriptProvenance;
  readonly authorizePaidInference?: boolean;
}

export interface ReviewScriptInput {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly orgId: string;
  readonly artifactId: string;
  readonly decision: 'accept' | 'reject';
  readonly explicitUserAction: boolean;
  readonly reason?: string;
}

export interface RetrievePrivateScriptInput {
  readonly userId: string | null;
  readonly orgId: string;
  readonly artifactId: string;
  readonly format: 'json' | 'markdown';
  readonly allowPendingPreview?: boolean;
}

export type {
  FirstValueCostPreview,
  FirstValuePrivateExport,
  FirstValueScriptArtifact,
  FirstValueSessionContext,
  HonestValidationReceipt,
  ScriptOutput,
};
