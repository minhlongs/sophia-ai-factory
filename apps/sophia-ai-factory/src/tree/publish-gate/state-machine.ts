/**
 * Compliance Publish Gate — Explicit 12-State Machine.
 *
 * Server-side transition authority. Real-world `PUBLISHED` status is forbidden.
 * Rejected, expired, and terminal simulated states cannot be silently mutated or executed.
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/state-machine
 */

import type { PublishGateState } from './types';

export const ALLOWED_PUBLISH_GATE_TRANSITIONS: Readonly<
  Record<PublishGateState, readonly PublishGateState[]>
> = {
  DRAFT: ['PREFLIGHT_REQUIRED', 'PREFLIGHT_BLOCKED', 'READY_FOR_REVIEW'],
  PREFLIGHT_REQUIRED: ['PREFLIGHT_BLOCKED', 'READY_FOR_REVIEW'],
  PREFLIGHT_BLOCKED: ['PREFLIGHT_REQUIRED', 'READY_FOR_REVIEW'],
  READY_FOR_REVIEW: ['AWAITING_HUMAN_APPROVAL', 'PREFLIGHT_REQUIRED'],
  AWAITING_HUMAN_APPROVAL: [
    'APPROVED',
    'REJECTED',
    'APPROVAL_EXPIRED',
    'PREFLIGHT_REQUIRED',
  ],
  APPROVED: ['MOCK_EXECUTION_CLAIMED', 'APPROVAL_EXPIRED', 'PREFLIGHT_REQUIRED'],
  REJECTED: [],
  APPROVAL_EXPIRED: [],
  MOCK_EXECUTION_CLAIMED: [
    'SIMULATED_PUBLISHED',
    'SIMULATED_FAILED',
    'RECONCILIATION_REQUIRED',
  ],
  SIMULATED_PUBLISHED: [],
  SIMULATED_FAILED: [],
  RECONCILIATION_REQUIRED: ['SIMULATED_PUBLISHED', 'SIMULATED_FAILED'],
};

const TERMINAL_STATES = new Set<PublishGateState>([
  'REJECTED',
  'APPROVAL_EXPIRED',
  'SIMULATED_PUBLISHED',
  'SIMULATED_FAILED',
]);

export function canTransitionPublishGate(
  from: PublishGateState,
  to: PublishGateState,
): boolean {
  return ALLOWED_PUBLISH_GATE_TRANSITIONS[from].includes(to);
}

export function isTerminalPublishGateState(state: PublishGateState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isMutableBeforeApproval(state: PublishGateState): boolean {
  return (
    state === 'DRAFT' ||
    state === 'PREFLIGHT_REQUIRED' ||
    state === 'PREFLIGHT_BLOCKED' ||
    state === 'READY_FOR_REVIEW' ||
    state === 'AWAITING_HUMAN_APPROVAL'
  );
}

export interface TransitionValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export function validatePublishGateTransition(
  from: PublishGateState,
  to: PublishGateState,
): TransitionValidationResult {
  if (canTransitionPublishGate(from, to)) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Invalid publish-gate state transition from ${from} to ${to}`,
  };
}
