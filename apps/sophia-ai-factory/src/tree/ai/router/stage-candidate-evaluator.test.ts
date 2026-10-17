import { describe, expect, it, vi } from 'vitest';
import type { CostArbitrageDecision, StageProviderOption } from '@/seed/types/unit-economics-types';

vi.mock('@/seed/security/circuit-breaker', () => ({
  getState: vi.fn(() => ({ state: 'CLOSED' })),
  shouldAllowRequest: vi.fn(() => true),
}));

import {
  buildArbitrageDecisionReason,
  selectBestStageCandidate,
} from './stage-candidate-evaluator';

const spec = { targetDurationSeconds: 30, maxBudgetUsd: 0.02 };
const candidates: StageProviderOption[] = [
  { provider: 'mekong', model: 'edge', unitCostUsd: 0, unitDescription: 'edge', isUnmetered: true, latencyAvgMs: 1 },
  { provider: 'openrouter', model: 'economy', unitCostUsd: 0.000001, unitDescription: 'economy', isUnmetered: false, latencyAvgMs: 2 },
  { provider: 'openrouter', model: 'quality', unitCostUsd: 0.00001, unitDescription: 'quality', isUnmetered: false, latencyAvgMs: 3 },
];

describe('stage candidate evaluator', () => {
  it('filters unavailable edge providers and selects the cheapest healthy candidate', () => {
    const result = selectBestStageCandidate({
      stage: 'script', candidates, spec, strategy: 'cheapest_healthy', edgeAvailable: false, tenantKeyRef: 'tenant',
    });
    expect(result.selection.model).toBe('economy');
    expect(result.isMekongProvider).toBe(false);
  });

  it('chooses the higher-cost paid option for quality priority and uses edge when available', () => {
    const quality = selectBestStageCandidate({
      stage: 'script', candidates: candidates.slice(1), spec, strategy: 'quality_priority', edgeAvailable: false, tenantKeyRef: 'tenant',
    });
    expect(quality.selection.model).toBe('quality');

    const edge = selectBestStageCandidate({
      stage: 'script', candidates, spec: { ...spec, bypassEdge: false }, strategy: 'cheapest_healthy', edgeAvailable: true, tenantKeyRef: 'tenant',
    });
    expect(edge.selection.model).toBe('edge');
    expect(edge.isMekongProvider).toBe(true);
  });

  it('formats Mekong and cloud explanations, including budget warnings', () => {
    const selectedStages: CostArbitrageDecision['selectedStages'] = {
      script: { stage: 'script', provider: 'openrouter', model: 's', estimatedCostUsd: 0.01, isUnmetered: false, circuitState: 'CLOSED' },
      visuals: { stage: 'visuals', provider: 'fal', model: 'v', estimatedCostUsd: 0.02, isUnmetered: false, circuitState: 'CLOSED' },
      audio: { stage: 'audio', provider: 'elevenlabs', model: 'a', estimatedCostUsd: 0.03, isUnmetered: false, circuitState: 'CLOSED' },
      render: { stage: 'render', provider: 'fal', model: 'r', estimatedCostUsd: 0.04, isUnmetered: false, circuitState: 'CLOSED' },
    };
    const mekongReason = buildArbitrageDecisionReason({ duration: 30, selectedStages, isMekongGpuAccelerated: true, savingsPercentage: 70, withinBudget: true, totalEstimatedCostUsd: 0.1 });
    const cloudReason = buildArbitrageDecisionReason({ duration: 30, selectedStages, isMekongGpuAccelerated: false, savingsPercentage: 0, withinBudget: false, totalEstimatedCostUsd: 0.1, maxBudgetUsd: 0.02 });
    expect(mekongReason).toContain('Mekong GPU Edge (70% savings');
    expect(cloudReason).toContain('Cloud BYOK routing');
    expect(cloudReason).toContain('exceeds budget $0.02');
  });
});
