/**
 * Agent Governance YAML (AGY) Policy Evaluator & SHA-256 Digest Utilities
 *
 * @module tree/governance/policy/policy-evaluator
 */

import type { PolicyEvaluationRequest } from '@/seed/types/agent-governance';
import {
  computeEvaluationSha256,
  computeSha256Sync,
} from './policy-evaluator-helpers';

export { computeEvaluationSha256, computeSha256Sync };

/**
 * Matches a single permission pattern against a requested action.
 * Supports:
 * - Exact case-insensitive match (e.g., 'video:render' matches 'video:render')
 * - Global wildcard '*' (matches any action)
 * - Prefix wildcard 'prefix:*' (matches 'prefix:render' or 'prefix')
 *
 * Prevents delimiter bypass (e.g., 'video:*' does not match 'video_extra:read').
 */
export function matchPermission(pattern: string, action: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normAction = action.trim().toLowerCase();

  if (normPattern === '*' || normPattern === normAction) {
    return true;
  }

  if (normPattern.endsWith(':*')) {
    const prefix = normPattern.slice(0, -2);
    return normAction.startsWith(prefix + ':') || normAction === prefix;
  }

  return false;
}

/**
 * Generates the canonical digest string for policy evaluation results.
 */
export function buildEvaluationDigestPayload(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): string {
  return [
    request.agencyId,
    request.agentId,
    request.action.trim().toLowerCase(),
    request.requestedAutonomy,
    request.requestedComputeUnits,
    allowed ? '1' : '0',
    reason,
  ].join(':');
}

/**
 * Asynchronously generates SHA-256 evaluation digest using Web Crypto API.
 */
export async function generatePolicyEvaluationDigest(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): Promise<string> {
  const payload = buildEvaluationDigestPayload(request, allowed, reason);
  return computeEvaluationSha256(payload);
}

/**
 * Synchronous digest generator.
 */
export function generatePolicyEvaluationDigestSync(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string,
): string {
  const payload = buildEvaluationDigestPayload(request, allowed, reason);
  return computeSha256Sync(payload);
}
