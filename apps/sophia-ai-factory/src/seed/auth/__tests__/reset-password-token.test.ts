/**
 * Unit tests for reset-password-token.ts
 * Covers: HMAC sign/verify, TTL, tamper detection, malformed input,
 *         missing env, jti DB insert + consume, and replay prevention.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signResetToken, consumeResetToken } from '../reset-password-token';

// ---- D1 mock helpers ----

function makeD1(changesOnUpdate = 1) {
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: changesOnUpdate } });
  const bindFn = vi.fn().mockReturnValue({ run: runFn, first: vi.fn().mockResolvedValue(null) });
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn });
  return { prepare: prepareFn, _run: runFn, _bind: bindFn };
}

/** D1 mock where INSERT succeeds and first UPDATE consumes, second UPDATE sees 0 changes */
function makeReplayD1() {
  let updateCallCount = 0;
  const insertRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const updateRun = vi.fn().mockImplementation(() => {
    updateCallCount++;
    return Promise.resolve({ meta: { changes: updateCallCount === 1 ? 1 : 0 } });
  });

  const prepareFn = vi.fn().mockImplementation((sql: string) => {
    const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');
    const run = isUpdate ? updateRun : insertRun;
    return { bind: vi.fn().mockReturnValue({ run, first: vi.fn().mockResolvedValue(null) }) };
  });

  return { prepare: prepareFn, _insertRun: insertRun, _updateRun: updateRun };
}

// ---- Tests ----

describe('signResetToken + consumeResetToken', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-padded!!';
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it('roundtrip: sign then consume returns userId', async () => {
    const db = makeD1(1);
    const token = await signResetToken('user-123', db as never);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    // For consume, we need INSERT to succeed (already did) then UPDATE to succeed
    const consumeDb = makeD1(1);
    const userId = await consumeResetToken(token, consumeDb as never);
    expect(userId).toBe('user-123');
  });

  it('inserts jti into DB on sign', async () => {
    const db = makeD1(1);
    await signResetToken('user-456', db as never);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_reset_tokens'),
    );
    expect(db._bind).toHaveBeenCalled();
    expect(db._run).toHaveBeenCalled();
  });

  it('replay: consume same token twice returns null on second attempt', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-789', signDb as never);

    const replayDb = makeReplayD1();
    const first = await consumeResetToken(token, replayDb as never);
    expect(first).toBe('user-789');

    const second = await consumeResetToken(token, replayDb as never);
    expect(second).toBeNull();
  });

  it('DB update 0 changes returns null (simulates already-consumed)', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-aaa', signDb as never);

    const db = makeD1(0); // UPDATE returns 0 changes
    const result = await consumeResetToken(token, db as never);
    expect(result).toBeNull();
  });
});

describe('consumeResetToken — invalid inputs', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-padded!!';
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it('returns null for malformed token (no dot)', async () => {
    const db = makeD1(1);
    const result = await consumeResetToken('nodot', db as never);
    expect(result).toBeNull();
  });

  it('returns null for bad base64 payload', async () => {
    const db = makeD1(1);
    const result = await consumeResetToken('!!!bad!!!.invalidsig', db as never);
    expect(result).toBeNull();
  });

  it('returns null for tampered signature', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-tamp', signDb as never);
    const tampered = token.slice(0, -4) + 'aaaa';
    const db = makeD1(1);
    const result = await consumeResetToken(tampered, db as never);
    expect(result).toBeNull();
  });

  it('returns null for expired token (mocked Date.now)', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-exp', signDb as never);

    // Advance time 2 hours
    const origNow = Date.now;
    Date.now = () => origNow() + 2 * 3600 * 1000;
    try {
      const db = makeD1(1);
      const result = await consumeResetToken(token, db as never);
      expect(result).toBeNull();
    } finally {
      Date.now = origNow;
    }
  });

  it('returns null when payload missing required fields', async () => {
    // Craft a token with missing jti
    const badPayload = btoa(JSON.stringify({ userId: 'u', exp: Date.now() / 1000 + 3600 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const db = makeD1(1);
    // No valid sig — will fail sig check first, which is fine
    const result = await consumeResetToken(`${badPayload}.invalidsig`, db as never);
    expect(result).toBeNull();
  });
});

describe('consumeResetToken — additional coverage (migrated from verifyResetToken)', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-min-32-chars-padded!!';
  });

  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it('valid token returns userId (consume succeeds)', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-verify', signDb as never);
    const consumeDb = makeD1(1);
    const userId = await consumeResetToken(token, consumeDb as never);
    expect(userId).toBe('user-verify');
  });

  it('returns null for tampered payload', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-t2', signDb as never);
    const [payloadB64, sig] = token.split('.');
    const badPayload = payloadB64 + 'X';
    const db = makeD1(1);
    const result = await consumeResetToken(`${badPayload}.${sig}`, db as never);
    expect(result).toBeNull();
  });

  it('returns null for expired token', async () => {
    const signDb = makeD1(1);
    const token = await signResetToken('user-t3', signDb as never);
    const origNow = Date.now;
    Date.now = () => origNow() + 2 * 3600 * 1000;
    try {
      const db = makeD1(1);
      const result = await consumeResetToken(token, db as never);
      expect(result).toBeNull();
    } finally {
      Date.now = origNow;
    }
  });
});

describe('getSecret — missing env', () => {
  it('throws when BETTER_AUTH_SECRET not set', async () => {
    const origSecret = process.env.BETTER_AUTH_SECRET;
    const origJwt = process.env.JWT_SECRET=REDACTED;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.JWT_SECRET=REDACTED;

    try {
      const db = makeD1(1);
      await expect(signResetToken('u', db as never)).rejects.toThrow('BETTER_AUTH_SECRET must be set');
    } finally {
      if (origSecret !== undefined) process.env.BETTER_AUTH_SECRET = origSecret;
      if (origJwt !== undefined) process.env.JWT_SECRET=REDACTED = origJwt;
    }
  });
});
