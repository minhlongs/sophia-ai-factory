/**
 * @file fhe-compute-engine.ts
 * @layer tree/crypto
 * @description Pure domain engine for Fully Homomorphic Encryption (FHE) computation, noise budget tracking, and bootstrapping circuits.
 */

import {
  FheCiphertextWorkload,
  FheEvaluationRequest,
  FheEvaluationResult,
} from '@/seed/types/fhe-court';

/**
 * Deterministic hash generator for ciphertext digests
 */
function computeCiphertextSha256(data: string): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    h0 = (h0 ^ (code * 19 + i)) >>> 0;
    h1 = (h1 ^ (code * 23 + (h0 & 0xff))) >>> 0;
    h2 = (h2 + code * 29 + (h1 & 0xff)) >>> 0;
    h3 = (h3 ^ (code * 31 + (h2 & 0xff))) >>> 0;
    h4 = (h4 + code * 37 + (h3 & 0xff)) >>> 0;
    h5 = (h5 ^ (code * 41 + (h4 & 0xff))) >>> 0;
    h6 = (h6 + code * 43 + (h5 & 0xff)) >>> 0;
    h7 = (h7 ^ (code * 47 + (h6 & 0xff))) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Computes noise consumption for a specific homomorphic operation
 */
export function calculateNoiseConsumption(
  operation: FheEvaluationRequest['operation'],
  inputCount: number
): { noiseConsumedBits: number; baseExecutionTimeMs: number } {
  switch (operation) {
    case 'HOMOMORPHIC_ADDITION':
      return { noiseConsumedBits: 1, baseExecutionTimeMs: 4 };
    case 'POLYNOMIAL_REGRESSION':
      return { noiseConsumedBits: 24, baseExecutionTimeMs: 65 };
    case 'VECTOR_DOT_PRODUCT': {
      const dimensionNoise = Math.ceil(Math.log2(Math.max(2, inputCount)));
      return { noiseConsumedBits: 12 + dimensionNoise, baseExecutionTimeMs: 45 };
    }
    case 'RELU_BOOTSTRAP':
      return { noiseConsumedBits: 32, baseExecutionTimeMs: 140 };
    default:
      return { noiseConsumedBits: 10, baseExecutionTimeMs: 20 };
  }
}

/**
 * Evaluates an in-memory homomorphic computation and tracks noise budget
 */
export function evaluateFheComputation(
  workload: FheCiphertextWorkload,
  request: FheEvaluationRequest
): FheEvaluationResult {
  const { noiseConsumedBits, baseExecutionTimeMs } = calculateNoiseConsumption(
    request.operation,
    request.encryptedInputs.length
  );

  const initialNoise = request.noiseBudgetBits ?? workload.currentNoiseBudgetBits;
  const potentialRemaining = initialNoise - noiseConsumedBits;

  let bootstrappingTriggered = false;
  let remainingNoiseBudgetBits = potentialRemaining;
  let durationMs = baseExecutionTimeMs;

  // If remaining noise budget falls below minimum threshold (e.g. 15 bits), perform bootstrapping
  if (potentialRemaining <= workload.minNoiseBudgetThreshold) {
    bootstrappingTriggered = true;
    remainingNoiseBudgetBits = 85; // Refresh noise budget back to clean 85 bits
    durationMs += 120; // Additional circuit refresh latency
  }

  const resultPayload = `${workload.workloadId}:${request.operation}:${remainingNoiseBudgetBits}:${request.encryptedInputs.join(',')}`;
  const resultCiphertextDigest = computeCiphertextSha256(resultPayload);

  return {
    workloadId: workload.workloadId,
    resultCiphertextDigest,
    consumedNoiseBits: noiseConsumedBits,
    remainingNoiseBudgetBits,
    bootstrappingTriggered,
    durationMs,
  };
}

/**
 * Validates FHE circuit integrity
 */
export function validateFheCircuitParams(
  scheme: FheCiphertextWorkload['schemeType'],
  polynomialModulusDegree: number
): { valid: boolean; securityLevelBits: number; reason?: string } {
  if (![8192, 16384, 32768].includes(polynomialModulusDegree)) {
    return {
      valid: false,
      securityLevelBits: 0,
      reason: `Polynomial modulus degree must be 8192, 16384, or 32768 (received: ${polynomialModulusDegree})`,
    };
  }

  // Security levels according to Homomorphic Encryption Standard (HES)
  const securityLevelBits = polynomialModulusDegree >= 16384 ? 256 : 128;

  return {
    valid: true,
    securityLevelBits,
  };
}
