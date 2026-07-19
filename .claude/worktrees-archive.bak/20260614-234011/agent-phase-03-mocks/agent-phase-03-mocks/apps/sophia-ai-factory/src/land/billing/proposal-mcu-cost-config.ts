/**
 * Proposal MCU (Model Compute Units) Cost Configuration
 *
 * Maps proposal-generation operations to MCU costs for unified billing.
 * Mirrors video-mcu-cost-config.ts shape — flat per-operation cost.
 */

export const PROPOSAL_MCU_COSTS = {
  GENERATE: 5,
} as const;

export type ProposalOperation = keyof typeof PROPOSAL_MCU_COSTS;

export function getProposalCost(operation: ProposalOperation): number {
  return PROPOSAL_MCU_COSTS[operation];
}
