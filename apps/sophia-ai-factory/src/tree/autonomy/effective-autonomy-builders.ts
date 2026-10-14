/**
 * Pure policy builder functions and level conversion tables for Effective Autonomy Resolver.
 * @module tree/autonomy/effective-autonomy-builders
 */

import type { AgentContext, AutonomyLevel } from '@/seed/types/creative-domain';
import type { AutonomyTier, MissionTypePolicy } from '@/seed/types/production-factory';
import { DEFAULT_MAX_AUTO_RETRIES } from './policy-repo';

export type EffectiveAutonomyPolicy = NonNullable<AgentContext['effectivePolicy']>;

const TIER_TO_STORED_LEVEL: Record<AutonomyTier, AutonomyLevel> = { 0: 0, 1: 2, 2: 3, 3: 4 };
const LEGACY_LEVEL_TO_TIER: Record<AutonomyLevel, AutonomyTier> = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 3 };

function isPublishAction(actionType: string): boolean {
  return actionType.startsWith('publish');
}

function makeRequiresApproval(tier: AutonomyTier, requirePublishApproval: boolean) {
  return (actionType: string): boolean =>
    tier <= 2 && requirePublishApproval && isPublishAction(actionType);
}

export function capStoredLevel(
  level: AutonomyLevel,
  cap: AutonomyLevel | undefined,
): AutonomyLevel {
  if (cap === undefined) return level;
  const capped = Math.min(level, cap);
  return capped as AutonomyLevel;
}

export function fromPolicy(policy: MissionTypePolicy): EffectiveAutonomyPolicy {
  const tier = policy.autonomyTier;
  return {
    tier,
    storedLevel: TIER_TO_STORED_LEVEL[tier],
    requiresApproval: makeRequiresApproval(tier, policy.requirePublishApproval),
    budgetCapCents: policy.maxCostCentsPerRun,
    maxAutoRetries: policy.maxAutoRetries,
  };
}

export function fromLegacyLevel(level: AutonomyLevel): EffectiveAutonomyPolicy {
  return {
    tier: LEGACY_LEVEL_TO_TIER[level],
    storedLevel: level,
    requiresApproval: () => false,
    budgetCapCents: null,
    maxAutoRetries: DEFAULT_MAX_AUTO_RETRIES,
  };
}

export function builtinDefault(): EffectiveAutonomyPolicy {
  const tier: AutonomyTier = 2;
  return {
    tier,
    storedLevel: TIER_TO_STORED_LEVEL[tier],
    requiresApproval: makeRequiresApproval(tier, true),
    budgetCapCents: null,
    maxAutoRetries: DEFAULT_MAX_AUTO_RETRIES,
  };
}
