/**
 * @file quantum-superconducting-scheduler-engine.test.ts
 * @layer tree/compute
 * @description Unit tests for Quantum Superconducting Matrix & 10,000,000 Workload Dispatching.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateQuantumMatrixFitness,
  planQuantumBatchDispatch,
} from '../quantum-superconducting-scheduler-engine';
import type { QuantumSuperconductingMatrix } from '@/seed/types/quantum-superconducting-nexus';

describe('QuantumSuperconductingSchedulerEngine', () => {
  const sampleMatrix: QuantumSuperconductingMatrix = {
    matrixRef: 'QUANTUM_MATRIX_MILKYWAY_CORE',
    locationSector: 'MATRIOSHKA_BRAIN_SOL',
    superconductingNodeCount: 131_072, // >= 65,536 nodes
    opticalBusLatencyNanos: 1.4, // < 3.5 ns
    opticalBusBandwidthPetabytes: 25_000,
    clockDriftFemtoseconds: 45.0, // < 75 fs
    activeCognitivePipelinesCount: 10_000_000,
    thermalCopRatio: 14.5, // >= 12.0
    superconductingStatus: 'CRITICAL_FLUX_STABLE',
    matrixSignature: 'sig_qm_1',
  };

  it('calculates composite multi-dimensional fitness score accurately', () => {
    const score = calculateQuantumMatrixFitness(sampleMatrix);

    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1.0);

    const degradedMatrix: QuantumSuperconductingMatrix = {
      ...sampleMatrix,
      superconductingStatus: 'DEGRADED_QUENCH',
    };
    expect(calculateQuantumMatrixFitness(degradedMatrix)).toBe(0.0);
  });

  it('plans optimal 10,000,000 workload batch dispatch across candidate matrices', () => {
    const matrices: QuantumSuperconductingMatrix[] = [
      sampleMatrix,
      {
        ...sampleMatrix,
        matrixRef: 'ANDROMEDA_SECONDARY_MATRIX',
        opticalBusLatencyNanos: 3.2,
        superconductingNodeCount: 65_536,
      },
    ];

    const plan = planQuantumBatchDispatch(matrices, 10_000_000, 50.0);

    expect(plan.targetMatrixRef).toBe('QUANTUM_MATRIX_MILKYWAY_CORE');
    expect(plan.assignedWorkloads).toBe(10_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(20_000);
    expect(plan.quantumDriftFs).toBe(50.0);
    expect(plan.dispatchHash).toHaveLength(64);
  });

  it('throws an error when measured clock drift exceeds allowable 75 fs threshold', () => {
    expect(() => {
      planQuantumBatchDispatch([sampleMatrix], 10_000_000, 85.0);
    }).toThrow('exceeds allowable threshold 75 fs');
  });
});
