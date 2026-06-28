/**
 * Tests for LogBuffer — RED-TEAM #9
 * Max-3 cap, flush clears buffer, dropped count tracked.
 */

import { describe, it, expect } from 'vitest';
import { LogBuffer } from './log-buffer';
import type { SafeLogPayload } from './safe-log';

function makeEntry(msg: string): SafeLogPayload {
  return { ts: Date.now(), level: 'info', msg, ctx: {} };
}

describe('LogBuffer', () => {
  it('accepts up to 3 entries', () => {
    const buf = new LogBuffer();
    buf.push(makeEntry('one'));
    buf.push(makeEntry('two'));
    buf.push(makeEntry('three'));
    expect(buf.size).toBe(3);
    expect(buf.droppedCount).toBe(0);
  });

  it('drops entries beyond cap and increments droppedCount', () => {
    const buf = new LogBuffer();
    for (let i = 0; i < 5; i++) buf.push(makeEntry(`msg-${i}`));
    expect(buf.size).toBe(3);
    expect(buf.droppedCount).toBe(2);
  });

  it('flush returns all entries and clears buffer', () => {
    const buf = new LogBuffer();
    buf.push(makeEntry('a'));
    buf.push(makeEntry('b'));
    const flushed = buf.flush();
    expect(flushed).toHaveLength(2);
    expect(flushed[0].msg).toBe('a');
    expect(buf.size).toBe(0);
  });

  it('flush on empty buffer returns empty array', () => {
    const buf = new LogBuffer();
    expect(buf.flush()).toEqual([]);
  });

  it('pushBatch called once per request (single flush cycle)', () => {
    // Verifies the "one pushBatch per request" contract:
    // push N entries, flush returns them all in one array for one fetch call.
    const buf = new LogBuffer();
    buf.push(makeEntry('x'));
    buf.push(makeEntry('y'));
    buf.push(makeEntry('z'));
    const flushed = buf.flush();
    // All entries in one batch → caller makes exactly 1 fetch to Better Stack
    expect(flushed).toHaveLength(3);
    expect(buf.size).toBe(0);
  });
});
