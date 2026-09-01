/**
 * Unit tests for sentry-symbolication-opt-in.
 * Verifies the doctrine-critical invariant: absent token NEVER blocks deploy.
 */

import { describe, it, expect } from 'vitest';
import {
  decideSymbolication,
  assertSymbolicationNonBlocking,
} from '../sentry-symbolication-opt-in';

describe('decideSymbolication', () => {
  it('returns enabled=true when SENTRY_AUTH_TOKEN present', () => {
    const decision = decideSymbolication({ SENTRY_AUTH_TOKEN: 'abc-secret' });
    expect(decision.enabled).toBe(true);
    expect(decision.reason).toContain('present');
  });

  it('returns enabled=false when token absent', () => {
    const decision = decideSymbolication({});
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toContain('absent');
  });

  it('returns enabled=false when token is whitespace-only', () => {
    const decision = decideSymbolication({ SENTRY_AUTH_TOKEN: '   ' });
    expect(decision.enabled).toBe(false);
  });

  it('returns enabled=false when token is empty string', () => {
    const decision = decideSymbolication({ SENTRY_AUTH_TOKEN: '' });
    expect(decision.enabled).toBe(false);
  });

  it('never throws on missing env object', () => {
    // Pass undefined explicitly — guards against incomplete mocks.
    const decision = decideSymbolication(undefined as unknown as Record<string, string | undefined>);
    expect(decision.enabled).toBe(false);
  });
});

describe('assertSymbolicationNonBlocking', () => {
  it('returns "proceed" when token is present (doctrine: never blocks)', () => {
    const decision = decideSymbolication({ SENTRY_AUTH_TOKEN: 'tok' });
    expect(assertSymbolicationNonBlocking(decision)).toBe('proceed');
  });

  it('returns "proceed" when token is ABSENT (core doctrine invariant)', () => {
    const decision = decideSymbolication({});
    expect(assertSymbolicationNonBlocking(decision)).toBe('proceed');
  });
});
