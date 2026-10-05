import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/tree/missions/api-key-auth', () => ({
  validateMissionApiKey: vi.fn(),
  apiKeyAuthErrorResponse: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  deductCredits: vi.fn(),
  getBalance: vi.fn(),
}));

import { validateMissionApiKey } from '@/tree/missions/api-key-auth';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';

describe('POST /api/v1/credits/consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(validateMissionApiKey).mockResolvedValue({ valid: false });
    const req = new NextRequest('http://localhost/api/v1/credits/consume', {
      method: 'POST',
      body: JSON.stringify({ amount: 10 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects invalid amounts with 400', async () => {
    vi.mocked(validateMissionApiKey).mockResolvedValue({ valid: true, userId: 'usr_123' });
    const req = new NextRequest('http://localhost/api/v1/credits/consume', {
      method: 'POST',
      body: JSON.stringify({ amount: -5 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('Invalid amount');
  });

  it('returns 402 when credits are insufficient', async () => {
    vi.mocked(validateMissionApiKey).mockResolvedValue({ valid: true, userId: 'usr_123' });
    vi.mocked(deductCredits).mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/v1/credits/consume', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(402);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe('Insufficient credits');
  });

  it('deducts credits and returns remaining balance on success', async () => {
    vi.mocked(validateMissionApiKey).mockResolvedValue({ valid: true, userId: 'usr_123' });
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(getBalance).mockResolvedValue({
      credits_remaining: 90,
      credits_total_purchased: 100,
      credits_total_used: 10,
    });

    const req = new NextRequest('http://localhost/api/v1/credits/consume', {
      method: 'POST',
      body: JSON.stringify({ amount: 10, reason: 'test_run' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.credits_consumed).toBe(10);
    expect(data.credits_remaining).toBe(90);
  });
});
