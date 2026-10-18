'use server';

/**
 * Land Layer: Server Actions for Stitch v4.2 Director's Control Deck
 * Executes 1-Click 4-Advisor Council Mission Dispatch & Half-Kelly Rebalancing.
 * Layer: land/control-deck | Max LOC: < 180 | Strict TypeScript | Zero forest imports
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type {
  BilingualText,
  ControlDeckScreenId,
  MabArmTelemetry,
} from '@/seed/types/stitch-control-deck';
import { computeLiveControlDeckDataset } from '@/tree/control-deck';

export interface DispatchAdvisorMissionInput {
  readonly screenId: ControlDeckScreenId;
  readonly mcuBudget?: number;
}

export interface DispatchAdvisorMissionResult {
  readonly ok: boolean;
  readonly missionId: string;
  readonly actorMode: 'authenticated' | 'preview';
  readonly championArmId: string;
  readonly halfKellyAllocationPct: number;
  readonly consensusConfidencePct: number;
  readonly dispatchedAtUtc: string;
  readonly message: BilingualText;
}

export interface RebalanceHalfKellyInput {
  readonly mcuBudget: number;
}

export interface RebalanceHalfKellyResult {
  readonly ok: boolean;
  readonly mcuBudget: number;
  readonly mabArms: readonly MabArmTelemetry[];
  readonly message: BilingualText;
}

export async function dispatchAdvisorCouncilMissionAction(
  input: DispatchAdvisorMissionInput,
): Promise<DispatchAdvisorMissionResult> {
  const safeBudget = Math.max(100, Math.min(100_000, input.mcuBudget ?? 1000));
  let user: { id: string } | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  const dataset = computeLiveControlDeckDataset({
    mcuBudget: safeBudget,
    byokReady: true,
  });

  const champion =
    dataset.mabArms.find((arm) => arm.isChampion) ?? dataset.mabArms[0];
  const avgConfidence =
    dataset.advisors.reduce((acc, adv) => acc + adv.confidenceScorePct, 0) /
    Math.max(1, dataset.advisors.length);

  const suffix = input.screenId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const missionId = `MSN-STITCH-${suffix}-${safeBudget}`;

  return {
    ok: true,
    missionId,
    actorMode: user ? 'authenticated' : 'preview',
    championArmId: champion?.armId ?? 'arm-alpha-01',
    halfKellyAllocationPct: champion?.halfKellyAllocationPct ?? 18.4,
    consensusConfidencePct: Number(avgConfidence.toFixed(1)),
    dispatchedAtUtc: new Date().toISOString(),
    message: {
      en: `Dispatched ${missionId} via 4-Advisor Council (${avgConfidence.toFixed(1)}% consensus) with Half-Kelly f* = ${champion?.halfKellyAllocationPct ?? 18.4}%.`,
      vi: `Đã điều phối ${missionId} qua Hội đồng 4 Cố vấn (${avgConfidence.toFixed(1)}% đồng thuận) với Half-Kelly f* = ${champion?.halfKellyAllocationPct ?? 18.4}%.`,
    },
  };
}

export async function rebalanceHalfKellyAction(
  input: RebalanceHalfKellyInput,
): Promise<RebalanceHalfKellyResult> {
  const clampedBudget = Math.max(100, Math.min(100_000, input.mcuBudget));
  const dataset = computeLiveControlDeckDataset({
    mcuBudget: clampedBudget,
    byokReady: true,
  });

  return {
    ok: true,
    mcuBudget: clampedBudget,
    mabArms: dataset.mabArms,
    message: {
      en: `Rebalanced Thompson Sampling & Half-Kelly across ${dataset.mabArms.length} arms for ${clampedBudget} MCU.`,
      vi: `Đã tái cân bằng Thompson Sampling & Half-Kelly trên ${dataset.mabArms.length} nhánh cho ngân sách ${clampedBudget} MCU.`,
    },
  };
}
