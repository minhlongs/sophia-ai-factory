/**
 * Capability budget and AGY governance policy gate for autonomous swarm tasks.
 * @module tree/autonomous/swarm-capability-gate
 */

import type { AutonomousCapability } from '@/seed/types/autonomous-engine';
import type {
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
} from '@/seed/types/agent-governance';
import { evaluateAgyPolicySync } from '@/tree/governance/agy-policy-engine';
import {
  CAPABILITY_BUDGETS,
  type SwarmExecutionContext,
} from './swarm-types';

/**
 * Validates capability execution against MCU budget, cycle token limits, and AGY governance policies.
 */
export function canExecuteCapability(
  capability: AutonomousCapability,
  context: SwarmExecutionContext,
): { allowed: boolean; reason?: string; verdict?: PolicyEvaluationVerdict } {
  const budget = CAPABILITY_BUDGETS[capability];
  if (!budget) {
    return { allowed: false, reason: `Unknown capability: ${capability}` };
  }

  if (context.availableMcu < budget.mcuRequired) {
    return {
      allowed: false,
      reason: `Insufficient MCU: required ${budget.mcuRequired}, available ${context.availableMcu}`,
    };
  }

  if (context.maxTokensPerCycle < budget.tokensEstimate) {
    return {
      allowed: false,
      reason: `Cycle token limit exceeded: estimate ${budget.tokensEstimate}, cap ${context.maxTokensPerCycle}`,
    };
  }

  if (context.agyConfig) {
    const policyReq: PolicyEvaluationRequest = {
      agencyId: context.tenantId || 'default',
      agentId: `agent-${capability}`,
      action: budget.actionName,
      requestedAutonomy: context.requestedAutonomy || budget.requiredAutonomy,
      requestedComputeUnits: budget.mcuRequired,
    };
    const verdict = evaluateAgyPolicySync(
      context.agyConfig,
      policyReq,
      budget.requiredAutonomy,
    );
    if (!verdict.allowed) {
      return {
        allowed: false,
        reason: `Governance policy rejected action ${budget.actionName}: ${verdict.reason}`,
        verdict,
      };
    }
    return { allowed: true, verdict };
  }

  return { allowed: true };
}
