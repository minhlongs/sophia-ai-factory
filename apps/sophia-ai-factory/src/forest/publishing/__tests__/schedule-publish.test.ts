/**
 * Unit tests: schedulePublish helper
 *
 * Covers:
 * 1. happy path — inserts row + emits event + returns jobId
 * 2. D1 insert error — throws Error
 * 3. caption + scheduledAt forwarded correctly
 * 4. inngest.send called with correct event name and data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn(),
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Import SUT ────────────────────────────────────────────────────────────────
import { schedulePublish } from '../schedule-publish';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeD1(overrides?: { runError?: string; runSuccess?: boolean }): D1Database {
  const runResult = {
    success: overrides?.runSuccess ?? true,
    error: overrides?.runError,
    meta: { changes: 1, duration: 1, last_row_id: 1, rows_read: 0, rows_written: 1 },
    results: [],
  };
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue(runResult),
        first: vi.fn(),
        all: vi.fn(),
      }),
    }),
    dump: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  } as unknown as D1Database;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('schedulePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue(undefined);
  });

  it('happy path: returns a jobId and emits publish.scheduled event', async () => {
    const db = makeD1();
    const result = await schedulePublish(db, {
      channelId: 'ch-abc',
      videoId: 'vid-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
    });

    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(mockInngestSend).toHaveBeenCalledOnce();
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'publish.scheduled',
      data: {
        jobId: result.jobId,
        tenantId: 'tenant-001',
        userId: 'user-001',
      },
    });
  });

  it('forwards caption to D1 bind correctly', async () => {
    const db = makeD1();
    await schedulePublish(db, {
      channelId: 'ch-abc',
      videoId: 'vid-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
      caption: 'Hello world caption',
    });

    // Verify bind was called with caption string (not undefined)
    const prepareMock = db.prepare as unknown as { mock: { results: Array<{ value: { bind: { mock: { calls: unknown[][] } } } }> } };
    const bindArgs = prepareMock.mock.results[0].value.bind.mock.calls[0];
    expect(bindArgs).toContain('Hello world caption');
  });

  it('throws when D1 insert returns error field', async () => {
    const db = makeD1({ runError: 'UNIQUE constraint failed' });

    await expect(
      schedulePublish(db, {
        channelId: 'ch-abc',
        videoId: 'vid-001',
        tenantId: 'tenant-001',
        userId: 'user-001',
      }),
    ).rejects.toThrow(/Insert failed/i);

    // inngest.send must NOT be called on insert failure
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('uses default scheduledAt (now) when not provided', async () => {
    const before = Math.floor(Date.now() / 1000);
    const db = makeD1();
    await schedulePublish(db, {
      channelId: 'ch-abc',
      videoId: 'vid-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
    });
    const after = Math.floor(Date.now() / 1000);

    type PrepMock = { mock: { results: Array<{ value: { bind: { mock: { calls: unknown[][] } } } }> } };
    const prepareMock = db.prepare as unknown as PrepMock;
    const args = prepareMock.mock.results[0].value.bind.mock.calls[0];
    // Bind args order: id, tenantId, videoId, channelId, caption, scheduled_at, created_at
    const scheduledAt = args[5] as number;
    expect(scheduledAt).toBeGreaterThanOrEqual(before);
    expect(scheduledAt).toBeLessThanOrEqual(after);
  });

  it('uses provided scheduledAt when given', async () => {
    const db = makeD1();
    const futureTs = Math.floor(Date.now() / 1000) + 3600;
    await schedulePublish(db, {
      channelId: 'ch-abc',
      videoId: 'vid-001',
      tenantId: 'tenant-001',
      userId: 'user-001',
      scheduledAt: futureTs,
    });

    type PrepMock = { mock: { results: Array<{ value: { bind: { mock: { calls: unknown[][] } } } }> } };
    const prepareMock = db.prepare as unknown as PrepMock;
    const args = prepareMock.mock.results[0].value.bind.mock.calls[0];
    const scheduledAt = args[5] as number;
    expect(scheduledAt).toBe(futureTs);
  });
});
