/**
 * audit.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRun, mockBind, mockPrepare, mockAll } = vi.hoisted(() => {
  const mockRun = vi.fn().mockResolvedValue({ success: true });
  const mockBind = vi.fn().mockReturnThis();
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, run: mockRun });
  const mockAll = vi.fn().mockResolvedValue({ results: [] });
  return { mockRun, mockBind, mockPrepare, mockAll };
});

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => ({
    prepare: mockPrepare,
    all: mockAll,
  })),
}));

import { audit } from '../audit';

describe('audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ bind: mockBind, run: mockRun });
    mockBind.mockReturnThis();
    mockRun.mockResolvedValue({ success: true });
  });

  it('INSERT is called with correct fields', async () => {
    await audit({
      tenantId: 'tenant-123',
      actor: 'test-actor',
      action: 'video.gen.started',
      resource: 'campaign-abc',
      metadata: { tier: 'lite' },
    });

    expect(mockPrepare).toHaveBeenCalledOnce();
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO audit_log');
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('does not throw when D1 fails (silent swallow)', async () => {
    mockRun.mockRejectedValueOnce(new Error('D1 error'));

    await expect(
      audit({ tenantId: 'tenant-err', action: 'test.action' }),
    ).resolves.toBeUndefined();
  });

  it('defaults actor to system when not provided', async () => {
    await audit({ tenantId: 'tenant-def', action: 'some.action' });

    expect(mockBind).toHaveBeenCalledWith(
      'tenant-def',
      'system',
      'some.action',
      null,
      null,
      expect.any(Number),
    );
  });

  it('serializes metadata to JSON', async () => {
    await audit({
      tenantId: 'tenant-meta',
      action: 'test',
      metadata: { key: 'value', count: 42 },
    });

    const bindArgs = mockBind.mock.calls[0] as unknown[];
    const metaArg = bindArgs[4] as string;
    expect(JSON.parse(metaArg)).toEqual({ key: 'value', count: 42 });
  });

  it('no UPDATE or DELETE SQL is ever issued', async () => {
    await audit({ tenantId: 'tenant-immutable', action: 'check' });

    const allSqls = (mockPrepare.mock.calls as string[][]).map((c) => c[0].toUpperCase());
    const hasUpdateDelete = allSqls.some(
      (sql) => sql.includes('UPDATE') || sql.includes('DELETE'),
    );
    expect(hasUpdateDelete).toBe(false);
  });
});
