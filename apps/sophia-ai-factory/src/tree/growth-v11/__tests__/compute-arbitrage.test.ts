import { describe, it, expect } from 'vitest';
import {
  evaluateComputeArbitrage,
  isOffPeakUtcHour,
  MODEL_BASE_COST_PER_SECOND,
  ComputeArbitrageSpec,
} from '../compute-arbitrage';
import { CircuitState } from '@/seed/types/failure-kind';

describe('Compute Arbitrage Engine', () => {
  describe('isOffPeakUtcHour', () => {
    it('correctly identifies off-peak hours [02:00, 08:00) UTC', () => {
      expect(isOffPeakUtcHour(2)).toBe(true);
      expect(isOffPeakUtcHour(5.5)).toBe(true);
      expect(isOffPeakUtcHour(7)).toBe(true);
      expect(isOffPeakUtcHour(8)).toBe(false);
      expect(isOffPeakUtcHour(14)).toBe(false);
      expect(isOffPeakUtcHour(0)).toBe(false);
      expect(isOffPeakUtcHour(-1)).toBe(false); // modulo normalized to 23
    });
  });

  describe('evaluateComputeArbitrage', () => {
    it('selects HEYGEN_STUDIO for high-velocity videos during peak hours', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        isHighVelocity: true,
      };
      const result = evaluateComputeArbitrage(spec, 14); // 14:00 UTC (peak)

      expect(result.provider).toBe('HEYGEN_STUDIO');
      expect(result.priorityLane).toBe('PRIORITY');
      expect(result.isOffPeak).toBe(false);
      // 60s * 0.10 = $6.00
      expect(result.estimatedDollarCost).toBe(6.0);
      expect(result.savingsUsd).toBe(0);
    });

    it('applies 42% off-peak discount to high-velocity render during off-peak window', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        isHighVelocity: true,
      };
      const result = evaluateComputeArbitrage(spec, 4); // 04:00 UTC (off-peak)

      expect(result.provider).toBe('HEYGEN_STUDIO');
      expect(result.isOffPeak).toBe(true);
      // 60s * 0.10 * 0.58 = $3.48
      expect(result.estimatedDollarCost).toBe(3.48);
      expect(result.savingsUsd).toBeCloseTo(2.52, 2);
    });

    it('opportunistically defers non-urgent batch jobs outside off-peak window', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 120,
        isHighVelocity: false,
        allowDeferred: true,
        urgency: 'BATCH',
      };
      const result = evaluateComputeArbitrage(spec, 15); // 15:00 UTC (peak)

      expect(result.provider).toBe('DEFERRED_OFFPEAK');
      expect(result.priorityLane).toBe('OFFPEAK_BATCH');
      expect(result.estimatedDollarCost).toBe(0);
      expect(result.savingsUsd).toBe(12.0); // Baseline 120 * 0.10
      expect(result.reason).toContain('deferred to off-peak window');
    });

    it('routes standard non-deferred jobs to DID_EXPRESS with off-peak multiplier if batch', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        qualityRequirement: 'STANDARD',
        allowDeferred: false,
      };
      const result = evaluateComputeArbitrage(spec, 12);

      expect(result.provider).toBe('DID_EXPRESS');
      // DID rate 0.04 * 60 * 0.58 (OFFPEAK_BATCH lane) = 1.392
      expect(result.estimatedDollarCost).toBeCloseTo(1.392, 2);
      expect(result.priorityLane).toBe('OFFPEAK_BATCH');
    });

    it('routes EXPRESS jobs directly to FAL_WAN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 30,
        qualityRequirement: 'EXPRESS',
        allowDeferred: false,
      };
      const result = evaluateComputeArbitrage(spec, 12);

      expect(result.provider).toBe('FAL_WAN');
      // 30 * 0.015 * 0.58 = 0.261
      expect(result.estimatedDollarCost).toBeCloseTo(0.261, 2);
    });

    it('handles Circuit Breaker OPEN on HEYGEN by gracefully degrading to DID_EXPRESS', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        isHighVelocity: true,
      };
      const breakerState = {
        HEYGEN_STUDIO: CircuitState.OPEN,
        DID_EXPRESS: CircuitState.CLOSED,
        FAL_WAN: CircuitState.CLOSED,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);

      expect(result.provider).toBe('DID_EXPRESS');
      expect(result.reason).toContain('Circuit breaker OPEN for HEYGEN_STUDIO: degraded to DID_EXPRESS');
    });

    it('handles dual Circuit Breaker failure by falling back to FAL_WAN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        isHighVelocity: true,
      };
      const breakerState = new Map<string, string>([
        ['HEYGEN_STUDIO', 'OPEN'],
        ['DID_EXPRESS', 'OPEN'],
        ['FAL_WAN', 'CLOSED'],
      ]);
      const result = evaluateComputeArbitrage(spec, 14, breakerState);

      expect(result.provider).toBe('FAL_WAN');
      expect(result.reason).toContain('degraded to FAL_WAN');
    });

    it('defers job when all visual generation providers trip circuit breakers', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        isHighVelocity: true,
      };
      const breakerState = {
        HEYGEN_STUDIO: CircuitState.OPEN,
        DID_EXPRESS: CircuitState.OPEN,
        FAL_WAN: CircuitState.OPEN,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);

      expect(result.provider).toBe('DEFERRED_OFFPEAK');
      expect(result.estimatedDollarCost).toBe(0);
      expect(result.reason).toContain('tripped circuit breakers');
    });

    it('handles 0 or negative duration safely without throwing or NaN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 0,
      };
      const result = evaluateComputeArbitrage(spec, 12);
      expect(result.estimatedDollarCost).toBe(0);
      expect(result.savingsUsd).toBe(0);
    });

    it('executes batch job during off-peak window without deferring', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 100,
        allowDeferred: true,
        urgency: 'BATCH',
      };
      // 03:00 UTC (off-peak)
      const result = evaluateComputeArbitrage(spec, 3);
      expect(result.provider).toBe('FAL_WAN');
      expect(result.isOffPeak).toBe(true);
      expect(result.priorityLane).toBe('OFFPEAK_BATCH');
      expect(result.estimatedDollarCost).toBeGreaterThan(0);
      expect(result.reason).toContain('Applied 42% off-peak discount');
    });

    it('degrades DID_EXPRESS to FAL_WAN when DID is OPEN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        qualityRequirement: 'STANDARD',
      };
      const breakerState = {
        DID_EXPRESS: CircuitState.OPEN,
        FAL_WAN: CircuitState.CLOSED,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('FAL_WAN');
      expect(result.reason).toContain('Circuit breaker OPEN for DID_EXPRESS: degraded to FAL_WAN');
    });

    it('upgrades DID_EXPRESS to HEYGEN_STUDIO when DID is OPEN and FAL is OPEN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        qualityRequirement: 'STANDARD',
      };
      const breakerState = {
        DID_EXPRESS: CircuitState.OPEN,
        FAL_WAN: CircuitState.OPEN,
        HEYGEN_STUDIO: CircuitState.CLOSED,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('HEYGEN_STUDIO');
      expect(result.reason).toContain('upgraded to available HEYGEN_STUDIO');
    });

    it('defers DID_EXPRESS when all express providers are OPEN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 60,
        qualityRequirement: 'STANDARD',
      };
      const breakerState = {
        DID_EXPRESS: CircuitState.OPEN,
        FAL_WAN: CircuitState.OPEN,
        HEYGEN_STUDIO: CircuitState.OPEN,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('DEFERRED_OFFPEAK');
      expect(result.reason).toContain('All express providers tripped');
    });

    it('fails over FAL_WAN to DID_EXPRESS when FAL is OPEN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 40,
        qualityRequirement: 'EXPRESS',
      };
      const breakerState = {
        FAL_WAN: CircuitState.OPEN,
        DID_EXPRESS: CircuitState.CLOSED,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('DID_EXPRESS');
      expect(result.reason).toContain('failed over to DID_EXPRESS');
    });

    it('defers FAL_WAN when FAL and DID are both OPEN', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 40,
        qualityRequirement: 'EXPRESS',
      };
      const breakerState = {
        FAL_WAN: CircuitState.OPEN,
        DID_EXPRESS: CircuitState.OPEN,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('DEFERRED_OFFPEAK');
      expect(result.reason).toContain('FAL_WAN circuit breaker OPEN: deferred to off-peak queue');
    });

    it('treats HALF_OPEN and DEGRADED states as available', () => {
      const spec: ComputeArbitrageSpec = {
        durationSeconds: 30,
        isHighVelocity: true,
      };
      const breakerState = {
        HEYGEN_STUDIO: CircuitState.HALF_OPEN,
      };
      const result = evaluateComputeArbitrage(spec, 14, breakerState);
      expect(result.provider).toBe('HEYGEN_STUDIO');
    });

    it('handles NaN or invalid hour gracefully', () => {
      expect(isOffPeakUtcHour(NaN)).toBe(false);
      // @ts-expect-error test invalid hour input
      expect(isOffPeakUtcHour(null)).toBe(false);
    });
  });
});
