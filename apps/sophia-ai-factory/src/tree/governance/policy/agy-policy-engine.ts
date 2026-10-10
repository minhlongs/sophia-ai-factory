/**
 * Agent Governance YAML (AGY) Policy Engine Core Coordinator
 *
 * @module tree/governance/policy/agy-policy-engine
 */

import type {
  AutonomyLevel,
  AgentGovernanceYaml,
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
} from '@/seed/types/agent-governance';
import {
  generatePolicyEvaluationDigest,
  generatePolicyEvaluationDigestSync,
} from './policy-evaluator';
import {
  checkPermissionViolation,
  checkAutonomyViolation,
  checkComputeViolation,
} from './violation-enforcer';

/**
 * Synchronous core evaluation logic.
 */
export function evaluateAgyPolicySync(
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomyForAction: AutonomyLevel = 'L1',
): PolicyEvaluationVerdict {
  // 1 & 2: Permission check (Deny precedence over Allow)
  const permCheck = checkPermissionViolation(config, request.action);
  if (permCheck.violated) {
    const reason = permCheck.reason ?? 'ACTION_NOT_PERMITTED';
    const evaluationSha256 = generatePolicyEvaluationDigestSync(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(permCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 3: Autonomy hierarchy check
  const autoCheck = checkAutonomyViolation(
    config.agent.maxAutonomyLevel,
    request.requestedAutonomy,
    requiredAutonomyForAction
  );
  if (autoCheck.violated) {
    const reason = autoCheck.reason ?? 'AUTONOMY_LEVEL_EXCEEDED';
    const evaluationSha256 = generatePolicyEvaluationDigestSync(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(autoCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 4: Compute limit check
  const compCheck = checkComputeViolation(config, request);
  if (compCheck.violated) {
    const reason = compCheck.reason ?? 'COMPUTE_LIMIT_EXCEEDED';
    const evaluationSha256 = generatePolicyEvaluationDigestSync(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(compCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 5: Approved verdict
  const evaluationSha256 = generatePolicyEvaluationDigestSync(request, true, 'POLICY_APPROVED');
  return {
    allowed: true,
    reason: 'POLICY_APPROVED',
    requiredAutonomy: requiredAutonomyForAction,
    escalationTriggered: false,
    evaluationSha256,
  };
}

/**
 * Evaluates an inbound action request against the agent's governance policy.
 * Deterministic domain function with 0 side effects.
 * Uses Web Crypto API for SHA-256 evaluation digest computation.
 */
export async function evaluateAgyPolicy(
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomyForAction: AutonomyLevel = 'L1',
): Promise<PolicyEvaluationVerdict> {
  // 1 & 2: Permission check (Deny precedence over Allow)
  const permCheck = checkPermissionViolation(config, request.action);
  if (permCheck.violated) {
    const reason = permCheck.reason ?? 'ACTION_NOT_PERMITTED';
    const evaluationSha256 = await generatePolicyEvaluationDigest(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(permCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 3: Autonomy hierarchy check
  const autoCheck = checkAutonomyViolation(
    config.agent.maxAutonomyLevel,
    request.requestedAutonomy,
    requiredAutonomyForAction
  );
  if (autoCheck.violated) {
    const reason = autoCheck.reason ?? 'AUTONOMY_LEVEL_EXCEEDED';
    const evaluationSha256 = await generatePolicyEvaluationDigest(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(autoCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 4: Compute limit check
  const compCheck = checkComputeViolation(config, request);
  if (compCheck.violated) {
    const reason = compCheck.reason ?? 'COMPUTE_LIMIT_EXCEEDED';
    const evaluationSha256 = await generatePolicyEvaluationDigest(request, false, reason);
    return {
      allowed: false,
      reason,
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: Boolean(compCheck.escalationTriggered),
      evaluationSha256,
    };
  }

  // 5: Approved verdict
  const evaluationSha256 = await generatePolicyEvaluationDigest(request, true, 'POLICY_APPROVED');
  return {
    allowed: true,
    reason: 'POLICY_APPROVED',
    requiredAutonomy: requiredAutonomyForAction,
    escalationTriggered: false,
    evaluationSha256,
  };
}
