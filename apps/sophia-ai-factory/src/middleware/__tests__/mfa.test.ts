import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { isMfaChallengePath, requiresMfaCheck, enforceMfaGate } from '../mfa';

vi.mock('@/seed/auth/mfa/login-challenge', () => ({
  isSessionMfaPending: vi.fn(),
}));

import { isSessionMfaPending } from '@/seed/auth/mfa/login-challenge';

describe('MFA gate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows MFA challenge paths without checking MFA', () => {
    expect(isMfaChallengePath('/auth/mfa-challenge')).toBe(true);
    expect(isMfaChallengePath('/api/auth/mfa/challenge')).toBe(true);
    expect(isMfaChallengePath('/api/auth/mfa/verify')).toBe(true);
    expect(isMfaChallengePath('/dashboard')).toBe(false);
  });

  it('identifies routes requiring MFA check', () => {
    expect(requiresMfaCheck('/dashboard')).toBe(true);
    expect(requiresMfaCheck('/dashboard/settings')).toBe(true);
    expect(requiresMfaCheck('/api/billing')).toBe(true);
    expect(requiresMfaCheck('/api/admin/users')).toBe(true);
    expect(requiresMfaCheck('/auth/mfa-challenge')).toBe(false);
    expect(requiresMfaCheck('/api/health')).toBe(false);
  });

  it('enforceMfaGate returns null when MFA is not required for route', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await enforceMfaGate('sess-1', '/api/health', req);
    expect(res).toBeNull();
    expect(isSessionMfaPending).not.toHaveBeenCalled();
  });

  it('enforceMfaGate returns null when session MFA is not pending', async () => {
    vi.mocked(isSessionMfaPending).mockResolvedValue(false);
    const req = new NextRequest('http://localhost/dashboard');
    const res = await enforceMfaGate('sess-1', '/dashboard', req);
    expect(res).toBeNull();
  });

  it('enforceMfaGate returns 403 JSON for API routes when MFA is pending', async () => {
    vi.mocked(isSessionMfaPending).mockResolvedValue(true);
    const req = new NextRequest('http://localhost/api/billing');
    const res = await enforceMfaGate('sess-1', '/api/billing', req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it('enforceMfaGate redirects to /auth/mfa-challenge for page routes when MFA is pending', async () => {
    vi.mocked(isSessionMfaPending).mockResolvedValue(true);
    const req = new NextRequest('http://localhost/dashboard');
    const res = await enforceMfaGate('sess-1', '/dashboard', req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('http://localhost/auth/mfa-challenge');
  });
});
