/**
 * Tests for POST /api/admin/audit/deploy
 *
 * Verifies:
 * - Requires CRON_SECRET authentication
 * - Accepts valid DEPLOY payload
 * - Inserts entry with hash chain fields
 * - Rejects invalid payloads
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

import { verifyCronAuth } from '@/seed/security/cron-auth';
import { createServerClient } from '@/seed/db/client';
import { POST } from '../route';

const mockVerifyCronAuth = vi.mocked(verifyCronAuth);
const mockCreateServerClient = vi.mocked(createServerClient);

function createDeployRequest(body: Record<string, unknown>): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/audit/deploy');
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

const validDeployBody = {
  event: 'DEPLOY',
  commit_sha: 'abc123def456',
  branch: 'main',
  timestamp: '2026-06-17T12:00:00Z',
  operator_host: 'MacBook-Pro',
  operator_user: 'longtho',
  diff_summary: '123 files changed',
  files_changed: 123,
  manifest: {
    commit_sha: 'abc123def456',
    branch: 'main',
    operator_host: 'MacBook-Pro',
  },
};

describe('POST /api/admin/audit/deploy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronAuth.mockReturnValue(null); // auth ok by default
  });

  describe('Authentication', () => {
    it('should return 401 when cron auth fails', async () => {
      mockVerifyCronAuth.mockReturnValue(new Response('Unauthorized', { status: 401 }) as any);

      const request = createDeployRequest(validDeployBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Payload Validation', () => {
    it('should return 400 when event is not DEPLOY', async () => {
      const request = createDeployRequest({
        ...validDeployBody,
        event: 'OTHER',
      });
      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await getJson(response);
      expect(data.error).toContain('Invalid payload');
    });

    it('should return 400 when commit_sha missing', async () => {
      const { event, commit_sha, ...rest } = validDeployBody;
      const request = createDeployRequest({ event, ...rest });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Deploy Audit Logging', () => {
    it('should insert audit log and return success with hash chain data', async () => {
      // Create a mock that satisfies the chain without complex typing
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { content_hash: 'prev_hash_abc' },
        error: null,
      });

      const singleMock = vi.fn().mockResolvedValue({
        data: { id: 'audit-123' },
        error: null,
      });

      // Build chain-returning mock using any to bypass TS
      const chainMock: any = {
        select: vi.fn(function(this: any) { return this; }),
        order: vi.fn(function(this: any) { return this; }),
        limit: vi.fn(function(this: any) { return this; }),
        maybeSingle: maybeSingleMock,
        insert: vi.fn(function(this: any) { return this; }),
        single: singleMock,
      };

      const mockDb: any = { from: vi.fn(() => chainMock) };
      mockCreateServerClient.mockReturnValue(mockDb);

      const request = createDeployRequest(validDeployBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await getJson(response);
      expect(data.success).toBe(true);
      expect(data.auditLogId).toBe('audit-123');
      expect(data.previousHash).toBe('prev_hash_abc');
      expect(typeof data.contentHash).toBe('string');
      expect(data.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty previous hash (first entry)', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const singleMock = vi.fn().mockResolvedValue({ data: { id: 'audit-456' }, error: null });
      const chainMock: any = {
        select: vi.fn(function(this: any) { return this; }),
        order: vi.fn(function(this: any) { return this; }),
        limit: vi.fn(function(this: any) { return this; }),
        maybeSingle: maybeSingleMock,
        insert: vi.fn(function(this: any) { return this; }),
        single: singleMock,
      };
      const mockDb: any = { from: vi.fn(() => chainMock) };
      mockCreateServerClient.mockReturnValue(mockDb);

      const request = createDeployRequest(validDeployBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await getJson(response);
      expect(data.success).toBe(true);
      expect(data.previousHash).toBeNull();
    });
  });
});
