import { describe, it, expect } from 'vitest';
import {
  calculateNoiseConsumption,
  evaluateFheComputation,
  validateFheCircuitParams,
} from '../fhe-compute-engine';
import type { FheCiphertextWorkload, FheEvaluationRequest } from '@/seed/types/fhe-court';

describe('FHE Compute Engine Unit Tests', () => {
  const mockWorkload: FheCiphertextWorkload = {
    id: 'fhe_wl_01',
    workloadId: 'WL_FHE_2026_001',
    schemeType: 'CKKS',
    ciphertextDigestSha256: 'c'.repeat(64),
    polynomialModulusDegree: 16384,
    currentNoiseBudgetBits: 85,
    minNoiseBudgetThreshold: 15,
    requiresBootstrapping: false,
    status: 'ENCRYPTED_IN_TRANSIT',
    executionDurationMs: 0,
    createdAt: '2026-09-27T00:00:00Z',
  };

  it('validates polynomial modulus degree against homomorphic security standard', () => {
    const valid16k = validateFheCircuitParams('CKKS', 16384);
    expect(valid16k.valid).toBe(true);
    expect(valid16k.securityLevelBits).toBe(256);

    const valid8k = validateFheCircuitParams('TFHE', 8192);
    expect(valid8k.valid).toBe(true);
    expect(valid8k.securityLevelBits).toBe(128);

    const invalid = validateFheCircuitParams('BFV', 4096);
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('must be 8192, 16384, or 32768');
  });

  it('calculates noise consumption per homomorphic operation type', () => {
    const addNoise = calculateNoiseConsumption('HOMOMORPHIC_ADDITION', 2);
    expect(addNoise.noiseConsumedBits).toBe(1);

    const polyNoise = calculateNoiseConsumption('POLYNOMIAL_REGRESSION', 4);
    expect(polyNoise.noiseConsumedBits).toBe(24);

    const dotNoise = calculateNoiseConsumption('VECTOR_DOT_PRODUCT', 8);
    expect(dotNoise.noiseConsumedBits).toBe(12 + Math.ceil(Math.log2(8))); // 12 + 3 = 15
  });

  it('evaluates computation and triggers bootstrapping when noise budget depletes below threshold', () => {
    // 1. High budget evaluation: no bootstrapping
    const request1: FheEvaluationRequest = {
      workloadId: mockWorkload.workloadId,
      scheme: 'CKKS',
      encryptedInputs: ['ctx_a', 'ctx_b'],
      operation: 'HOMOMORPHIC_ADDITION',
      noiseBudgetBits: 85,
    };
    const res1 = evaluateFheComputation(mockWorkload, request1);
    expect(res1.bootstrappingTriggered).toBe(false);
    expect(res1.remainingNoiseBudgetBits).toBe(84);
    expect(res1.resultCiphertextDigest).toMatch(/^[a-f0-9]{64}$/);

    // 2. Low budget evaluation (< 15 bits): triggers bootstrapping and refreshes to 85 bits
    const request2: FheEvaluationRequest = {
      workloadId: mockWorkload.workloadId,
      scheme: 'CKKS',
      encryptedInputs: ['ctx_x', 'ctx_y', 'ctx_z'],
      operation: 'POLYNOMIAL_REGRESSION', // consumes 24 bits
      noiseBudgetBits: 20, // 20 - 24 = -4 <= 15 threshold!
    };
    const res2 = evaluateFheComputation(mockWorkload, request2);
    expect(res2.bootstrappingTriggered).toBe(true);
    expect(res2.remainingNoiseBudgetBits).toBe(85);
    expect(res2.durationMs).toBeGreaterThan(100);
  });
});
