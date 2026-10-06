import { describe, expect, it } from 'vitest';
import {
  createInitialCircuitStatus,
  evaluateCircuitStatus,
  getRemainingCooldownMs,
  isCircuitAvailable,
} from '../circuit-breaker';

describe('Autonomous Two-Tier Circuit Breaker Evaluator', () => {
  const service = 'affiliate-scout';
  const threshold = 5;
  const cooldownMs = 300_000; // 5 minutes

  it('initializes circuit breaker in healthy CLOSED state', () => {
    const status = createInitialCircuitStatus(service, {
      failureThreshold: threshold,
      cooldownPeriodMs: cooldownMs,
    });

    expect(status.state).toBe('CLOSED');
    expect(status.consecutiveFailures).toBe(0);
    expect(status.failureThreshold).toBe(5);
    expect(isCircuitAvailable(status)).toBe(true);
  });

  it('increments consecutive failures without tripping below threshold', () => {
    let status = createInitialCircuitStatus(service, {
      failureThreshold: threshold,
      cooldownPeriodMs: cooldownMs,
    });

    for (let i = 1; i < threshold; i++) {
      const res = evaluateCircuitStatus(status, 'FAILURE');
      status = res.status;
      expect(status.state).toBe('CLOSED');
      expect(status.consecutiveFailures).toBe(i);
      expect(res.tripped).toBe(false);
      expect(isCircuitAvailable(status)).toBe(true);
    }
  });

  it('trips circuit to OPEN at exactly the failure threshold', () => {
    let status = createInitialCircuitStatus(service, {
      failureThreshold: threshold,
      cooldownPeriodMs: cooldownMs,
    });

    // 4 failures
    for (let i = 0; i < 4; i++) {
      status = evaluateCircuitStatus(status, 'FAILURE').status;
    }

    // 5th failure trips
    const res = evaluateCircuitStatus(status, 'FAILURE');
    expect(res.tripped).toBe(true);
    expect(res.status.state).toBe('OPEN');
    expect(res.status.consecutiveFailures).toBe(5);
    expect(isCircuitAvailable(res.status)).toBe(false);
  });

  it('resets failure count to 0 on SUCCESS in CLOSED state', () => {
    let status = createInitialCircuitStatus(service, {
      failureThreshold: threshold,
    });

    // Accumulate 3 failures
    for (let i = 0; i < 3; i++) {
      status = evaluateCircuitStatus(status, 'FAILURE').status;
    }
    expect(status.consecutiveFailures).toBe(3);

    const res = evaluateCircuitStatus(status, 'SUCCESS');
    expect(res.status.consecutiveFailures).toBe(0);
    expect(res.status.state).toBe('CLOSED');
  });

  it('maintains OPEN state and rejects executions during cooldown period', () => {
    const tripTime = 1_000_000;
    const openStatus = createInitialCircuitStatus(service, {
      state: 'OPEN',
      consecutiveFailures: 5,
      lastFailureAt: tripTime,
      lastStateChangeAt: tripTime,
      cooldownPeriodMs: cooldownMs,
    });

    // 100 seconds later (cooldown is 300 seconds)
    const midCooldown = tripTime + 100_000;
    expect(getRemainingCooldownMs(openStatus, midCooldown)).toBe(200_000);
    expect(isCircuitAvailable(openStatus, midCooldown)).toBe(false);

    // PROBE action before cooldown does not change state
    const probeRes = evaluateCircuitStatus(openStatus, 'PROBE', midCooldown);
    expect(probeRes.status.state).toBe('OPEN');
  });

  it('transitions from OPEN to HALF_OPEN when cooldown expires and PROBE is evaluated', () => {
    const tripTime = 1_000_000;
    const openStatus = createInitialCircuitStatus(service, {
      state: 'OPEN',
      consecutiveFailures: 5,
      lastFailureAt: tripTime,
      lastStateChangeAt: tripTime,
      cooldownPeriodMs: cooldownMs,
    });

    const afterCooldown = tripTime + cooldownMs + 10;
    expect(getRemainingCooldownMs(openStatus, afterCooldown)).toBe(0);
    expect(isCircuitAvailable(openStatus, afterCooldown)).toBe(true);

    const probeRes = evaluateCircuitStatus(openStatus, 'PROBE', afterCooldown);
    expect(probeRes.status.state).toBe('HALF_OPEN');
    expect(probeRes.tripped).toBe(false);
  });

  it('recovers from HALF_OPEN to CLOSED on successful canary probe', () => {
    const halfOpenStatus = createInitialCircuitStatus(service, {
      state: 'HALF_OPEN',
      consecutiveFailures: 5,
    });

    const res = evaluateCircuitStatus(halfOpenStatus, 'SUCCESS');
    expect(res.recovered).toBe(true);
    expect(res.status.state).toBe('CLOSED');
    expect(res.status.consecutiveFailures).toBe(0);
  });

  it('trips from HALF_OPEN back to OPEN immediately if canary probe fails', () => {
    const halfOpenStatus = createInitialCircuitStatus(service, {
      state: 'HALF_OPEN',
      consecutiveFailures: 5,
    });

    const res = evaluateCircuitStatus(halfOpenStatus, 'FAILURE');
    expect(res.tripped).toBe(true);
    expect(res.status.state).toBe('OPEN');
    expect(res.status.consecutiveFailures).toBe(6);
  });
});
