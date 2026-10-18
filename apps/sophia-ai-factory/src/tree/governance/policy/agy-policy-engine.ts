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
import { evaluateAgyPolicySteps } from './agy-policy-steps';

/**
 * Synchronous core evaluation logic.
 */
export function evaluateAgyPolicySync(
  config: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomyForAction: AutonomyLevel = 'L1',
): PolicyEvaluationVerdict {
  const outcome = evaluateAgyPolicySteps(config, request, requiredAutonomyForAction);
  const evaluationSha256 = generatePolicyEvaluationDigestSync(
    request,
    outcome.allowed,
    outcome.reason,
  );
  return {
    ...outcome,
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
  const outcome = evaluateAgyPolicySteps(config, request, requiredAutonomyForAction);
  const evaluationSha256 = await generatePolicyEvaluationDigest(
    request,
    outcome.allowed,
    outcome.reason,
  );
  return {
    ...outcome,
    evaluationSha256,
  };
}
