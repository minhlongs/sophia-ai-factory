/**
 * Effective Autonomy Resolver
 *
 * Resolves the autonomy policy actually enforced for one agent run, keyed by
 * (workspace, mission type). Priority order (plan §3):
 *
 *   . mission-type policy      (mission_type_policies row for the exact type)
 *   2. workspace global policy  (same table, mission_type = 'global')
 *   3. legacy autonomy config   (autonomy_configs via getAutonomyConfig —
 *                                stored level passed through untouched so the
 *                                old deny-if-level<3 behavior is preserved)
 *   4. built-in default         L2 Supervised, require_publish_approval = 1
 *                               (fail-closed: agents may run, publish gated)
 *
 * Tier → stored-level mapping: L0→0 · L1→2 · L2→3 · L3→4.
 * L3 full-auto never requires approval (plan §3); tiers 0–2 gate publish-type
 * tools by the policy flag. A mission-row `autonomy_level`, when provided,
 * only ever CAPS the stored level (fail-closed direction).
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/autonomy/effective-autonomy
 */

import type { AgentContext, AutonomyLevel } from '@/seed/types/creative-domain';
import type { AutonomyTier, MissionTypePolicy } from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { getAutonomyConfig } from './autonomy-repo';
import { getMissionTypePolicy, DEFAULT_MAX_AUTO_RETRIES } from './policy-repo';

/** Shape carried on AgentContext.effectivePolicy (single source of truth). */
export type EffectiveAutonomyPolicy = NonNullable<AgentContext['effectivePolicy']>;

const TIER_TO_STORED_LEVEL: Record<AutonomyTier, AutonomyLevel> = { 0: 0, 1: 2, 2: 3, 3: 4 };

const LEGACY_LEVEL_TO_TIER: Record<AutonomyLevel, AutonomyTier> = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 3 };

/** Workspace-global key inside mission_type_policies. */
export const GLOBAL_MISSION_TYPE = 'global';

// ---------------------------------------------------------------------------
// Pure resolution (no DB — unit-testable)
// ---------------------------------------------------------------------------

export interface BuildEffectiveAutonomyParams {
  missionPolicy?: MissionTypePolicy | null;
  workspaceGlobalPolicy?: MissionTypePolicy | null;
  /**
   * Stored legacy autonomy level for the workspace, or null when unavailable
   * or unset (built-in default row counts as unset).
   */
  legacyLevel?: AutonomyLevel | null;
  /** Mission-row autonomy_level cap; undefined = uncapped. */
  missionAutonomyLevel?: AutonomyLevel;
}

function isPublishAction(actionType: string): boolean {
  return actionType.startsWith('publish');
}

function makeRequiresApproval(tier: AutonomyTier, requirePublishApproval: boolean) {
  return (actionType: string): boolean =>
    tier <= 2 && requirePublishApproval && isPublishAction(actionType);
}

function capStoredLevel(level: AutonomyLevel, cap: AutonomyLevel | undefined): AutonomyLevel {
  if (cap === undefined) return level;
  const capped = Math.min(level, cap);
  return capped as AutonomyLevel;
}

function fromPolicy(policy: MissionTypePolicy): EffectiveAutonomyPolicy {
  const tier = policy.autonomyTier;
  return {
    tier,
    storedLevel: TIER_TO_STORED_LEVEL[tier],
    requiresApproval: makeRequiresApproval(tier, policy.requirePublishApproval),
    budgetCapCents: policy.maxCostCentsPerRun,
    maxAutoRetries: policy.maxAutoRetries,
  };
}

function fromLegacyLevel(level: AutonomyLevel): EffectiveAutonomyPolicy {
  return {
    // Legacy configs carry no approval concept — preserve old behavior exactly.
    tier: LEGACY_LEVEL_TO_TIER[level],
    storedLevel: level,
    requiresApproval: () => false,
    budgetCapCents: null,
    maxAutoRetries: DEFAULT_MAX_AUTO_RETRIES,
  };
}

function builtinDefault(): EffectiveAutonomyPolicy {
  const tier: AutonomyTier = 2;
  return {
    tier,
    storedLevel: TIER_TO_STORED_LEVEL[tier],
    requiresApproval: makeRequiresApproval(tier, true),
    budgetCapCents: null,
    maxAutoRetries: DEFAULT_MAX_AUTO_RETRIES,
  };
}

/**
 * Pure resolver: applies the priority chain over pre-fetched inputs.
 * Deterministic — identical inputs always yield an identical result.
 */
export function buildEffectiveAutonomy(
  params: BuildEffectiveAutonomyParams,
): EffectiveAutonomyPolicy {
  let resolved: EffectiveAutonomyPolicy;
  if (params.missionPolicy) {
    resolved = fromPolicy(params.missionPolicy);
  } else if (params.workspaceGlobalPolicy) {
    resolved = fromPolicy(params.workspaceGlobalPolicy);
  } else if (params.legacyLevel !== null && params.legacyLevel !== undefined) {
    resolved = fromLegacyLevel(params.legacyLevel);
  } else {
    resolved = builtinDefault();
  }
  return { ...resolved, storedLevel: capStoredLevel(resolved.storedLevel, params.missionAutonomyLevel) };
}

// ---------------------------------------------------------------------------
// DB-wired resolution
// ---------------------------------------------------------------------------

export interface ResolveEffectiveAutonomyParams {
  workspaceId: string;
  missionType: string;
  /** Mission-row autonomy_level cap; undefined = uncapped. */
  missionAutonomyLevel?: AutonomyLevel;
}

/**
 * Resolve the effective autonomy policy from storage. Never throws: any read
 * failure degrades down the priority chain and lands on the fail-closed
 * built-in default (L2 Supervised, publish approval required).
 *
 * The legacy branch passes the stored level through untouched — including the
 * legacy built-in default (level 1, deny) — so a workspace with no policy and
 * no stored config keeps today's exact behavior.
 */
export async function resolveEffectiveAutonomy(
  params: ResolveEffectiveAutonomyParams,
): Promise<EffectiveAutonomyPolicy> {
  const { workspaceId, missionType, missionAutonomyLevel } = params;

  let missionPolicy: MissionTypePolicy | null = null;
  const missionResult = await getMissionTypePolicy(workspaceId, missionType);
  if (missionResult.ok) {
    missionPolicy = missionResult.value;
  } else {
    logger.warn('[EffectiveAutonomy] mission policy read failed, degrading', {
      error: missionResult.error.message,
      workspaceId,
      missionType,
    });
  }

  let workspaceGlobalPolicy: MissionTypePolicy | null = null;
  if (!missionPolicy && missionType !== GLOBAL_MISSION_TYPE) {
    const globalResult = await getMissionTypePolicy(workspaceId, GLOBAL_MISSION_TYPE);
    if (globalResult.ok) {
      workspaceGlobalPolicy = globalResult.value;
    } else {
      logger.warn('[EffectiveAutonomy] global policy read failed, degrading', {
        error: globalResult.error.message,
        workspaceId,
      });
    }
  }

  let legacyLevel: AutonomyLevel | null = null;
  if (!missionPolicy && !workspaceGlobalPolicy) {
    const legacyResult = await getAutonomyConfig(workspaceId, 'global');
    if (legacyResult.ok) {
      // Pass through untouched — the legacy built-in default (level 1) keeps
      // today's deny behavior for unconfigured workspaces.
      legacyLevel = legacyResult.value.level;
    }
  }

  return buildEffectiveAutonomy({ missionPolicy, workspaceGlobalPolicy, legacyLevel, missionAutonomyLevel });
}
