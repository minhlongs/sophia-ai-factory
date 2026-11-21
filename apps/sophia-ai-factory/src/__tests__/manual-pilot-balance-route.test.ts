// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';
import type { ApiKeyAuthResult } from '@/tree/missions/api-key-auth-helpers';
import type { McuBalance, McuTransactionRow } from '@/tree/mcu/credits-queries';

const mocks = vi.hoisted(() => ({
  auth: vi.fn<(authorization: string | null, apiKey: string | null) => Promise<ApiKeyAuthResult>>(),
  balance: vi.fn<(userId: string, orgId?: string) => Promise<McuBalance>>(),
  transactions: vi.fn<(userId: string, limit?: number) => Promise<McuTransactionRow[]>>(),
}));

vi.mock('@/tree/missions/api-key-auth', async () => ({
  validateMissionApiKey: mocks.auth,
  apiKeyAuthErrorResponse: (await import('@/tree/missions/api-key-auth-helpers')).apiKeyAuthErrorResponse,
}));
vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: mocks.balance,
  listTransactions: mocks.transactions,
}));
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (request: NextRequest) => Promise<NextResponse>) => handler,
}));

import { GET } from '@/app/api/v1/credits/route';

const balance: McuBalance = {
  credits_remaining: 1400,
  credits_total_purchased: 900,
  credits_total_used: 0,
};
const transactions: McuTransactionRow[] = [{
  id: 'transaction', delta: -10, reason: 'test', mission_id: 'mission', created_at: 1,
}];

function request() {
  return new NextRequest('https://local/api/v1/credits?orgId=caller-selected-org', {
    headers: { authorization: 'Bearer fixture-key', 'x-api-key': 'fixture-key', 'x-org-id': 'caller-selected-org' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ valid: true, userId: 'customer', orgId: 'pilot-org', authKind: 'api_key' });
  mocks.balance.mockResolvedValue(balance);
  mocks.transactions.mockResolvedValue(transactions);
});

describe('manual pilot balance route tenant boundary', () => {
  it.each(['pilot-org', 'other-org'])('forwards only the authenticated %s scope and preserves the response', async orgId => {
    mocks.auth.mockResolvedValue({ valid: true, userId: 'customer', orgId, authKind: 'api_key' });
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith('Bearer fixture-key', 'fixture-key');
    expect(mocks.balance).toHaveBeenCalledExactlyOnceWith('customer', orgId);
    expect(mocks.transactions).toHaveBeenCalledExactlyOnceWith('customer', 20);
    expect(await response.json()).toEqual({ ...balance, recent_transactions: transactions });
  });

  it.each(['api_key', 'session'] as const)('preserves unscoped %s access without trusting a caller tenant', async authKind => {
    mocks.auth.mockResolvedValue({ valid: true, userId: 'customer', authKind });
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.balance).toHaveBeenCalledExactlyOnceWith('customer', undefined);
    expect(mocks.transactions).toHaveBeenCalledExactlyOnceWith('customer', 20);
  });

  it.each([
    ['missing_credentials', 401], ['invalid_key', 401], ['inactive', 403], ['db_unreachable', 503],
  ] as const)('preserves %s authentication failures without wallet reads', async (errorType, status) => {
    mocks.auth.mockResolvedValue({ valid: false, error: 'Authentication denied', errorType });
    const response = await GET(request());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: 'Authentication denied' });
    expect(mocks.balance).not.toHaveBeenCalled();
    expect(mocks.transactions).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])('rejects an absent or empty user principal (%s) even with an authenticated tenant', async userId => {
    mocks.auth.mockResolvedValue({ valid: true, userId, orgId: 'pilot-org', authKind: 'api_key' });
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authenticated user principal required' });
    expect(mocks.balance).not.toHaveBeenCalled();
    expect(mocks.transactions).not.toHaveBeenCalled();
  });
});
