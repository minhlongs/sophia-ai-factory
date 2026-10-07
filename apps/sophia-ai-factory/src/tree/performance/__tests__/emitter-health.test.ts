/**
 * Unit tests for emitter-health pure predicates.
 * Static-wiring registry: 13 wired, 0 deferred in Reality Loop v1.2.
 */

import { describe, it, expect } from 'vitest';
import {
  isWiredEventType,
  isDeferredEventType,
  isContingentEventType,
  CONTINGENT_EVENT_TYPES,
  STALE_EMITTER_WINDOW_MS,
} from '../emitter-health';
import { REALITY_LOOP_EVENT_TYPES } from '../loop-events';

describe('emitter-health static registry', () => {
  it('all 13 canonical event types are accounted for (wired)', () => {
    for (const eventType of REALITY_LOOP_EVENT_TYPES) {
      const wired = isWiredEventType(eventType);
      expect(wired).toBe(true);
    }
  });

  it('creative.edited is wired via editCreativeArtifact Server Action', () => {
    expect(isWiredEventType('creative.edited')).toBe(true);
    expect(isDeferredEventType('creative.edited')).toBe(false);
  });

  it('memory.corrected is wired via correctMemory Server Action', () => {
    expect(isWiredEventType('memory.corrected')).toBe(true);
    expect(isDeferredEventType('memory.corrected')).toBe(false);
  });

  it('mission.created is wired', () => {
    expect(isWiredEventType('mission.created')).toBe(true);
    expect(isDeferredEventType('mission.created')).toBe(false);
  });

  it('agent.failed is wired and contingent', () => {
    expect(isWiredEventType('agent.failed')).toBe(true);
    expect(isContingentEventType('agent.failed')).toBe(true);
  });

  it('creative.edited and memory.corrected are contingent event types', () => {
    expect(isContingentEventType('creative.edited')).toBe(true);
    expect(isContingentEventType('memory.corrected')).toBe(true);
  });

  it('contingent event types are registered', () => {
    expect(CONTINGENT_EVENT_TYPES.has('mission.abandoned')).toBe(true);
    expect(CONTINGENT_EVENT_TYPES.has('approval.rejected')).toBe(true);
    expect(CONTINGENT_EVENT_TYPES.has('creative.rejected')).toBe(true);
  });

  it('mission.cost_recorded is wired and not contingent', () => {
    expect(isWiredEventType('mission.cost_recorded')).toBe(true);
    expect(isContingentEventType('mission.cost_recorded')).toBe(false);
  });

  it('wired + deferred counts sum to 13 (13 wired, 0 deferred)', () => {
    const wired = REALITY_LOOP_EVENT_TYPES.filter(isWiredEventType).length;
    const deferred = REALITY_LOOP_EVENT_TYPES.filter(isDeferredEventType).length;
    expect(wired).toBe(13);
    expect(deferred).toBe(0);
    expect(wired + deferred).toBe(13);
  });

  it('stale window is 24h in ms', () => {
    expect(STALE_EMITTER_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

