/**
 * Policy Violation Enforcer & Escalation Trigger Resolver
 *
 * @module tree/governance/policy/violation-enforcer
 */

import type {
  AutonomyLevel,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
} from '@/seed/types/agent-governance';
import { AUTONOMY_RANKS } from './types';
import { matchPermission } from './policy-evaluator';

export interface ViolationCheckResult {
  violated: boolean;
  reason?: string;
  escalationTriggered?: boolean;
}

/**
 * Checks explicit deny and allow permissions against requested action.
 */
export function checkPermissionViolation(
  config: AgentGovernanceYaml,
  action: string
): ViolationCheckResult {
  const normAction = action.trim().toLowerCase();

  // 1. Explicit Deny Rules (DENY PRECEDENCE OVER ALLOW)
  for (const denyPattern of config.permissions.deny) {
    if (matchPermission(denyPattern, normAction)) {
      return {
        violated: true,
        reason: 'ACTION_EXPLICITLY_DENIED',
        escalationTriggered: config.escalation.onDisallowedAction === 'escalate_human',
      };
    }
  }

  // 2. Allow Rules
  let isAllowed = false;
  for (const allowPattern of config.permissions.allow) {
    if (matchPermission(allowPattern, normAction)) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    return {
      violated: true,
      reason: 'ACTION_NOT_PERMITTED',
      escalationTriggered: config.escalation.onDisallowedAction === 'escalate_human',
    };
  }

  return { violated: false };
}

/**
 * Checks autonomy hierarchy rank violations.
 */
export function checkAutonomyViolation(
  maxAutonomy: AutonomyLevel,
  requestedAutonomy: AutonomyLevel,
  requiredAutonomy: AutonomyLevel
): ViolationCheckResult {
  const agentRank = AUTONOMY_RANKS[maxAutonomy] ?? 0;
  const requestedRank = AUTONOMY_RANKS[requestedAutonomy] ?? 0;
  const requiredRank = AUTONOMY_RANKS[requiredAutonomy] ?? 0;

  if (requestedRank > agentRank || requiredRank > agentRank) {
    return {
      violated: true,
      reason: 'AUTONOMY_LEVEL_EXCEEDED',
      escalationTriggered: true,
    };
  }

  return { violated: false };
}

/**
 * Checks compute limits against max configured MCU.
 */
export function checkComputeViolation(
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest
): ViolationCheckResult {
  if (
    request.requestedComputeUnits > config.compute.maxComputeUnitsMcu ||
    request.requestedComputeUnits <= 0 ||
    !Number.isFinite(request.requestedComputeUnits)
  ) {
    return {
      violated: true,
      reason: 'COMPUTE_LIMIT_EXCEEDED',
      escalationTriggered: config.escalation.onQuotaExceeded === 'request_approval',
    };
  }

  return { violated: false };
}
