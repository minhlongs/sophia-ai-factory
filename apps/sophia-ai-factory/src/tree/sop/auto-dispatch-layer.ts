/**
 * auto-dispatch-layer.ts — Mission auto-classification + dispatch for 60% automation.
 *
 * Layer: tree (domain-reusable)
 *
 * Provides:
 *   1. `classifyMission(text)` — heuristic + LLM-assisted mission type tag.
 *   2. `AUTO_DISPATCH_RULES` — map of mission type → agent fleet spec.
 *   3. `getAutomationCoverage()` — current auto-handle rate (target: ≥ 60%).
 *   4. `canAutoDispatch(mission)` — returns { canAuto, agentFleet } | null.
 *
 * Designed as a thin shim over the existing solo-orchestrator.ts
 * so the rest of the system stays unchanged.
 */

import { routeLLM } from '@/tree/openclaw';
import { logger } from '@/seed/utils/logger-utility';
import {
  RULES,
  getDispatchRule,
  type MissionType,
  type MissionTypeRule,
} from './mission-taxonomy-rules';

export { RULES, getDispatchRule, type MissionType, type MissionTypeRule };

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Returns the mission type for the given text.
 * Falls back to `unknown` when no keyword matches and LLM is unavailable.
 */
export async function classifyMission(text: string): Promise<MissionType> {
  const lowered = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lowered.includes(k))) {
      return rule.missionType;
    }
  }
  // LLM fallback — try once; swallow errors so caller still gets a type.
  try {
    const result = await routeLLM(
      'lite',
      `Classify the following mission into one of: content, video, social, support, finance, sales, onboarding, engineering, marketing, unknown.\nMission: ${text.slice(0, 2000)}`,
    );
    const answer = result.text.trim().toLowerCase();
    const allowed = new Set<MissionType>([
      'content',
      'video',
      'social',
      'support',
      'finance',
      'sales',
      'onboarding',
      'engineering',
      'marketing',
      'unknown',
    ]);
    if (allowed.has(answer as MissionType)) return answer as MissionType;
  } catch (err) {
    logger.warn('auto-dispatch: LLM classify failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Auto-dispatch decision
// ---------------------------------------------------------------------------

export interface DispatchDecision {
  canAuto: boolean;
  missionType: MissionType;
  agentFleet: string[];
}

export async function canAutoDispatch(missionText: string): Promise<DispatchDecision | null> {
  const missionType = await classifyMission(missionText);
  if (missionType === 'unknown') {
    return { canAuto: false, missionType, agentFleet: [] };
  }
  const rule = getDispatchRule(missionType);
  if (!rule || rule.agentFleet.length === 0) {
    return { canAuto: false, missionType, agentFleet: [] };
  }
  return { canAuto: true, missionType, agentFleet: rule.agentFleet };
}

// ---------------------------------------------------------------------------
// Coverage metrics
// ---------------------------------------------------------------------------

export interface CoverageSnapshot {
  totalTypes: number;
  autoTypes: number;
  coveragePct: number;
  targetMet: boolean;
}

let _snapshot: CoverageSnapshot | null = null;

export function getAutomationCoverage(): CoverageSnapshot {
  if (_snapshot) return _snapshot;
  const totalTypes = RULES.length;
  const autoTypes = RULES.filter((r) => r.agentFleet.length > 0).length;
  const coveragePct = totalTypes > 0 ? Math.round((autoTypes / totalTypes) * 100) : 0;
  _snapshot = {
    totalTypes,
    autoTypes,
    coveragePct,
    targetMet: coveragePct >= 60,
  };
  return _snapshot;
}

export function resetCoverageCache() {
  _snapshot = null;
}
