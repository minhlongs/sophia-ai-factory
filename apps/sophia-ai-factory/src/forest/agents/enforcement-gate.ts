/**
 * Enforcement Gate — Tier-based access control for AI agents
 * Layer: forest
 * Purpose: Validates that a user's subscription tier allows the requested agent role
 */

import type { Tier } from '@/seed/types';

/**
 * Error thrown when a tier cannot run a specific agent role
 */
export class AgentTierBlockedError extends Error {
  public readonly agentRole: string;
  public readonly requiredTier: string;
  public readonly userTier: string;
  public readonly errorClass = 'tier_blocked';

  constructor(agentRole: string, requiredTier: string, userTier: string) {
    super(`Agent role "${agentRole}" requires tier "${requiredTier}", but user has "${userTier}"`);
    this.name = 'AgentTierBlockedError';
    this.agentRole = agentRole;
    this.requiredTier = requiredTier;
    this.userTier = userTier;
  }
}

/**
 * Role-to-tier requirement mapping
 * Returns a COPY to prevent mutations from affecting gate logic
 */
export function getAgentRoleTierMap(): Record<string, Tier> {
  return {
    CEO: 'PREMIUM',
    CTO: 'ENTERPRISE',
    CSO: 'ENTERPRISE',
    CMO: 'ENTERPRISE',
    COO: 'ENTERPRISE',
    Developer: 'PREMIUM',
    QA: 'BASIC',
    Ops: 'BASIC',
    Marketing: 'PREMIUM',
  };
}

/**
 * Determines if a given user tier can run an agent with the specified role
 * @throws AgentTierBlockedError if the combination is not allowed
 */
export function assertTierAllowsAgent(userTier: Tier, agentRole: string): void {
  const roleMap = getAgentRoleTierMap();
  const requiredTier = roleMap[agentRole] ?? 'ENTERPRISE';

  // MASTER bypasses all checks
  if (userTier === 'MASTER') {
    return;
  }

  // Compare tier ranks
  const tierRanks: Record<Tier, number> = {
    BASIC: 0,
    PREMIUM: 1,
    ENTERPRISE: 2,
    MASTER: 3,
  };

  if (tierRanks[userTier] < tierRanks[requiredTier]) {
    throw new AgentTierBlockedError(agentRole, requiredTier, userTier);
  }
}
