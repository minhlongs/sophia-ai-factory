/**
 * Violations API Tests
 *
 * Tests for GET /api/violations endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/analytics/rbac', () => ({
  verifyLicenseAccess: vi.fn(),
  getUserLicenseNonce: vi.fn(),
  checkAdmin: vi.fn(),
}));

vi.mock('@/lib/analytics/queries', () => ({
  fetchViolations: vi.fn(),
  fetchViolationSummary: vi.fn(),
}));

vi.mock('@/lib/security/api-key-validator', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('@/lib/security/jwt-validator', () => ({
  validateJwt: vi.fn(),
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

import { GET } from './route';
import { getCurrentUser } from '@/lib/auth';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/lib/analytics/rbac';
import { fetchViolations, fetchViolationSummary } from '@/lib/analytics/queries';
import { validateApiKey } from '@/lib/security/api-key-validator';
import { validateJwt } from '@/lib/security/jwt-validator';
import { checkRateLimit } from '@/lib/security/rate-limiter';

describe('Violations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      (validateJwt as any).mockResolvedValue({ valid: false });
      (validateApiKey as any).mockResolvedValue({ valid: false });

      const request = new NextRequest(new URL('http://localhost:3000/api/violations'));
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('authentication required');
    });

    it('should accept valid JWT token', async () => {
      (validateJwt as any).mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      (getCurrentUser as any).mockResolvedValue({ id: 'user-123', tier: 'BASIC' });
      (checkAdmin as any).mockResolvedValue(false);
      (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 99 });
      (getUserLicenseNonce as any).mockResolvedValue('license-abc');
      (fetchViolations as any).mockResolvedValue({ violations: [], total: 0, hasMore: false });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 0,
        byType: {},
        bySeverity: {},
        byTier: {},
        resolvedCount: 0,
        unresolvedCount: 0,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations'),
        {
          headers: { authorization: 'Bearer valid-token' },
        }
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should accept valid API key', async () => {
      (validateJwt as any).mockResolvedValue({ valid: false });
      (validateApiKey as any).mockResolvedValue({
        valid: true,
        apiKey: { ownerId: 'user-456', keyId: 'key-789', rateLimitPerMinute: 100 },
      });
      (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 99 });
      (fetchViolations as any).mockResolvedValue({ violations: [], total: 0, hasMore: false });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 0,
        byType: {},
        bySeverity: {},
        byTier: {},
        resolvedCount: 0,
        unresolvedCount: 0,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations'),
        {
          headers: { 'x-api-key': 'mk_valid-key' },
        }
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should reject requests when rate limit exceeded', async () => {
      (validateJwt as any).mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      (getCurrentUser as any).mockResolvedValue({ id: 'user-123', tier: 'BASIC' });
      (checkAdmin as any).mockResolvedValue(false);
      (checkRateLimit as any).mockResolvedValue({ allowed: false, retryAfter: 30 });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations'),
        {
          headers: { authorization: 'Bearer valid-token' },
        }
      );
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.retryAfter).toBe(30);
    });
  });

  describe('Query Validation', () => {
    beforeEach(() => {
      (validateJwt as any).mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      (getCurrentUser as any).mockResolvedValue({ id: 'user-123', tier: 'BASIC' });
      (checkAdmin as any).mockResolvedValue(false);
      (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 99 });
    });

    it('should reject invalid severity values', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations?severity=invalid')
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject invalid violation types', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations?type=invalid')
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('should reject date range exceeding 90 days', async () => {
      const now = Math.floor(Date.now() / 1000);
      const ninetyOneDaysAgo = now - (91 * 86400);

      const request = new NextRequest(
        new URL(`http://localhost:3000/api/violations?start=${ninetyOneDaysAgo}&end=${now}`)
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('90 days');
    });

    it('should cap limit to 100', async () => {
      (getUserLicenseNonce as any).mockResolvedValue('license-abc');
      (fetchViolations as any).mockResolvedValue({ violations: [], total: 0, hasMore: false });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 0,
        byType: {},
        bySeverity: {},
        byTier: {},
        resolvedCount: 0,
        unresolvedCount: 0,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations?limit=500')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Verify fetchViolations was called with limit=100
      // Note: page defaults to '1' (string) because Zod .default() bypasses transform
      expect(fetchViolations).toHaveBeenCalledWith(expect.anything(), '1', 100);
    });
  });

  describe('RBAC', () => {
    beforeEach(() => {
      (validateJwt as any).mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      (getCurrentUser as any).mockResolvedValue({ id: 'user-123', tier: 'BASIC' });
      (checkAdmin as any).mockResolvedValue(false);
      (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 99 });
    });

    it('should reject users querying other users violations', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations?userId=other-user')
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should auto-inject user license nonce if not provided', async () => {
      (getUserLicenseNonce as any).mockResolvedValue('license-abc');
      (fetchViolations as any).mockResolvedValue({ violations: [], total: 0, hasMore: false });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 0,
        byType: {},
        bySeverity: {},
        byTier: {},
        resolvedCount: 0,
        unresolvedCount: 0,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations')
      );
      await GET(request);

      expect(getUserLicenseNonce).toHaveBeenCalledWith('user-123');
      expect(fetchViolations).toHaveBeenCalledWith(
        expect.objectContaining({ licenseNonce: 'license-abc' }),
        expect.anything(),
        expect.anything()
      );
    });

    it('should allow admins to query any user', async () => {
      (checkAdmin as any).mockResolvedValue(true);
      (fetchViolations as any).mockResolvedValue({ violations: [], total: 0, hasMore: false });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 0,
        byType: {},
        bySeverity: {},
        byTier: {},
        resolvedCount: 0,
        unresolvedCount: 0,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations?userId=other-user')
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    beforeEach(() => {
      (validateJwt as any).mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      (getCurrentUser as any).mockResolvedValue({ id: 'user-123', tier: 'BASIC' });
      (checkAdmin as any).mockResolvedValue(false);
      (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 99 });
      (getUserLicenseNonce as any).mockResolvedValue('license-abc');
    });

    it('should return paginated violations with summary', async () => {
      const mockViolations = [
        {
          id: 'v1',
          type: 'quota_exceeded' as const,
          severity: 'high' as const,
          userId: 'user-123',
          licenseNonce: 'license-abc',
          tier: 'BASIC',
          endpoint: '/api/v1/usage',
          createdAt: Date.now(),
          resolved: false,
        },
      ];

      (fetchViolations as any).mockResolvedValue({
        violations: mockViolations,
        total: 1,
        hasMore: false,
      });
      (fetchViolationSummary as any).mockResolvedValue({
        totalViolations: 1,
        byType: { quota_exceeded: 1 },
        bySeverity: { high: 1 },
        byTier: { BASIC: 1 },
        resolvedCount: 0,
        unresolvedCount: 1,
        trend: [],
      });

      const request = new NextRequest(
        new URL('http://localhost:3000/api/violations')
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('violations');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('metadata');

      expect(data.pagination).toEqual({
        // page defaults to '1' (string) when not provided — Zod .default() bypasses transform
        page: '1',
        limit: 50,
        total: 1,
        hasMore: false,
      });

      expect(data.summary.totalViolations).toBe(1);
    });
  });
});
