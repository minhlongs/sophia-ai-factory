/**
 * OPC Affiliate execution contract (pure domain logic, zero I/O).
 *
 * A render manifest, a queued job or an accepted webhook is NOT media, NOT a
 * publication and NOT a succeeded campaign. This module is the single place
 * where a state transition is allowed, so every producer (server action,
 * Telegram handler, Inngest job, callback) speaks the same truth.
 *
 * Layer: tree/affiliate/execution
 * @module tree/affiliate/execution/execution-contract
 */

import { success, failure, type Result } from '@/seed/types/result';

export const EXECUTION_STATES = [
  'draft',
  'approval_pending',
  'render_queued',
  'rendered',
  'publish_queued',
  'published',
  'blocked',
  'failed',
  'cancelled',
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];

export type ExecutionBlockReason =
  | 'TENANT_REQUIRED'
  | 'UNVERIFIED_ELIGIBILITY'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_INVALIDATED'
  | 'KILL_SWITCH_ACTIVE'
  | 'BUDGET_EXCEEDED'
  | 'CREDENTIALS_MISSING'
  | 'PROVIDER_UNAVAILABLE'
  | 'MEDIA_NOT_VERIFIED'
  | 'LINK_OR_ACCOUNT_MISSING'
  | 'INVALID_TRANSITION'
  | 'UNCERTAIN_OUTCOME';

export interface VerifiedArtifact {
  id: string;
  storageKey: string;
  mediaType: string;
  byteSize: number;
  checksumSha256: string;
  /** Fixtures may be used by tests, never presented as a real production render. */
  isFixture: boolean;
  verifiedAtMs: number;
  durationSec?: number;
}

export interface ApprovalEvidence {
  status: 'approved' | 'pending_ceo' | 'invalidated_by_mutation' | 'aborted_by_kill_switch' | 'revoked' | 'executed' | string;
  /** Hash recomputed from the CURRENT payload at the side-effect boundary. */
  currentHash: string;
  /** Hash persisted when the CEO approved. */
  storedHash: string;
  approvedAtMs?: number | null;
  expiresAtMs?: number | null;
  revokedAtMs?: number | null;
  nowMs: number;
}

export interface ExecutionEvidence {
  tenantId: string;
  state: ExecutionState;
  /** A supported, verified jurisdiction AND verified offer terms are required. */
  jurisdictionKnown: boolean;
  termsVerified: boolean;
  approval: ApprovalEvidence;
  killSwitchActive: boolean;
  reservedCostCents: number;
  maxCostCents: number;
  credentialsConnected: boolean;
  voiceover?: { success: boolean; provider: 'elevenlabs' | 'mock' | string; isFixture: boolean };
  artifact?: VerifiedArtifact | null;
  affiliateTargetUrl?: string;
  targetAccount?: string;
  /** Provider/DB result could not be determined (timeout, network cut, restart). */
  outcomeKnown?: boolean;
}

export interface GateDecision {
  nextState: ExecutionState;
  reason: ExecutionBlockReason | null;
}

/**
 * Byte-level proof that an artifact is real media, not a manifest/descriptor.
 *
 * A TypeScript `VerifiedArtifact` type is only a compile-time claim: a caller
 * (a render worker, a replay, a malformed provider callback) can still hand us
 * an object with zero bytes or an empty checksum. This predicate is the single
 * source of truth reused by BOTH the pure gates (artifact + publish) and the
 * durable repository (`recordVerifiedArtifact`) so no boundary can report
 * `rendered`/`publish_queued` on unverified media.
 *
 * `isFixture` stays allowed here only because the callers that persist media
 * must set `is_fixture` and never present it to an operator as a real render;
 * byte-level verification is independent of that flag.
 */
export function hasVerifiedMedia(
  artifact: VerifiedArtifact | null | undefined,
): boolean {
  if (!artifact) return false;
  return (
    artifact.byteSize > 0 &&
    typeof artifact.checksumSha256 === 'string' &&
    artifact.checksumSha256.length > 0 &&
    typeof artifact.storageKey === 'string' &&
    artifact.storageKey.length > 0 &&
    typeof artifact.verifiedAtMs === 'number' &&
    Number.isFinite(artifact.verifiedAtMs) &&
    artifact.verifiedAtMs > 0
  );
}

const ALLOWED_TRANSITIONS: Record<ExecutionState, readonly ExecutionState[]> = {
  draft: ['approval_pending', 'blocked', 'cancelled'],
  approval_pending: ['render_queued', 'blocked', 'failed', 'cancelled'],
  render_queued: ['rendered', 'blocked', 'failed', 'cancelled'],
  rendered: ['publish_queued', 'blocked', 'failed', 'cancelled'],
  publish_queued: ['published', 'blocked', 'failed'],
  published: [],
  blocked: ['approval_pending', 'render_queued', 'cancelled'],
  failed: ['render_queued', 'cancelled'],
  cancelled: [],
};

