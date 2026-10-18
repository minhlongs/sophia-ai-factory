/**
 * AGY Policy Evaluation Steps — Shared check pipeline for sync and async policy engines.
 *
 * @module tree/governance/policy/agy-policy-steps
 */

import type {
  AutonomyLevel,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
} from '@/seed/types/agent-governance';
import {
  checkPermissionViolation,
  checkAutonomyViolation,
  checkComputeViolation,
} from './violation-enforcer';

export interface PolicyStepOutcome {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredAutonomy: AutonomyLevel;
  readonly escalationTriggered: boolean;
}

/**
 * Evaluates permission, autonomy, and compute checks in sequence.
 */
export function evaluateAgyPolicySteps(
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomyForAction: AutonomyLevel = 'L1',
): PolicyStepOutcome {
  // 1 & 2: Permission check (Deny precedence over Allow)
  const permCheck = checkPermissionViolation(config, request.action);
  if (permCheck.violated) {
    return {
      allowed: false,
      reason: permCheck.reason ?? 'ACTION_NOT_PERMITTED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(permCheck.escalationTriggered),
    };
  }

  // 3: Autonomy hierarchy check
  const autoCheck = checkAutonomyViolation(
    config.agent.maxAutonomyLevel,
    request.requestedAutonomy,
    requiredAutonomyForAction,
  );
  if (autoCheck.violated) {
    return {
      allowed: false,
      reason: autoCheck.reason ?? 'AUTONOMY_LEVEL_EXCEEDED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(autoCheck.escalationTriggered),
    };
  }

  // 4: Compute limit check
  const compCheck = checkComputeViolation(config, request);
  if (compCheck.violated) {
    return {
      allowed: false,
      reason: compCheck.reason ?? 'COMPUTE_LIMIT_EXCEEDED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(compCheck.escalationTriggered),
    };
  }

  // 5: Approved verdict
  return {
    allowed: true,
    reason: 'POLICY_APPROVED',
    requiredAutonomy: requiredAutonomyForAction,
    escalationTriggered: false,
  };
}
