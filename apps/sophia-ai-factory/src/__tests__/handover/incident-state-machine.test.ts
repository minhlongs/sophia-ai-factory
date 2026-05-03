/**
 * Tests for incident state machine.
 * @module __tests__/handover/incident-state-machine.test
 */

import { describe, it, expect } from 'vitest';
import { evaluateIncidentAction } from '@/lib/status/incident-state-machine';

describe('evaluateIncidentAction', () => {
  it('opens incident after 3 consecutive failures with no active incident', () => {
    const checks = [
      { status: 'down' as const },
      { status: 'down' as const },
      { status: 'down' as const },
    ];
    expect(evaluateIncidentAction(checks, null)).toBe('open');
  });

  it('closes incident after 3 consecutive successes with active incident', () => {
    const checks = [
      { status: 'ok' as const },
      { status: 'ok' as const },
      { status: 'ok' as const },
    ];
    expect(evaluateIncidentAction(checks, 'inc-001')).toBe('close');
  });

  it('noops on mixed sequence with no active incident', () => {
    const checks = [
      { status: 'ok' as const },
      { status: 'down' as const },
      { status: 'ok' as const },
    ];
    expect(evaluateIncidentAction(checks, null)).toBe('noop');
  });

  it('noops on 2 failures (not 3)', () => {
    const checks = [
      { status: 'down' as const },
      { status: 'down' as const },
      { status: 'ok' as const },
    ];
    expect(evaluateIncidentAction(checks, null)).toBe('noop');
  });

  it('does not open incident when one is already active', () => {
    const checks = [
      { status: 'down' as const },
      { status: 'down' as const },
      { status: 'down' as const },
    ];
    expect(evaluateIncidentAction(checks, 'existing-inc')).toBe('noop');
  });

  it('returns noop on empty checks', () => {
    expect(evaluateIncidentAction([], null)).toBe('noop');
  });
});
