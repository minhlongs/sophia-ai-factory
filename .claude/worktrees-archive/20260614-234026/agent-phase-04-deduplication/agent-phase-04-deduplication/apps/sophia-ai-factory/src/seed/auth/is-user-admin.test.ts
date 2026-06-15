/**
 * Tests for isUserAdmin helper.
 *
 * Covers: session admin fast-path / DB admin fallback / neither admin / null DB row.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import type { User } from '@/seed/db/client';

const mockSingle = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

const baseUser: User = {
  id: 'user-1',
  email: 'a@b.co',
};

describe('isUserAdmin', () => {
  beforeEach(() => {
    mockSingle.mockReset();
  });

  it('queries database and returns true when session role is admin and DB role is admin', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' } });
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(true);
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('queries database and returns false when session role is admin but DB role is user', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'user' } });
    const result = await isUserAdmin({ ...baseUser, role: 'admin' });
    expect(result).toBe(false);
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('returns true when DB role is admin (session not admin)', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' } });
    const result = await isUserAdmin({ ...baseUser, role: 'user' });
    expect(result).toBe(true);
    expect(mockSingle).toHaveBeenCalledOnce();
  });

  it('returns false when neither session nor DB say admin', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'user' } });
    const result = await isUserAdmin({ ...baseUser, role: 'user' });
    expect(result).toBe(false);
  });

  it('returns false when DB row is null (no profile)', async () => {
    mockSingle.mockResolvedValue({ data: null });
    const result = await isUserAdmin({ ...baseUser, role: undefined });
    expect(result).toBe(false);
  });
});
