/**
 * Internal Usage Query API Tests
 *
 * Tests for /api/internal/usage/query endpoint:
 * - Access control (internal secret validation)
 * - Query by license_nonce
 * - Query by external_customer_id
 * - Aggregation formats
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { GET } from '@/app/api/internal/usage/query/route';
import { NextRequest } from 'next/server';

// Mock environment
vi.mock('next/server', () => {
  const actual = vi.importActual('next/server');
  return {
    ...actual,
    NextResponse: {
      json: (data: any, init?: any) => ({
        status: init?.status || 200,
        body: data,
      }),
    },
  };
});

// Mock Supabase
const mockSupabaseData = { data: null, error: null };
let mockSupabaseSingleResult: any = null;
let mockSupabaseQueryResult: any = { data: [], error: null };

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => ({
      select: vi.fn((columns?: string) => {
        // Create a mock query builder that supports fluent chaining
        const mockQueryBuilder = {
          eq: vi.fn(function(this: any, column: string, value: any) {
            // Support both single() queries and list queries
            if (column === 'nonce' || column === 'polar_customer_id' || column === 'stripe_customer_id') {
              // This is a license lookup query - return single()
              return {
                single: vi.fn(() => Promise.resolve(mockSupabaseSingleResult || mockSupabaseData)),
              };
            }
            // This is a list query - allow chaining more eq/gte/lte calls
            return mockQueryBuilder;
          }),
          gte: vi.fn(function(this: any) {
            return mockQueryBuilder;
          }),
          lte: vi.fn(function(this: any) {
            // Final call in the chain - return awaitable result
            return Promise.resolve(mockSupabaseQueryResult);
          }),
          order: vi.fn(function(this: any) {
            return mockQueryBuilder;
          }),
          ascending: vi.fn(function(this: any) {
            return Promise.resolve(mockSupabaseQueryResult);
          }),
        };
        return mockQueryBuilder;
      }),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
    })),
  }),
}));

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Internal Usage Query API - Access Control', () => {
  const createMockRequest = (searchParams: Record<string, string> = {}, headers: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    const requestHeaders = new Headers(headers);

    return {
      nextUrl: {
        searchParams: params,
      },
      headers: requestHeaders,
    } as unknown as NextRequest;
  };

  it('rejects request without x-internal-secret header', async () => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: 'test-secret',
      },
    });

    const request = createMockRequest({ license_nonce: 'test-license' });
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect((response.body as any).error).toContain('Unauthorized');
  });

  it('rejects request with invalid secret', async () => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: 'test-secret',
      },
    });

    const request = createMockRequest(
      { license_nonce: 'test-license' },
      { 'x-internal-secret': 'wrong-secret' }
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect((response.body as any).error).toContain('Unauthorized');
  });

  it('rejects when INTERNAL_WEBHOOK_SECRET is not configured', async () => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: undefined,
      },
    });

    const request = createMockRequest({ license_nonce: 'test-license' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

describe('Internal Usage Query API - Query Validation', () => {
  beforeEach(() => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: 'test-secret',
      },
    });
    mockSupabaseSingleResult = null;
  });

  const createAuthorizedRequest = (searchParams: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    const headers = new Headers();
    headers.set('x-internal-secret', 'test-secret');

    return {
      nextUrl: {
        searchParams: params,
      },
      headers,
    } as unknown as NextRequest;
  };

  it('requires license_nonce or external_customer_id', async () => {
    const request = createAuthorizedRequest({
      start: '1709856000',
      end: '1710028800',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toContain('Missing required param');
  });

  it('rejects both license_nonce and external_customer_id together', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      external_customer_id: 'cus_123',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toContain('Cannot specify both');
  });

  it('rejects invalid start timestamp', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      start: 'invalid',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toContain('Invalid start timestamp');
  });

  it('rejects invalid end timestamp', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      start: '1709856000',
      end: 'invalid',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toContain('Invalid end timestamp');
  });

  it('rejects start > end', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      start: '1710028800',
      end: '1709856000',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toBe('start must be before end');
  });

  it('rejects date range > 90 days', async () => {
    const ninetyOneDays = 91 * 86400;
    const end = 1710028800;
    const start = end - ninetyOneDays;

    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      start: start.toString(),
      end: end.toString(),
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect((response.body as any).error).toContain('Date range exceeds maximum');
  });
});

describe('Internal Usage Query API - License Lookup', () => {
  beforeEach(() => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: 'test-secret',
      },
    });
  });

  const createAuthorizedRequest = (searchParams: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    const headers = new Headers();
    headers.set('x-internal-secret', 'test-secret');

    return {
      nextUrl: {
        searchParams: params,
      },
      headers,
    } as unknown as NextRequest;
  };

  it('returns 404 for non-existent license', async () => {
    mockSupabaseSingleResult = { data: null, error: { message: 'Not found' } };

    const request = createAuthorizedRequest({
      license_nonce: 'non-existent-license',
    });

    const response = await GET(request);

    expect(response.status).toBe(404);
    expect((response.body as any).error).toContain('License not found');
  });

  it('returns 404 for non-existent external customer', async () => {
    mockSupabaseSingleResult = { data: null, error: { message: 'Not found' } };

    const request = createAuthorizedRequest({
      external_customer_id: 'cus_nonexistent',
    });

    const response = await GET(request);

    expect(response.status).toBe(404);
    expect((response.body as any).error).toContain('No license found');
  });
});

describe('Internal Usage Query API - Successful Queries', () => {
  beforeEach(() => {
    vi.stubGlobal('process', {
      env: {
        INTERNAL_WEBHOOK_SECRET: 'test-secret',
      },
    });

    // Mock successful license lookup
    mockSupabaseSingleResult = {
      data: {
        nonce: 'test-license',
        tier: 'PREMIUM',
        created_by: 'user-123',
      },
      error: null,
    };

    // Mock successful query result with empty events (since we're not testing actual data aggregation)
    mockSupabaseQueryResult = { data: [], error: null };
  });

  const createAuthorizedRequest = (searchParams: Record<string, string> = {}) => {
    const params = new URLSearchParams(searchParams);
    const headers = new Headers();
    headers.set('x-internal-secret', 'test-secret');

    return {
      nextUrl: {
        searchParams: params,
      },
      headers,
    } as unknown as NextRequest;
  };

  it('returns summary format by default', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect((response.body as any).tenantId).toBe('user-123');
    expect((response.body as any).licenseNonce).toBe('test-license');
    expect((response.body as any).totals).toBeDefined();
    expect((response.body as any).byService).toBeDefined();
  });

  it('returns raw format when requested', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
      format: 'raw',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect((response.body as any).rawEvents).toBeDefined();
    expect((response.body as any).count).toBeDefined();
  });

  it('uses default billing period when dates not provided', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect((response.body as any).period).toBeDefined();
    expect((response.body as any).period.start).toBeDefined();
    expect((response.body as any).period.end).toBeDefined();
  });

  it('includes quota usage in response', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect((response.body as any).quotaUsage).toBeDefined();
    expect((response.body as any).quotaUsage.hourlyLimit).toBeDefined();
    expect((response.body as any).quotaUsage.dailyLimit).toBeDefined();
    expect((response.body as any).quotaUsage.monthlyLimit).toBeDefined();
  });

  it('includes tier information from license', async () => {
    const request = createAuthorizedRequest({
      license_nonce: 'test-license',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect((response.body as any).tier).toBe('PREMIUM');
  });
});
