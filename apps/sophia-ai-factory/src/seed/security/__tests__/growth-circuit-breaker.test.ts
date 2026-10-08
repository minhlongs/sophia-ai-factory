import { describe, it, expect } from 'vitest';
import {
  classifyGrowthError,
  evaluateCircuitState,
  recordCircuitFailure,
  recordCircuitSuccess,
  CircuitBreakerStateRecord,
} from '../growth-circuit-breaker';

describe('Seed Security: Growth Circuit Breaker', () => {
  describe('classifyGrowthError', () => {
    it('classifies 429 and rate limit errors as TRANSIENT_RATE_LIMIT', () => {
      expect(classifyGrowthError(new Error('HTTP 429: Too Many Requests'))).toBe('TRANSIENT_RATE_LIMIT');
      expect(classifyGrowthError('Rate limit exceeded for provider')).toBe('TRANSIENT_RATE_LIMIT');
    });

    it('classifies timeouts and socket resets as DOWNSTREAM_TIMEOUT', () => {
      expect(classifyGrowthError(new Error('Gateway timeout 504'))).toBe('DOWNSTREAM_TIMEOUT');
      expect(classifyGrowthError('read ECONNRESET')).toBe('DOWNSTREAM_TIMEOUT');
    });

    it('classifies 401 and invalid api keys as INVALID_BYOK_KEY', () => {
      expect(classifyGrowthError(new Error('Unauthorized 401'))).toBe('INVALID_BYOK_KEY');
      expect(classifyGrowthError('Invalid API Key provided')).toBe('INVALID_BYOK_KEY');
    });

    it('classifies 400 and validation errors as PERMANENT_SCHEMA_ERROR', () => {
      expect(classifyGrowthError(new Error('Validation failed for schema'))).toBe('PERMANENT_SCHEMA_ERROR');
      expect(classifyGrowthError('Bad Request 400')).toBe('PERMANENT_SCHEMA_ERROR');
    });

    it('defaults unknown errors to UNKNOWN_ERROR', () => {
      expect(classifyGrowthError(new Error('Something unusual happened'))).toBe('UNKNOWN_ERROR');
      expect(classifyGrowthError(null)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('evaluateCircuitState', () => {
    it('remains OPEN if cooldown period has not elapsed', () => {
      const state: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'OPEN',
        consecutiveFailures: 3,
        lastFailureTime: 1000,
        lastSuccessTime: 0,
      };
      // Cooldown is 60s (60000ms). Now is 1000 + 30000 = 31000
      expect(evaluateCircuitState(state, 31000)).toBe('OPEN');
    });

    it('transitions to HALF_OPEN once cooldown period has passed', () => {
      const state: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'OPEN',
        consecutiveFailures: 3,
        lastFailureTime: 1000,
        lastSuccessTime: 0,
      };
      // Now is 1000 + 60000 = 61000
      expect(evaluateCircuitState(state, 61000)).toBe('HALF_OPEN');
    });

    it('preserves CLOSED state', () => {
      const state: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 1000,
      };
      expect(evaluateCircuitState(state, 2000)).toBe('CLOSED');
    });
  });

  describe('recordCircuitFailure and recordCircuitSuccess', () => {
    it('immediately trips to OPEN on INVALID_BYOK_KEY even on 1 failure', () => {
      const current: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
      };
      const updated = recordCircuitFailure(current, 'INVALID_BYOK_KEY', 5000);
      expect(updated.state).toBe('OPEN');
      expect(updated.consecutiveFailures).toBe(1);
      expect(updated.lastFailureTime).toBe(5000);
    });

    it('trips to OPEN only after meeting threshold for transient errors', () => {
      let current: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
      };

      current = recordCircuitFailure(current, 'DOWNSTREAM_TIMEOUT', 1000);
      expect(current.state).toBe('CLOSED');
      expect(current.consecutiveFailures).toBe(1);

      current = recordCircuitFailure(current, 'DOWNSTREAM_TIMEOUT', 2000);
      expect(current.state).toBe('CLOSED');
      expect(current.consecutiveFailures).toBe(2);

      current = recordCircuitFailure(current, 'DOWNSTREAM_TIMEOUT', 3000);
      expect(current.state).toBe('OPEN');
      expect(current.consecutiveFailures).toBe(3);
    });

    it('resets state to CLOSED and clears failure counter on success', () => {
      const openState: CircuitBreakerStateRecord = {
        resourceId: 'res-1',
        state: 'OPEN',
        consecutiveFailures: 4,
        lastFailureTime: 1000,
        lastSuccessTime: 0,
      };
      const recovered = recordCircuitSuccess(openState, 90000);
      expect(recovered.state).toBe('CLOSED');
      expect(recovered.consecutiveFailures).toBe(0);
      expect(recovered.lastSuccessTime).toBe(90000);
    });
  });
});
