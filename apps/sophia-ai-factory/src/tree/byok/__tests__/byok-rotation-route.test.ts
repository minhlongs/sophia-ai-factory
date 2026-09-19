/**
 * BYOK Key Rotation Route Tests (/api/admin/byok-rotation)
 *
 * Verifies:
 * - Route protection: admin auth required, 403 for unauthorized users
 * - Master key version generation in key_versions
 * - 7-day dual-decrypt window returned in response
 * - Inngest event 'key.rotation.requested' emitted
 * - SOC 2 CC7.2 audit log recorded
 * - Empty body and custom reason handling
 * - GET status endpoint reporting active version
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

const { mockLogAuditEvent } = vi.hoisted(() => ({ mockLogAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/tree/audit/logger/audit-query', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock('@/tree/byok/byok-crypto', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@/tree/byok/byok-crypto');
  return {
    ...actual,
    generateMasterKey: vi.fn().mockResolvedValue('new-encrypted-key-base64'),
    getActiveKeyVersion: vi.fn().mockResolvedValue(3),
  };
});

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdminWithRecentAuth: vi.fn(),
}));

import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { inngest } from '@/seed/inngest/client';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import { generateMasterKey, getActiveKeyVersion } from '@/tree/byok/byok-crypto';
import { POST, GET } from '@/app/api/admin/byok-rotation/route';

function createD1Mock() {
  const calls: Array<{ sql: string; bindArgs: unknown[] }> = [];
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const first = vi.fn().mockResolvedValue(null);

  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    calls.push({ sql: 'BIND', bindArgs: args });
    return { run, first };
  });

  const prepare = vi.fn().mockImplementation((sql: string) => {
    calls.push({ sql, bindArgs: [] });
    return { bind, first, run };
  });

  return { prepare, bind, first, run, calls };
}

describe('BYOK Rotation Route (/api/admin/byok-rotation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/byok-rotation', () => {
    it('rejects unauthenticated or non-admin requests', async () => {
      vi.mocked(requireAdminWithRecentAuth).mockResolvedValue(
        NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
      );

      const request = new NextRequest('http://localhost:3000/api/admin/byok-rotation', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'Admin access required' });
    });

    it('successfully initiates rotation, increments key version, sets 7-day dual-decrypt window, fires Inngest event, and logs SOC 2 audit', async () => {
      vi.mocked(requireAdminWithRecentAuth).mockResolvedValue({
        user: { id: 'admin-sec-01', email: 'security@sophia.ai', role: 'admin' },
        recentAuth: true,
      });

      const db = createD1Mock();
      mockGetD1.mockReturnValue(db);

      // 1st query: current active version -> 2
      db.first.mockResolvedValueOnce({ version: 2 });
      // 2nd query: next version -> 3
      db.first.mockResolvedValueOnce({ next_version: 3 });

      const request = new NextRequest('http://localhost:3000/api/admin/byok-rotation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Q3 Enterprise Key Rotation' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        keyVersion: 3,
        oldVersion: 2,
        dualDecryptWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days (604,800,000 ms)
        message: 'Key rotation queued. Re-encryption will run asynchronously.',
      });

      // Assert Inngest event fired
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'key.rotation.requested',
          data: {
            keyVersion: 3,
            oldVersion: 2,
            reason: 'Q3 Enterprise Key Rotation',
          },
        }),
      );

      // Assert SOC 2 audit log recorded
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'key_rotation.requested',
          userId: 'admin-sec-01',
          metadata: expect.objectContaining({
            keyVersion: 3,
            oldVersion: 2,
            reason: 'Q3 Enterprise Key Rotation',
          }),
        }),
      );
    });

    it('handles empty request body gracefully without failing', async () => {
      vi.mocked(requireAdminWithRecentAuth).mockResolvedValue({
        user: { id: 'admin-sec-02', email: 'admin@sophia.ai', role: 'admin' },
        recentAuth: true,
      });

      const db = createD1Mock();
      mockGetD1.mockReturnValue(db);

      db.first.mockResolvedValueOnce({ version: 1 });
      db.first.mockResolvedValueOnce({ next_version: 2 });

      const request = new NextRequest('http://localhost:3000/api/admin/byok-rotation', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        keyVersion: number;
        oldVersion: number;
      };
      expect(data.success).toBe(true);
      expect(data.keyVersion).toBe(2);
      expect(data.oldVersion).toBe(1);
    });
  });

  describe('GET /api/admin/byok-rotation', () => {
    it('returns current active key version and rotation configuration for admins', async () => {
      vi.mocked(requireAdminWithRecentAuth).mockResolvedValue({
        user: { id: 'admin-sec-03', email: 'admin@sophia.ai', role: 'admin' },
        recentAuth: true,
      });

      vi.mocked(getActiveKeyVersion).mockResolvedValueOnce(3);

      const request = new NextRequest('http://localhost:3000/api/admin/byok-rotation', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        status: 'ready',
        activeVersion: 3,
        dualDecryptWindowMs: 604800000,
        keyType: 'master',
        algorithm: 'AES-256-GCM',
      });
    });

    it('blocks non-admin access to GET status', async () => {
      vi.mocked(requireAdminWithRecentAuth).mockResolvedValue(
        NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
      );

      const request = new NextRequest('http://localhost:3000/api/admin/byok-rotation', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });
});
