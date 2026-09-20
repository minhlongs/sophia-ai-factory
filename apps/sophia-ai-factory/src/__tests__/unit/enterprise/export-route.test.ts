/**
 * Unit & Integration Tests for Analytics Export API Route (/api/v1/analytics/export).
 *
 * Covers:
 * 1. Authentication guard (401 when unauthenticated)
 * 2. Organization context resolution (403 when no org)
 * 3. Multi-tenant isolation guard (403 CROSS_TENANT_VIOLATION on mismatch)
 * 4. Input validation (400 on invalid format or date range)
 * 5. Successful streaming GET and POST exports
 *
 * @module __tests__/unit/enterprise/export-route.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetCurrentUser, mockResolveOrgId, mockGetD1 } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: mockResolveOrgId,
}));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/db/client')>();
  return {
    ...actual,
    getD1: mockGetD1,
  };
});

import { GET, POST } from '@/app/api/v1/analytics/export/route';

describe('Analytics Export Route (/api/v1/analytics/export)', () => {
  const mockUser = { id: 'user_123', email: 'owner@agency.com', role: 'admin' };
  const userOrgId = 'org_alpha';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockResolveOrgId.mockResolvedValue(userOrgId);

    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'bi_1',
            org_id: userOrgId,
            period_start: 1700000000000,
            period_end: 1702592000000,
            mrr_cents: 300000,
            throughput_count: 50,
            viral_score: 85,
            affiliate_revenue_cents: 600000,
            marketing_spend_cents: 150000,
            created_at: 1700000000000,
          },
        ],
      }),
      first: vi.fn().mockResolvedValue(null),
    };

    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    };
    mockGetD1.mockResolvedValue(mockDb);
  });

  describe('1. Authentication & Tenant Guards', () => {
    it('returns 401 UNAUTHORIZED when session is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('returns 503 DB_UNAVAILABLE when database connection fails', async () => {
      mockGetD1.mockResolvedValue(null);

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export');
      const res = await GET(req);

      expect(res.status).toBe(503);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('DB_UNAVAILABLE');
    });

    it('returns 403 FORBIDDEN when user has no active organization context', async () => {
      mockResolveOrgId.mockResolvedValue(null);

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('FORBIDDEN');
    });

    it('returns 403 CROSS_TENANT_VIOLATION when attempting to export another org data', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/v1/analytics/export?org_id=org_competitor',
      );
      const res = await GET(req);

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('CROSS_TENANT_VIOLATION');
    });
  });

  describe('2. Input Validation', () => {
    it('returns 400 on unsupported format', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/v1/analytics/export?format=xml',
      );
      const res = await GET(req);

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('INVALID_FORMAT');
    });

    it('returns 400 when start timestamp is greater than end timestamp', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/v1/analytics/export?start=20000&end=10000',
      );
      const res = await GET(req);

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('3. Successful Streaming Export', () => {
    it('handles GET request and streams CSV response', async () => {
      const req = new NextRequest(
        `https://sophia.agencyos.network/api/v1/analytics/export?format=csv&org_id=${userOrgId}`,
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      expect(res.body).toBeDefined();
    });

    it('handles POST request with body parameters and streams JSON response', async () => {
      const req = new NextRequest('https://sophia.agencyos.network/api/v1/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'json',
          orgId: userOrgId,
          start: 1700000000000,
          end: 1702592000000,
        }),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');
      expect(res.body).toBeDefined();
    });
  });
});
