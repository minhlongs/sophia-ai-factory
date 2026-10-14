/**
 * Effective Autonomy Resolver
 *
 * Resolves the autonomy policy actually enforced for one agent run, keyed by
 * (workspace, mission type).
 *
 * Layer: tree (domain-specific reusable).
 * @module tree/autonomy/effective-autonomy
 */

import type { AutonomyLevel } from '@/seed/types/creative-domain';
import type { MissionTypePolicy } from '@/seed/types/production-factory';
import { logger } from '@/seed/utils/logger-utility';
import { getAutonomyConfig } from './autonomy-repo';
import { getMissionTypePolicy } from './policy-repo';
import {
  capStoredLevel,
  fromPolicy,
  fromLegacyLevel,
  builtinDefault,
  type EffectiveAutonomyPolicy,
} from './effective-autonomy-builders';

export type { EffectiveAutonomyPolicy };

/** Workspace-global key inside mission_type_policies. */
export const GLOBAL_MISSION_TYPE = 'global';

export interface BuildEffectiveAutonomyParams {
  missionPolicy?: MissionTypePolicy | null;
  workspaceGlobalPolicy?: MissionTypePolicy | null;
  legacyLevel?: AutonomyLevel | null;
  missionAutonomyLevel?: AutonomyLevel;
}

/**
 * Pure resolver: applies the priority chain over pre-fetched inputs.
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

export interface ResolveEffectiveAutonomyParams {
  workspaceId: string;
  missionType: string;
  missionAutonomyLevel?: AutonomyLevel;
}

/**
 * Resolve the effective autonomy policy from storage. Never throws.
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
      legacyLevel = legacyResult.value.level;
    }
  }

  return buildEffectiveAutonomy({ missionPolicy, workspaceGlobalPolicy, legacyLevel, missionAutonomyLevel });
}
