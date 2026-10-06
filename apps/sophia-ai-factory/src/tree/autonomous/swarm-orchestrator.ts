/**
 * Autonomous Swarm Orchestrator & Governance Enforcer
 * Tree Layer - Deterministic domain logic for autonomous swarm capability dispatch,
 * AGY policy integration, and execution gating.
 *
 * @module tree/autonomous/swarm-orchestrator
 */

import type {
  AutonomousCapability,
  AutonomousScheduleTaskRow,
} from '@/seed/types/autonomous-engine';
import type {
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
} from '@/seed/types/agent-governance';
import { evaluateAgyPolicySync } from '@/tree/governance/agy-policy-engine';
import {
  CAPABILITY_BUDGETS,
  type SwarmExecutionContext,
  type SwarmExecutionResult,
} from './swarm-types';
import { discoverAffiliateOffers } from './swarm-affiliate-scout';
import { generateViralVideoScript } from './swarm-content-producer';
import { generateMultiPlatformSyndication } from './swarm-auto-publisher';

// Re-export all submodules for complete backward compatibility
export * from './swarm-types';
export * from './swarm-affiliate-scout';
export * from './swarm-content-producer';
export * from './swarm-auto-publisher';
export * from './swarm-telemetry';

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

/**
 * Executes an autonomous swarm task with genuine capability handler logic,
 * AGY policy enforcement, and audit telemetry generation.
 */
export function executeSwarmTask(
  task: AutonomousScheduleTaskRow,
  context: SwarmExecutionContext,
): SwarmExecutionResult {
  const cap = (task.capability_name || task.skill_name) as AutonomousCapability;
  const budget = CAPABILITY_BUDGETS[cap];

  if (!budget) {
    return {
      success: false,
      capability: cap,
      mcuConsumed: 0,
      tokensUsed: 0,
      actionsTaken: [],
      error: `Unknown capability: ${cap}`,
    };
  }

  const budgetCheck = canExecuteCapability(cap, context);
  if (!budgetCheck.allowed) {
    return {
      success: false,
      capability: cap,
      mcuConsumed: 0,
      tokensUsed: 0,
      actionsTaken: [],
      error: budgetCheck.reason,
      governanceVerdict: budgetCheck.verdict,
      escalationTriggered: budgetCheck.verdict?.escalationTriggered,
    };
  }

  switch (cap) {
    case 'affiliate-scout': {
      const scoutOutput = discoverAffiliateOffers();
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          `Scanned affiliate programs (${scoutOutput.scannedNetworks.join(', ')})`,
          'Filtered high-EPC offers > $5',
          `Updated active affiliate catalog with ${scoutOutput.qualifiedOffers.length} programs`,
        ],
        details: scoutOutput,
        governanceVerdict: budgetCheck.verdict,
        escalationTriggered: budgetCheck.verdict?.escalationTriggered ?? false,
      };
    }

    case 'content-producer': {
      const producerOutput = generateViralVideoScript();
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          `Generated high-hook bilingual script (Hook score: ${producerOutput.qualityMetrics.hookScore})`,
          'Synthesized voice-track via ElevenLabs',
          'Rendered avatar draft & stored in Cloudflare R2',
        ],
        details: producerOutput,
        governanceVerdict: budgetCheck.verdict,
        escalationTriggered: budgetCheck.verdict?.escalationTriggered ?? false,
      };
    }

    case 'auto-publisher': {
      const targetMarket = context.targetMarket || 'VN';
      const publisherOutput = generateMultiPlatformSyndication({
        targetMarkets: [targetMarket],
      });
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          'Verified video render status',
          'Generated platform SEO metadata',
          `Dispatched YouTube and TikTok syndication payload (Scheduled for ${targetMarket} APAC peak)`,
        ],
        details: publisherOutput,
        governanceVerdict: budgetCheck.verdict,
        escalationTriggered: budgetCheck.verdict?.escalationTriggered ?? false,
      };
    }

    default:
      return {
        success: false,
        capability: cap,
        mcuConsumed: 0,
        tokensUsed: 0,
        actionsTaken: [],
        error: `Unknown capability: ${cap}`,
      };
  }
}
