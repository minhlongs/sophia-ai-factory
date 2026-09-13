/**
 * Unit tests for land/commerce/actions/commerce-action-auth.
 * Verifies requireWorkspaceAccess authentication, workspace membership check,
 * and fail-closed error handling.
 *
 * @module land/commerce/__tests__/commerce-action-auth.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetCurrentUser, mockVerifyWorkspaceAccess, mockCreateServerClient } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: mockVerifyWorkspaceAccess,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { requireWorkspaceAccess } from '../actions/commerce-action-auth';

describe('land/commerce/actions/commerce-action-auth', () => {
  const fakeUser = { id: 'usr_commerce_1', email: 'merchant@test.com' };
  const fakeWorkspaceId = 'ws_commerce_1';
  const fakeDb = {} as unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockReturnValue(fakeDb);
    mockGetCurrentUser.mockResolvedValue(fakeUser);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
  });

  it('returns NOT_AUTHENTICATED when user is not logged in', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await requireWorkspaceAccess(fakeWorkspaceId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NOT_AUTHENTICATED');
      expect(res.error.message).toBe('Authentication required');
    }
  });

  it('returns FORBIDDEN when user does not have workspace access', async () => {
    mockVerifyWorkspaceAccess.mockResolvedValue(false);
    const res = await requireWorkspaceAccess(fakeWorkspaceId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FORBIDDEN');
      expect(res.error.message).toBe('You do not have access to this workspace');
    }
    expect(mockVerifyWorkspaceAccess).toHaveBeenCalledWith(fakeWorkspaceId, fakeUser.id, fakeDb);
  });

  it('returns success with user id and email when membership is valid', async () => {
    const res = await requireWorkspaceAccess(fakeWorkspaceId);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.id).toBe(fakeUser.id);
      expect(res.value.email).toBe(fakeUser.email);
    }
  });

  it('returns INTERNAL error when verifyWorkspaceAccess throws', async () => {
    mockVerifyWorkspaceAccess.mockRejectedValue(new Error('D1 connection terminated'));
    const res = await requireWorkspaceAccess(fakeWorkspaceId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INTERNAL');
      expect(res.error.message).toBe('D1 connection terminated');
    }
  });
});
