import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminWithRecentAuth: vi.fn(),
  setPlatformConfig: vi.fn(),
}));

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdminWithRecentAuth: mocks.requireAdminWithRecentAuth,
}));
vi.mock('@/seed/db/platform-config-repo', () => ({
  getPlatformConfig: vi.fn(),
  setPlatformConfig: mocks.setPlatformConfig,
}));

import { POST } from './route';

function adminRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/platform-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'honeycomb_dataset', value: 'telemetry-prod' }),
  });
}

describe('POST /api/admin/platform-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminWithRecentAuth.mockResolvedValue({ user: { id: 'admin-1' } });
  });

  it('reports success when the value is persisted', async () => {
    mocks.setPlatformConfig.mockResolvedValue(true);

    const response = await POST(adminRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(mocks.setPlatformConfig).toHaveBeenCalledWith('honeycomb_dataset', 'telemetry-prod', 'admin-1');
  });

  it('rejects with 503 when the store is unavailable instead of reporting success', async () => {
    mocks.setPlatformConfig.mockResolvedValue(false);

    const response = await POST(adminRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.not.toMatchObject({ success: true });
  });

  it('rejects with 500 when persisting throws', async () => {
    mocks.setPlatformConfig.mockRejectedValue(new Error('D1 write failed'));

    const response = await POST(adminRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.not.toMatchObject({ success: true });
  });

  it('rejects an unknown config key before touching the store', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'affiliate_kill_switch_active', value: 'true' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.setPlatformConfig).not.toHaveBeenCalled();
  });
});
