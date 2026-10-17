/**
 * Tree Layer: Live Thompson Bandit & Half-Kelly Telemetry Calculator for Control Deck
 * Connects tree/growth-v13 & tree/growth-v14 mathematical engines to Stitch Control Deck dataset.
 * Layer: tree/control-deck | Max LOC: < 180 | Zero :any | Zero IO
 */

import type {
  ControlDeckDataset,
  MabArmTelemetry,
  ControlDeckPaymentEntry,
  StitchScreenSpec,
} from '@/seed/types/stitch-control-deck';
import { calculateKellyAllocation } from '@/tree/growth-v14/kelly-allocator';
import { calculateUCB1 } from '@/tree/growth-v13/thompson-bandit';
import { STITCH_CONTROL_DECK_DATASET } from './stitch-deck-data';

export interface LiveTelemetryOverrides {
  readonly mrrFormatted?: string;
  readonly mcuBudget?: number;
  readonly byokReady?: boolean;
  readonly liveSettlements?: readonly ControlDeckPaymentEntry[];
}

export function computeLiveControlDeckDataset(
  overrides?: LiveTelemetryOverrides,
): ControlDeckDataset {
  const base = STITCH_CONTROL_DECK_DATASET;
  const availableMcu = overrides?.mcuBudget ?? 1000;
  const totalPulls = base.mabArms.reduce(
    (acc, arm) => acc + arm.alpha + arm.beta,
    0,
  );

  const recomputedArms: MabArmTelemetry[] = base.mabArms.map((arm) => {
    const pulls = arm.alpha + arm.beta;
    const posteriorMean = pulls > 0 ? arm.alpha / pulls : 0.5;
    const ucb1 = calculateUCB1(arm.alpha, pulls, totalPulls);
    const numericRoas =
      Number.parseFloat(arm.roasMultiplier.replace('x', '')) || 2.5;

    const kelly = calculateKellyAllocation(
      {
        winProbability: posteriorMean,
        projectedRoas: numericRoas,
        halfKelly: true,
        minFraction: 0.05,
        maxFraction: 0.25,
      },
      availableMcu,
    );

    const winProbPct = Number(
      (Math.min(0.99, (posteriorMean + Math.min(1, ucb1)) / 2) * 100).toFixed(
        1,
      ),
    );
    const halfKellyPct = Number((kelly.boundedFraction * 100).toFixed(1));

    return {
      ...arm,
      winProbabilityPct: winProbPct,
      halfKellyAllocationPct: halfKellyPct,
    };
  });

  const updatedScreens: StitchScreenSpec[] = base.screens.map((screen) => {
    if (screen.id === 'dashboard' && overrides?.mrrFormatted) {
      return {
        ...screen,
        primaryKpiValue: overrides.mrrFormatted,
      };
    }
    if (screen.id === 'setup-wizard' && overrides?.byokReady !== undefined) {
      return {
        ...screen,
        statusBadge: overrides.byokReady
          ? {
              en: 'ACCOUNT CHECK · BYOK ENCRYPTION ENABLED',
              vi: 'KIỂM TRA TÀI KHOẢN · ĐÃ BẬT MÃ HÓA BYOK',
            }
          : {
              en: 'ACCOUNT CHECK · BYOK ENCRYPTION NOT ENABLED',
              vi: 'KIỂM TRA TÀI KHOẢN · CHƯA BẬT MÃ HÓA BYOK',
            },
      };
    }
    return screen;
  });

  return {
    ...base,
    screens: updatedScreens,
    mabArms: recomputedArms,
    settlements:
      overrides?.liveSettlements && overrides.liveSettlements.length > 0
        ? overrides.liveSettlements
        : base.settlements,
  };
}
