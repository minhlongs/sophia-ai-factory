/**
 * Video Review Criteria Evaluator, Token Verification & Status Parsing
 *
 * Layer: tree/organizations/review
 * Allowed imports: @/seed/*
 */

import type { FeedbackComment } from '@/seed/types/agency-multitenancy';
import { isReviewTokenExpired } from '@/seed/security/review-token';

/**
 * Validates non-empty token string input.
 */
export function validateTokenInput(rawToken: unknown): string {
  if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
    throw new Error('VALIDATION_ERROR: INVALID_TOKEN: Review token is required');
  }
  return rawToken.trim();
}

/**
 * Safely parses feedback comments JSON array stored in database.
 */
export function parseFeedbackComments(jsonStr: string | null | undefined): FeedbackComment[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Normalizes DB status string to standard 3-state enum.
 */
export function normalizeReviewStatus(
  rawStatus: string | null | undefined
): 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' {
  const normalized = (rawStatus || '').toUpperCase();
  if (normalized === 'APPROVED') return 'APPROVED';
  if (normalized === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  return 'PENDING';
}

/**
 * Validates expiration timestamp against current clock.
 */
export function checkIsExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  return isReviewTokenExpired(expiresAt);
}

/**
 * Guards transition logic for reviews.
 * If already approved, prevents changes_requested regressions.
 * If approving again, signals idempotent completion.
 */
export function evaluateDecisionTransition(
  currentStatus: string | null | undefined,
  decision: 'approve' | 'request_changes'
): { isIdempotentApproval: boolean } {
  const normalized = (currentStatus || '').toLowerCase();
  if (normalized === 'approved') {
    if (decision === 'approve') {
      return { isIdempotentApproval: true };
    }
    throw new Error(
      'ALREADY_APPROVED: Cannot request changes on an approved video that has been scheduled/published'
    );
  }
  return { isIdempotentApproval: false };
}
