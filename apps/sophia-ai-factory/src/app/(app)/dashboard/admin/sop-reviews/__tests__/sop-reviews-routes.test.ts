/**
 * Unit tests for Admin SOP Reviews Approve & Reject Route Handlers
 *
 * Verifies RBAC, input validation, status transitions, and fail-closed security.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as approvePost } from '../[id]/approve/route';
import { POST as rejectPost } from '../[id]/reject/route';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      first: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  }),
};

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import type { User } from '@/seed/db/client';

describe('Admin SOP Reviews Routes', () => {
  const adminUser: User = { id: 'usr_admin_1', email: 'admin@agencyos.network', role: 'admin' };
  const regularUser: User = { id: 'usr_reg_2', email: 'creator@example.com', role: 'user' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST [id]/approve', () => {
    it('returns 400 when unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const res = await approvePost(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'sop_123' }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('Not authenticated');
    });

    it('returns 400 when user does not have admin tier (fail-closed)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(regularUser);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('BASIC');

      const res = await approvePost(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'sop_123' }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('Admin access required');
    });

    it('returns 400 when listing is not found or not in pending_review', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(adminUser);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('MASTER');

      mockDb.prepare.mockReturnValueOnce({
        bind: vi.fn().mockReturnValueOnce({
          first: vi.fn().mockResolvedValueOnce(null),
        }),
      } as unknown as ReturnType<typeof mockDb.prepare>);

      const res = await approvePost(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'sop_missing' }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('Listing not found');
    });

    it('approves pending listing for MASTER tier admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(adminUser);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('MASTER');

      mockDb.prepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            first: vi.fn().mockResolvedValueOnce({ id: 'sop_123', status: 'pending_review' }),
          }),
        } as unknown as ReturnType<typeof mockDb.prepare>)
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            run: vi.fn().mockResolvedValueOnce({ success: true }),
          }),
        } as unknown as ReturnType<typeof mockDb.prepare>);

      const res = await approvePost(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'sop_123' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(true);
    });
  });

  describe('POST [id]/reject', () => {
    it('returns 400 when unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Incomplete instructions' }),
      });

      const res = await rejectPost(req, {
        params: Promise.resolve({ id: 'sop_123' }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('Not authenticated');
    });

    it('rejects pending listing with reason for ENTERPRISE tier admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(adminUser);
      vi.mocked(resolveUserTier).mockResolvedValueOnce('ENTERPRISE');

      mockDb.prepare
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            first: vi.fn().mockResolvedValueOnce({
              id: 'sop_123',
              status: 'pending_review',
              description: 'Initial description',
            }),
          }),
        } as unknown as ReturnType<typeof mockDb.prepare>)
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValueOnce({
            run: vi.fn().mockResolvedValueOnce({ success: true }),
          }),
        } as unknown as ReturnType<typeof mockDb.prepare>);

      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Formatting does not meet quality standard' }),
      });

      const res = await rejectPost(req, {
        params: Promise.resolve({ id: 'sop_123' }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; error?: string };
      expect(json.success).toBe(true);
    });
  });
});
