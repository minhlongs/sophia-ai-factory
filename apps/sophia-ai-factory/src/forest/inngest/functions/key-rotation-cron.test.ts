/**
 * Key Rotation Cron Tests — Phase 3: Auto-Rotation Cron
 *
 * Covers:
 *   - Skip when no key versions exist
 *   - Skip when key version is < 90 days old
 *   - Trigger rotation when key version is >= 90 days old
 *   - Audit log events written correctly for each scenario
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
const { mockLogAuditEvent } = vi.hoisted(() => ({
  mockLogAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({}),
}));
const { mockGenerateMasterKey } = vi.hoisted(() => ({
  mockGenerateMasterKey: vi.fn().mockResolvedValue('encrypted-key-base64'),
}));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

vi.mock('@cloudflare/d1', () => ({}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: mockInngestSend,
    createFunction: (
      _cfg: unknown,
      _evt: unknown,
      handler: (...args: unknown[]) => unknown,
    ) => handler,
  },
}));

vi.mock('@/tree/audit/logger/audit-query', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock('@/tree/byok/byok-crypto', () => ({
  decryptApiKey: vi.fn(),
  encryptApiKey: vi.fn(),
  generateMasterKey: mockGenerateMasterKey,
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mockLogger }));

// ── Import after mocks ──────────────────────────────────────────────────────

import { keyRotationCron } from '@/forest/inngest/functions/key-rotation-reencrypt';

// ── Types ───────────────────────────────────────────────────────────────────

type InngestCronHandler = (ctx: {
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}) => Promise<unknown>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeD1Mock() {
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const all = vi.fn().mockResolvedValue({ results: [] });
  const bind = vi.fn().mockReturnValue({ first, run, all });
  const prepare = vi.fn().mockReturnValue({ bind, first, run, all });
  return { prepare, bind, first, run, all };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('keyRotationCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips rotation when no key versions exist and logs audit event', async () => {
    const db = makeD1Mock();
    mockGetD1.mockReturnValue(db);

    const handler = keyRotationCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    // Verify skip result
    expect(result).toEqual({ skipped: true, reason: 'no_key_version' });

    // Verify audit log
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'key_rotation.cron_skip_no_version',
        userId: 'system',
      }),
    );

    // Verify rotation was NOT triggered
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('skips rotation when key version is less than 90 days old', async () => {
    const db = makeD1Mock();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    db.first.mockResolvedValue({ version: 1, created_at: thirtyDaysAgo });
    mockGetD1.mockReturnValue(db);

    const handler = keyRotationCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    // Verify skip result
    const res = result as Record<string, unknown>;
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('too_young');
    expect(res.version).toBe(1);
    expect(res.ageDays).toBeLessThan(90);

    // Verify audit log
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'key_rotation.cron_skip_too_young',
        userId: 'system',
      }),
    );

    // Verify rotation was NOT triggered
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('triggers rotation when key version is >= 90 days old', async () => {
    const db = makeD1Mock();
    const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 86_400_000).toISOString();
    db.first
      .mockResolvedValueOnce({ version: 2, created_at: ninetyFiveDaysAgo })
      .mockResolvedValueOnce({ next_version: 3 });
    mockGetD1.mockReturnValue(db);

    const handler = keyRotationCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await handler({ step: mockStep });

    // Verify trigger result
    const res = result as Record<string, unknown>;
    expect(res.skipped).toBe(false);
    expect(res.keyVersion).toBe(3);
    expect(res.oldVersion).toBe(2);
    expect(res.ageDays).toBeGreaterThanOrEqual(90);

    // Verify master key was generated
    expect(mockGenerateMasterKey).toHaveBeenCalled();

    // Verify new version was inserted
    const prepareCalls = db.prepare.mock.calls as Array<[string]>;
    const insertCall = prepareCalls.find(([sql]) => sql.includes('INSERT INTO key_versions'));
    expect(insertCall).toBeDefined();

    // Verify Inngest event was fired
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'key.rotation.requested',
        data: { keyVersion: 3, oldVersion: 2, reason: 'auto-rotation-cron' },
      }),
    );

    // Verify audit log
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'key_rotation.cron_triggered',
        userId: 'system',
      }),
    );
  });

  it('handles D1 not being available gracefully', async () => {
    mockGetD1.mockReturnValue(null);

    const handler = keyRotationCron as unknown as InngestCronHandler;
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    // Should throw an error when D1 is unavailable
    await expect(handler({ step: mockStep })).rejects.toThrow(
      'D1 database binding not available',
    );
  });
});