export function isTerminalState(state: ExecutionState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

export function transitionExecutionState(
  from: ExecutionState,
  to: ExecutionState,
): Result<GateDecision, ExecutionBlockReason> {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return failure('INVALID_TRANSITION');
  }
  return success({ nextState: to, reason: null });
}

function approvalFailure(approval: ApprovalEvidence): ExecutionBlockReason | null {
  if (approval.revokedAtMs !== null && approval.revokedAtMs !== undefined) {
    return 'APPROVAL_INVALIDATED';
  }
  if (approval.expiresAtMs !== null && approval.expiresAtMs !== undefined && approval.nowMs > approval.expiresAtMs) {
    return 'APPROVAL_INVALIDATED';
  }
  if (approval.status !== 'approved') return 'APPROVAL_REQUIRED';
  if (approval.currentHash !== approval.storedHash) return 'APPROVAL_INVALIDATED';
  return null;
}

/** Common safety checks, deliberately re-run after every retry/sleep. */
function commonGate(evidence: ExecutionEvidence): ExecutionBlockReason | null {
  if (!evidence.tenantId || evidence.tenantId === 'default') return 'TENANT_REQUIRED';
  if (evidence.outcomeKnown === false) return 'UNCERTAIN_OUTCOME';
  if (evidence.killSwitchActive) return 'KILL_SWITCH_ACTIVE';
  if (!evidence.jurisdictionKnown || !evidence.termsVerified) return 'UNVERIFIED_ELIGIBILITY';
  const approvalError = approvalFailure(evidence.approval);
  if (approvalError) return approvalError;
  if (evidence.reservedCostCents > evidence.maxCostCents) return 'BUDGET_EXCEEDED';
  if (!evidence.credentialsConnected) return 'CREDENTIALS_MISSING';
  return null;
}

/**
 * Gate BEFORE spending on TTS / render. Success means "may enqueue the render",
 * never "media exists".
 */
export function evaluateRenderGate(evidence: ExecutionEvidence): Result<GateDecision, ExecutionBlockReason> {
  const common = commonGate(evidence);
  if (common) return failure(common);

  // A failed or mock voiceover must never be reported as a produced asset.
  if (evidence.voiceover && (!evidence.voiceover.success || (evidence.voiceover.provider === 'mock' && !evidence.voiceover.isFixture))) {
    return failure('PROVIDER_UNAVAILABLE');
  }

  const transition = transitionExecutionState(evidence.state, 'render_queued');
  if (!transition.ok) return failure(transition.error);
  return success({ nextState: 'render_queued', reason: null });
}

/**
 * Gate for marking a run `rendered`. Requires verified byte-level media metadata.
 * A manifest / descriptor / prompt list is explicitly insufficient.
 */
export function evaluateArtifactGate(evidence: ExecutionEvidence): Result<GateDecision, ExecutionBlockReason> {
  const common = commonGate(evidence);
  if (common) return failure(common);
  if (!hasVerifiedMedia(evidence.artifact)) {
    return failure('MEDIA_NOT_VERIFIED');
  }
  const transition = transitionExecutionState(evidence.state, 'rendered');
  if (!transition.ok) return failure(transition.error);
  return success({ nextState: 'rendered', reason: null });
}

/**
 * Gate immediately BEFORE a publish side effect. Re-verifies approval, halt,
 * budget and payload binding — a check done earlier in the job is not enough.
 */
export function evaluatePublishGate(evidence: ExecutionEvidence): Result<GateDecision, ExecutionBlockReason> {
  const common = commonGate(evidence);
  if (common) return failure(common);
  // Re-verify byte-level media HERE, immediately before the publish side effect.
  // A truthy manifest/descriptor object is not proof of rendered bytes, and the
  // artifact gate may have run in an earlier step/retry of the job.
  if (!hasVerifiedMedia(evidence.artifact)) return failure('MEDIA_NOT_VERIFIED');
  if (!evidence.affiliateTargetUrl || !evidence.targetAccount) return failure('LINK_OR_ACCOUNT_MISSING');
  const transition = transitionExecutionState(evidence.state, 'publish_queued');
  if (!transition.ok) return failure(transition.error);
  return success({ nextState: 'publish_queued', reason: null });
}

/** Honest terminal state for skipped / errored / uncertain work. */
export function blockExecution(reason: ExecutionBlockReason): GateDecision {
  return { nextState: 'blocked', reason };
}
