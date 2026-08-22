/**
 * Typed domain error hierarchy for the Creative Economy OS.
 *
 * Every error carries a `code` discriminator so callers can branch on the
 * failure kind without string-matching messages. Style mirrors
 * `seed/types/failure-kind.ts` (enum-like code table) and `seed/types/result.ts`
 * (explicit success/failure, no silent swallowing).
 *
 * @module seed/types/creative-economy/errors
 */

import type { Result } from '@/seed/types/result'
import { failure } from '@/seed/types/result'

// ─── Error code table ────────────────────────────────────────────────────────

export const CreativeEconomyErrorCode = {
  INVALID_STATE_TRANSITION: 'invalid-state-transition',
  APPROVAL_REQUIRED: 'approval-required',
  BUDGET_EXCEEDED: 'budget-exceeded',
  PROVIDER_UNAVAILABLE: 'provider-unavailable',
  PROVENANCE_MISSING: 'provenance-missing',
} as const

export type CreativeEconomyErrorCode =
  (typeof CreativeEconomyErrorCode)[keyof typeof CreativeEconomyErrorCode]

// ─── Base error ──────────────────────────────────────────────────────────────

export class CreativeEconomyError extends Error {
  readonly code: CreativeEconomyErrorCode

  constructor(code: CreativeEconomyErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'CreativeEconomyError'
    this.code = code
  }
}

// ─── Concrete error kinds ────────────────────────────────────────────────────

export class InvalidStateTransitionError extends CreativeEconomyError {
  readonly from: string
  readonly to: string
  readonly allowed: readonly string[]

  constructor(from: string, to: string, allowed: readonly string[]) {
    super(
      CreativeEconomyErrorCode.INVALID_STATE_TRANSITION,
      `Invalid state transition: ${from} -> ${to}. Allowed: ${allowed.join(', ') || '(none)'}`,
    )
    this.name = 'InvalidStateTransitionError'
    this.from = from
    this.to = to
    this.allowed = allowed
  }
}

export class ApprovalRequiredError extends CreativeEconomyError {
  readonly actionType: string
  readonly approvalRequestId?: string

  constructor(actionType: string, approvalRequestId?: string) {
    super(
      CreativeEconomyErrorCode.APPROVAL_REQUIRED,
      `Action "${actionType}" requires human approval before execution`,
    )
    this.name = 'ApprovalRequiredError'
    this.actionType = actionType
    this.approvalRequestId = approvalRequestId
  }
}

export class BudgetExceededError extends CreativeEconomyError {
  readonly requestedCents: number
  readonly remainingCents: number

  constructor(requestedCents: number, remainingCents: number) {
    super(
      CreativeEconomyErrorCode.BUDGET_EXCEEDED,
      `Requested ${requestedCents} cents exceeds remaining budget of ${remainingCents} cents`,
    )
    this.name = 'BudgetExceededError'
    this.requestedCents = requestedCents
    this.remainingCents = remainingCents
  }
}

export class ProviderUnavailableError extends CreativeEconomyError {
  readonly providerId: string
  readonly capability: string

  constructor(providerId: string, capability: string, options?: { cause?: unknown }) {
    super(
      CreativeEconomyErrorCode.PROVIDER_UNAVAILABLE,
      `Provider "${providerId}" is unavailable for capability "${capability}"`,
      options,
    )
    this.name = 'ProviderUnavailableError'
    this.providerId = providerId
    this.capability = capability
  }
}

export class ProvenanceMissingError extends CreativeEconomyError {
  readonly assetId: string
  readonly requiredAction: string

  constructor(assetId: string, requiredAction: string) {
    super(
      CreativeEconomyErrorCode.PROVENANCE_MISSING,
      `Asset "${assetId}" is missing a provenance record for action "${requiredAction}"`,
    )
    this.name = 'ProvenanceMissingError'
    this.assetId = assetId
    this.requiredAction = requiredAction
  }
}

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isCreativeEconomyError(error: unknown): error is CreativeEconomyError {
  return error instanceof CreativeEconomyError
}

export function isErrorCode(
  error: unknown,
  code: CreativeEconomyErrorCode,
): error is CreativeEconomyError {
  return isCreativeEconomyError(error) && error.code === code
}

// ─── Result bridge ───────────────────────────────────────────────────────────

/** Wrap a thrown CreativeEconomyError into a failure Result. */
export function toFailure(error: CreativeEconomyError): Result<never, CreativeEconomyError> {
  return failure(error)
}