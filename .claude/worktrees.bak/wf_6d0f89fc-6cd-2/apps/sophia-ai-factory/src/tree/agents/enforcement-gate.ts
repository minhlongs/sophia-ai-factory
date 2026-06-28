/**
 * Agent Enforcement Gate — tier-based pre-task access control.
 * Called before any LLM invocation in the runner.
 * Throws AgentTierBlockedError if user's tier does not permit the agent role.
 */

import type { AgentRole } from './types';

/** Tier hierarchy (ascending) */
const TIER_ORDER: string[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

/**
 * Maps each agent role to the minimum tier required to run it.
 * BASIC: no agent execution permitted.
 * PREMIUM: CEO + Developer roles.
 * ENTERPRISE: all current roles.
 * MASTER: unlimited (bypass all gates).
 */
const ROLE_MIN_TIER: Record<AgentRole, string> = {
  CEO: 'PREMIUM',
  CTO: 'ENTERPRISE',
  CSO: 'ENTERPRISE',
  CMO: 'ENTERPRISE',
  COO: 'ENTERPRISE',
  Developer: 'PREMIUM',
  QA: 'ENTERPRISE',
  Ops: 'ENTERPRISE',
  Marketing: 'ENTERPRISE',
};

/** Structured error thrown when user's tier blocks agent execution. */
export class AgentTierBlockedError extends Error {
  readonly agentRole: string;
  readonly requiredTier: string;
  readonly userTier: string;
  readonly errorClass = 'tier_blocked';

  constructor(agentRole: string, requiredTier: string, userTier: string) {
    super(
      `Agent role '${agentRole}' requires ${requiredTier} tier (current: ${userTier})`
    );
    this.name = 'AgentTierBlockedError';
    this.agentRole = agentRole;
    this.requiredTier = requiredTier;
    this.userTier = userTier;
  }
}

/**
 * Assert that the user's tier permits running the given agent role.
 * Throws AgentTierBlockedError (→ HTTP 403) if not.
 * MASTER tier bypasses all gates.
 * Unknown roles default to ENTERPRISE requirement (fail-safe deny).
 */
export function assertTierAllowsAgent(userTier: string, agentRole: string): void {
  // MASTER bypasses everything
  if (userTier === 'MASTER') return;

  const requiredTier = ROLE_MIN_TIER[agentRole as AgentRole] ?? 'ENTERPRISE';

  const userIdx = TIER_ORDER.indexOf(userTier);
  const requiredIdx = TIER_ORDER.indexOf(requiredTier);

  // Unknown tier → deny
  if (userIdx === -1 || userIdx < requiredIdx) {
    throw new AgentTierBlockedError(agentRole, requiredTier, userTier);
  }
}

/** Read-only role→tier map for UI display (Mission Control). */
export function getAgentRoleTierMap(): Record<string, string> {
  return { ...ROLE_MIN_TIER };
}
