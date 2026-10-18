import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireAdminMock, createServerClientMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/seed/auth/admin', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/seed/db/client', () => ({ createServerClient: createServerClientMock }));

const { GET, POST } = await import('./route');

describe('/api/onboarding authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
    );
  });

  it('denies a non-admin GET before loading a tenant record', async () => {
    const response = await GET(
      new NextRequest('https://example.test/api/onboarding?tenantId=tenant-victim'),
    );

    expect(response.status).toBe(403);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('denies a non-admin POST before writing tenant onboarding data', async () => {
    const response = await POST(
      new NextRequest('https://example.test/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-victim',
          tenantName: 'Attacker overwrite',
          ceoEmail: 'attacker@example.test',
          ceoName: 'Attacker',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
