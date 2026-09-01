/**
 * Unit tests for emitter-health pure predicates.
 * Static-wiring registry: 11 wired, 2 deferred (creative.edited, memory.corrected).
 */

import { describe, it, expect } from 'vitest';
import {
  isWiredEventType,
  isDeferredEventType,
  STALE_EMITTER_WINDOW_MS,
} from '../emitter-health';
import { REALITY_LOOP_EVENT_TYPES } from '../loop-events';

describe('emitter-health static registry', () => {
  it('all 13 canonical event types are accounted for (wired OR deferred)', () => {
    for (const eventType of REALITY_LOOP_EVENT_TYPES) {
      const wired = isWiredEventType(eventType);
      const deferred = isDeferredEventType(eventType);
      expect(wired || deferred).toBe(true);
    }
  });

  it('creative.edited is deferred (no production call site yet)', () => {
    expect(isDeferredEventType('creative.edited')).toBe(true);
    expect(isWiredEventType('creative.edited')).toBe(false);
  });

  it('memory.corrected is deferred (no human-correction hook yet)', () => {
    expect(isDeferredEventType('memory.corrected')).toBe(true);
    expect(isWiredEventType('memory.corrected')).toBe(false);
  });

  it('mission.created is wired', () => {
    expect(isWiredEventType('mission.created')).toBe(true);
    expect(isDeferredEventType('mission.created')).toBe(false);
  });

  it('agent.failed is wired', () => {
    expect(isWiredEventType('agent.failed')).toBe(true);
  });

  it('mission.cost_recorded is wired', () => {
    expect(isWiredEventType('mission.cost_recorded')).toBe(true);
  });

  it('wired + deferred counts sum to 13', () => {
    const wired = REALITY_LOOP_EVENT_TYPES.filter(isWiredEventType).length;
    const deferred = REALITY_LOOP_EVENT_TYPES.filter(isDeferredEventType).length;
    expect(wired).toBe(11);
    expect(deferred).toBe(2);
    expect(wired + deferred).toBe(13);
  });

  it('stale window is 24h in ms', () => {
    expect(STALE_EMITTER_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});
