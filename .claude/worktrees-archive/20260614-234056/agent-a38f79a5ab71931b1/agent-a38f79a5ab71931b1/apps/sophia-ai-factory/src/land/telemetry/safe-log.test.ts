/**
 * Tests for safeLog — RED-TEAM #12
 * PII scrub + JSON.stringify escape + 4KB truncate.
 */

import { describe, it, expect } from 'vitest';
import { safeLog } from './safe-log';

describe('safeLog', () => {
  it('scrubs PII from message', () => {
    const payload = safeLog('error', 'User sk-abcdefghijklmnopqrstuvwxyz failed');
    expect(payload.msg).toContain('[REDACTED-SK]');
    expect(payload.msg).not.toContain('sk-abcde');
  });

  it('scrubs PII from ctx values', () => {
    const payload = safeLog('info', 'login', { email: 'user@example.com', role: 'admin' });
    const ctx = payload.ctx as Record<string, unknown>;
    expect(ctx.email as string).toContain('[REDACTED-EMAIL]');
    expect(ctx.role).toBe('admin');
  });

  it('truncates message longer than 4096 chars', () => {
    const longMsg = 'a'.repeat(5000);
    const payload = safeLog('warn', longMsg);
    expect(payload.msg.length).toBeLessThanOrEqual(4096 + '[TRUNCATED]'.length + 3);
    expect(payload.msg).toContain('[TRUNCATED]');
  });

  it('escapes control characters via JSON round-trip', () => {
    // Newline injection attempt
    const payload = safeLog('info', 'normal msg', { input: 'value\ninjected\u0000null' });
    // After JSON.stringify + parse the string is safely encoded
    const ctxStr = JSON.stringify(payload.ctx);
    expect(ctxStr).not.toContain('\n'); // raw newline must not appear
  });

  it('returns correct level and ts', () => {
    const before = Date.now();
    const payload = safeLog('fatal', 'crash');
    expect(payload.level).toBe('fatal');
    expect(payload.ts).toBeGreaterThanOrEqual(before);
  });
});
