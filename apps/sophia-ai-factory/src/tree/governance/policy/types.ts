/**
 * Agent Governance YAML (AGY) Types & Constants
 *
 * @module tree/governance/policy/types
 */

import type { AutonomyLevel } from '@/seed/types/agent-governance';

/**
 * Autonomy level numerical rank mappings for strict hierarchy comparison.
 */
export const AUTONOMY_RANKS: Record<AutonomyLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};
