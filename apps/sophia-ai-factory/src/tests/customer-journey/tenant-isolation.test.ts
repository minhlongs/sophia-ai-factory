import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getCustomerUsageSummary } from '@/land/billing/customer-usage-summary';
import { encryptApiKey, decryptApiKey } from '@/tree/byok/byok-crypto';
import { recordPerformanceEventIdempotent } from '@/tree/performance/events';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { GET as getTickets, POST as postTickets } from '@/app/api/support/tickets/route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const TEST_MASTER_KEY = Buffer.from('12345678901234567890123456789012').toString('base64');

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDbRun = vi.fn();
const mockDbAll = vi.fn();
const mockDbFirst = vi.fn().mockResolvedValue({ version: 1 });
const mockDbBind = vi.fn(() => ({ run: mockDbRun, all: mockDbAll, first: mockDbFirst }));
const mockDbPrepare = vi.fn(() => ({ bind: mockDbBind, first: mockDbFirst }));
const mockSupabaseEq = vi.fn();
const mockSupabaseSelect = vi.fn(() => ({ eq: mockSupabaseEq }));
const mockSupabaseInsert = vi.fn();
const mockSupabaseFrom = vi.fn((table: string) => {
  if (table === 'support_tickets') {
    return { select: mockSupabaseSelect, insert: mockSupabaseInsert };
  }
  return { select: vi.fn(), insert: vi.fn() };
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: mockDbPrepare,
    from: mockSupabaseFrom,
  })),
  getD1: vi.fn(async () => ({
    prepare: mockDbPrepare,
  })),
}));

describe('Phase 9: Multi-Tenant Data Isolation & Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbFirst.mockResolvedValue({ version: 1 });
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY;
  });

  describe('Usage & Billing Event Tenant Isolation', () => {
    it('enforces strict user_id boundary and rejects queries with missing tenant ID', async () => {
      await expect(getCustomerUsageSummary('')).rejects.toThrow('TENANT_ID_REQUIRED');
    });

    it('guarantees Tenant A usage query binds strictly to Tenant A and ignores Tenant B', async () => {
      mockDbAll
        .mockResolvedValueOnce({
          results: [{ service_name: 'fal-ai-flux', credits_used: 2.0, created_at: 1720000000, status_code: 200 }],
        })
        .mockResolvedValueOnce({ results: [] });

      const reportA = await getCustomerUsageSummary('usr_tenant_alpha');

      expect(reportA.userId).toBe('usr_tenant_alpha');
      expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?1'));
      expect(mockDbBind).toHaveBeenCalledWith('usr_tenant_alpha', expect.any(Number), expect.any(Number));
      expect(reportA.totals.totalCredits).toBe(2.0);
    });
  });

  describe('Cryptographic & Query BYOK Key Isolation', () => {
    it('prevents cross-tenant key decryption via AES-GCM-256 AAD binding', async () => {
      const plainKey = 'sk-or-v1-secret-token-for-tenant-a';
      const packedBytes = await encryptApiKey(plainKey, 'usr_tenant_alpha');

      // Decryption with owner tenant succeeds
      const decryptedA = await decryptApiKey(packedBytes, 'usr_tenant_alpha');
      expect(decryptedA).toBe(plainKey);

      // Decryption with malicious Tenant B context MUST fail to match plainKey
      let tenantBLeaked = false;
      try {
        const decryptedB = await decryptApiKey(packedBytes, 'usr_tenant_bravo');
        if (decryptedB === plainKey) tenantBLeaked = true;
      } catch {
        tenantBLeaked = false;
      }
      expect(tenantBLeaked).toBe(false);
    });
  });

  describe('Support Ticket Cross-Tenant Isolation', () => {
    it('restricts ticket listings strictly to the authenticated session tenant', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_tenant_alpha' } as never);
      mockSupabaseEq.mockResolvedValue({
        data: [{ id: 't-1', user_id: 'usr_tenant_alpha', title: 'Issue A' }],
        error: null,
      });

      const req = new NextRequest('http://localhost/api/support/tickets');
      const res = await getTickets(req);
      expect(res.status).toBe(200);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('support_tickets');
      expect(mockSupabaseSelect).toHaveBeenCalledWith('*');
      expect(mockSupabaseEq).toHaveBeenCalledWith('user_id', 'usr_tenant_alpha');
    });

    it('forces ticket creation user_id to session tenant, ignoring spoof attempts', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_tenant_alpha' } as never);
      mockSupabaseInsert.mockResolvedValue({ error: null });

      const req = new NextRequest('http://localhost/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Help Needed',
          description: 'Cannot connect my API key for video generation',
          user_id: 'usr_tenant_bravo_spoofed',
        }),
      });

      const res = await postTickets(req);
      expect(res.status).toBe(201);
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'usr_tenant_alpha' }),
      );
    });
  });

  describe('Idempotency of Usage & Performance Events', () => {
    it('prevents duplicate event counts and charges on retry via INSERT OR IGNORE', async () => {
      mockDbRun
        .mockResolvedValueOnce({ meta: { changes: 1 } })
        .mockResolvedValueOnce({ meta: { changes: 0 } });

      const eventPayload: PerformanceEvent = {
        id: 'evt_idempotent_test_001',
        workspaceId: 'ws_tenant_alpha',
        assetId: 'ast_001',
        projectId: 'prj_001',
        entityType: 'asset',
        entityId: 'ent_001',
        eventType: 'video.render.completed',
        channel: 'youtube',
        count: 1,
        valueCents: 150,
        recordedAt: Date.now(),
      };

      const firstInsert = await recordPerformanceEventIdempotent(eventPayload);
      expect(firstInsert).toBe(true);

      const retryInsert = await recordPerformanceEventIdempotent(eventPayload);
      expect(retryInsert).toBe(false);

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO performance_events'),
      );
    });
  });
});
