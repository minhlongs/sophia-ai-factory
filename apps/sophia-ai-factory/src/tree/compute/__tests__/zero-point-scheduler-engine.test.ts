/**
 * @file zero-point-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Zero-Point Quantum Vacuum Super-Lattice & 400M Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateZeroPointSuperLatticeFitness,
  planZeroPointBatchDispatch,
} from '../zero-point-scheduler-engine';
import type { ZeroPointSuperLattice } from '@/seed/types/zero-point-vacuum-nexus';

describe('Zero-Point Quantum Vacuum Scheduler Engine', () => {
  const primeLattice: ZeroPointSuperLattice = {
    latticeRef: 'ZERO_POINT_LATTICE_PRIME',
    locationSector: 'TRANS_COSMIC_CORE',
    vacuumNodesCount: 4_194_304,
    vacuumBusLatencyNanos: 0.02, // 0.02 ns < 0.05 ns
    vacuumBusBandwidthPetabytes: 1_000_000,
    relativisticClockDriftFs: 0.2, // 0.2 fs < 0.5 fs
    activeSentientPipelinesCount: 400_000_000,
    thermalCopRatio: 36.5, // > 35.0
    superLatticeStatus: 'ZERO_POINT_FLUX_STABLE',
    latticeSignature: 'SIG_ZP_PRIME_001',
  };

  it('calculates optimal fitness score for stable Zero-Point super-lattice', () => {
    const fitness = calculateZeroPointSuperLatticeFitness(primeLattice);
    expect(fitness).toBeGreaterThan(0.80);
    expect(fitness).toBeLessThanOrEqual(1.0);
  });

  it('returns zero fitness for degraded or un-stabilized lattices', () => {
    const degradedLattice: ZeroPointSuperLattice = {
      ...primeLattice,
      superLatticeStatus: 'DEGRADED_THERMAL_DECAY',
    };

    const fitness = calculateZeroPointSuperLatticeFitness(degradedLattice);
    expect(fitness).toBe(0.0);
  });

  it('plans dispatch for 400,000,000 sentient workloads across optimal lattice with sub-0.5 fs clock drift', () => {
    const backupLattice: ZeroPointSuperLattice = {
      ...primeLattice,
      latticeRef: 'ZERO_POINT_LATTICE_BACKUP',
      vacuumBusLatencyNanos: 0.04,
      thermalCopRatio: 35.0,
    };

    const plan = planZeroPointBatchDispatch([backupLattice, primeLattice], 400_000_000, 0.4);

    expect(plan.targetLatticeRef).toBe('ZERO_POINT_LATTICE_PRIME');
    expect(plan.assignedWorkloads).toBe(400_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(1_000_000); // 1,000,000 PB
    expect(plan.relativisticDriftFs).toBe(0.4);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects dispatch when clock drift exceeds 0.5 fs limit or no stable lattice exists', () => {
    expect(() => planZeroPointBatchDispatch([primeLattice], 400_000_000, 0.8)).toThrow(
      'exceeds allowable threshold'
    );

    const degradedLattice: ZeroPointSuperLattice = {
      ...primeLattice,
      superLatticeStatus: 'WORKLOAD_SATURATED',
    };
    expect(() => planZeroPointBatchDispatch([degradedLattice], 400_000_000, 0.3)).toThrow(
      'Zero stable zero-point quantum vacuum super-lattices'
    );
  });
});
